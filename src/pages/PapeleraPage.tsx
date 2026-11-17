import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Trash2 } from 'lucide-react';
import { useAudioStudy } from '../app/AudioStudyContext';
import { getAudioBlob } from '../services/database/indexedDb';
import { formatDateTimeEs, formatDuration } from '../utils/audioUtils';

export const PapeleraPage: React.FC = () => {
  const {
    subjects,
    topics,
    playlists,
    tracks,
    trashItems,
    playback,
    pausePlayback,
    restoreFromTrash,
    permanentlyDeleteTrashItem,
    emptyTrash,
    showBanner,
  } = useAudioStudy();

  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [confirmPermanentId, setConfirmPermanentId] = useState<string | null>(null);
  const [confirmEmptyAll, setConfirmEmptyAll] = useState(false);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const stopPreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewTrackId(null);
  };

  const handleTogglePreview = async (trackId: string) => {
    if (previewTrackId === trackId) {
      stopPreview();
      return;
    }

    stopPreview();
    if (playback.status === 'playing') {
      pausePlayback();
    }

    const blob = await getAudioBlob(trackId);
    if (!blob) {
      showBanner('error', 'No se encontró el archivo de audio para previsualizar.');
      return;
    }

    const url = URL.createObjectURL(blob);
    previewUrlRef.current = url;
    const audio = new Audio(url);
    previewAudioRef.current = audio;
    audio.onended = () => stopPreview();
    audio.onerror = () => {
      stopPreview();
      showBanner('error', 'No se pudo reproducir la vista previa de este audio.');
    };
    setPreviewTrackId(trackId);
    await audio.play();
  };

  const itemToDelete = confirmPermanentId
    ? trashItems.find((i) => i.id === confirmPermanentId)
    : null;
  const trackToDelete = itemToDelete
    ? tracks.find((t) => t.id === itemToDelete.trackId)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 dark:border-[#162C2E] pb-5">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#0B1C1E] dark:text-white">
            Papelera de grabaciones
          </h1>
          <p className="text-sm text-slate-600 dark:text-[#9BB8B5] mt-1">
            Los audios que saltas durante el repaso se guardan aquí sin borrarse definitivamente hasta que tú lo confirmes.
          </p>
        </div>

        {trashItems.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmEmptyAll(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 dark:border-red-900/70 text-red-700 dark:text-red-300 px-4 py-2.5 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-950/40 min-h-[44px] cursor-pointer whitespace-nowrap self-start sm:self-auto"
          >
            <Trash2 className="w-4 h-4" />
            <span>Vaciar papelera</span>
          </button>
        )}
      </div>

      {trashItems.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#193537] p-8 text-center space-y-2">
          <p className="text-base font-semibold text-slate-900 dark:text-white">
            La papelera está vacía
          </p>
          <p className="text-sm text-slate-600 dark:text-[#9BB8B5] max-w-md mx-auto">
            Cuando saltes un audio porque ya dominas esa respuesta, aparecerá aquí por si deseas recuperarlo más adelante.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#193537] divide-y divide-slate-100 dark:divide-[#152D2F]">
          {trashItems.map((item) => {
            const track = tracks.find((t) => t.id === item.trackId);
            if (!track) return null;
            const sub = subjects.find((s) => s.id === item.originalSubjectId);
            const top = topics.find((t) => t.id === item.originalTopicId);
            const pl = playlists.find((p) => p.id === item.originalPlaylistId);
            const isPreviewing = previewTrackId === track.id;

            return (
              <div
                key={item.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => void handleTogglePreview(track.id)}
                    aria-label={isPreviewing ? `Pausar vista previa de ${track.title}` : `Escuchar ${track.title}`}
                    className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-100 dark:bg-[#081213] text-slate-800 dark:text-[#D1E5E3] flex items-center justify-center shrink-0 cursor-pointer hover:bg-slate-200 dark:hover:bg-[#102A2C]"
                  >
                    {isPreviewing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="text-sm sm:text-base font-semibold text-slate-950 dark:text-white truncate">
                      {track.title}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-[#8FB3B0] truncate">
                      {sub?.name ?? 'Materia eliminada'} · {top?.name ?? 'Tema'} ·{' '}
                      {pl?.name ?? 'Playlist eliminada'}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-[#7E9E9B] font-mono tabular-nums">
                      {formatDuration(track.durationSec)} ·{' '}
                      {item.reason === 'skipped' ? 'Saltado en repaso' : 'Archivado manual'} ·{' '}
                      {formatDateTimeEs(item.deletedAt)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (previewTrackId === track.id) stopPreview();
                      void restoreFromTrash(item.id);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B7D6E] dark:bg-[#14E3C3] text-white dark:text-[#060909] px-3.5 py-2 text-xs font-bold min-h-[40px] cursor-pointer whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Recuperar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmPermanentId(item.id)}
                    aria-label={`Eliminar definitivamente ${track.title}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-[#1E3F41] px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 min-h-[40px] cursor-pointer whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de confirmación para eliminar un audio definitivamente */}
      {confirmPermanentId && trackToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-permanent-delete"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#1B3537] p-6 space-y-4 shadow-2xl">
            <h3 id="confirm-permanent-delete" className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Eliminar definitivamente
            </h3>
            <p className="text-sm text-slate-600 dark:text-[#9BB8B5]">
              ¿Confirmas borrar para siempre <strong>"{trackToDelete.title}"</strong>? Esta grabación no se podrá recuperar salvo que tengas una copia de seguridad.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmPermanentId(null)}
                className="rounded-xl border border-slate-200 dark:border-[#1E3F41] px-4 py-2 text-sm font-medium min-h-[44px] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (previewTrackId === trackToDelete.id) stopPreview();
                  void permanentlyDeleteTrashItem(confirmPermanentId);
                  setConfirmPermanentId(null);
                  showBanner('info', `"${trackToDelete.title}" se eliminó definitivamente.`);
                }}
                className="rounded-xl bg-red-600 text-white px-4 py-2 text-sm font-bold min-h-[44px] cursor-pointer"
              >
                Borrar definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para vaciar toda la papelera */}
      {confirmEmptyAll && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-empty-trash"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#1B3537] p-6 space-y-4 shadow-2xl">
            <h3 id="confirm-empty-trash" className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Vaciar toda la papelera
            </h3>
            <p className="text-sm text-slate-600 dark:text-[#9BB8B5]">
              Se eliminarán de forma definitiva <strong>{trashItems.length}</strong>{' '}
              {trashItems.length === 1 ? 'grabación' : 'grabaciones'} de tu dispositivo. ¿Deseas continuar?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmEmptyAll(false)}
                className="rounded-xl border border-slate-200 dark:border-[#1E3F41] px-4 py-2 text-sm font-medium min-h-[44px] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  stopPreview();
                  void emptyTrash();
                  setConfirmEmptyAll(false);
                }}
                className="rounded-xl bg-red-600 text-white px-4 py-2 text-sm font-bold min-h-[44px] cursor-pointer"
              >
                Vaciar papelera
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
