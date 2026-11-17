import {
  AudioTrack,
  CURRENT_SCHEMA_VERSION,
  PlaybackProgress,
  Playlist,
  StorageStats,
  Subject,
  Topic,
  TrashItem,
  UserSettings,
} from '../../types/audioStudy';

const DB_NAME = 'audiostudy_db';
const DB_VERSION = 1;

export const STORE_SUBJECTS = 'subjects';
export const STORE_TOPICS = 'topics';
export const STORE_PLAYLISTS = 'playlists';
export const STORE_TRACKS = 'tracks';
export const STORE_AUDIO_BLOBS = 'audioBlobs';
export const STORE_TRASH = 'trash';
export const STORE_SETTINGS = 'settings';
export const STORE_PROGRESS = 'playbackProgress';
export const STORE_META = 'schemaMeta';

export const DEFAULT_USER_SETTINGS: UserSettings = {
  id: 'user_settings',
  schemaVersion: CURRENT_SCHEMA_VERSION,
  theme: 'dark',
  repeatPlaylist: false,
  defaultVolume: 1,
  autoResumeLastPosition: true,
  headsetConfig: {
    onNextTrack: 'skip_and_archive',
    onPreviousTrack: 'previous_track',
    onPauseCommand: 'pause',
    onPlayCommand: 'play',
    singleTapWorkaroundEnabled: false,
  },
  persistentStorageRequested: false,
};

export const DEFAULT_PROGRESS: PlaybackProgress = {
  id: 'playback_progress',
  playlistId: null,
  trackId: null,
  positionSec: 0,
  updatedAt: Date.now(),
};

interface AudioBlobRecord {
  trackId: string;
  blob: Blob;
  mimeType: string;
  updatedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Tu navegador no admite almacenamiento local IndexedDB.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      // Migración inicial v0 -> v1 (estructurada para futuras versiones)
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(STORE_SUBJECTS)) {
          db.createObjectStore(STORE_SUBJECTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_TOPICS)) {
          const store = db.createObjectStore(STORE_TOPICS, { keyPath: 'id' });
          store.createIndex('subjectId', 'subjectId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_PLAYLISTS)) {
          const store = db.createObjectStore(STORE_PLAYLISTS, { keyPath: 'id' });
          store.createIndex('topicId', 'topicId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_TRACKS)) {
          const store = db.createObjectStore(STORE_TRACKS, { keyPath: 'id' });
          store.createIndex('playlistId', 'playlistId', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_AUDIO_BLOBS)) {
          db.createObjectStore(STORE_AUDIO_BLOBS, { keyPath: 'trackId' });
        }
        if (!db.objectStoreNames.contains(STORE_TRASH)) {
          const store = db.createObjectStore(STORE_TRASH, { keyPath: 'id' });
          store.createIndex('trackId', 'trackId', { unique: true });
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_PROGRESS)) {
          db.createObjectStore(STORE_PROGRESS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error('No se pudo abrir la base de datos local.'));
    };
  });

  return dbPromise;
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Error en la operación de base de datos.'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Error al confirmar la transacción local.'));
    tx.onabort = () => reject(tx.error ?? new Error('Transacción cancelada por falta de espacio o error interno.'));
  });
}

export async function loadAllLibraryData(): Promise<{
  subjects: Subject[];
  topics: Topic[];
  playlists: Playlist[];
  tracks: AudioTrack[];
  trashItems: TrashItem[];
  settings: UserSettings;
  progress: PlaybackProgress;
}> {
  const db = await openDatabase();
  const tx = db.transaction(
    [
      STORE_SUBJECTS,
      STORE_TOPICS,
      STORE_PLAYLISTS,
      STORE_TRACKS,
      STORE_TRASH,
      STORE_SETTINGS,
      STORE_PROGRESS,
    ],
    'readonly'
  );

  const [subjects, topics, playlists, tracks, trashItems, settingsRaw, progressRaw] =
    await Promise.all([
      requestToPromise<Subject[]>(tx.objectStore(STORE_SUBJECTS).getAll()),
      requestToPromise<Topic[]>(tx.objectStore(STORE_TOPICS).getAll()),
      requestToPromise<Playlist[]>(tx.objectStore(STORE_PLAYLISTS).getAll()),
      requestToPromise<AudioTrack[]>(tx.objectStore(STORE_TRACKS).getAll()),
      requestToPromise<TrashItem[]>(tx.objectStore(STORE_TRASH).getAll()),
      requestToPromise<UserSettings | undefined>(tx.objectStore(STORE_SETTINGS).get('user_settings')),
      requestToPromise<PlaybackProgress | undefined>(tx.objectStore(STORE_PROGRESS).get('playback_progress')),
    ]);

  const settings: UserSettings = settingsRaw
    ? {
        ...DEFAULT_USER_SETTINGS,
        ...settingsRaw,
        headsetConfig: {
          ...DEFAULT_USER_SETTINGS.headsetConfig,
          ...(settingsRaw.headsetConfig || {}),
        },
      }
    : DEFAULT_USER_SETTINGS;

  const progress: PlaybackProgress = progressRaw ?? DEFAULT_PROGRESS;

  return {
    subjects: subjects.sort((a, b) => a.createdAt - b.createdAt),
    topics: topics.sort((a, b) => a.createdAt - b.createdAt),
    playlists: playlists.sort((a, b) => a.createdAt - b.createdAt),
    tracks: tracks.sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt - b.createdAt),
    trashItems: trashItems.sort((a, b) => b.deletedAt - a.deletedAt),
    settings,
    progress,
  };
}

export async function putRecord<T>(storeName: string, value: T): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).put(value);
  await transactionDone(tx);
}

