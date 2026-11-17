import { HeadsetControlConfig } from '../../types/audioStudy';

export interface MediaSessionCallbacks {
  onPlay: () => void;
  onPause: () => void;
  onNextSkipAndArchive: () => void;
  onNextOnly: () => void;
  onPrevious: () => void;
  onSeekTo: (timeSec: number) => void;
  onStop: () => void;
  onUnsupportedAction?: (action: string) => void;
}

export function isMediaSessionSupported(): boolean {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
}

export function updateMediaSessionMetadata(params: {
  title: string;
  subjectName: string;
  topicName: string;
  playlistName: string;
}): void {
  if (!isMediaSessionSupported() || typeof MediaMetadata === 'undefined') return;

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: params.title,
      artist: `${params.subjectName} · ${params.topicName}`,
      album: params.playlistName,
      artwork: [
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
    });
  } catch {
    // Algunos navegadores ignoran ciertos campos de MediaMetadata
  }
}

export function updateMediaSessionPlaybackState(state: 'none' | 'paused' | 'playing'): void {
  if (!isMediaSessionSupported()) return;
  try {
    navigator.mediaSession.playbackState = state;
  } catch {
    // No soportado en el navegador actual
  }
}

export function updateMediaSessionPosition(durationSec: number, positionSec: number): void {
  if (!isMediaSessionSupported() || typeof navigator.mediaSession.setPositionState !== 'function') {
    return;
  }
  if (!Number.isFinite(durationSec) || durationSec <= 0) return;

  const safePosition = Math.max(0, Math.min(durationSec, Number.isFinite(positionSec) ? positionSec : 0));
  try {
    navigator.mediaSession.setPositionState({
      duration: durationSec,
      playbackRate: 1,
      position: safePosition,
    });
  } catch {
    // Evitar errores si el navegador aún no cargó la duración exacta
  }
}

export function registerMediaSessionHandlers(
  config: HeadsetControlConfig,
  callbacks: MediaSessionCallbacks
): () => void {
  if (!isMediaSessionSupported()) {
    return () => {};
  }

  const dispatchCommand = (action: HeadsetControlConfig['onNextTrack']) => {
    switch (action) {
      case 'skip_and_archive':
        callbacks.onNextSkipAndArchive();
        break;
      case 'next_only':
        callbacks.onNextOnly();
        break;
      case 'previous_track':
        callbacks.onPrevious();
        break;
      case 'play_pause':
        callbacks.onPause();
        break;
    }
  };

  const safeSetHandler = (
    action: MediaSessionAction,
    handler: MediaSessionActionHandler | null
  ) => {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      // El navegador no admite esta acción multimedia específica
    }
  };

  safeSetHandler('play', () => {
    if (config.onPlayCommand === 'skip_and_archive') {
      callbacks.onNextSkipAndArchive();
    } else {
      callbacks.onPlay();
    }
  });

  safeSetHandler('pause', () => {
    if (config.onPauseCommand === 'skip_and_archive') {
      callbacks.onNextSkipAndArchive();
    } else {
      callbacks.onPause();
    }
  });

  safeSetHandler('nexttrack', () => {
    dispatchCommand(config.onNextTrack);
  });

  safeSetHandler('previoustrack', () => {
    dispatchCommand(config.onPreviousTrack);
  });

  safeSetHandler('seekto', (details) => {
    if (typeof details.seekTime === 'number' && Number.isFinite(details.seekTime)) {
      callbacks.onSeekTo(details.seekTime);
    }
  });

  safeSetHandler('stop', () => {
    callbacks.onStop();
  });

  return () => {
    const actions: MediaSessionAction[] = [
      'play',
      'pause',
      'nexttrack',
      'previoustrack',
      'seekto',
      'stop',
    ];
    actions.forEach((a) => safeSetHandler(a, null));
  };
}
