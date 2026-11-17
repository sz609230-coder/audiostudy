import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  FolderPlus,
  Headphones,
  Mic,
  Play,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useAudioStudy } from '../app/AudioStudyContext';
import { getActivePlaylistTracks } from '../services/playback/playbackEngine';
import { formatDuration } from '../utils/audioUtils';
import { PWAInstallButton } from '../components/PWAInstallButton';

export const InicioPage: React.FC = () => {
  const {
    subjects,
    topics,
    playlists,
    tracks,
    lastSavedProgress,
    playback,
    storageStats,
    setActiveSection,
    setSelectedSubjectId,
    setSelectedPlaylistId,
    playPlaylist,
    resumeLastSession,
    loadDemoData,
    clearDemoData,
    hasDemoData,
  } = useAudioStudy();

  const activeTracks = tracks.filter((t) => t.status === 'active');
  const lastPlaylist = playlists.find(
    (p) => p.id === (playback.currentPlaylistId || lastSavedProgress.playlistId)
  );
  const lastTrack = tracks.find(
    (t) =>
      t.id === (playback.currentTrackId || lastSavedProgress.trackId) && t.status === 'active'
  );
  const lastPlaylistTracks = lastPlaylist ? getActivePlaylistTracks(tracks, lastPlaylist.id) : [];

  const handleOpenSubject = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setActiveSection('materias');
  };

  const handleOpenPlaylist = (playlistId: string) => {
    setSelectedPlaylistId(playlistId);
    setActiveSection('playlist');
  };

  return (
    <div className="space-y-8">
      {/* Encabezado principal */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-[#162C2E] pb-6">
        <div className="space-y-1.5 max-w-2xl">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0B1C1E] dark:text-white text-balance">
            Estudia con tu voz, repasa sin sacar el teléfono
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-[#9BB8B5]">
            Graba explicaciones y respuestas cortas, organízalas por materia y escúchalas en orden con tus auriculares Bluetooth.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <PWAInstallButton />
          <button
            type="button"
            onClick={() => setActiveSection('grabadora')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B7D6E] dark:bg-[#14E3C3] text-white dark:text-[#060909] px-5 py-3 text-sm font-bold hover:opacity-90 transition-opacity min-h-[48px] cursor-pointer whitespace-nowrap"
          >
            <Mic className="w-4 h-4 shrink-0" />
            <span>Grabación nueva</span>
          </button>
        </div>
      </section>

      {/* Aviso de almacenamiento casi lleno */}
      {storageStats.nearLimit && (
        <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-950 dark:text-amber-100 space-y-1">
            <p className="font-semibold">
              El almacenamiento local está al {storageStats.percentUsed}% de su capacidad.
            </p>
            <p className="opacity-85">
              Exporta una copia de seguridad o vacía la papelera manualmente desde Configuración para liberar espacio sin perder grabaciones importantes.
            </p>
          </div>
        </div>
      )}

      {/* Tarjeta principal: Continuar escuchando / Última playlist reproducida */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#193537] p-6 flex flex-col justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-[#82A8A5]">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Headphones className="w-4 h-4 text-[#0B7D6E] dark:text-[#14E3C3]" />
                Continuar escuchando
              </span>
              {lastPlaylist && (
                <span className="font-mono tabular-nums">
                  {lastPlaylistTracks.length} {lastPlaylistTracks.length === 1 ? 'audio' : 'audios'}
                </span>
              )}
            </div>

            {lastPlaylist ? (
              <>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-950 dark:text-white">
                  {lastPlaylist.name}
                </h2>
                <p className="text-sm text-slate-600 dark:text-[#9BB8B5]">
                  {lastTrack ? (
                    <>
                      Última pista: <strong className="text-slate-900 dark:text-white">{lastTrack.title}</strong>
                      {' · '}
                      <span className="font-mono tabular-nums">
                        {formatDuration(
                          playback.currentTrackId === lastTrack.id
                            ? playback.currentTimeSec
                            : lastSavedProgress.positionSec
                        )}{' '}
                        / {formatDuration(lastTrack.durationSec)}
                      </span>
                    </>
                  ) : (
                    'Listo para reproducir en orden desde la primera grabación.'
                  )}
                </p>
              </>
            ) : (
              <>
                <h2 className="font-display text-xl font-bold text-slate-950 dark:text-white">
                  Aún no hay una playlist reciente
                </h2>
                <p className="text-sm text-slate-600 dark:text-[#9BB8B5]">
                  Crea una materia y graba tu primer audio, o carga el ejemplo opcional para probar los controles Bluetooth de inmediato.
                </p>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {lastPlaylist && lastPlaylistTracks.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    void resumeLastSession();
                    setActiveSection('reproductor');
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B7D6E] dark:bg-[#14E3C3] text-white dark:text-[#060909] px-5 py-2.5 text-sm font-bold hover:opacity-90 min-h-[44px] cursor-pointer whitespace-nowrap"
                >
                  <Play className="w-4 h-4 shrink-0" />
                  <span>Reanudar reproducción</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenPlaylist(lastPlaylist.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-[#1E3F41] px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-[#D1E5E3] hover:bg-slate-100 dark:hover:bg-[#102A2C] min-h-[44px] cursor-pointer whitespace-nowrap"
                >
                  <span>Ver lista completa</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setActiveSection('materias')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-[#1E3F41] px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-[#D1E5E3] hover:bg-slate-100 dark:hover:bg-[#102A2C] min-h-[44px] cursor-pointer whitespace-nowrap"
              >
                <FolderPlus className="w-4 h-4" />
                <span>Organizar materias</span>
              </button>
            )}
          </div>
        </div>

        {/* Resumen rápido de biblioteca + Datos opcionales */}
        <div className="rounded-2xl bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#193537] p-6 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <h2 className="font-display text-base font-bold text-slate-950 dark:text-white">
              Tu biblioteca local
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-mono text-2xl font-bold tabular-nums text-[#0B7D6E] dark:text-[#14E3C3]">
                  {subjects.length}
                </div>
                <div className="text-slate-600 dark:text-[#8FB3B0]">Materias</div>
              </div>
              <div>
                <div className="font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                  {activeTracks.length}
                </div>
                <div className="text-slate-600 dark:text-[#8FB3B0]">Audios activos</div>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-[#7E9E9B] leading-relaxed">
              Tus grabaciones permanecen únicamente en este dispositivo dentro de IndexedDB y funcionan sin conexión.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-[#152D2F]">
            {!hasDemoData ? (
              <button
                type="button"
                onClick={() => void loadDemoData()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-[#1E3F41] px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-[#C5DFDD] hover:bg-slate-100 dark:hover:bg-[#102A2C] transition-colors min-h-[44px] cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4 text-[#0B7D6E] dark:text-[#14E3C3] shrink-0" />
                <span>Cargar ejemplo de estudio</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void clearDemoData()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-[#1E3F41] px-4 py-2.5 text-xs font-medium text-slate-600 dark:text-[#9BB8B5] hover:text-red-600 dark:hover:text-red-300 hover:bg-slate-100 dark:hover:bg-[#102A2C] transition-colors min-h-[44px] cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Eliminar datos de ejemplo</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Acceso rápido a Materias */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            Acceso a materias
          </h2>
          <button
            type="button"
            onClick={() => setActiveSection('materias')}
            className="text-sm font-medium text-[#0B7D6E] dark:text-[#14E3C3] hover:underline cursor-pointer min-h-[44px] px-2"
          >
            Administrar materias
          </button>
        </div>

        {subjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-[#1F3F41] p-8 text-center space-y-3">
            <BookOpen className="w-8 h-8 mx-auto text-slate-400 dark:text-[#5B827F]" />
            <p className="text-sm text-slate-600 dark:text-[#9BB8B5] max-w-md mx-auto">
              Todavía no creaste ninguna materia. Crea tu primera materia (por ejemplo Geografía, Biología o Ciudadanía) o carga el ejemplo opcional para probar la app.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setActiveSection('materias')}
                className="rounded-xl bg-[#0B7D6E] dark:bg-[#14E3C3] text-white dark:text-[#060909] px-4 py-2.5 text-sm font-semibold min-h-[44px] cursor-pointer"
              >
                Crear primera materia
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map((subject) => {
              const subjectTopics = topics.filter((t) => t.subjectId === subject.id);
              const subjectPlaylists = playlists.filter((p) => p.subjectId === subject.id);
              const subjectAudioCount = activeTracks.filter((tr) => tr.subjectId === subject.id).length;

              return (
                <div
                  key={subject.id}
                  className="rounded-2xl bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#193537] p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenSubject(subject.id)}
                      className="text-left group cursor-pointer w-full"
                    >
                      <h3 className="font-display text-base font-bold text-slate-950 dark:text-white group-hover:text-[#0B7D6E] dark:group-hover:text-[#14E3C3] transition-colors truncate">
                        {subject.name}
                      </h3>
                    </button>
                    <p className="text-xs text-slate-500 dark:text-[#8FB3B0] font-mono tabular-nums">
                      {subjectTopics.length} {subjectTopics.length === 1 ? 'tema' : 'temas'} ·{' '}
                      {subjectPlaylists.length}{' '}
                      {subjectPlaylists.length === 1 ? 'playlist' : 'playlists'} ·{' '}
                      {subjectAudioCount} {subjectAudioCount === 1 ? 'audio' : 'audios'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-[#152D2F]">
                    <button
                      type="button"
                      onClick={() => handleOpenSubject(subject.id)}
                      className="text-xs font-semibold text-slate-700 dark:text-[#C5DFDD] hover:text-[#0B7D6E] dark:hover:text-[#14E3C3] min-h-[40px] px-2 cursor-pointer"
                    >
                      Abrir temas
                    </button>
                    {subjectPlaylists[0] && (
                      <button
                        type="button"
                        onClick={() => {
                          void playPlaylist(subjectPlaylists[0].id);
                          setActiveSection('reproductor');
                        }}
                        aria-label={`Reproducir ${subjectPlaylists[0].name}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#0D3B3E]/10 dark:bg-[#102E30] text-[#0B7D6E] dark:text-[#14E3C3] px-3 py-2 text-xs font-bold hover:opacity-85 min-h-[40px] cursor-pointer whitespace-nowrap"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Reproducir</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
