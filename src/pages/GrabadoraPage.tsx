import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Save,
  Square,
} from 'lucide-react';
import { useAudioStudy } from '../app/AudioStudyContext';
import {
  explainMicrophoneError,
  isRecordingSupported,
  MicrophoneErrorInfo,
  requestMicrophoneStream,
} from '../services/permissions/microphoneService';
import {
  formatDateTimeEs,
  formatDuration,
  generateNextAutoTitle,
  pickSupportedRecorderMimeType,
} from '../utils/audioUtils';

type RecorderStage = 'idle' | 'recording' | 'paused' | 'preview' | 'saving' | 'saved';

export const GrabadoraPage: React.FC = () => {
  const {
    subjects,
    topics,
    playlists,
    tracks,
    selectedPlaylistId,
    setSelectedPlaylistId,
    createDirectPlaylist,
    saveNewRecording,
    pausePlayback,
    playback,
    showBanner,
    setActiveSection,
  } = useAudioStudy();

  const [stage, setStage] = useState<RecorderStage>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [titleInput, setTitleInput] = useState('');
  const [targetPlaylistId, setTargetPlaylistId] = useState<string>(selectedPlaylistId || '');
  const [destinationMode, setDestinationMode] = useState<'existing' | 'new'>(
    playlists.length > 0 ? 'existing' : 'new'
  );
  const [micError, setMicError] = useState<MicrophoneErrorInfo | null>(null);
  const [interruptionWarning, setInterruptionWarning] = useState<string | null>(null);
  const [saveStateLabel, setSaveStateLabel] = useState<string>('Listo para grabar');
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedMimeType, setRecordedMimeType] = useState<string>('audio/webm');
  const [recordedAt, setRecordedAt] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [supportsPause, setSupportsPause] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);

  // Creación directa de playlist (Materia y Tema opcionales)
  const [quickSubjectName, setQuickSubjectName] = useState('');
  const [quickTopicName, setQuickTopicName] = useState('');
  const [quickPlaylistName, setQuickPlaylistName] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtMsRef = useRef<number>(0);
  const accumulatedMsRef = useRef<number>(0);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const interruptedRef = useRef(false);

  useEffect(() => {
    if (playlists.length === 0) {
      setTargetPlaylistId('');
      setDestinationMode('new');
      return;
    }

    const selectedValid = selectedPlaylistId && playlists.some((p) => p.id === selectedPlaylistId);
    const targetValid = targetPlaylistId && playlists.some((p) => p.id === targetPlaylistId);

    if (selectedValid && selectedPlaylistId !== targetPlaylistId) {
      setTargetPlaylistId(selectedPlaylistId);
      setDestinationMode('existing');
    } else if (!targetValid) {
      setTargetPlaylistId(selectedValid ? selectedPlaylistId : playlists[0].id);
      setDestinationMode('existing');
    }
  }, [playlists, selectedPlaylistId, targetPlaylistId]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (analyserRafRef.current) cancelAnimationFrame(analyserRafRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      void audioCtxRef.current?.close();
    };
  }, [previewUrl]);

  const autoSuggestedTitle = useMemo(() => generateNextAutoTitle(tracks), [tracks]);

  const cleanupRecordingResources = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (analyserRafRef.current) {
      cancelAnimationFrame(analyserRafRef.current);
      analyserRafRef.current = null;
    }
    setAudioLevel(0);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  };

  const startTimerLoop = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    startedAtMsRef.current = Date.now();
    timerRef.current = window.setInterval(() => {
      const totalMs = accumulatedMsRef.current + (Date.now() - startedAtMsRef.current);
      setElapsedSec(totalMs / 1000);
    }, 100);
  };

  const startLevelMeter = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length / 255;
        setAudioLevel(Math.min(1, avg * 1.8));
        analyserRafRef.current = requestAnimationFrame(tick);
      };
      analyserRafRef.current = requestAnimationFrame(tick);
    } catch {
      // Medidor visual opcional si el navegador restringe AudioContext
    }
  };

  const handleStartRecording = async () => {
    setMicError(null);
    setInterruptionWarning(null);
    interruptedRef.current = false;

    if (!isRecordingSupported()) {
      setMicError(explainMicrophoneError(new Error('Unsupported')));
      return;
    }

    // Evitar reproducir un audio mientras se graba otro
    if (playback.status === 'playing') {
      pausePlayback();
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setRecordedBlob(null);
    chunksRef.current = [];
    accumulatedMsRef.current = 0;
    setElapsedSec(0);

    try {
      const stream = await requestMicrophoneStream();
      streamRef.current = stream;

      const { mimeType } = pickSupportedRecorderMimeType();
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      setSupportsPause(typeof recorder.pause === 'function' && typeof recorder.resume === 'function');

      const resolvedMime = recorder.mimeType || mimeType || 'audio/webm';
      setRecordedMimeType(resolvedMime);

      // Detectar interrupción física del micrófono (llamada, desconexión Bluetooth, etc.)
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.onended = () => {
          interruptedRef.current = true;
          setInterruptionWarning(
            'El micrófono se desconectó o fue interrumpido por otra aplicación. Verifica la vista previa antes de guardar.'
          );
          if (recorder.state !== 'inactive') {
            try {
              recorder.stop();
            } catch {
              // Ignorar si ya cerró
            }
          }
        };
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        interruptedRef.current = true;
        cleanupRecordingResources();
        setStage('idle');
        setSaveStateLabel('Grabación interrumpida por error');
        setInterruptionWarning(
          'Ocurrió un error al capturar el audio. No se guardó ningún archivo dañado.'
        );
      };

      recorder.onstop = () => {
        const finalDurationMs =
          accumulatedMsRef.current +
          (startedAtMsRef.current > 0 ? Date.now() - startedAtMsRef.current : 0);
        cleanupRecordingResources();

        const blob = new Blob(chunksRef.current, { type: resolvedMime });
        if (blob.size === 0 || finalDurationMs < 250) {
          setStage('idle');
          setSaveStateLabel('Grabación descartada por estar vacía');
          setInterruptionWarning(
            'La grabación fue demasiado corta o no recibió audio del micrófono. Intenta de nuevo.'
          );
          return;
        }

        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setPreviewUrl(url);
        setElapsedSec(finalDurationMs / 1000);
        setRecordedAt(Date.now());
        setStage('preview');
        setSaveStateLabel(
          interruptedRef.current
            ? 'Grabación interrumpida · Revisa la vista previa antes de guardar'
            : 'Vista previa lista · Sin guardar todavía'
        );
      };

      recorder.start(250);
      startTimerLoop();
      startLevelMeter(stream);
      setStage('recording');
      setSaveStateLabel('Grabando audio en curso');
    } catch (err) {
      cleanupRecordingResources();
      setMicError(explainMicrophoneError(err));
      setStage('idle');
      setSaveStateLabel('Permiso de micrófono requerido');
    }
  };

  const handlePauseRecording = () => {
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state !== 'recording') return;
    try {
      rec.pause();
      accumulatedMsRef.current += Date.now() - startedAtMsRef.current;
      startedAtMsRef.current = 0;
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setStage('paused');
      setSaveStateLabel('Grabación en pausa');
    } catch {
      setSupportsPause(false);
      showBanner('warning', 'Este navegador no permite pausar una grabación en curso.');
    }
  };

  const handleResumeRecording = () => {
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state !== 'paused') return;
    try {
      rec.resume();
      startTimerLoop();
      setStage('recording');
      setSaveStateLabel('Grabando audio en curso');
    } catch {
      showBanner('error', 'No se pudo reanudar la grabación.');
    }
  };

  const handleStopRecording = () => {
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state === 'inactive') return;
    if (rec.state === 'paused') {
      startedAtMsRef.current = 0;
    }
    rec.stop();
  };

  const handleDiscardAndReRecord = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setRecordedBlob(null);
    setRecordedAt(null);
    setElapsedSec(0);
    setInterruptionWarning(null);
    setStage('idle');
    setSaveStateLabel('Listo para grabar');
  };

  const handleSaveRecording = async () => {
    if (!recordedBlob) return;

    const finalTitle = titleInput.trim() || autoSuggestedTitle;
    setStage('saving');
    setSaveStateLabel('Guardando en almacenamiento local...');

    try {
      let resolvedPlaylistId = targetPlaylistId;
      let resolvedPlaylistName =
        playlists.find((p) => p.id === resolvedPlaylistId)?.name ?? '';

      if (destinationMode === 'new' || !resolvedPlaylistId || !playlists.some((p) => p.id === resolvedPlaylistId)) {
        const createdPl = await createDirectPlaylist(
          quickPlaylistName,
          quickSubjectName,
          quickTopicName
        );
        resolvedPlaylistId = createdPl.id;
        resolvedPlaylistName = createdPl.name;
        setTargetPlaylistId(createdPl.id);
        setSelectedPlaylistId(createdPl.id);
        setDestinationMode('existing');
        setQuickPlaylistName('');
        setQuickSubjectName('');
        setQuickTopicName('');
      }

      const saved = await saveNewRecording({
        playlistId: resolvedPlaylistId,
        title: finalTitle,
        durationSec: elapsedSec,
        blob: recordedBlob,
        mimeType: recordedMimeType,
      });

      setStage('saved');
      setSaveStateLabel(`Guardado como "${saved.title}" en "${resolvedPlaylistName}"`);
      setTitleInput('');
      showBanner(
        'success',
        `Grabación "${saved.title}" guardada directamente en la playlist "${resolvedPlaylistName}".`
      );
    } catch (err) {
      setStage('preview');
      setSaveStateLabel('Error al guardar');
      showBanner(
        'error',
        err instanceof Error
          ? err.message
          : 'No se pudo guardar la grabación. Verifica el espacio disponible.'
      );
    }
  };

  const togglePreviewAudio = () => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    if (isPreviewPlaying) {
      audio.pause();
      setIsPreviewPlaying(false);
    } else {
      void audio.play();
      setIsPreviewPlaying(true);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="border-b border-slate-200 dark:border-[#162C2E] pb-5">
        <h1 className="font-display text-2xl font-extrabold text-[#0B1C1E] dark:text-white">
          Grabadora de estudio
        </h1>
        <p className="text-sm text-slate-600 dark:text-[#9BB8B5] mt-1">
          El micrófono se solicita únicamente cuando presionas Comenzar a grabar.
        </p>
      </div>

      {/* Diagnóstico de error de micrófono o permisos */}
      {micError && (
        <div
          role="alert"
          className="rounded-2xl border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/50 p-5 space-y-3"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h2 className="text-base font-bold text-red-900 dark:text-red-100">
                {micError.title}
              </h2>
              <p className="text-sm text-red-800 dark:text-red-200">{micError.message}</p>
            </div>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-xs sm:text-sm text-red-900 dark:text-red-200 pl-1">
            {micError.instructions.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => void handleStartRecording()}
            className="rounded-xl bg-red-700 text-white px-4 py-2 text-xs font-bold min-h-[40px] cursor-pointer"
          >
            Intentar de nuevo
          </button>
        </div>
      )}

      {interruptionWarning && (
        <div
          role="status"
          className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-950 dark:text-amber-100"
        >
          {interruptionWarning}
        </div>
      )}

      {/* Panel principal de grabación */}
      <section className="rounded-2xl bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#193537] p-6 sm:p-8 space-y-6 text-center">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#0B7D6E] dark:text-[#14E3C3]">
            {saveStateLabel}
          </p>
          <div
            aria-live="polite"
            className="font-mono text-5xl sm:text-6xl font-bold tabular-nums tracking-tight text-slate-950 dark:text-white"
          >
            {formatDuration(elapsedSec)}
          </div>
          {recordedAt && stage === 'preview' && (
            <p className="text-xs text-slate-500 dark:text-[#8FB3B0]">
              Capturado el {formatDateTimeEs(recordedAt)}
            </p>
          )}
        </div>

        {/* Medidor discreto de nivel de entrada */}
        {(stage === 'recording' || stage === 'paused') && (
          <div className="max-w-xs mx-auto space-y-1.5" aria-hidden="true">
            <div className="h-2 rounded-full bg-slate-200 dark:bg-[#102628] overflow-hidden">
              <div
                className="h-full bg-[#0B7D6E] dark:bg-[#14E3C3] transition-transform duration-75 origin-left"
                style={{ transform: `scaleX(${stage === 'paused' ? 0.05 : Math.max(0.06, audioLevel)})` }}
              />
            </div>
          </div>
        )}

        {/* Controles principales */}
        {(stage === 'idle' || stage === 'saved') && (
          <div className="flex flex-col items-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => void handleStartRecording()}
              className="w-24 h-24 rounded-full bg-[#0B7D6E] dark:bg-[#14E3C3] text-white dark:text-[#060909] flex items-center justify-center shadow-lg hover:scale-[1.03] active:scale-[0.98] transition-transform cursor-pointer"
              aria-label="Comenzar grabación"
            >
              <Mic className="w-9 h-9" />
            </button>
            <span className="text-sm font-semibold text-slate-800 dark:text-[#D1E5E3]">
              Toca para empezar a grabar
            </span>
            {stage === 'saved' && targetPlaylistId && (
              <button
                type="button"
                onClick={() => setActiveSection('playlist')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0B7D6E] dark:text-[#14E3C3] hover:underline min-h-[40px] cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Ver grabación en la playlist</span>
              </button>
            )}
          </div>
        )}

        {(stage === 'recording' || stage === 'paused') && (
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            {supportsPause && (
              <button
                type="button"
                onClick={stage === 'recording' ? handlePauseRecording : handleResumeRecording}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-[#1E3F41] px-5 py-3 text-sm font-semibold text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-[#102A2C] min-h-[48px] cursor-pointer"
              >
                {stage === 'recording' ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>Pausar</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Reanudar</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleStopRecording}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 text-white px-6 py-3 text-sm font-bold hover:bg-red-700 min-h-[48px] cursor-pointer"
            >
              <Square className="w-4 h-4" />
              <span>Detener y revisar</span>
            </button>
          </div>
        )}

        {/* Vista previa y formulario de guardado */}
        {(stage === 'preview' || stage === 'saving') && previewUrl && (
          <div className="text-left space-y-5 pt-4 border-t border-slate-100 dark:border-[#152D2F]">
            <audio
              ref={previewAudioRef}
              src={previewUrl}
              onEnded={() => setIsPreviewPlaying(false)}
              className="hidden"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-[#071011] border border-slate-200 dark:border-[#142B2D] p-4">
              <button
                type="button"
                onClick={togglePreviewAudio}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0B7D6E] dark:bg-[#14E3C3] text-white dark:text-[#060909] px-4 py-2.5 text-sm font-bold min-h-[44px] cursor-pointer"
              >
                {isPreviewPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isPreviewPlaying ? 'Pausar vista previa' : 'Escuchar vista previa'}</span>
              </button>

              <button
                type="button"
                onClick={handleDiscardAndReRecord}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-[#1E3F41] px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-[#C5DFDD] hover:bg-slate-100 dark:hover:bg-[#102A2C] min-h-[44px] cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Volver a grabar</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="recording-title"
                  className="block text-xs font-semibold text-slate-600 dark:text-[#9BB8B5] mb-1.5"
                >
                  Título de la grabación (opcional)
                </label>
                <input
                  id="recording-title"
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder={`Si queda vacío se guardará como "${autoSuggestedTitle}"`}
                  className="w-full rounded-xl bg-slate-50 dark:bg-[#060C0D] border border-slate-200 dark:border-[#1A3537] px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
                />
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label
                    htmlFor="recording-playlist"
                    className="block text-xs font-semibold text-slate-600 dark:text-[#9BB8B5]"
                  >
                    Guardar directamente en playlist
                  </label>
                  {playlists.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setDestinationMode((m) => (m === 'existing' ? 'new' : 'existing'))
                      }
                      className="text-xs font-semibold text-[#0B7D6E] dark:text-[#14E3C3] hover:underline cursor-pointer"
                    >
                      {destinationMode === 'existing'
                        ? '+ Crear playlist nueva aquí'
                        : 'Usar una playlist existente'}
                    </button>
                  )}
                </div>

                {destinationMode === 'existing' && playlists.length > 0 ? (
                  <select
                    id="recording-playlist"
                    value={targetPlaylistId}
                    onChange={(e) => {
                      setTargetPlaylistId(e.target.value);
                      setSelectedPlaylistId(e.target.value);
                    }}
                    className="w-full rounded-xl bg-slate-50 dark:bg-[#060C0D] border border-slate-200 dark:border-[#1A3537] px-4 py-3 text-sm text-slate-900 dark:text-white"
                  >
                    {playlists.map((pl) => {
                      const s = subjects.find((x) => x.id === pl.subjectId);
                      const t = topics.find((x) => x.id === pl.topicId);
                      return (
                        <option key={pl.id} value={pl.id}>
                          {pl.name} ({s?.name ?? 'General'} · {t?.name ?? 'General'})
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <div className="rounded-xl bg-slate-50 dark:bg-[#071011] border border-slate-200 dark:border-[#142B2D] p-4 space-y-3">
                    <p className="text-xs font-semibold text-slate-700 dark:text-[#C5DFDD]">
                      Nueva playlist de destino (se crea automáticamente al guardar)
                    </p>
                    <div>
                      <label htmlFor="quick-playlist-name" className="sr-only">
                        Nombre de la nueva playlist
                      </label>
                      <input
                        id="quick-playlist-name"
                        type="text"
                        value={quickPlaylistName}
                        onChange={(e) => setQuickPlaylistName(e.target.value)}
                        placeholder='Nombre de la playlist (si queda vacío será "Mi playlist de estudio")'
                        className="w-full rounded-lg bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#1A3537] px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        value={quickSubjectName}
                        onChange={(e) => setQuickSubjectName(e.target.value)}
                        placeholder="Materia (opcional, ej. Geografía)"
                        aria-label="Materia opcional"
                        className="rounded-lg bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#1A3537] px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400"
                      />
                      <input
                        type="text"
                        value={quickTopicName}
                        onChange={(e) => setQuickTopicName(e.target.value)}
                        placeholder="Tema (opcional, ej. El clima)"
                        aria-label="Tema opcional"
                        className="rounded-lg bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#1A3537] px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={stage === 'saving'}
                onClick={() => void handleSaveRecording()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B7D6E] dark:bg-[#14E3C3] text-white dark:text-[#060909] py-3.5 text-sm font-bold hover:opacity-90 disabled:opacity-50 min-h-[48px] cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{stage === 'saving' ? 'Guardando...' : 'Finalizar y guardar en playlist'}</span>
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
