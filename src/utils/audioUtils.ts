import { AudioTrack } from '../types/audioStudy';

export function createStableId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '00:00';
  }
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatDateTimeEs(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let idx = 0;
  let value = bytes;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx++;
  }
  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

/**
 * Genera el siguiente título automático con formato "Audio 001", "Audio 002", etc.
 */
export function generateNextAutoTitle(existingTracks: Pick<AudioTrack, 'title'>[]): string {
  let maxNumber = 0;
  const pattern = /^Audio\s+(\d+)$/i;
  for (const t of existingTracks) {
    const match = t.title.trim().match(pattern);
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed) && parsed > maxNumber) {
        maxNumber = parsed;
      }
    }
  }
  return `Audio ${String(maxNumber + 1).padStart(3, '0')}`;
}

export function sanitizeFilename(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ_\-\s]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 64) || 'audio_estudio';
}

export function pickSupportedRecorderMimeType(): {
  mimeType: string;
  extension: string;
} {
  if (typeof MediaRecorder === 'undefined') {
    return { mimeType: 'audio/webm', extension: 'webm' };
  }
  const candidates = [
    { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
    { mimeType: 'audio/webm', extension: 'webm' },
    { mimeType: 'audio/mp4;codecs=mp4a.40.2', extension: 'm4a' },
    { mimeType: 'audio/mp4', extension: 'm4a' },
    { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(c.mimeType)) {
      return c;
    }
  }
  return { mimeType: '', extension: 'webm' };
}

export function getExtensionFromMimeType(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (lower.includes('mp4') || lower.includes('aac') || lower.includes('m4a')) return 'm4a';
  if (lower.includes('ogg')) return 'ogg';
  if (lower.includes('wav')) return 'wav';
  if (lower.includes('mpeg') || lower.includes('mp3')) return 'mp3';
  return 'webm';
}

/**
 * Sintetiza un archivo WAV PCM válido y audible para audios de demostración opcionales
 * o pruebas locales sin depender de URLs externas ni conexión a internet.
 */
export function synthesizeStudyToneWav(
  frequencies: number[],
  durationSec = 4.2,
  sampleRate = 22050
): Blob {
  const numSamples = Math.floor(durationSec * sampleRate);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  const segSamples = Math.max(1, Math.floor(numSamples / Math.max(1, frequencies.length)));

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const freqIdx = Math.min(frequencies.length - 1, Math.floor(i / segSamples));
    const freq = frequencies[freqIdx] || 261.63;
    const localPos = (i % segSamples) / segSamples;
    const envelope = Math.sin(Math.PI * Math.min(1, localPos * 6)) * Math.sin(Math.PI * Math.min(1, (1 - localPos) * 6));
    const globalFade = i < 400 ? i / 400 : i > numSamples - 800 ? (numSamples - i) / 800 : 1;
    const wave =
      0.55 * Math.sin(2 * Math.PI * freq * t) +
      0.22 * Math.sin(2 * Math.PI * freq * 1.5 * t) +
      0.1 * Math.sin(2 * Math.PI * freq * 2 * t);
    const sample = Math.max(-1, Math.min(1, wave * envelope * globalFade * 0.35));
    view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
