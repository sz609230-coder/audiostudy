import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Download,
  Edit3,
  FolderInput,
  Mic,
  Play,
  Plus,
  Share2,
  Trash2,
  Upload,
} from 'lucide-react';
import { useAudioStudy } from '../app/AudioStudyContext';
import { getActivePlaylistTracks } from '../services/playback/playbackEngine';
import { formatDateTimeEs, formatDuration } from '../utils/audioUtils';

export const PlaylistPage: React.FC = () => {
  const {
    subjects,
    topics,
    playlists,
    tracks,
    selectedPlaylistId,
    setSelectedPlaylistId,
    setActiveSection,
    playback,
    playPlaylist,
    createDirectPlaylist,
    importAudioFileToPlaylist,
    renamePlaylist,
    renameTrack,
    reorderTrack,
    moveTrackToPlaylist,
    archiveTrackManually,
    downloadTrackFile,
    exportPlaylistBackup,
    showBanner,
  } = useAudioStudy();

  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [editingPlaylistTitle, setEditingPlaylistTitle] = useState(false);
  const [playlistTitleInput, setPlaylistTitleInput] = useState('');
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [trackTitleInput, setTrackTitleInput] = useState('');
  const [movingTrackId, setMovingTrackId] = useState<string | null>(null);
  const [directPlaylistName, setDirectPlaylistName] = useState('');
  const [importingAudio, setImportingAudio] = useState(false);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);

  const currentPlaylist =
    playlists.find((p) => p.id === selectedPlaylistId) ?? playlists[0] ?? null;

  const subject = currentPlaylist
    ? subjects.find((s) => s.id === currentPlaylist.subjectId)
    : undefined;
  const topic = currentPlaylist
    ? topics.find((t) => t.id === currentPlaylist.topicId)
    : undefined;

  const orderedTracks = useMemo(
    () => (currentPlaylist ? getActivePlaylistTracks(tracks, currentPlaylist.id) : []),
    [currentPlaylist, tracks]
  );

  const totalDurationSec = useMemo(
    () => orderedTracks.reduce((acc, t) => acc + t.durationSec, 0),
    [orderedTracks]
  );

  const handleCreateDirectPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = directPlaylistName.trim();
    if (!name) {
      showBanner('warning', 'Escribe un nombre para la playlist.');
      return;
    }
    const created = await createDirectPlaylist(name);
    setDirectPlaylistName('');
    showBanner('success', `Playlist "${created.name}" creada.`);
  };

  const handleImportAudioChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !currentPlaylist) return;

    setImportingAudio(true);
    try {
      const saved = await importAudioFileToPlaylist(currentPlaylist.id, file);
      showBanner('success', `Audio "${saved.title}" guardado en "${currentPlaylist.name}".`);
    } catch (err) {
      showBanner(
        'error',
        err instanceof Error ? err.message : 'No se pudo guardar el archivo de audio.'
      );
    } finally {
      setImportingAudio(false);
    }
  };

  if (!currentPlaylist) {
    return (
      <div className="rounded-2xl bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#193537] p-8 text-center space-y-5 max-w-xl mx-auto">
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
            Crea tu primera playlist
          </h1>
          <p className="text-sm text-slate-600 dark:text-[#9BB8B5] max-w-md mx-auto">
            Puedes crear una playlist directamente aquí para guardar grabaciones o archivos de audio al instante.
          </p>
        </div>

        <form onSubmit={(e) => void handleCreateDirectPlaylist(e)} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={directPlaylistName}
            onChange={(e) => setDirectPlaylistName(e.target.value)}
            placeholder="Nombre de la playlist (ej. El clima)"
            aria-label="Nombre de la nueva playlist"
            className="flex-1 rounded-xl bg-slate-50 dark:bg-[#060C0D] border border-slate-200 dark:border-[#1A3537] px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B7D6E] dark:bg-[#14E3C3] text-white dark:text-[#060909] px-5 py-2.5 text-sm font-bold min-h-[44px] cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Crear playlist</span>
          </button>
        </form>

        <button
          type="button"
          onClick={() => setActiveSection('materias')}
          className="text-xs font-semibold text-slate-500 dark:text-[#8FB3B0] hover:underline cursor-pointer"
        >
          O organizar primero por Materias y Temas
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selector de playlist cuando hay varias */}
      {playlists.length > 1 && (
        <div className="flex items-center gap-3">
          <label htmlFor="playlist-switcher" className="text-xs font-semibold text-slate-500 dark:text-[#8FB3B0] whitespace-nowrap">
            Playlist activa:
          </label>
          <select
            id="playlist-switcher"
            value={currentPlaylist.id}
            onChange={(e) => setSelectedPlaylistId(e.target.value)}
            className="flex-1 max-w-md rounded-xl bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#1A3537] px-3.5 py-2.5 text-sm text-slate-900 dark:text-white"
          >
            {playlists.map((pl) => {
              const s = subjects.find((x) => x.id === pl.subjectId);
              const t = topics.find((x) => x.id === pl.topicId);
              return (
                <option key={pl.id} value={pl.id}>
                  {s?.name ?? 'Materia'} / {t?.name ?? 'Tema'} — {pl.name}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Encabezado de la Playlist */}
      <section className="rounded-2xl bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#193537] p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0 flex-1">
            <p className="text-xs font-medium text-[#0B7D6E] dark:text-[#14E3C3]">
              {subject?.name ?? 'Sin materia'} · {topic?.name ?? 'Sin tema'}
            </p>
            {editingPlaylistTitle ? (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={playlistTitleInput}
                  onChange={(e) => setPlaylistTitleInput(e.target.value)}
                  aria-label="Nuevo nombre de playlist"
                  className="flex-1 rounded-xl bg-slate-50 dark:bg-[#060C0D] border border-slate-300 dark:border-[#1F3F41] px-3 py-2 text-base font-bold"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (playlistTitleInput.trim()) {
                      void renamePlaylist(currentPlaylist.id, playlistTitleInput);
                      showBanner('success', 'Nombre de la playlist actualizado.');
                    }
                    setEditingPlaylistTitle(false);
                  }}
                  className="rounded-xl bg-[#0B7D6E] dark:bg-[#14E3C3] text-white dark:text-[#060909] px-3.5 py-2 text-xs font-bold min-h-[40px] cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-white truncate">
                  {currentPlaylist.name}
                </h1>
                <button
                  type="button"
                  onClick={() => {
                    setPlaylistTitleInput(currentPlaylist.name);
                    setEditingPlaylistTitle(true);
                  }}
                  aria-label="Cambiar nombre de la playlist"
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
            )}
            <p className="text-xs text-slate-500 dark:text-[#8FB3B0] font-mono tabular-nums">
              {orderedTracks.length} {orderedTracks.length === 1 ? 'grabación' : 'grabaciones'} · Duración total{' '}
              {formatDuration(totalDurationSec)}
            </p>
          </div>
        </div>

        {/* Barra de acciones de playlist */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 dark:border-[#152D2F]">
          <button
            type="button"
            disabled={orderedTracks.length === 0}
            onClick={() => {
              void playPlaylist(currentPlaylist.id);
              setActiveSection('reproductor');
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B7D6E] dark:bg-[#14E3C3] text-white dark:text-[#060909] px-5 py-2.5 text-sm font-bold disabled:opacity-40 min-h-[44px] cursor-pointer whitespace-nowrap"
          >
            <Play className="w-4 h-4" />
            <span>Reproducir toda la lista</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedPlaylistId(currentPlaylist.id);
              setActiveSection('grabadora');
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-[#1E3F41] px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-[#D1E5E3] hover:bg-slate-100 dark:hover:bg-[#102A2C] min-h-[44px] cursor-pointer whitespace-nowrap"
          >
            <Mic className="w-4 h-4 text-[#0B7D6E] dark:text-[#14E3C3]" />
            <span>Grabar aquí</span>
          </button>

          <input
            ref={audioFileInputRef}
            type="file"
            accept="audio/*"
            onChange={(e) => void handleImportAudioChange(e)}
            className="hidden"
          />
          <button
            type="button"
            disabled={importingAudio}
            onClick={() => audioFileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-[#1E3F41] px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-[#D1E5E3] hover:bg-slate-100 dark:hover:bg-[#102A2C] min-h-[44px] cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            <Upload className="w-4 h-4 text-[#0B7D6E] dark:text-[#14E3C3]" />
            <span>{importingAudio ? 'Guardando...' : 'Agregar archivo de audio'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEditingOrder((prev) => !prev)}
            className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold min-h-[44px] cursor-pointer whitespace-nowrap ${
              isEditingOrder
                ? 'bg-[#0D3B3E] text-[#14E3C3] border-[#14E3C3]/40'
                : 'border-slate-200 dark:border-[#1E3F41] text-slate-800 dark:text-[#D1E5E3] hover:bg-slate-100 dark:hover:bg-[#102A2C]'
            }`}
          >
            <span>{isEditingOrder ? 'Listo con el orden' : 'Editar orden'}</span>
          </button>

          {orderedTracks.length > 0 && (
            <button
              type="button"
              onClick={() => void exportPlaylistBackup(currentPlaylist.id)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-[#1E3F41] px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-[#C5DFDD] hover:bg-slate-100 dark:hover:bg-[#102A2C] min-h-[44px] cursor-pointer whitespace-nowrap"
            >
              <Share2 className="w-4 h-4" />
              <span>Exportar playlist</span>
            </button>
          )}
        </div>
      </section>

      {/* Lista ordenada de grabaciones */}
      {orderedTracks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-[#1F3F41] p-8 text-center space-y-3">
          <p className="text-sm text-slate-600 dark:text-[#9BB8B5]">
            Esta playlist no tiene grabaciones activas.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedPlaylistId(currentPlaylist.id);
              setActiveSection('grabadora');
            }}
            className="rounded-xl bg-[#0B7D6E] dark:bg-[#14E3C3] text-white dark:text-[#060909] px-4 py-2.5 text-sm font-bold min-h-[44px] cursor-pointer"
          >
            Grabar primer audio
          </button>
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#193537] divide-y divide-slate-100 dark:divide-[#152D2F]">
          {orderedTracks.map((track, idx) => {
            const isPlayingThis = playback.currentTrackId === track.id;
            const isEditingTitle = editingTrackId === track.id;
            const isMoving = movingTrackId === track.id;

            return (
              <div
                key={track.id}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  isPlayingThis ? 'bg-[#0D3B3E]/10 dark:bg-[#0D3B3E]/40' : ''
                }`}
              >
                <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      void playPlaylist(currentPlaylist.id, track.id);
                      setActiveSection('reproductor');
                    }}
                    aria-label={`Reproducir pista ${idx + 1}: ${track.title}`}
                    className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center font-mono text-sm font-bold tabular-nums shrink-0 cursor-pointer ${
                      isPlayingThis
                        ? 'bg-[#0B7D6E] dark:bg-[#14E3C3] text-white dark:text-[#060909]'
                        : 'bg-slate-100 dark:bg-[#081213] text-slate-700 dark:text-[#9BB8B5] hover:bg-slate-200 dark:hover:bg-[#102A2C]'
                    }`}
                  >
                    {isPlayingThis ? <Play className="w-4 h-4" /> : idx + 1}
                  </button>

                  <div className="min-w-0 flex-1">
                    {isEditingTitle ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={trackTitleInput}
                          onChange={(e) => setTrackTitleInput(e.target.value)}
                          aria-label="Nuevo título de la grabación"
                          className="flex-1 rounded-lg bg-slate-50 dark:bg-[#060C0D] border border-slate-300 dark:border-[#1F3F41] px-3 py-1.5 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (trackTitleInput.trim()) {
                              void renameTrack(track.id, trackTitleInput);
                            }
                            setEditingTrackId(null);
                          }}
                          className="rounded-lg bg-[#0B7D6E] dark:bg-[#14E3C3] text-white dark:text-[#060909] px-3 py-1.5 text-xs font-bold cursor-pointer"
                        >
                          Guardar
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            void playPlaylist(currentPlaylist.id, track.id);
                            setActiveSection('reproductor');
                          }}
                          className="text-left w-full cursor-pointer"
                        >
                          <div className="text-sm sm:text-base font-semibold text-slate-950 dark:text-white truncate">
                            {track.title}
                          </div>
                        </button>
                        <div className="text-xs text-slate-500 dark:text-[#8FB3B0] font-mono tabular-nums mt-0.5">
                          {formatDuration(track.durationSec)} · {formatDateTimeEs(track.createdAt)}
                        </div>
                      </>
                    )}

                    {isMoving && playlists.length > 1 && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <select
                          aria-label={`Mover ${track.title} a otra playlist`}
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              void moveTrackToPlaylist(track.id, e.target.value);
                              setMovingTrackId(null);
                              showBanner('success', `"${track.title}" se movió de playlist.`);
                            }
                          }}
                          className="rounded-lg bg-slate-50 dark:bg-[#060C0D] border border-slate-300 dark:border-[#1F3F41] px-2.5 py-1.5 text-xs"
                        >
                          <option value="" disabled>
                            Elegir playlist destino...
                          </option>
                          {playlists
                            .filter((p) => p.id !== currentPlaylist.id)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setMovingTrackId(null)}
                          className="text-xs text-slate-500 hover:underline cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Controles de fila */}
                <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                  {isEditingOrder ? (
                    <>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => void reorderTrack(currentPlaylist.id, track.id, 'up')}
                        aria-label={`Subir ${track.title}`}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-[#1E3F41] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === orderedTracks.length - 1}
                        onClick={() => void reorderTrack(currentPlaylist.id, track.id, 'down')}
                        aria-label={`Bajar ${track.title}`}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-[#1E3F41] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTrackId(track.id);
                          setTrackTitleInput(track.title);
                        }}
                        aria-label={`Editar título de ${track.title}`}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#102A2C] cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {playlists.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setMovingTrackId(isMoving ? null : track.id)}
                          aria-label={`Mover ${track.title} a otra playlist`}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#102A2C] cursor-pointer"
                        >
                          <FolderInput className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void downloadTrackFile(track.id)}
                        aria-label={`Descargar archivo de ${track.title}`}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#102A2C] cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void archiveTrackManually(track.id)}
                        aria-label={`Enviar ${track.title} a la papelera`}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-[#102A2C] cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
