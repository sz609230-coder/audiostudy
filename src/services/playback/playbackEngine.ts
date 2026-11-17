import {
  AudioTrack,
  PlaybackEngineState,
  TrashItem,
  UndoSkipEntry,
} from '../../types/audioStudy';
import { createStableId } from '../../utils/audioUtils';

export const SKIP_DEBOUNCE_MS = 280;

export function createInitialPlaybackState(repeatPlaylist = false, volume = 1): PlaybackEngineState {
  return {
    status: 'idle',
    currentPlaylistId: null,
    currentTrackId: null,
    queueTrackIds: [],
    currentTimeSec: 0,
    durationSec: 0,
    volume,
    repeatPlaylist,
    endedMessage: null,
    errorMessage: null,
    lastUndoSkip: null,
    lastSkipTimestamp: 0,
  };
}

export function getActivePlaylistTracks(tracks: AudioTrack[], playlistId: string): AudioTrack[] {
  return tracks
    .filter((t) => t.playlistId === playlistId && t.status === 'active')
    .sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt - b.createdAt);
}

export function buildPlaylistQueue(tracks: AudioTrack[], playlistId: string): string[] {
  return getActivePlaylistTracks(tracks, playlistId).map((t) => t.id);
}

export interface SkipTransitionResult {
  nextState: PlaybackEngineState;
  updatedTracks: AudioTrack[];
  addedTrashItem: TrashItem | null;
  nextTrackToLoad: AudioTrack | null;
  shouldAutoPlay: boolean;
  throttled: boolean;
}

/**
 * Ejecuta la acción solicitada por el comando nexttrack o botón Siguiente:
 * 1. Identifica el audio actual.
 * 2. Lo mueve a la papelera sin eliminarlo físicamente.
 * 3. Carga inmediatamente el siguiente audio manteniendo el orden y la reproducción.
 */
export function skipCurrentTrackToTrash(
  state: PlaybackEngineState,
  tracks: AudioTrack[],
  now = Date.now()
): SkipTransitionResult {
  if (!state.currentTrackId || !state.currentPlaylistId) {
    return {
      nextState: state,
      updatedTracks: tracks,
      addedTrashItem: null,
      nextTrackToLoad: null,
      shouldAutoPlay: false,
      throttled: false,
    };
  }

  // Protección ante pulsaciones repetidas en milisegundos
  if (now - state.lastSkipTimestamp < SKIP_DEBOUNCE_MS) {
    return {
      nextState: state,
      updatedTracks: tracks,
      addedTrashItem: null,
      nextTrackToLoad: null,
      shouldAutoPlay: false,
      throttled: true,
    };
  }

  const currentTrack = tracks.find((t) => t.id === state.currentTrackId);
  if (!currentTrack || currentTrack.status !== 'active') {
    return {
      nextState: state,
      updatedTracks: tracks,
      addedTrashItem: null,
      nextTrackToLoad: null,
      shouldAutoPlay: false,
      throttled: false,
    };
  }

  const currentIndex = state.queueTrackIds.indexOf(currentTrack.id);
  const remainingQueue = state.queueTrackIds.filter((id) => id !== currentTrack.id);

  const trashItem: TrashItem = {
    id: createStableId('trash'),
    trackId: currentTrack.id,
    originalPlaylistId: currentTrack.playlistId,
    originalSubjectId: currentTrack.subjectId,
    originalTopicId: currentTrack.topicId,
    originalOrderIndex: currentTrack.orderIndex,
    deletedAt: now,
    reason: 'skipped',
  };

  const updatedTracks = tracks.map((t) =>
    t.id === currentTrack.id ? { ...t, status: 'trashed' as const, updatedAt: now } : t
  );

  let nextTrackId: string | null = null;
  if (remainingQueue.length > 0) {
    if (currentIndex >= 0 && currentIndex < remainingQueue.length) {
      nextTrackId = remainingQueue[currentIndex];
    } else if (state.repeatPlaylist) {
      nextTrackId = remainingQueue[0];
    }
  }

  const nextTrackToLoad = nextTrackId
    ? updatedTracks.find((t) => t.id === nextTrackId && t.status === 'active') ?? null
    : null;

  const undoEntry: UndoSkipEntry = {
    track: currentTrack,
    trashItem,
    previousTrackId: currentTrack.id,
    playlistId: state.currentPlaylistId,
  };

  if (!nextTrackToLoad) {
    return {
      nextState: {
        ...state,
        status: 'completed',
        currentTrackId: null,
        queueTrackIds: remainingQueue,
        currentTimeSec: 0,
        durationSec: 0,
        endedMessage: 'Has saltado el último audio de la playlist. Puedes recuperarlo desde la papelera.',
        errorMessage: null,
        lastUndoSkip: undoEntry,
        lastSkipTimestamp: now,
      },
      updatedTracks,
      addedTrashItem: trashItem,
      nextTrackToLoad: null,
      shouldAutoPlay: false,
      throttled: false,
    };
  }

  return {
    nextState: {
      ...state,
      status: 'loading',
      currentTrackId: nextTrackToLoad.id,
      queueTrackIds: remainingQueue,
      currentTimeSec: 0,
      durationSec: nextTrackToLoad.durationSec,
      endedMessage: null,
      errorMessage: null,
      lastUndoSkip: undoEntry,
      lastSkipTimestamp: now,
    },
    updatedTracks,
    addedTrashItem: trashItem,
    nextTrackToLoad,
    shouldAutoPlay: true,
    throttled: false,
  };
}

