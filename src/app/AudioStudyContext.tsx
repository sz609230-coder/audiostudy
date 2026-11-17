import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AppSection,
  AudioTrack,
  HeadsetControlConfig,
  PlaybackEngineState,
  PlaybackProgress,
  Playlist,
  StorageStats,
  Subject,
  ThemeMode,
  Topic,
  TrashItem,
  UserSettings,
} from '../types/audioStudy';
import {
  DEFAULT_PROGRESS,
  DEFAULT_USER_SETTINGS,
  deleteRecord,
  getAudioBlob,
  getStorageStats,
  importMergedBackupAtomic,
  loadAllLibraryData,
  moveTrackToTrashAtomic,
  permanentlyDeleteTracksAtomic,
  putManyRecords,
  putRecord,
  requestPersistentStorage,
  restoreTrackFromTrashAtomic,
  saveAudioTrackWithBlob,
  savePlaybackProgress,
  saveSettings,
  STORE_PLAYLISTS,
  STORE_SUBJECTS,
  STORE_TOPICS,
  STORE_TRACKS,
  STORE_TRASH,
} from '../services/database/indexedDb';
import {
  advanceOnTrackEnd,
  buildPlaylistQueue,
  createInitialPlaybackState,
  getActivePlaylistTracks,
  goToNextTrackWithoutArchive,
  goToPreviousTrack,
  normalizePlaylistOrder,
  reorderTrackInPlaylist,
  skipCurrentTrackToTrash,
} from '../services/playback/playbackEngine';
import { WebAudioPlayer } from '../services/playback/webAudioPlayer';
import {
  registerMediaSessionHandlers,
  updateMediaSessionMetadata,
  updateMediaSessionPlaybackState,
  updateMediaSessionPosition,
} from '../services/media-session/mediaSessionService';
import { createStableId, getExtensionFromMimeType, sanitizeFilename } from '../utils/audioUtils';
import { buildOptionalDemoData } from '../services/demo/demoSeedService';
import {
  computeSafeBackupMerge,
  createBackupBundle,
  validateBackupJson,
} from '../services/backup/backupService';

export interface NotificationBanner {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

interface AudioStudyContextValue {
  isReady: boolean;
  activeSection: AppSection;
  setActiveSection: (section: AppSection) => void;
  selectedPlaylistId: string | null;
  setSelectedPlaylistId: (id: string | null) => void;
  selectedSubjectId: string | null;
  setSelectedSubjectId: (id: string | null) => void;

  subjects: Subject[];
  topics: Topic[];
  playlists: Playlist[];
  tracks: AudioTrack[];
  trashItems: TrashItem[];
  settings: UserSettings;
  lastSavedProgress: PlaybackProgress;
  playback: PlaybackEngineState;
  storageStats: StorageStats;
  banner: NotificationBanner | null;
  dismissBanner: () => void;
  showBanner: (type: NotificationBanner['type'], message: string) => void;

  // Tema y ajustes
  setTheme: (theme: ThemeMode) => Promise<void>;
  updateHeadsetConfig: (patch: Partial<HeadsetControlConfig>) => Promise<void>;
  toggleRepeatPlaylist: () => Promise<void>;
  toggleAutoResume: () => Promise<void>;
  requestPersistStorage: () => Promise<boolean>;
  refreshStorageStats: () => Promise<void>;

  // Materias, temas, playlists
  createSubject: (name: string, color?: string) => Promise<Subject>;
  updateSubject: (id: string, name: string, color?: string) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  createTopic: (subjectId: string, name: string) => Promise<Topic>;
  updateTopic: (id: string, name: string) => Promise<void>;
  deleteTopic: (id: string) => Promise<void>;
  createPlaylist: (subjectId: string, topicId: string, name: string) => Promise<Playlist>;
  createDirectPlaylist: (playlistName: string, subjectName?: string, topicName?: string) => Promise<Playlist>;
  renamePlaylist: (id: string, name: string) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;

  // Grabaciones
  saveNewRecording: (params: {
    playlistId: string;
    title: string;
    durationSec: number;
    blob: Blob;
    mimeType: string;
  }) => Promise<AudioTrack>;
  importAudioFileToPlaylist: (playlistId: string, file: File, customTitle?: string) => Promise<AudioTrack>;
  renameTrack: (trackId: string, newTitle: string) => Promise<void>;
  moveTrackToPlaylist: (trackId: string, targetPlaylistId: string) => Promise<void>;
  reorderTrack: (playlistId: string, trackId: string, direction: 'up' | 'down') => Promise<void>;
  archiveTrackManually: (trackId: string) => Promise<void>;
  restoreFromTrash: (trashItemId: string) => Promise<void>;
  permanentlyDeleteTrashItem: (trashItemId: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  undoLastSkip: () => Promise<void>;
  downloadTrackFile: (trackId: string) => Promise<void>;

  // Reproductor
  playPlaylist: (playlistId: string, startTrackId?: string, startPositionSec?: number) => Promise<void>;
  resumeLastSession: () => Promise<void>;
  togglePlayPause: () => Promise<void>;
  pausePlayback: () => void;
  resumePlayback: () => Promise<void>;
  skipNextAndArchive: () => Promise<void>;
  nextWithoutArchive: () => Promise<void>;
  previousTrack: () => Promise<void>;
  seekTo: (seconds: number) => void;
  setVolume: (volume: number) => void;

  // Copias de seguridad y demo
  exportAllBackup: () => Promise<void>;
  exportPlaylistBackup: (playlistId: string) => Promise<void>;
  importBackupFile: (file: File) => Promise<{ importedTracks: number; skippedDuplicates: number }>;
  loadDemoData: () => Promise<void>;
  clearDemoData: () => Promise<void>;
  hasDemoData: boolean;
}

const AudioStudyContext = createContext<AudioStudyContextValue | null>(null);

export const AudioStudyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [activeSection, setActiveSection] = useState<AppSection>('inicio');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [lastSavedProgress, setLastSavedProgress] = useState<PlaybackProgress>(DEFAULT_PROGRESS);
  const [playback, setPlayback] = useState<PlaybackEngineState>(() => createInitialPlaybackState());
  const [storageStats, setStorageStats] = useState<StorageStats>({
    usageBytes: 0,
    quotaBytes: 0,
    percentUsed: 0,
    persisted: false,
    supported: false,
    nearLimit: false,
  });
  const [banner, setBanner] = useState<NotificationBanner | null>(null);

