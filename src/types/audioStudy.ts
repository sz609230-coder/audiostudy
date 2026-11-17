export const CURRENT_SCHEMA_VERSION = 1;

export type AppSection =
  | 'inicio'
  | 'materias'
  | 'playlist'
  | 'grabadora'
  | 'reproductor'
  | 'papelera'
  | 'configuracion';

export type ThemeMode = 'dark' | 'light';

export type MediaCommandAction =
  | 'skip_and_archive'
  | 'next_only'
  | 'play_pause'
  | 'previous_track';

export interface HeadsetControlConfig {
  onNextTrack: MediaCommandAction;
  onPreviousTrack: MediaCommandAction;
  onPauseCommand: 'pause' | 'skip_and_archive';
  onPlayCommand: 'play' | 'skip_and_archive';
  singleTapWorkaroundEnabled: boolean;
}

export interface UserSettings {
  id: 'user_settings';
  schemaVersion: number;
  theme: ThemeMode;
  repeatPlaylist: boolean;
  defaultVolume: number;
  autoResumeLastPosition: boolean;
  headsetConfig: HeadsetControlConfig;
  persistentStorageRequested: boolean;
}

export interface Subject {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  updatedAt: number;
  isDemo?: boolean;
}

export interface Topic {
  id: string;
  subjectId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  isDemo?: boolean;
}

export interface Playlist {
  id: string;
  subjectId: string;
  topicId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  isDemo?: boolean;
}

export type TrackStatus = 'active' | 'trashed';

export interface AudioTrack {
  id: string;
  playlistId: string;
  subjectId: string;
  topicId: string;
  title: string;
  durationSec: number;
  orderIndex: number;
  mimeType: string;
  byteSize: number;
  createdAt: number;
  updatedAt: number;
  status: TrackStatus;
  isDemo?: boolean;
}

export interface TrashItem {
  id: string;
  trackId: string;
  originalPlaylistId: string;
  originalSubjectId: string;
  originalTopicId: string;
  originalOrderIndex: number;
  deletedAt: number;
  reason: 'skipped' | 'manual';
}

export interface PlaybackProgress {
  id: 'playback_progress';
  playlistId: string | null;
  trackId: string | null;
  positionSec: number;
  updatedAt: number;
}

export interface UndoSkipEntry {
  track: AudioTrack;
  trashItem: TrashItem;
  previousTrackId: string | null;
  playlistId: string;
}

export type PlaybackStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'completed'
  | 'error';

export interface PlaybackEngineState {
  status: PlaybackStatus;
  currentPlaylistId: string | null;
  currentTrackId: string | null;
  queueTrackIds: string[];
  currentTimeSec: number;
  durationSec: number;
  volume: number;
  repeatPlaylist: boolean;
  endedMessage: string | null;
  errorMessage: string | null;
  lastUndoSkip: UndoSkipEntry | null;
  lastSkipTimestamp: number;
}

/**
 * Abstracción multiplataforma del reproductor.
 * La versión web usa HTMLAudioElement + Media Session API;
 * una futura app nativa Android (Kotlin) implementará este mismo contrato
 * sobre Android Media3 (ExoPlayer + MediaSessionService).
 */
export interface IPlaybackController {
  loadTrack(track: AudioTrack, blob: Blob, startPositionSec?: number): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  seekTo(seconds: number): void;
  setVolume(volume: number): void;
  stop(): void;
  destroy(): void;
}

export interface StorageStats {
  usageBytes: number;
  quotaBytes: number;
  percentUsed: number;
  persisted: boolean;
  supported: boolean;
  nearLimit: boolean;
}

export interface BackupSerializedTrack {
  track: AudioTrack;
  audioBase64: string;
}

export interface BackupBundle {
  format: 'audiostudy-backup';
  schemaVersion: number;
  exportedAt: number;
  subjects: Subject[];
  topics: Topic[];
  playlists: Playlist[];
  tracks: BackupSerializedTrack[];
  trashItems: TrashItem[];
}