export interface AdvanceTransitionResult {
  nextState: PlaybackEngineState;
  nextTrackToLoad: AudioTrack | null;
  shouldAutoPlay: boolean;
}

/**
 * Al terminar normalmente un audio, avanza al siguiente SIN eliminarlo ni archivarlo.
 * Si es el último y no hay repetición, muestra el mensaje de fin de playlist.
 */
export function advanceOnTrackEnd(
  state: PlaybackEngineState,
  tracks: AudioTrack[]
): AdvanceTransitionResult {
  if (!state.currentPlaylistId || !state.currentTrackId) {
    return { nextState: state, nextTrackToLoad: null, shouldAutoPlay: false };
  }

  const activeQueue = buildPlaylistQueue(tracks, state.currentPlaylistId);
  const currentIdx = activeQueue.indexOf(state.currentTrackId);

  let nextTrackId: string | null = null;
  if (currentIdx >= 0 && currentIdx + 1 < activeQueue.length) {
    nextTrackId = activeQueue[currentIdx + 1];
  } else if (state.repeatPlaylist && activeQueue.length > 0) {
    nextTrackId = activeQueue[0];
  }

  if (!nextTrackId) {
    return {
      nextState: {
        ...state,
        status: 'completed',
        queueTrackIds: activeQueue,
        currentTimeSec: state.durationSec,
        endedMessage: 'Se terminó la playlist. Ningún audio fue eliminado.',
        errorMessage: null,
      },
      nextTrackToLoad: null,
      shouldAutoPlay: false,
    };
  }

  const nextTrackToLoad = tracks.find((t) => t.id === nextTrackId && t.status === 'active') ?? null;
  if (!nextTrackToLoad) {
    return {
      nextState: {
        ...state,
        status: 'completed',
        endedMessage: 'Se terminó la playlist.',
      },
      nextTrackToLoad: null,
      shouldAutoPlay: false,
    };
  }

  return {
    nextState: {
      ...state,
      status: 'loading',
      currentTrackId: nextTrackToLoad.id,
      queueTrackIds: activeQueue,
      currentTimeSec: 0,
      durationSec: nextTrackToLoad.durationSec,
      endedMessage: null,
      errorMessage: null,
    },
    nextTrackToLoad,
    shouldAutoPlay: true,
  };
}

/**
 * Avanza al siguiente audio SIN archivar (cuando el usuario configura explícitamente next_only).
 */
export function goToNextTrackWithoutArchive(
  state: PlaybackEngineState,
  tracks: AudioTrack[]
): AdvanceTransitionResult {
  return advanceOnTrackEnd(state, tracks);
}

export interface PreviousTransitionResult {
  nextState: PlaybackEngineState;
  trackToLoad: AudioTrack | null;
  restartCurrent: boolean;
}

export function goToPreviousTrack(
  state: PlaybackEngineState,
  tracks: AudioTrack[]
): PreviousTransitionResult {
  if (!state.currentPlaylistId || !state.currentTrackId) {
    return { nextState: state, trackToLoad: null, restartCurrent: false };
  }

  if (state.currentTimeSec > 3) {
    return {
      nextState: {
        ...state,
        currentTimeSec: 0,
        endedMessage: null,
      },
      trackToLoad: null,
      restartCurrent: true,
    };
  }

  const activeQueue = buildPlaylistQueue(tracks, state.currentPlaylistId);
  const currentIdx = activeQueue.indexOf(state.currentTrackId);
  if (currentIdx > 0) {
    const prevId = activeQueue[currentIdx - 1];
    const prevTrack = tracks.find((t) => t.id === prevId && t.status === 'active') ?? null;
    if (prevTrack) {
      return {
        nextState: {
          ...state,
          status: 'loading',
          currentTrackId: prevTrack.id,
          queueTrackIds: activeQueue,
          currentTimeSec: 0,
          durationSec: prevTrack.durationSec,
          endedMessage: null,
          errorMessage: null,
        },
        trackToLoad: prevTrack,
        restartCurrent: false,
      };
    }
  }

  return {
    nextState: {
      ...state,
      currentTimeSec: 0,
    },
    trackToLoad: null,
    restartCurrent: true,
  };
}

export function normalizePlaylistOrder(tracks: AudioTrack[], playlistId: string): AudioTrack[] {
  const playlistTracks = getActivePlaylistTracks(tracks, playlistId);
  const indexMap = new Map<string, number>();
  playlistTracks.forEach((t, idx) => indexMap.set(t.id, idx));

  return tracks.map((t) => {
    const newIndex = indexMap.get(t.id);
    if (newIndex !== undefined && newIndex !== t.orderIndex) {
      return { ...t, orderIndex: newIndex };
    }
    return t;
  });
}

export function reorderTrackInPlaylist(
  tracks: AudioTrack[],
  playlistId: string,
  trackId: string,
  direction: 'up' | 'down'
): AudioTrack[] {
  const ordered = getActivePlaylistTracks(tracks, playlistId);
  const idx = ordered.findIndex((t) => t.id === trackId);
  if (idx === -1) return tracks;

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= ordered.length) return tracks;

  const copy = [...ordered];
  const temp = copy[idx];
  copy[idx] = copy[swapIdx];
  copy[swapIdx] = temp;

  const now = Date.now();
  const orderMap = new Map<string, number>();
  copy.forEach((t, i) => orderMap.set(t.id, i));

  return tracks.map((t) => {
    const newOrder = orderMap.get(t.id);
    if (newOrder !== undefined) {
      return { ...t, orderIndex: newOrder, updatedAt: now };
    }
    return t;
  });
}
