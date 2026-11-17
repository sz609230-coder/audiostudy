import {
  AudioTrack,
  BackupBundle,
  BackupSerializedTrack,
  CURRENT_SCHEMA_VERSION,
  Playlist,
  Subject,
  Topic,
  TrashItem,
} from '../../types/audioStudy';

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType || 'audio/webm' });
}

export async function createBackupBundle(params: {
  subjects: Subject[];
  topics: Topic[];
  playlists: Playlist[];
  tracks: AudioTrack[];
  trashItems: TrashItem[];
  getBlob: (trackId: string) => Promise<Blob | undefined>;
}): Promise<BackupBundle> {
  const serializedTracks: BackupSerializedTrack[] = [];

  for (const track of params.tracks) {
    const blob = await params.getBlob(track.id);
    if (!blob) {
      throw new Error(`Falta el archivo binario del audio "${track.title}".`);
    }
    const buffer = await blob.arrayBuffer();
    serializedTracks.push({
      track,
      audioBase64: arrayBufferToBase64(buffer),
    });
  }

  return {
    format: 'audiostudy-backup',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: Date.now(),
    subjects: params.subjects,
    topics: params.topics,
    playlists: params.playlists,
    tracks: serializedTracks,
    trashItems: params.trashItems,
  };
}

export interface BackupValidationResult {
  valid: boolean;
  error?: string;
  bundle?: BackupBundle;
}

export function validateBackupJson(rawText: string): BackupValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      valid: false,
      error: 'El archivo seleccionado no contiene JSON válido.',
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'Formato de copia de seguridad inválido.' };
  }

  const obj = parsed as Record<string, unknown>;
  if (obj.format !== 'audiostudy-backup') {
    return {
      valid: false,
      error: 'Este archivo no pertenece a una copia de seguridad de AudioStudy.',
    };
  }

  if (typeof obj.schemaVersion !== 'number' || obj.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return {
      valid: false,
      error: 'La versión de esta copia de seguridad es posterior a la versión actual de la aplicación.',
    };
  }

  if (
    !Array.isArray(obj.subjects) ||
    !Array.isArray(obj.topics) ||
    !Array.isArray(obj.playlists) ||
    !Array.isArray(obj.tracks) ||
    !Array.isArray(obj.trashItems)
  ) {
    return {
      valid: false,
      error: 'La copia de seguridad está incompleta o dañada (faltan secciones obligatorias).',
    };
  }

  for (const entry of obj.tracks as unknown[]) {
    if (!entry || typeof entry !== 'object') {
      return { valid: false, error: 'Una grabación dentro del respaldo tiene un formato inválido.' };
    }
    const item = entry as Record<string, unknown>;
    if (!item.track || typeof item.track !== 'object' || typeof item.audioBase64 !== 'string') {
      return { valid: false, error: 'Faltan datos de audio en una de las grabaciones del respaldo.' };
    }
    const t = item.track as Record<string, unknown>;
    if (typeof t.id !== 'string' || typeof t.title !== 'string' || typeof t.playlistId !== 'string') {
      return { valid: false, error: 'Metadatos de grabación incompletos en el respaldo.' };
    }
    if (item.audioBase64.length === 0) {
      return { valid: false, error: `El audio "${t.title}" no contiene datos binarios.` };
    }
  }

  return {
    valid: true,
    bundle: parsed as BackupBundle,
  };
}

export interface MergeBackupSummary {
  subjectsToAdd: Subject[];
  topicsToAdd: Topic[];
  playlistsToAdd: Playlist[];
  tracksToAdd: Array<{ track: AudioTrack; blob: Blob }>;
  trashItemsToAdd: TrashItem[];
  skippedDuplicates: number;
}

/**
 * Fusiona una copia de seguridad sin sobrescribir ni duplicar grabaciones existentes.
 */
export function computeSafeBackupMerge(
  bundle: BackupBundle,
  existing: {
    subjects: Subject[];
    topics: Topic[];
    playlists: Playlist[];
    tracks: AudioTrack[];
    trashItems: TrashItem[];
  }
): MergeBackupSummary {
  const existingSubjectIds = new Set(existing.subjects.map((s) => s.id));
  const existingTopicIds = new Set(existing.topics.map((t) => t.id));
  const existingPlaylistIds = new Set(existing.playlists.map((p) => p.id));
  const existingTrackIds = new Set(existing.tracks.map((t) => t.id));
  const existingTrashIds = new Set(existing.trashItems.map((tr) => tr.id));

  // Evitar duplicar por contenido idéntico (mismo título + fecha + tamaño + playlist)
  const existingTrackFingerprints = new Set(
    existing.tracks.map((t) => `${t.playlistId}::${t.title.trim().toLowerCase()}::${t.createdAt}::${t.byteSize}`)
  );

  const subjectsToAdd = bundle.subjects.filter((s) => !existingSubjectIds.has(s.id));
  const topicsToAdd = bundle.topics.filter((t) => !existingTopicIds.has(t.id));
  const playlistsToAdd = bundle.playlists.filter((p) => !existingPlaylistIds.has(p.id));
  const trashItemsToAdd = bundle.trashItems.filter((tr) => !existingTrashIds.has(tr.id));

  const tracksToAdd: Array<{ track: AudioTrack; blob: Blob }> = [];
  let skippedDuplicates = 0;

  for (const item of bundle.tracks) {
    const fingerprint = `${item.track.playlistId}::${item.track.title.trim().toLowerCase()}::${item.track.createdAt}::${item.track.byteSize}`;
    if (existingTrackIds.has(item.track.id) || existingTrackFingerprints.has(fingerprint)) {
      skippedDuplicates++;
      continue;
    }
    const blob = base64ToBlob(item.audioBase64, item.track.mimeType);
    if (blob.size === 0) {
      throw new Error(`El archivo de audio "${item.track.title}" resultó vacío al decodificar.`);
    }
    tracksToAdd.push({ track: item.track, blob });
  }

  return {
    subjectsToAdd,
    topicsToAdd,
    playlistsToAdd,
    tracksToAdd,
    trashItemsToAdd,
    skippedDuplicates,
  };
}
