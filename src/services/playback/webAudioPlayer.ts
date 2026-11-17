import { AudioTrack, IPlaybackController } from '../../types/audioStudy';

export interface WebAudioPlayerEvents {
  onTimeUpdate: (currentTimeSec: number, durationSec: number) => void;
  onPlayStateChange: (isPlaying: boolean) => void;
  onEnded: () => void;
  onError: (message: string) => void;
}

/**
 * Implementación web de IPlaybackController usando un único HTMLAudioElement.
 * Garantiza que nunca haya dos audios reproduciéndose a la vez y libera ObjectURLs.
 */
export class WebAudioPlayer implements IPlaybackController {
  private audio: HTMLAudioElement;
  private currentObjectUrl: string | null = null;
  private events: WebAudioPlayerEvents;
  private loadSequence = 0;

  constructor(events: WebAudioPlayerEvents) {
    this.events = events;
    this.audio = new Audio();
    this.audio.preload = 'auto';
    // Atributo para mejor compatibilidad en móviles iOS/Android
    this.audio.setAttribute('playsinline', 'true');

    this.audio.addEventListener('timeupdate', () => {
      const dur = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
      this.events.onTimeUpdate(this.audio.currentTime || 0, dur);
    });

    this.audio.addEventListener('loadedmetadata', () => {
      const dur = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
      this.events.onTimeUpdate(this.audio.currentTime || 0, dur);
    });

    this.audio.addEventListener('play', () => {
      this.events.onPlayStateChange(true);
    });

    this.audio.addEventListener('pause', () => {
      if (!this.audio.ended) {
        this.events.onPlayStateChange(false);
      }
    });

    this.audio.addEventListener('ended', () => {
      this.events.onPlayStateChange(false);
      this.events.onEnded();
    });

    this.audio.addEventListener('error', () => {
      const mediaErr = this.audio.error;
      let msg = 'No se pudo reproducir este archivo de audio.';
      if (mediaErr) {
        if (mediaErr.code === MediaError.MEDIA_ERR_DECODE || mediaErr.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
          msg = 'El formato del archivo de audio no es compatible con este navegador o el archivo está dañado.';
        } else if (mediaErr.code === MediaError.MEDIA_ERR_ABORTED) {
          msg = 'La carga del audio fue interrumpida.';
        }
      }
      this.events.onError(msg);
    });
  }

  public updateEvents(events: WebAudioPlayerEvents): void {
    this.events = events;
  }

  public async loadTrack(track: AudioTrack, blob: Blob, startPositionSec = 0): Promise<void> {
    const seq = ++this.loadSequence;

    // Detener inmediatamente cualquier pista previa para evitar reproducción duplicada
    this.audio.pause();
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }

    if (!blob || blob.size === 0) {
      throw new Error(`El audio "${track.title}" no tiene contenido reproducible.`);
    }

    const url = URL.createObjectURL(blob);
    this.currentObjectUrl = url;
    this.audio.src = url;
    this.audio.load();

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        this.audio.removeEventListener('canplay', onCanPlay);
        this.audio.removeEventListener('loadedmetadata', onCanPlay);
        this.audio.removeEventListener('error', onError);
      };

      const onCanPlay = () => {
        cleanup();
        if (seq !== this.loadSequence) {
          resolve();
          return;
        }
        if (startPositionSec > 0 && Number.isFinite(this.audio.duration)) {
          this.audio.currentTime = Math.min(startPositionSec, Math.max(0, this.audio.duration - 0.5));
        }
        resolve();
      };

      const onError = () => {
        cleanup();
        reject(new Error(`El formato de "${track.title}" (${track.mimeType}) no es compatible o está corrupto.`));
      };

      this.audio.addEventListener('canplay', onCanPlay, { once: true });
      this.audio.addEventListener('loadedmetadata', onCanPlay, { once: true });
      this.audio.addEventListener('error', onError, { once: true });
    });
  }

  public async play(): Promise<void> {
    if (!this.audio.src) {
      throw new Error('No hay ninguna grabación cargada para reproducir.');
    }
    try {
      await this.audio.play();
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError') {
        throw new Error(
          'El navegador bloqueó la reproducción automática. Pulsa Reproducir para iniciar el audio.'
        );
      }
      if (name === 'NotSupportedError') {
        throw new Error('Formato de audio incompatible con este dispositivo.');
      }
      throw err;
    }
  }

  public pause(): void {
    this.audio.pause();
  }

  public seekTo(seconds: number): void {
    if (!Number.isFinite(seconds) || !this.audio.src) return;
    const duration = Number.isFinite(this.audio.duration) ? this.audio.duration : seconds;
    this.audio.currentTime = Math.max(0, Math.min(duration, seconds));
  }

  public setVolume(volume: number): void {
    this.audio.volume = Math.max(0, Math.min(1, volume));
  }

  public stop(): void {
    this.loadSequence++;
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  public destroy(): void {
    this.stop();
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
    this.audio.removeAttribute('src');
    this.audio.load();
  }
}
