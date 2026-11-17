import React, { useMemo, useState } from 'react';
import {
  ChevronRight,
  Edit3,
  FolderPlus,
  ListPlus,
  Play,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useAudioStudy } from '../app/AudioStudyContext';
import { formatDuration } from '../utils/audioUtils';

export const MateriasPage: React.FC = () => {
  const {
    subjects,
    topics,
    playlists,
    tracks,
    selectedSubjectId,
    setSelectedSubjectId,
    setSelectedPlaylistId,
    setActiveSection,
    createSubject,
    updateSubject,
    deleteSubject,
    createTopic,
    updateTopic,
    deleteTopic,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    playPlaylist,
    showBanner,
  } = useAudioStudy();

  const [searchQuery, setSearchQuery] = useState('');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editingSubjectName, setEditingSubjectName] = useState('');

  const [newTopicNameBySubject, setNewTopicNameBySubject] = useState<Record<string, string>>({});
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingTopicName, setEditingTopicName] = useState('');

  const [newPlaylistNameByTopic, setNewPlaylistNameByTopic] = useState<Record<string, string>>({});
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [editingPlaylistName, setEditingPlaylistName] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'subject' | 'topic' | 'playlist';
    id: string;
    label: string;
  } | null>(null);

  const activeTracks = useMemo(() => tracks.filter((t) => t.status === 'active'), [tracks]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return activeTracks.filter((t) => t.title.toLowerCase().includes(q));
  }, [activeTracks, searchQuery]);

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSubjectName.trim();
    if (!trimmed) {
      showBanner('warning', 'Escribe un nombre para la materia.');
      return;
    }
    const created = await createSubject(trimmed);
    setNewSubjectName('');
    setSelectedSubjectId(created.id);
    showBanner('success', `Materia "${created.name}" creada.`);
  };

  const handleCreateTopic = async (subjectId: string) => {
    const name = (newTopicNameBySubject[subjectId] || '').trim();
    if (!name) {
      showBanner('warning', 'Escribe un nombre para el tema.');
      return;
    }
    const created = await createTopic(subjectId, name);
    setNewTopicNameBySubject((prev) => ({ ...prev, [subjectId]: '' }));
    showBanner('success', `Tema "${created.name}" agregado.`);
  };

  const handleCreatePlaylist = async (subjectId: string, topicId: string) => {
    const name = (newPlaylistNameByTopic[topicId] || '').trim();
    if (!name) {
      showBanner('warning', 'Escribe un nombre para la playlist.');
      return;
    }
    const created = await createPlaylist(subjectId, topicId, name);
    setNewPlaylistNameByTopic((prev) => ({ ...prev, [topicId]: '' }));
    showBanner('success', `Playlist "${created.name}" creada.`);
  };

  const executeConfirmDelete = async () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === 'subject') {
      await deleteSubject(confirmDelete.id);
      if (selectedSubjectId === confirmDelete.id) setSelectedSubjectId(null);
    } else if (confirmDelete.type === 'topic') {
      await deleteTopic(confirmDelete.id);
    } else {
      await deletePlaylist(confirmDelete.id);
    }
    showBanner('info', `Se eliminó "${confirmDelete.label}".`);
    setConfirmDelete(null);
  };

  const displayedSubjects = selectedSubjectId
    ? subjects.filter((s) => s.id === selectedSubjectId)
    : subjects;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 dark:border-[#162C2E] pb-5">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#0B1C1E] dark:text-white">
            Materias, temas y playlists
          </h1>
          <p className="text-sm text-slate-600 dark:text-[#9BB8B5] mt-1">
            Estructura tu estudio en orden: Materia &rarr; Tema &rarr; Playlist &rarr; Audios.
          </p>
        </div>

        {selectedSubjectId && (
          <button
            type="button"
            onClick={() => setSelectedSubjectId(null)}
            className="text-sm font-semibold text-[#0B7D6E] dark:text-[#14E3C3] hover:underline min-h-[44px] px-2 cursor-pointer self-start sm:self-auto"
          >
            Ver todas las materias
          </button>
        )}
      </div>

      {/* Buscador de grabaciones por título */}
      <div className="space-y-3">
        <label htmlFor="search-recordings" className="sr-only">
          Buscar una grabación por su título
        </label>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="search-recordings"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar grabación por su título (ej. ¿Qué es el clima?, soberanía...)"
            className="w-full rounded-xl bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#1A3537] pl-10 pr-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#14E3C3]"
          />
        </div>

        {searchQuery.trim() && (
          <div className="rounded-2xl bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#193537] p-4 space-y-2">
            <div className="text-xs font-semibold text-slate-500 dark:text-[#8FB3B0]">
              Resultados ({searchResults.length})
            </div>
            {searchResults.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-[#9BB8B5]">
                No se encontraron grabaciones activas que coincidan con "{searchQuery}".
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-[#152D2F]">
                {searchResults.map((track) => {
                  const sub = subjects.find((s) => s.id === track.subjectId);
                  const top = topics.find((t) => t.id === track.topicId);
                  const pl = playlists.find((p) => p.id === track.playlistId);
                  return (
                    <li
                      key={track.id}
                      className="py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {track.title}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-[#8FB3B0] truncate">
                          {sub?.name} · {top?.name} · {pl?.name} ·{' '}
                          <span className="font-mono tabular-nums">
                            {formatDuration(track.durationSec)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void playPlaylist(track.playlistId, track.id);
                          setActiveSection('reproductor');
                        }}
                        aria-label={`Reproducir ${track.title}`}
                        className="min-h-[40px] px-3 rounded-xl bg-[#0B7D6E] dark:bg-[#14E3C3] text-white dark:text-[#060909] text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Escuchar</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Formulario para crear nueva materia */}
      <form
        onSubmit={(e) => void handleCreateSubject(e)}
        className="flex flex-col sm:flex-row gap-3 rounded-2xl bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#193537] p-4"
      >
        <label htmlFor="new-subject-input" className="sr-only">
          Nombre de la nueva materia
        </label>
        <input
          id="new-subject-input"
          type="text"
          value={newSubjectName}
          onChange={(e) => setNewSubjectName(e.target.value)}
          placeholder="Nueva materia (ej. Geografía, Biología, Ciudadanía)"
          className="flex-1 rounded-xl bg-slate-50 dark:bg-[#060C0D] border border-slate-200 dark:border-[#1A3537] px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#14E3C3]"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B7D6E] dark:bg-[#14E3C3] text-white dark:text-[#060909] px-5 py-2.5 text-sm font-bold hover:opacity-90 min-h-[44px] cursor-pointer whitespace-nowrap"
        >
          <FolderPlus className="w-4 h-4" />
          <span>Crear materia</span>
        </button>
      </form>

      {/* Listado de materias y sus temas */}
      {displayedSubjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-[#1F3F41] p-8 text-center text-sm text-slate-600 dark:text-[#9BB8B5]">
          No hay materias registradas todavía. Usa el formulario superior para crear la primera.
        </div>
      ) : (
        <div className="space-y-6">
          {displayedSubjects.map((subject) => {
            const subjectTopics = topics.filter((t) => t.subjectId === subject.id);
            const isEditingSub = editingSubjectId === subject.id;

            return (
              <section
                key={subject.id}
                className="rounded-2xl bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#193537] p-5 sm:p-6 space-y-5"
              >
                {/* Cabecera de Materia */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-[#152D2F] pb-4">
                  {isEditingSub ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        type="text"
                        value={editingSubjectName}
                        onChange={(e) => setEditingSubjectName(e.target.value)}
                        aria-label="Editar nombre de materia"
                        className="flex-1 rounded-xl bg-slate-50 dark:bg-[#060C0D] border border-slate-300 dark:border-[#1F3F41] px-3 py-2 text-sm text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (editingSubjectName.trim()) {
                            void updateSubject(subject.id, editingSubjectName);
                          }
                          setEditingSubjectId(null);
                        }}
                        className="rounded-xl bg-[#0B7D6E] dark:bg-[#14E3C3] text-white dark:text-[#060909] px-3.5 py-2 text-xs font-bold min-h-[40px] cursor-pointer"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSubjectId(null)}
                        className="rounded-xl border border-slate-200 dark:border-[#1E3F41] px-3 py-2 text-xs min-h-[40px] cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <>
                      <div>
                        <h2 className="font-display text-xl font-bold text-slate-950 dark:text-white">
                          {subject.name}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-[#8FB3B0] font-mono tabular-nums mt-0.5">
                          {subjectTopics.length} {subjectTopics.length === 1 ? 'tema' : 'temas'} ·{' '}
                          {activeTracks.filter((tr) => tr.subjectId === subject.id).length} audios
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSubjectId(subject.id);
                            setEditingSubjectName(subject.name);
                          }}
                          aria-label={`Editar materia ${subject.name}`}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#102A2C] cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDelete({
                              type: 'subject',
                              id: subject.id,
                              label: subject.name,
                            })
                          }
                          aria-label={`Eliminar materia ${subject.name}`}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-[#102A2C] cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Crear tema dentro de la materia */}
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={newTopicNameBySubject[subject.id] || ''}
                    onChange={(e) =>
                      setNewTopicNameBySubject((prev) => ({
                        ...prev,
                        [subject.id]: e.target.value,
                      }))
                    }
                    placeholder={`Agregar tema en ${subject.name} (ej. El clima)`}
                    aria-label={`Nuevo tema en ${subject.name}`}
                    className="flex-1 rounded-xl bg-slate-50 dark:bg-[#060C0D] border border-slate-200 dark:border-[#1A3537] px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => void handleCreateTopic(subject.id)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-[#1E3F41] px-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-[#D1E5E3] hover:bg-slate-100 dark:hover:bg-[#102A2C] min-h-[44px] cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar tema</span>
                  </button>
                </div>

                {/* Lista de temas */}
                {subjectTopics.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-[#7E9E9B]">
                    Sin temas aún. Crea un tema para poder añadir playlists de estudio.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {subjectTopics.map((topic) => {
                      const topicPlaylists = playlists.filter((p) => p.topicId === topic.id);
                      const topicAudioCount = activeTracks.filter((tr) => tr.topicId === topic.id).length;
                      const isEditingTop = editingTopicId === topic.id;

                      return (
                        <div
                          key={topic.id}
                          className="rounded-xl bg-slate-50/80 dark:bg-[#071011] border border-slate-200/80 dark:border-[#142B2D] p-4 space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            {isEditingTop ? (
                              <div className="flex flex-1 items-center gap-2">
                                <input
                                  type="text"
                                  value={editingTopicName}
                                  onChange={(e) => setEditingTopicName(e.target.value)}
                                  aria-label="Editar nombre del tema"
                                  className="flex-1 rounded-lg bg-white dark:bg-[#0B1617] border border-slate-300 dark:border-[#1F3F41] px-3 py-1.5 text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (editingTopicName.trim()) {
                                      void updateTopic(topic.id, editingTopicName);
                                    }
                                    setEditingTopicId(null);
                                  }}
                                  className="rounded-lg bg-[#0B7D6E] dark:bg-[#14E3C3] text-white dark:text-[#060909] px-3 py-1.5 text-xs font-bold min-h-[36px] cursor-pointer"
                                >
                                  Guardar
                                </button>
                              </div>
                            ) : (
                              <>
                                <div>
                                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                    {topic.name}
                                  </h3>
                                  <p className="text-xs text-slate-500 dark:text-[#8FB3B0] font-mono tabular-nums">
                                    {topicAudioCount}{' '}
                                    {topicAudioCount === 1 ? 'audio guardado' : 'audios guardados'} ·{' '}
                                    {topicPlaylists.length}{' '}
                                    {topicPlaylists.length === 1 ? 'playlist' : 'playlists'}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingTopicId(topic.id);
                                      setEditingTopicName(topic.name);
                                    }}
                                    aria-label={`Editar tema ${topic.name}`}
                                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setConfirmDelete({
                                        type: 'topic',
                                        id: topic.id,
                                        label: topic.name,
                                      })
                                    }
                                    aria-label={`Eliminar tema ${topic.name}`}
                                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Playlists del tema */}
                          <div className="space-y-2">
                            {topicPlaylists.map((pl) => {
                              const plTracks = activeTracks.filter((tr) => tr.playlistId === pl.id);
                              const isEditingPl = editingPlaylistId === pl.id;

                              return (
                                <div
                                  key={pl.id}
                                  className="rounded-xl bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#193537] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2"
                                >
                                  {isEditingPl ? (
                                    <div className="flex flex-1 items-center gap-2">
                                      <input
                                        type="text"
                                        value={editingPlaylistName}
                                        onChange={(e) => setEditingPlaylistName(e.target.value)}
                                        aria-label="Cambiar nombre de playlist"
                                        className="flex-1 rounded-lg bg-slate-50 dark:bg-[#060C0D] border border-slate-300 dark:border-[#1F3F41] px-2.5 py-1.5 text-sm"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (editingPlaylistName.trim()) {
                                            void renamePlaylist(pl.id, editingPlaylistName);
                                          }
                                          setEditingPlaylistId(null);
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
                                          setSelectedPlaylistId(pl.id);
                                          setActiveSection('playlist');
                                        }}
                                        className="flex-1 min-w-0 text-left flex items-center gap-2 cursor-pointer group"
                                      >
                                        <span className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-[#0B7D6E] dark:group-hover:text-[#14E3C3] truncate">
                                          {pl.name}
                                        </span>
                                        <span className="text-xs text-slate-500 dark:text-[#8FB3B0] font-mono tabular-nums shrink-0">
                                          · {plTracks.length}
                                        </span>
                                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                                      </button>

                                      <div className="flex items-center gap-1 shrink-0">
                                        {plTracks.length > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              void playPlaylist(pl.id);
                                              setActiveSection('reproductor');
                                            }}
                                            aria-label={`Reproducir playlist ${pl.name}`}
                                            className="min-h-[36px] px-2.5 rounded-lg bg-[#0D3B3E]/10 dark:bg-[#102E30] text-[#0B7D6E] dark:text-[#14E3C3] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                                          >
                                            <Play className="w-3.5 h-3.5" />
                                            <span>Reproducir</span>
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingPlaylistId(pl.id);
                                            setEditingPlaylistName(pl.name);
                                          }}
                                          aria-label={`Renombrar playlist ${pl.name}`}
                                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setConfirmDelete({
                                              type: 'playlist',
                                              id: pl.id,
                                              label: pl.name,
                                            })
                                          }
                                          aria-label={`Eliminar playlist ${pl.name}`}
                                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Crear playlist dentro del tema */}
                          <div className="flex gap-2 pt-1">
                            <input
                              type="text"
                              value={newPlaylistNameByTopic[topic.id] || ''}
                              onChange={(e) =>
                                setNewPlaylistNameByTopic((prev) => ({
                                  ...prev,
                                  [topic.id]: e.target.value,
                                }))
                              }
                              placeholder={`Nueva playlist en ${topic.name}`}
                              aria-label={`Nueva playlist en ${topic.name}`}
                              className="flex-1 rounded-lg bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#1A3537] px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400"
                            />
                            <button
                              type="button"
                              onClick={() => void handleCreatePlaylist(subject.id, topic.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-[#102E30] text-white dark:text-[#14E3C3] px-3 py-2 text-xs font-semibold min-h-[38px] cursor-pointer whitespace-nowrap"
                            >
                              <ListPlus className="w-3.5 h-3.5" />
                              <span>Crear playlist</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Diálogo de confirmación para borrado estructural */}
      {confirmDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-hierarchy"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#1B3537] p-6 space-y-4 shadow-2xl">
            <h3 id="confirm-delete-hierarchy" className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Confirmar eliminación
            </h3>
            <p className="text-sm text-slate-600 dark:text-[#9BB8B5]">
              ¿Seguro que deseas eliminar <strong>{confirmDelete.label}</strong> y sus elementos internos? Esta acción no se puede deshacer.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-xl border border-slate-200 dark:border-[#1E3F41] px-4 py-2 text-sm font-medium min-h-[44px] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void executeConfirmDelete()}
                className="rounded-xl bg-red-600 text-white px-4 py-2 text-sm font-bold min-h-[44px] cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