  const playerRef = useRef<WebAudioPlayer | null>(null);
  const stateRef = useRef({
    subjects,
    topics,
    playlists,
    tracks,
    trashItems,
    settings,
    playback,
  });

  useEffect(() => {
    stateRef.current = {
      subjects,
      topics,
      playlists,
      tracks,
      trashItems,
      settings,
      playback,
    };
  }, [subjects, topics, playlists, tracks, trashItems, settings, playback]);

  const bannerTimerRef = useRef<number | null>(null);

  const showBanner = useCallback((type: NotificationBanner['type'], message: string) => {
    const id = createStableId('msg');
    setBanner({ id, type, message });
    if (bannerTimerRef.current) {
      window.clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
    if (type === 'success' || type === 'info') {
      bannerTimerRef.current = window.setTimeout(() => {
        setBanner((current) => (current?.id === id ? null : current));
      }, 4500);
    }
  }, []);

  const dismissBanner = useCallback(() => {
    if (bannerTimerRef.current) {
      window.clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
    setBanner(null);
  }, []);

  // Sincronizar tema claro/oscuro con <html class="dark">
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', settings.theme === 'dark' ? '#060909' : '#F4F7F7');
    }
  }, [settings.theme]);

  const refreshStorageStats = useCallback(async () => {
    const stats = await getStorageStats();
    setStorageStats(stats);
  }, []);

  // Inicializar base de datos local al arrancar
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await loadAllLibraryData();
        if (!mounted) return;
        setSubjects(data.subjects);
        setTopics(data.topics);
        setPlaylists(data.playlists);
        setTracks(data.tracks);
        setTrashItems(data.trashItems);
        setSettings(data.settings);
        setLastSavedProgress(data.progress);
        setPlayback((prev) => ({
          ...prev,
          repeatPlaylist: data.settings.repeatPlaylist,
          volume: data.settings.defaultVolume,
        }));

        if (data.progress.playlistId) {
          setSelectedPlaylistId(data.progress.playlistId);
        } else if (data.playlists.length > 0) {
          setSelectedPlaylistId(data.playlists[0].id);
        }

        // Soporte ?demo=1 para pruebas deterministas rápidas cuando está vacío
        const params = new URLSearchParams(window.location.search);
        if (params.get('demo') === '1' && data.subjects.length === 0) {
          const demo = buildOptionalDemoData();
          await importMergedBackupAtomic({
            subjects: demo.subjects,
            topics: demo.topics,
            playlists: demo.playlists,
            tracksWithBlobs: demo.tracksWithBlobs,
            trashItems: [],
          });
          if (!mounted) return;
          setSubjects(demo.subjects);
          setTopics(demo.topics);
          setPlaylists(demo.playlists);
          setTracks(demo.tracksWithBlobs.map((x) => x.track));
          setSelectedPlaylistId(demo.playlists[0].id);
        }