export async function putManyRecords<T>(storeName: string, values: T[]): Promise<void> {
  if (values.length === 0) return;
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  for (const val of values) {
    store.put(val);
  }
  await transactionDone(tx);
}

export async function deleteRecord(storeName: string, key: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).delete(key);
  await transactionDone(tx);
}

export async function saveAudioTrackWithBlob(track: AudioTrack, blob: Blob): Promise<void> {
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error('El audio grabado está vacío y no se puede guardar.');
  }
  const db = await openDatabase();
  const tx = db.transaction([STORE_TRACKS, STORE_AUDIO_BLOBS], 'readwrite');
  const existing = await requestToPromise<AudioTrack | undefined>(
    tx.objectStore(STORE_TRACKS).get(track.id)
  );
  if (existing) {
    throw new Error('Ya existe una grabación con el mismo identificador. Se canceló la sobrescritura.');
  }
  tx.objectStore(STORE_TRACKS).put(track);
  const blobRecord: AudioBlobRecord = {
    trackId: track.id,
    blob,
    mimeType: track.mimeType || blob.type || 'audio/webm',
    updatedAt: Date.now(),
  };
  tx.objectStore(STORE_AUDIO_BLOBS).put(blobRecord);
  await transactionDone(tx);
}

export async function getAudioBlob(trackId: string): Promise<Blob | undefined> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_AUDIO_BLOBS, 'readonly');
  const record = await requestToPromise<AudioBlobRecord | undefined>(
    tx.objectStore(STORE_AUDIO_BLOBS).get(trackId)
  );
  return record?.blob;
}

export async function moveTrackToTrashAtomic(track: AudioTrack, trashItem: TrashItem): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_TRACKS, STORE_TRASH], 'readwrite');
  tx.objectStore(STORE_TRACKS).put({ ...track, status: 'trashed', updatedAt: Date.now() });
  tx.objectStore(STORE_TRASH).put(trashItem);
  await transactionDone(tx);
}

export async function restoreTrackFromTrashAtomic(
  track: AudioTrack,
  trashItemId: string
): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_TRACKS, STORE_TRASH], 'readwrite');
  tx.objectStore(STORE_TRACKS).put({ ...track, status: 'active', updatedAt: Date.now() });
  tx.objectStore(STORE_TRASH).delete(trashItemId);
  await transactionDone(tx);
}

export async function permanentlyDeleteTracksAtomic(
  trackIds: string[],
  trashItemIds: string[]
): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_TRACKS, STORE_AUDIO_BLOBS, STORE_TRASH], 'readwrite');
  const tracksStore = tx.objectStore(STORE_TRACKS);
  const blobsStore = tx.objectStore(STORE_AUDIO_BLOBS);
  const trashStore = tx.objectStore(STORE_TRASH);

  for (const id of trackIds) {
    tracksStore.delete(id);
    blobsStore.delete(id);
  }
  for (const tid of trashItemIds) {
    trashStore.delete(tid);
  }
  await transactionDone(tx);
}

export async function importMergedBackupAtomic(params: {
  subjects: Subject[];
  topics: Topic[];
  playlists: Playlist[];
  tracksWithBlobs: Array<{ track: AudioTrack; blob: Blob }>;
  trashItems: TrashItem[];
}): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(
    [STORE_SUBJECTS, STORE_TOPICS, STORE_PLAYLISTS, STORE_TRACKS, STORE_AUDIO_BLOBS, STORE_TRASH],
    'readwrite'
  );

  const subStore = tx.objectStore(STORE_SUBJECTS);
  const topStore = tx.objectStore(STORE_TOPICS);
  const plStore = tx.objectStore(STORE_PLAYLISTS);
  const trkStore = tx.objectStore(STORE_TRACKS);
  const blobStore = tx.objectStore(STORE_AUDIO_BLOBS);
  const trashStore = tx.objectStore(STORE_TRASH);

  params.subjects.forEach((s) => subStore.put(s));
  params.topics.forEach((t) => topStore.put(t));
  params.playlists.forEach((p) => plStore.put(p));
  params.trashItems.forEach((tr) => trashStore.put(tr));
  params.tracksWithBlobs.forEach(({ track, blob }) => {
    trkStore.put(track);
    blobStore.put({
      trackId: track.id,
      blob,
      mimeType: track.mimeType || blob.type || 'audio/webm',
      updatedAt: Date.now(),
    } as AudioBlobRecord);
  });

  await transactionDone(tx);
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  await putRecord(STORE_SETTINGS, settings);
}

export async function savePlaybackProgress(progress: PlaybackProgress): Promise<void> {
  await putRecord(STORE_PROGRESS, progress);
}

export async function getStorageStats(): Promise<StorageStats> {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.estimate) {
    return {
      usageBytes: 0,
      quotaBytes: 0,
      percentUsed: 0,
      persisted: false,
      supported: false,
      nearLimit: false,
    };
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage ?? 0;
    const quota = estimate.quota ?? 0;
    const percentUsed = quota > 0 ? Math.min(100, Math.round((usage / quota) * 1000) / 10) : 0;
    const persisted =
      typeof navigator.storage.persisted === 'function' ? await navigator.storage.persisted() : false;

    return {
      usageBytes: usage,
      quotaBytes: quota,
      percentUsed,
      persisted,
      supported: true,
      nearLimit: percentUsed >= 80,
    };
  } catch {
    return {
      usageBytes: 0,
      quotaBytes: 0,
      percentUsed: 0,
      persisted: false,
      supported: false,
      nearLimit: false,
    };
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.persist !== 'function') {
    return false;
  }
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
