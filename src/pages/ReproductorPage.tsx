import React from 'react';
import {
  CheckCircle2,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAudioStudy } from '../app/AudioStudyContext';
import { getActivePlaylistTracks } from '../services/playback/playbackEngine';
import { formatDuration } from '../utils/audioUtils';

export const ReproductorPage: React.FC = () => {
  const {
    subjects,
    topics,
    playlists,
    tracks,
    playback,
    settings,
    setActiveSection,
    playPlaylist,
    togglePlayPause,
    skipNextAndArchive,
    previousTrack,
    seekTo,
    setVolume,
    toggleRepeatPlaylist,
    undoLastSkip,
  } = useAudioStudy();

  const currentPlaylist = playlists.find((p) => p.id === playback.currentPlaylistId) ?? null;
  const activePlaylistTracks = currentPlaylist
    ? getActivePlaylistTracks(tracks, currentPlaylist.id)
    : [];

  const currentTrack = playback.currentTrackId
    ? tracks.find((t) => t.id === playback.currentTrackId)
    : undefined;
  const currentSubject = currentTrack
    ? subjects.find((s) => s.id === currentTrack.subjectId)
    : undefined;
  const currentTopic = currentTrack
    ? topics.find((t) => t.id === currentTrack.topicId)
    : undefined;

  const trackIndex = currentTrack
    ? activePlaylistTracks.findIndex((t) => t.id === currentTrack.id)
    : -1;

  const duration = playback.durationSec || currentTrack?.durationSec || 0;
  const progressPercent = duration > 0 ? Math.min(100, (playback.currentTimeSec / duration) * 100) : 0;

  const statusText = (() => {
    switch (playback.status) {
      case 'playing':
        return 'Reproduciendo';
      case 'paused':
        return 'En pausa';
      case 'loading':
        return 'Cargando audio...';
      case 'completed':
        return 'Playlist finalizada';
      case 'error':
        return 'Error de reproducción';
      default:
        return 'Listo para reproducir';
    }
  })();

  if (!currentTrack && !currentPlaylist) {
    return (
      <div className="rounded-2xl bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#193537] p-8 text-center space-y-4 max-w-2xl mx-auto">
        <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
          Reproductor de estudio
        </h1>
        <p className="text-sm text-slate-600 dark:text-[#9BB8B5]">
          Elige una playlist o comienza una grabación nueva para escucharla con tus auriculares Bluetooth.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setActiveSection('materias')}
            className="rounded-xl bg-[#0B7D6E] dark:bg-[#14E3C3] text-white dark:text-[#060909] px-5 py-2.5 text-sm font-bold min-h-[44px] cursor-pointer"
          >
            Elegir materia y playlist
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('grabadora')}
            className="rounded-xl border border-slate-200 dark:border-[#1E3F41] px-5 py-2.5 text-sm font-semibold min-h-[44px] cursor-pointer"
          >
            Ir a Grabadora
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Botón rápido de Deshacer último salto si existe */}
      {playback.lastUndoSkip && (
        <div className="rounded-2xl bg-[#0D3B3E]/10 dark:bg-[#0D3B3E]/60 border border-[#0B7D6E]/25 dark:border-[#14E3C3]/30 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-slate-900 dark:text-[#E2F7F4]">
            Enviaste <strong>"{playback.lastUndoSkip.track.title}"</strong> a la papelera al saltarlo.
          </span>
          <button
            type="button"
            onClick={() => void undoLastSkip()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B7D6E] dark:bg-[#14E3C3] text-white dark:text-[#060909] px-3.5 py-2 text-xs font-bold min-h-[38px] cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Deshacer último salto</span>
          </button>
        </div>
      )}

      {/* Tarjeta principal del reproductor */}
      <section className="rounded-3xl bg-white dark:bg-[#091314] border border-slate-200 dark:border-[#193537] p-6 sm:p-8 space-y-7">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-[#8FB3B0]">
          <span>
            {currentSubject?.name ?? 'Estudio'} · {currentTopic?.name ?? 'Tema'} ·{' '}
            {currentPlaylist?.name ?? 'Playlist'}
          </span>
          <span className="font-mono tabular-nums font-semibold text-[#0B7D6E] dark:text-[#14E3C3]">
            {statusText}
            {trackIndex >= 0 && ` · Pista ${trackIndex + 1} de ${activePlaylistTracks.length}`}
          </span>
        </div>

        {/* Título actual */}
        <div className="space-y-2">
          <h1 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-950 dark:text-white text-balance">
            {currentTrack ? currentTrack.title : currentPlaylist?.name ?? 'Playlist finalizada'}
          </h1>
          {playback.endedMessage && (
            <div className="inline-flex items-center gap-2 text-sm font-medium text-[#0B7D6E] dark:text-[#14E3C3] pt-1">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{playback.endedMessage}</span>
            </div>
          )}
          {playback.errorMessage && (
            <p className="text-sm text-red-600 dark:text-red-400">{playback.errorMessage}</p>
          )}
        </div>

        {/* Barra de progreso */}
        <div className="space-y-2">
          <label htmlFor="player-seek" className="sr-only">
            Posición de reproducción
          </label>
          <input
            id="player-seek"
            type="range"
            min={0}
            max={Math.max(1, duration)}
            step={0.1}
            value={Math.min(playback.currentTimeSec, Math.max(1, duration))}
            onChange={(e) => seekTo(Number(e.target.value))}
            disabled={!currentTrack}
            className="w-full audiostudy-range"
            style={{
              background: `linear-gradient(to right, #14E3C3 ${progressPercent}%, rgba(148,163,184,0.3) ${progressPercent}%)`,
              height: '6px',
              borderRadius: '9999px',
            }}
          />
          <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-500 dark:text-[#8FB3B0]">
            <span>{formatDuration(playback.currentTimeSec)}</span>
            <span>{formatDuration(duration)}</span>
          </div>
        </div>

        {/* Controles de reproducción */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => void previousTrack()}
              disabled={!currentTrack}
              aria-label="Pista anterior"
              className="min-h-[48px] min-w-[48px] rounded-2xl border border-slate-200 dark:border-[#1E3F41] flex items-center justify-center text-slate-800 dark:text-[#D1E5E3] hover:bg-slate-100 dark:hover:bg-[#102A2C] disabled:opacity-40 cursor-pointer"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => void togglePlayPause()}
              aria-label={playback.status === 'playing' ? 'Pausar' : 'Reproducir'}
              className="w-16 h-16 rounded-full bg-[#0B7D6E] dark:bg-[#14E3C3] text-white dark:text-[#060909] flex items-center justify-center shadow-lg hover:scale-[1.03] active:scale-[0.98] transition-transform cursor-pointer"
            >
              {playback.status === 'playing' ? (
                <Pause className="w-7 h-7" />
              ) : (
                <Play className="w-7 h-7 ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => void skipNextAndArchive()}
              disabled={!currentTrack}
              aria-label="Siguiente pista: saltar y archivar en papelera"
              className="min-h-[48px] px-4 rounded-2xl border border-slate-200 dark:border-[#1E3F41] flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-[#D1E5E3] hover:bg-slate-100 dark:hover:bg-[#102A2C] disabled:opacity-40 cursor-pointer whitespace-nowrap"
            >
              <SkipForward className="w-5 h-5 text-[#0B7D6E] dark:text-[#14E3C3]" />
              <span>Saltar y archivar</span>
            </button>
          </div>

          {/* Repetición y volumen */}
          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <button
              type="button"
              onClick={() => void toggleRepeatPlaylist()}
              aria-pressed={settings.repeatPlaylist}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold border min-h-[40px] cursor-pointer whitespace-nowrap ${
                settings.repeatPlaylist
                  ? 'bg-[#0D3B3E] text-[#14E3C3] border-[#14E3C3]/40'
                  : 'border-slate-200 dark:border-[#1E3F41] text-slate-600 dark:text-[#9BB8B5]'
              }`}
            >
              <Repeat className="w-4 h-4" />
              <span>{settings.repeatPlaylist ? 'Repetir: Sí' : 'Repetir: No'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void setVolume(playback.volume > 0 ? 0 : 1)}
                aria-label={playback.volume === 0 ? 'Activar sonido' : 'Silenciar'}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-600 dark:text-[#9BB8B5] cursor-pointer"
              >
                {playback.volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <label htmlFor="player-volume" className="sr-only">
                Volumen de reproducción
              </label>
              <input
                id="player-volume"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={playback.volume}
                onChange={(e) => void setVolume(Number(e.target.value))}
                className="w-24 audiostudy-range"
                style={{
                  background: `linear-gradient(to right, #14E3C3 ${playback.volume * 100}%, rgba(148,163,184,0.3) ${playback.volume * 100}%)`,
                  height: '5px',
                  borderRadius: '9999px',
                }}
              />
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-500 dark:text-[#7E9E9B] border-t border-slate-100 dark:border-[#152D2F] pt-4 leading-relaxed">
          Al terminar un audio normalmente, pasará al siguiente sin eliminarse. Si pulsas{' '}
          <strong>Saltar y archivar</strong> (o Siguiente en tus auriculares Bluetooth), la pista actual irá a la Papelera y comenzará la siguiente.
        </p>
      </section>

      {/* Cola de reproducción de la playlist */}
      <section className="rounded-2xl bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#193537] p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-bold text-slate-950 dark:text-white">
            Orden de reproducción ({activePlaylistTracks.length})
          </h2>
          {currentPlaylist && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveSection('playlist')}
                className="text-xs font-medium text-slate-600 dark:text-[#9BB8B5] hover:text-slate-900 dark:hover:text-white hover:underline cursor-pointer min-h-[36px]"
              >
                Editar playlist
              </button>
              <button
                type="button"
                onClick={() => void playPlaylist(currentPlaylist.id)}
                className="text-xs font-semibold text-[#0B7D6E] dark:text-[#14E3C3] hover:underline cursor-pointer min-h-[36px]"
              >
                Reiniciar lista
              </button>
            </div>
          )}
        </div>

        {activePlaylistTracks.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-[#8FB3B0]">
            No quedan audios activos en esta playlist. Puedes restaurar pistas desde la Papelera.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-[#152D2F]">
            {activePlaylistTracks.map((t, idx) => {
              const isCurrent = t.id === currentTrack?.id;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => currentPlaylist && void playPlaylist(currentPlaylist.id, t.id)}
                    className={`w-full py-3 px-3 rounded-xl flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                      isCurrent
                        ? 'bg-[#0D3B3E]/10 dark:bg-[#0D3B3E]/50 text-[#0B7D6E] dark:text-[#14E3C3]'
                        : 'hover:bg-slate-50 dark:hover:bg-[#0E1E20]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs tabular-nums w-6 text-slate-400">
                        {idx + 1}.
                      </span>
                      <span className="text-sm font-semibold truncate text-slate-900 dark:text-white">
                        {t.title}
                      </span>
                    </div>
                    <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-[#8FB3B0] shrink-0">
                      {formatDuration(t.durationSec)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};