        await refreshStorageStats();
      } catch (err) {
        showBanner(
          'error',
          err instanceof Error
            ? err.message
            : 'No se pudo cargar tu biblioteca local desde IndexedDB.'
        );
      } finally {
        if (mounted) setIsReady(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [refreshStorageStats, showBanner]);

  const loadAndStartTrack = useCallback(
    async (track: AudioTrack, startPositionSec = 0, autoPlay = true) => {
      const player = playerRef.current;
      if (!player) return;

      const { subjects: subs, topics: tops, playlists: pls, settings: cfg } = stateRef.current;
      const subject = subs.find((s) => s.id === track.subjectId);
      const topic = tops.find((t) => t.id === track.topicId);
      const playlist = pls.find((p) => p.id === track.playlistId);

      try {
        const blob = await getAudioBlob(track.id);
        if (!blob) {
          setPlayback((prev) => ({
            ...prev,
            status: 'error',
            errorMessage: `No se encontró el archivo de audio para "${track.title}".`,
          }));
          showBanner('error', `El archivo de "${track.title}" no existe en el almacenamiento local.`);
          return;
        }

        player.setVolume(cfg.defaultVolume);
        await player.loadTrack(track, blob, startPositionSec);

        updateMediaSessionMetadata({
          title: track.title,
          subjectName: subject?.name ?? 'Sin materia',
          topicName: topic?.name ?? 'Sin tema',
          playlistName: playlist?.name ?? 'Playlist de estudio',
        });

        if (autoPlay) {
          await player.play();
          setPlayback((prev) => ({
            ...prev,
            status: 'playing',
            currentTrackId: track.id,
            currentPlaylistId: track.playlistId,
            currentTimeSec: startPositionSec,
            durationSec: track.durationSec,
            errorMessage: null,
            endedMessage: null,
          }));
          updateMediaSessionPlaybackState('playing');
        } else {
          setPlayback((prev) => ({
            ...prev,
            status: 'paused',
            currentTrackId: track.id,
            currentPlaylistId: track.playlistId,
            currentTimeSec: startPositionSec,
            durationSec: track.durationSec,
            errorMessage: null,
            endedMessage: null,
          }));
          updateMediaSessionPlaybackState('paused');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al iniciar la reproducción.';
        setPlayback((prev) => ({
          ...prev,
          status: 'paused',
          errorMessage: msg,
        }));
        showBanner('warning', msg);
      }
    },
    [showBanner]
  );

  // Guardar progreso de reproducción de forma periódica sin saturar IndexedDB
  const lastProgressSavedAtRef = useRef<number>(0);

  // Instanciar único WebAudioPlayer
  useEffect(() => {
    const player = new WebAudioPlayer({
      onTimeUpdate: (currentTimeSec, durationSec) => {
        setPlayback((prev) => ({
          ...prev,
          currentTimeSec,
          durationSec: durationSec > 0 ? durationSec : prev.durationSec,
        }));
        updateMediaSessionPosition(durationSec, currentTimeSec);

        const now = Date.now();
        if (now - lastProgressSavedAtRef.current > 2000) {
          lastProgressSavedAtRef.current = now;
          const cur = stateRef.current.playback;
          if (cur.currentTrackId && cur.currentPlaylistId) {
            const prog: PlaybackProgress = {
              id: 'playback_progress',
              playlistId: cur.currentPlaylistId,
              trackId: cur.currentTrackId,
              positionSec: currentTimeSec,
              updatedAt: now,
            };
            setLastSavedProgress(prog);
            void savePlaybackProgress(prog);
          }
        }
      },
      onPlayStateChange: (isPlaying) => {
        setPlayback((prev) => {
          if (prev.status === 'completed' || prev.status === 'loading') return prev;
          return { ...prev, status: isPlaying ? 'playing' : 'paused' };
        });
        updateMediaSessionPlaybackState(isPlaying ? 'playing' : 'paused');
      },
      onEnded: () => {
        // IMPORTANTE: Al terminar normalmente, avanzar SIN eliminar ni archivar la pista
        const cur = stateRef.current;
        const transition = advanceOnTrackEnd(cur.playback, cur.tracks);
        setPlayback(transition.nextState);
        if (transition.nextTrackToLoad && transition.shouldAutoPlay) {
          void loadAndStartTrack(transition.nextTrackToLoad, 0, true);
        } else {
          updateMediaSessionPlaybackState('none');
        }
      },
      onError: (message) => {
        setPlayback((prev) => ({ ...prev, status: 'error', errorMessage: message }));
        showBanner('error', message);
      },
    });

    playerRef.current = player;
    return () => {
      player.destroy();
      playerRef.current = null;
    };
  }, [loadAndStartTrack, showBanner]);

  // Detectar cambios en dispositivos Bluetooth / audio (desconexión o reconexión)
  useEffect(() => {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.addEventListener !== 'function') {
      return;
    }
    const handleDeviceChange = () => {
      const cur = stateRef.current.playback;
      if (cur.status === 'playing') {
        showBanner(
          'info',
          'Cambio detectado en el dispositivo de audio / Bluetooth. Los controles multimedia siguen sincronizados.'
        );
      }
    };
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [showBanner]);

  const playPlaylist = useCallback(
    async (playlistId: string, startTrackId?: string, startPositionSec = 0) => {
      const activeTracks = getActivePlaylistTracks(stateRef.current.tracks, playlistId);
      if (activeTracks.length === 0) {
        showBanner('warning', 'Esta playlist está vacía. Graba o mueve un audio antes de reproducir.');
        return;
      }

      const targetTrack =
        (startTrackId ? activeTracks.find((t) => t.id === startTrackId) : activeTracks[0]) ??
        activeTracks[0];

      const queueIds = activeTracks.map((t) => t.id);
      setSelectedPlaylistId(playlistId);
      setPlayback((prev) => ({
        ...prev,
        status: 'loading',
        currentPlaylistId: playlistId,
        currentTrackId: targetTrack.id,
        queueTrackIds: queueIds,
        currentTimeSec: startPositionSec,
        durationSec: targetTrack.durationSec,
        endedMessage: null,
        errorMessage: null,
      }));

      const prog: PlaybackProgress = {
        id: 'playback_progress',
        playlistId,
        trackId: targetTrack.id,
        positionSec: startPositionSec,
        updatedAt: Date.now(),
      };
      setLastSavedProgress(prog);
      await savePlaybackProgress(prog);

      await loadAndStartTrack(targetTrack, startPositionSec, true);
    },
    [loadAndStartTrack, showBanner]
  );

  const resumeLastSession = useCallback(async () => {
    const prog = lastSavedProgress;
    if (!prog.playlistId || !prog.trackId) {
      showBanner('info', 'Todavía no hay una sesión reciente para reanudar.');
      return;
    }
    const trackExists = stateRef.current.tracks.some(
      (t) => t.id === prog.trackId && t.status === 'active'
    );
    await playPlaylist(
      prog.playlistId,
      trackExists ? prog.trackId : undefined,
      trackExists && settings.autoResumeLastPosition ? prog.positionSec : 0
    );
  }, [lastSavedProgress, playPlaylist, settings.autoResumeLastPosition, showBanner]);

  const pausePlayback = useCallback(() => {
    playerRef.current?.pause();
    setPlayback((prev) => ({ ...prev, status: 'paused' }));
    updateMediaSessionPlaybackState('paused');
  }, []);

  const resumePlayback = useCallback(async () => {
    const cur = stateRef.current.playback;
    if (!cur.currentTrackId && cur.currentPlaylistId) {
      await playPlaylist(cur.currentPlaylistId);
      return;
    }
    if (!cur.currentTrackId) {
      showBanner('info', 'Selecciona una playlist o grabación para reproducir.');
      return;
    }
    try {
      await playerRef.current?.play();
      setPlayback((prev) => ({ ...prev, status: 'playing', errorMessage: null }));
      updateMediaSessionPlaybackState('playing');
    } catch (err) {
      showBanner('error', err instanceof Error ? err.message : 'No se pudo reanudar la reproducción.');
    }
  }, [playPlaylist, showBanner]);

  const togglePlayPause = useCallback(async () => {
    const status = stateRef.current.playback.status;
    if (status === 'playing') {
      pausePlayback();
    } else {
      await resumePlayback();
    }
  }, [pausePlayback, resumePlayback]);

  const skipNextAndArchive = useCallback(async () => {
    const cur = stateRef.current;
    const result = skipCurrentTrackToTrash(cur.playback, cur.tracks, Date.now());
    if (result.throttled || !result.addedTrashItem) return;

    const skippedTrack = result.updatedTracks.find((t) => t.id === result.addedTrashItem!.trackId);
    setTracks(result.updatedTracks);
    setTrashItems((prev) => [result.addedTrashItem!, ...prev]);
    setPlayback(result.nextState);

    if (skippedTrack) {
      try {
        await moveTrackToTrashAtomic(skippedTrack, result.addedTrashItem);
      } catch (err) {
        showBanner('error', err instanceof Error ? err.message : 'No se pudo archivar en la papelera.');
      }
    }

    if (result.nextTrackToLoad && result.shouldAutoPlay) {
      await loadAndStartTrack(result.nextTrackToLoad, 0, true);
    } else {
      playerRef.current?.stop();
      updateMediaSessionPlaybackState('none');
    }
  }, [loadAndStartTrack, showBanner]);

  const nextWithoutArchive = useCallback(async () => {
    const cur = stateRef.current;
    const result = goToNextTrackWithoutArchive(cur.playback, cur.tracks);
    setPlayback(result.nextState);
    if (result.nextTrackToLoad && result.shouldAutoPlay) {
      await loadAndStartTrack(result.nextTrackToLoad, 0, true);
    } else {
      playerRef.current?.stop();
      updateMediaSessionPlaybackState('none');
    }
  }, [loadAndStartTrack]);

  const previousTrack = useCallback(async () => {
    const cur = stateRef.current;
    const result = goToPreviousTrack(cur.playback, cur.tracks);
    setPlayback(result.nextState);
    if (result.restartCurrent) {
      playerRef.current?.seekTo(0);
      return;
    }
    if (result.trackToLoad) {
      await loadAndStartTrack(result.trackToLoad, 0, true);
    }
  }, [loadAndStartTrack]);

  const seekTo = useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds);
    setPlayback((prev) => ({ ...prev, currentTimeSec: seconds }));
  }, []);

  const setVolume = useCallback(async (volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    playerRef.current?.setVolume(clamped);
    setPlayback((prev) => ({ ...prev, volume: clamped }));
    const updated = { ...stateRef.current.settings, defaultVolume: clamped };
    setSettings(updated);
    await saveSettings(updated);
  }, []);

  const undoLastSkip = useCallback(async () => {
    const undo = stateRef.current.playback.lastUndoSkip;
    if (!undo) return;

    const restoredTrack: AudioTrack = {
      ...undo.track,
      status: 'active',
      updatedAt: Date.now(),
    };

    try {
      await restoreTrackFromTrashAtomic(restoredTrack, undo.trashItem.id);
      const nextTracks = stateRef.current.tracks.map((t) =>
        t.id === restoredTrack.id ? restoredTrack : t
      );
      setTracks(nextTracks);
      setTrashItems((prev) => prev.filter((item) => item.id !== undo.trashItem.id));

      const queue = buildPlaylistQueue(nextTracks, undo.playlistId);
      setPlayback((prev) => ({
        ...prev,
        queueTrackIds: queue,
        lastUndoSkip: null,
        endedMessage: null,
      }));
      await loadAndStartTrack(restoredTrack, 0, true);
      showBanner('success', `Se recuperó "${restoredTrack.title}" en su playlist original.`);
    } catch (err) {
      showBanner('error', err instanceof Error ? err.message : 'No se pudo deshacer el último salto.');
    }
  }, [loadAndStartTrack, showBanner]);

  // Registrar controladores Media Session API (pantalla bloqueada y auriculares Bluetooth)
  useEffect(() => {
    return registerMediaSessionHandlers(settings.headsetConfig, {
      onPlay: () => void resumePlayback(),
      onPause: () => pausePlayback(),
      onNextSkipAndArchive: () => void skipNextAndArchive(),
      onNextOnly: () => void nextWithoutArchive(),
      onPrevious: () => void previousTrack(),
      onSeekTo: (sec) => seekTo(sec),
      onStop: () => {
        playerRef.current?.stop();
        setPlayback((prev) => ({ ...prev, status: 'paused', currentTimeSec: 0 }));
      },
    });
  }, [
    settings.headsetConfig,
    resumePlayback,
    pausePlayback,
    skipNextAndArchive,
    nextWithoutArchive,
    previousTrack,
    seekTo,
  ]);

  // Ajustes
  const setTheme = useCallback(async (theme: ThemeMode) => {
    const updated = { ...stateRef.current.settings, theme };
    setSettings(updated);
    await saveSettings(updated);
  }, []);

  const updateHeadsetConfig = useCallback(async (patch: Partial<HeadsetControlConfig>) => {
    const updated: UserSettings = {
      ...stateRef.current.settings,
      headsetConfig: {
        ...stateRef.current.settings.headsetConfig,
        ...patch,
      },
    };
    setSettings(updated);
    await saveSettings(updated);
  }, []);

  const toggleRepeatPlaylist = useCallback(async () => {
    const nextRepeat = !stateRef.current.settings.repeatPlaylist;
    const updated = { ...stateRef.current.settings, repeatPlaylist: nextRepeat };
    setSettings(updated);
    setPlayback((prev) => ({ ...prev, repeatPlaylist: nextRepeat }));
    await saveSettings(updated);
  }, []);

  const toggleAutoResume = useCallback(async () => {
    const updated = {
      ...stateRef.current.settings,
      autoResumeLastPosition: !stateRef.current.settings.autoResumeLastPosition,
    };
    setSettings(updated);
    await saveSettings(updated);
  }, []);

  const requestPersistStorage = useCallback(async () => {
    const granted = await requestPersistentStorage();
    const updated = { ...stateRef.current.settings, persistentStorageRequested: true };
    setSettings(updated);
    await saveSettings(updated);
    await refreshStorageStats();
    showBanner(
      granted ? 'success' : 'info',
      granted
        ? 'Almacenamiento persistente activado. El navegador protegerá tus grabaciones.'
        : 'El navegador decidirá la persistencia automáticamente según el uso de la app.'
    );
    return granted;
  }, [refreshStorageStats, showBanner]);

  // CRUD Materias / Temas / Playlists
  const createSubject = useCallback(async (name: string, color = '#14E3C3') => {
    const now = Date.now();
    const sub: Subject = {
      id: createStableId('sub'),
      name: name.trim(),
      color,
      createdAt: now,
      updatedAt: now,
    };
    await putRecord(STORE_SUBJECTS, sub);
    stateRef.current = {
      ...stateRef.current,
      subjects: [...stateRef.current.subjects, sub],
    };
    setSubjects((prev) => [...prev, sub]);
    return sub;
  }, []);

  const updateSubject = useCallback(async (id: string, name: string, color?: string) => {
    const existing = stateRef.current.subjects.find((s) => s.id === id);
    if (!existing) return;
    const updated: Subject = {
      ...existing,
      name: name.trim(),
      color: color ?? existing.color,
      updatedAt: Date.now(),
    };
    await putRecord(STORE_SUBJECTS, updated);
    setSubjects((prev) => prev.map((s) => (s.id === id ? updated : s)));
  }, []);

  const deleteSubject = useCallback(async (id: string) => {
    const childTopicIds = stateRef.current.topics.filter((t) => t.subjectId === id).map((t) => t.id);
    const childPlaylistIds = stateRef.current.playlists
      .filter((p) => p.subjectId === id)
      .map((p) => p.id);
    const childTrackIds = stateRef.current.tracks
      .filter((t) => t.subjectId === id)
      .map((t) => t.id);
    const childTrashIds = stateRef.current.trashItems
      .filter((tr) => tr.originalSubjectId === id)
      .map((tr) => tr.id);

    if (childTrackIds.includes(stateRef.current.playback.currentTrackId ?? '')) {
      playerRef.current?.stop();
      setPlayback(createInitialPlaybackState(stateRef.current.settings.repeatPlaylist));
    }

    await permanentlyDeleteTracksAtomic(childTrackIds, childTrashIds);
    for (const pid of childPlaylistIds) await deleteRecord(STORE_PLAYLISTS, pid);
    for (const tid of childTopicIds) await deleteRecord(STORE_TOPICS, tid);
    await deleteRecord(STORE_SUBJECTS, id);

    setTracks((prev) => prev.filter((t) => t.subjectId !== id));
    setTrashItems((prev) => prev.filter((tr) => tr.originalSubjectId !== id));
    setPlaylists((prev) => prev.filter((p) => p.subjectId !== id));
    setTopics((prev) => prev.filter((t) => t.subjectId !== id));
    setSubjects((prev) => prev.filter((s) => s.id !== id));
    await refreshStorageStats();
  }, [refreshStorageStats]);

  const createTopic = useCallback(async (subjectId: string, name: string) => {
    const now = Date.now();
    const topic: Topic = {
      id: createStableId('top'),
      subjectId,
      name: name.trim(),
      createdAt: now,
      updatedAt: now,
    };
    await putRecord(STORE_TOPICS, topic);
    stateRef.current = {
      ...stateRef.current,
      topics: [...stateRef.current.topics, topic],
    };
    setTopics((prev) => [...prev, topic]);
    return topic;
  }, []);

  const updateTopic = useCallback(async (id: string, name: string) => {
    const existing = stateRef.current.topics.find((t) => t.id === id);
    if (!existing) return;
    const updated: Topic = { ...existing, name: name.trim(), updatedAt: Date.now() };
    await putRecord(STORE_TOPICS, updated);
    setTopics((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }, []);

  const deleteTopic = useCallback(async (id: string) => {
    const childPlaylists = stateRef.current.playlists.filter((p) => p.topicId === id).map((p) => p.id);
    const childTrackIds = stateRef.current.tracks.filter((t) => t.topicId === id).map((t) => t.id);
    const childTrashIds = stateRef.current.trashItems
      .filter((tr) => tr.originalTopicId === id)
      .map((tr) => tr.id);

    if (childTrackIds.includes(stateRef.current.playback.currentTrackId ?? '')) {
      playerRef.current?.stop();
      setPlayback(createInitialPlaybackState(stateRef.current.settings.repeatPlaylist));
    }

    await permanentlyDeleteTracksAtomic(childTrackIds, childTrashIds);
    for (const pid of childPlaylists) await deleteRecord(STORE_PLAYLISTS, pid);
    await deleteRecord(STORE_TOPICS, id);

    setTracks((prev) => prev.filter((t) => t.topicId !== id));
    setTrashItems((prev) => prev.filter((tr) => tr.originalTopicId !== id));
    setPlaylists((prev) => prev.filter((p) => p.topicId !== id));
    setTopics((prev) => prev.filter((t) => t.id !== id));
    await refreshStorageStats();
  }, [refreshStorageStats]);

  const createPlaylist = useCallback(async (subjectId: string, topicId: string, name: string) => {
    const now = Date.now();
    const pl: Playlist = {
      id: createStableId('pl'),
      subjectId,
      topicId,
      name: name.trim(),
      createdAt: now,
      updatedAt: now,
    };
    await putRecord(STORE_PLAYLISTS, pl);
    stateRef.current = {
      ...stateRef.current,
      playlists: [...stateRef.current.playlists, pl],
    };
    setPlaylists((prev) => [...prev, pl]);
    setSelectedPlaylistId(pl.id);
    return pl;
  }, []);

  const createDirectPlaylist = useCallback(
    async (playlistName: string, subjectName?: string, topicName?: string) => {
      const cleanPl = playlistName.trim() || 'Mi playlist de estudio';
      const cleanSub = (subjectName ?? '').trim() || 'General';
      const cleanTop = (topicName ?? '').trim() || 'General';

      let subject = stateRef.current.subjects.find(
        (s) => s.name.trim().toLowerCase() === cleanSub.toLowerCase()
      );
      if (!subject) {
        subject = await createSubject(cleanSub);
      }

      let topic = stateRef.current.topics.find(
        (t) =>
          t.subjectId === subject!.id &&
          t.name.trim().toLowerCase() === cleanTop.toLowerCase()
      );
      if (!topic) {
        topic = await createTopic(subject.id, cleanTop);
      }

      return createPlaylist(subject.id, topic.id, cleanPl);
    },
    [createPlaylist, createSubject, createTopic]
  );

  const renamePlaylist = useCallback(async (id: string, name: string) => {
    const existing = stateRef.current.playlists.find((p) => p.id === id);
    if (!existing) return;
    const updated: Playlist = { ...existing, name: name.trim(), updatedAt: Date.now() };
    await putRecord(STORE_PLAYLISTS, updated);
    setPlaylists((prev) => prev.map((p) => (p.id === id ? updated : p)));
  }, []);

  const deletePlaylist = useCallback(async (id: string) => {
    const childTrackIds = stateRef.current.tracks.filter((t) => t.playlistId === id).map((t) => t.id);
    const childTrashIds = stateRef.current.trashItems
      .filter((tr) => tr.originalPlaylistId === id)
      .map((tr) => tr.id);

    if (stateRef.current.playback.currentPlaylistId === id) {
      playerRef.current?.stop();
      setPlayback(createInitialPlaybackState(stateRef.current.settings.repeatPlaylist));
    }

    await permanentlyDeleteTracksAtomic(childTrackIds, childTrashIds);
    await deleteRecord(STORE_PLAYLISTS, id);

    setTracks((prev) => prev.filter((t) => t.playlistId !== id));
    setTrashItems((prev) => prev.filter((tr) => tr.originalPlaylistId !== id));
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
    if (selectedPlaylistId === id) setSelectedPlaylistId(null);
    await refreshStorageStats();
  }, [refreshStorageStats, selectedPlaylistId]);

  // Grabaciones
  const saveNewRecording = useCallback(
    async (params: {
      playlistId: string;
      title: string;
      durationSec: number;
      blob: Blob;
      mimeType: string;
    }) => {
      const playlist = stateRef.current.playlists.find((p) => p.id === params.playlistId);
      if (!playlist) {
        throw new Error('Selecciona una playlist válida antes de guardar la grabación.');
      }
      const existingInPlaylist = getActivePlaylistTracks(stateRef.current.tracks, playlist.id);
      const nextOrder =
        existingInPlaylist.length > 0
          ? Math.max(...existingInPlaylist.map((t) => t.orderIndex)) + 1
          : 0;

      const now = Date.now();
      const newTrack: AudioTrack = {
        id: createStableId('trk'),
        playlistId: playlist.id,
        subjectId: playlist.subjectId,
        topicId: playlist.topicId,
        title: params.title.trim(),
        durationSec: Math.max(0.5, params.durationSec),
        orderIndex: nextOrder,
        mimeType: params.mimeType || params.blob.type || 'audio/webm',
        byteSize: params.blob.size,
        createdAt: now,
        updatedAt: now,
        status: 'active',
      };

      await saveAudioTrackWithBlob(newTrack, params.blob);
      stateRef.current = {
        ...stateRef.current,
        tracks: [...stateRef.current.tracks, newTrack],
      };
      setTracks((prev) => [...prev, newTrack]);
      setSelectedPlaylistId(playlist.id);
      await refreshStorageStats();
      return newTrack;
    },
    [refreshStorageStats]
  );

  const importAudioFileToPlaylist = useCallback(
    async (playlistId: string, file: File, customTitle?: string) => {
      if (!file || file.size === 0) {
        throw new Error('El archivo de audio seleccionado está vacío.');
      }

      const objectUrl = URL.createObjectURL(file);
      let durationSec = 0;
      try {
        durationSec = await new Promise<number>((resolve, reject) => {
          const audio = new Audio();
          audio.preload = 'metadata';
          audio.onloadedmetadata = () => {
            const d = Number.isFinite(audio.duration) ? audio.duration : 1;
            resolve(Math.max(0.5, d));
          };
          audio.onerror = () => {
            reject(new Error('El archivo seleccionado no es un audio compatible o está dañado.'));
          };
          audio.src = objectUrl;
        });
      } finally {
        URL.revokeObjectURL(objectUrl);
      }

      const fallbackTitle = file.name.replace(/\.[^/.]+$/, '').trim() || 'Audio importado';
      const title = (customTitle ?? '').trim() || fallbackTitle;
      return saveNewRecording({
        playlistId,
        title,
        durationSec,
        blob: file,
        mimeType: file.type || 'audio/mpeg',
      });
    },
    [saveNewRecording]
  );

  const renameTrack = useCallback(async (trackId: string, newTitle: string) => {
    const existing = stateRef.current.tracks.find((t) => t.id === trackId);
    if (!existing) return;
    const updated: AudioTrack = { ...existing, title: newTitle.trim(), updatedAt: Date.now() };
    await putRecord(STORE_TRACKS, updated);
    setTracks((prev) => prev.map((t) => (t.id === trackId ? updated : t)));
  }, []);

  const moveTrackToPlaylist = useCallback(async (trackId: string, targetPlaylistId: string) => {
    const track = stateRef.current.tracks.find((t) => t.id === trackId);
    const targetPl = stateRef.current.playlists.find((p) => p.id === targetPlaylistId);
    if (!track || !targetPl) return;

    const targetTracks = getActivePlaylistTracks(stateRef.current.tracks, targetPlaylistId);
    const nextOrder = targetTracks.length > 0 ? Math.max(...targetTracks.map((t) => t.orderIndex)) + 1 : 0;

    const updated: AudioTrack = {
      ...track,
      playlistId: targetPl.id,
      subjectId: targetPl.subjectId,
      topicId: targetPl.topicId,
      orderIndex: nextOrder,
      updatedAt: Date.now(),
    };
    await putRecord(STORE_TRACKS, updated);
    const nextAll = normalizePlaylistOrder(
      stateRef.current.tracks.map((t) => (t.id === trackId ? updated : t)),
      track.playlistId
    );
    setTracks(nextAll);
  }, []);

  const reorderTrack = useCallback(
    async (playlistId: string, trackId: string, direction: 'up' | 'down') => {
      const updatedAll = reorderTrackInPlaylist(stateRef.current.tracks, playlistId, trackId, direction);
      setTracks(updatedAll);
      const changed = updatedAll.filter((t) => t.playlistId === playlistId && t.status === 'active');
      await putManyRecords(STORE_TRACKS, changed);
      if (stateRef.current.playback.currentPlaylistId === playlistId) {
        setPlayback((prev) => ({
          ...prev,
          queueTrackIds: buildPlaylistQueue(updatedAll, playlistId),
        }));
      }
    },
    []
  );

  const archiveTrackManually = useCallback(
    async (trackId: string) => {
      const track = stateRef.current.tracks.find((t) => t.id === trackId && t.status === 'active');
      if (!track) return;

      if (stateRef.current.playback.currentTrackId === trackId) {
        await skipNextAndArchive();
        return;
      }

      const trashItem: TrashItem = {
        id: createStableId('trash'),
        trackId: track.id,
        originalPlaylistId: track.playlistId,
        originalSubjectId: track.subjectId,
        originalTopicId: track.topicId,
        originalOrderIndex: track.orderIndex,
        deletedAt: Date.now(),
        reason: 'manual',
      };

      await moveTrackToTrashAtomic(track, trashItem);
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, status: 'trashed', updatedAt: Date.now() } : t))
      );
      setTrashItems((prev) => [trashItem, ...prev]);
      showBanner('info', `"${track.title}" se envió a la papelera.`);
    },
    [showBanner, skipNextAndArchive]
  );

  const restoreFromTrash = useCallback(
    async (trashItemId: string) => {
      const trashItem = stateRef.current.trashItems.find((item) => item.id === trashItemId);
      const track = stateRef.current.tracks.find((t) => t.id === trashItem?.trackId);
      if (!trashItem || !track) return;

      const originalPlExists = stateRef.current.playlists.some(
        (p) => p.id === trashItem.originalPlaylistId
      );
      const fallbackPl = stateRef.current.playlists[0];
      if (!originalPlExists && !fallbackPl) {
        showBanner(
          'warning',
          'La playlist original fue eliminada. Crea primero una materia, tema y playlist para recuperar este audio.'
        );
        return;
      }

      const targetPl = originalPlExists
        ? stateRef.current.playlists.find((p) => p.id === trashItem.originalPlaylistId)!
        : fallbackPl;

      const restoredTrack: AudioTrack = {
        ...track,
        playlistId: targetPl.id,
        subjectId: targetPl.subjectId,
        topicId: targetPl.topicId,
        orderIndex: trashItem.originalOrderIndex,
        status: 'active',
        updatedAt: Date.now(),
      };

      await restoreTrackFromTrashAtomic(restoredTrack, trashItem.id);
      const nextTracks = stateRef.current.tracks.map((t) =>
        t.id === restoredTrack.id ? restoredTrack : t
      );
      setTracks(nextTracks);
      setTrashItems((prev) => prev.filter((item) => item.id !== trashItemId));

      if (stateRef.current.playback.currentPlaylistId === targetPl.id) {
        setPlayback((prev) => ({
          ...prev,
          queueTrackIds: buildPlaylistQueue(nextTracks, targetPl.id),
        }));
      }
      showBanner('success', `Se recuperó "${restoredTrack.title}" en "${targetPl.name}".`);
    },
    [showBanner]
  );

  const permanentlyDeleteTrashItem = useCallback(
    async (trashItemId: string) => {
      const trashItem = stateRef.current.trashItems.find((item) => item.id === trashItemId);
      if (!trashItem) return;
      await permanentlyDeleteTracksAtomic([trashItem.trackId], [trashItem.id]);
      setTracks((prev) => prev.filter((t) => t.id !== trashItem.trackId));
      setTrashItems((prev) => prev.filter((item) => item.id !== trashItemId));
      await refreshStorageStats();
    },
    [refreshStorageStats]
  );

  const emptyTrash = useCallback(async () => {
    const items = stateRef.current.trashItems;
    if (items.length === 0) return;
    await permanentlyDeleteTracksAtomic(
      items.map((i) => i.trackId),
      items.map((i) => i.id)
    );
    const trashedIds = new Set(items.map((i) => i.trackId));
    setTracks((prev) => prev.filter((t) => !trashedIds.has(t.id)));
    setTrashItems([]);
    await refreshStorageStats();
    showBanner('success', 'La papelera se vació por completo.');
  }, [refreshStorageStats, showBanner]);

  const downloadTrackFile = useCallback(
    async (trackId: string) => {
      const track = stateRef.current.tracks.find((t) => t.id === trackId);
      if (!track) return;
      const blob = await getAudioBlob(trackId);
      if (!blob) {
        showBanner('error', 'No se encontró el archivo de audio para descargar.');
        return;
      }
      const ext = getExtensionFromMimeType(track.mimeType || blob.type);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sanitizeFilename(track.title)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    [showBanner]
  );

  // Copias de seguridad
  const triggerJsonDownload = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const exportAllBackup = useCallback(async () => {
    const cur = stateRef.current;
    const bundle = await createBackupBundle({
      subjects: cur.subjects,
      topics: cur.topics,
      playlists: cur.playlists,
      tracks: cur.tracks,
      trashItems: cur.trashItems,
      getBlob: getAudioBlob,
    });
    const dateTag = new Date().toISOString().slice(0, 10);
    triggerJsonDownload(bundle, `audiostudy-respaldo-${dateTag}.json`);
    showBanner('success', 'Copia de seguridad completa descargada.');
  }, [showBanner]);

  const exportPlaylistBackup = useCallback(
    async (playlistId: string) => {
      const cur = stateRef.current;
      const pl = cur.playlists.find((p) => p.id === playlistId);
      if (!pl) return;
      const sub = cur.subjects.filter((s) => s.id === pl.subjectId);
      const top = cur.topics.filter((t) => t.id === pl.topicId);
      const plTracks = cur.tracks.filter((t) => t.playlistId === playlistId && t.status === 'active');

      const bundle = await createBackupBundle({
        subjects: sub,
        topics: top,
        playlists: [pl],
        tracks: plTracks,
        trashItems: [],
        getBlob: getAudioBlob,
      });
      triggerJsonDownload(bundle, `playlist-${sanitizeFilename(pl.name)}.json`);
      showBanner('success', `Playlist "${pl.name}" exportada correctamente.`);
    },
    [showBanner]
  );

  const importBackupFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      const validation = validateBackupJson(text);
      if (!validation.valid || !validation.bundle) {
        throw new Error(validation.error ?? 'Archivo de respaldo inválido.');
      }

      const cur = stateRef.current;
      const merge = computeSafeBackupMerge(validation.bundle, {
        subjects: cur.subjects,
        topics: cur.topics,
        playlists: cur.playlists,
        tracks: cur.tracks,
        trashItems: cur.trashItems,
      });

      await importMergedBackupAtomic({
        subjects: merge.subjectsToAdd,
        topics: merge.topicsToAdd,
        playlists: merge.playlistsToAdd,
        tracksWithBlobs: merge.tracksToAdd,
        trashItems: merge.trashItemsToAdd,
      });

      const fresh = await loadAllLibraryData();
      setSubjects(fresh.subjects);
      setTopics(fresh.topics);
      setPlaylists(fresh.playlists);
      setTracks(fresh.tracks);
      setTrashItems(fresh.trashItems);
      await refreshStorageStats();

      return {
        importedTracks: merge.tracksToAdd.length,
        skippedDuplicates: merge.skippedDuplicates,
      };
    },
    [refreshStorageStats]
  );

  // Datos de demostración opcionales
  const hasDemoData = useMemo(
    () =>
      subjects.some((s) => s.isDemo) ||
      playlists.some((p) => p.isDemo) ||
      tracks.some((t) => t.isDemo),
    [subjects, playlists, tracks]
  );

  const loadDemoData = useCallback(async () => {
    if (hasDemoData) {
      showBanner('info', 'Los datos de ejemplo ya están cargados.');
      return;
    }
    const demo = buildOptionalDemoData();
    await importMergedBackupAtomic({
      subjects: demo.subjects,
      topics: demo.topics,
      playlists: demo.playlists,
      tracksWithBlobs: demo.tracksWithBlobs,
      trashItems: [],
    });
    const fresh = await loadAllLibraryData();
    setSubjects(fresh.subjects);
    setTopics(fresh.topics);
    setPlaylists(fresh.playlists);
    setTracks(fresh.tracks);
    setSelectedPlaylistId(demo.playlists[0].id);
    await refreshStorageStats();
    showBanner(
      'success',
      'Ejemplo cargado: Geografía (El clima), Biología y Ciudadanía con audios de prueba.'
    );
  }, [hasDemoData, refreshStorageStats, showBanner]);

  const clearDemoData = useCallback(async () => {
    const demoTrackIds = stateRef.current.tracks.filter((t) => t.isDemo).map((t) => t.id);
    const demoTrashIds = stateRef.current.trashItems
      .filter((tr) => demoTrackIds.includes(tr.trackId))
      .map((tr) => tr.id);
    const demoPlaylistIds = stateRef.current.playlists.filter((p) => p.isDemo).map((p) => p.id);
    const demoTopicIds = stateRef.current.topics.filter((t) => t.isDemo).map((t) => t.id);
    const demoSubjectIds = stateRef.current.subjects.filter((s) => s.isDemo).map((s) => s.id);

    if (demoTrackIds.includes(stateRef.current.playback.currentTrackId ?? '')) {
      playerRef.current?.stop();
      setPlayback(createInitialPlaybackState(stateRef.current.settings.repeatPlaylist));
    }

    await permanentlyDeleteTracksAtomic(demoTrackIds, demoTrashIds);
    for (const pid of demoPlaylistIds) await deleteRecord(STORE_PLAYLISTS, pid);
    for (const tid of demoTopicIds) await deleteRecord(STORE_TOPICS, tid);
    for (const sid of demoSubjectIds) await deleteRecord(STORE_SUBJECTS, sid);

    const fresh = await loadAllLibraryData();
    setSubjects(fresh.subjects);
    setTopics(fresh.topics);
    setPlaylists(fresh.playlists);
    setTracks(fresh.tracks);
    setTrashItems(fresh.trashItems);
    if (selectedPlaylistId && demoPlaylistIds.includes(selectedPlaylistId)) {
      setSelectedPlaylistId(fresh.playlists[0]?.id ?? null);
    }
    await refreshStorageStats();
    showBanner('info', 'Se eliminaron todos los datos de ejemplo.');
  }, [refreshStorageStats, selectedPlaylistId, showBanner]);

  const value: AudioStudyContextValue = {
    isReady,
    activeSection,
    setActiveSection,
    selectedPlaylistId,
    setSelectedPlaylistId,
    selectedSubjectId,
    setSelectedSubjectId,
    subjects,
    topics,
    playlists,
    tracks,
    trashItems,
    settings,
    lastSavedProgress,
    playback,
    storageStats,
    banner,
    dismissBanner,
    showBanner,
    setTheme,
    updateHeadsetConfig,
    toggleRepeatPlaylist,
    toggleAutoResume,
    requestPersistStorage,
    refreshStorageStats,
    createSubject,
    updateSubject,
    deleteSubject,
    createTopic,
    updateTopic,
    deleteTopic,
    createPlaylist,
    createDirectPlaylist,
    renamePlaylist,
    deletePlaylist,
    saveNewRecording,
    importAudioFileToPlaylist,
    renameTrack,
    moveTrackToPlaylist,
    reorderTrack,
    archiveTrackManually,
    restoreFromTrash,
    permanentlyDeleteTrashItem,
    emptyTrash,
    undoLastSkip,
    downloadTrackFile,
    playPlaylist,
    resumeLastSession,
    togglePlayPause,
    pausePlayback,
    resumePlayback,
    skipNextAndArchive,
    nextWithoutArchive,
    previousTrack,
    seekTo,
    setVolume,
    exportAllBackup,
    exportPlaylistBackup,
    importBackupFile,
    loadDemoData,
    clearDemoData,
    hasDemoData,
  };

  return <AudioStudyContext.Provider value={value}>{children}</AudioStudyContext.Provider>;
};

export function useAudioStudy(): AudioStudyContextValue {
  const ctx = useContext(AudioStudyContext);
  if (!ctx) {
    throw new Error('useAudioStudy debe utilizarse dentro de AudioStudyProvider');
  }
  return ctx;
}
