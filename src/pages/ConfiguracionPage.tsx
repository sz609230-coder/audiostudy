import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Bluetooth,
  Download,
  HardDrive,
  Info,
  Moon,
  ShieldCheck,
  Smartphone,
  Sun,
  Upload,
} from 'lucide-react';
import { useAudioStudy } from '../app/AudioStudyContext';
import { formatBytes } from '../utils/audioUtils';
import { isMediaSessionSupported } from '../services/media-session/mediaSessionService';
import { PWAInstallButton } from '../components/PWAInstallButton';

export const ConfiguracionPage: React.FC = () => {
  const {
    settings,
    setTheme,
    updateHeadsetConfig,
    toggleRepeatPlaylist,
    toggleAutoResume,
    storageStats,
    requestPersistStorage,
    exportAllBackup,
    importBackupFile,
    showBanner,
  } = useAudioStudy();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);

  const handleImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImporting(true);
    try {
      const summary = await importBackupFile(file);
      showBanner(
        'success',
        `Respaldo restaurado: ${summary.importedTracks} audios importados y ${summary.skippedDuplicates} duplicados omitidos sin borrar datos previos.`
      );
    } catch (err) {
      showBanner(
        'error',
        err instanceof Error
          ? `${err.message} Tus grabaciones originales no se modificaron.`
          : 'No se pudo importar la copia de seguridad. Tus grabaciones originales siguen intactas.'
      );
    } finally {
      setImporting(false);
    }
  };

  const pauseConflict = settings.headsetConfig.onPauseCommand === 'skip_and_archive';
  const playConflict = settings.headsetConfig.onPlayCommand === 'skip_and_archive';

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="border-b border-slate-200 dark:border-[#162C2E] pb-5">
        <h1 className="font-display text-2xl font-extrabold text-[#0B1C1E] dark:text-white">
          Configuración y copias de seguridad
        </h1>
        <p className="text-sm text-slate-600 dark:text-[#9BB8B5] mt-1">
          Personaliza la apariencia, los controles Bluetooth, el almacenamiento local y la compatibilidad sin conexión.
        </p>
      </div>

      {/* Preferencias generales y Apariencia */}
      <section className="rounded-2xl bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#193537] p-6 space-y-5">
        <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
          Preferencias de pantalla y reproducción
        </h2>

        <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-b border-slate-100 dark:border-[#152D2F]">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              Tema visual
            </div>
            <div className="text-xs text-slate-500 dark:text-[#8FB3B0]">
              Elige modo oscuro para estudiar de noche o modo claro para exterior.
            </div>
          </div>

          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-[#071011] p-1 border border-slate-200 dark:border-[#1A3537]">
            <button
              type="button"
              onClick={() => void setTheme('dark')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold min-h-[38px] cursor-pointer ${
                settings.theme === 'dark'
                  ? 'bg-[#0D3B3E] text-[#14E3C3]'
                  : 'text-slate-600 dark:text-[#8FB3B0]'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Oscuro</span>
            </button>
            <button
              type="button"
              onClick={() => void setTheme('light')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold min-h-[38px] cursor-pointer ${
                settings.theme === 'light'
                  ? 'bg-white text-[#0B1C1E] shadow-sm'
                  : 'text-slate-600 dark:text-[#8FB3B0]'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Claro</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 dark:border-[#152D2F]">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              Repetir playlist automáticamente al finalizar
            </div>
            <div className="text-xs text-slate-500 dark:text-[#8FB3B0]">
              Si está desactivado, la reproducción se detiene al terminar el último audio.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.repeatPlaylist}
            onClick={() => void toggleRepeatPlaylist()}
            className={`px-4 py-2 rounded-xl text-xs font-bold min-h-[40px] cursor-pointer ${
              settings.repeatPlaylist
                ? 'bg-[#0B7D6E] dark:bg-[#14E3C3] text-white dark:text-[#060909]'
                : 'bg-slate-100 dark:bg-[#071011] text-slate-700 dark:text-[#9BB8B5] border border-slate-200 dark:border-[#1A3537]'
            }`}
          >
            {settings.repeatPlaylist ? 'Activado' : 'Desactivado'}
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 py-1">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              Recordar posición al reanudar sesión
            </div>
            <div className="text-xs text-slate-500 dark:text-[#8FB3B0]">
              Retoma exactamente en el segundo donde pausaste la última vez.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.autoResumeLastPosition}
            onClick={() => void toggleAutoResume()}
            className={`px-4 py-2 rounded-xl text-xs font-bold min-h-[40px] cursor-pointer ${
              settings.autoResumeLastPosition
                ? 'bg-[#0B7D6E] dark:bg-[#14E3C3] text-white dark:text-[#060909]'
                : 'bg-slate-100 dark:bg-[#071011] text-slate-700 dark:text-[#9BB8B5] border border-slate-200 dark:border-[#1A3537]'
            }`}
          >
            {settings.autoResumeLastPosition ? 'Activado' : 'Desactivado'}
          </button>
        </div>
      </section>

      {/* Controles de auriculares Bluetooth */}
      <section className="rounded-2xl bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#193537] p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <Bluetooth className="w-5 h-5 text-[#0B7D6E] dark:text-[#14E3C3]" />
          <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            Controles de auriculares Bluetooth
          </h2>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 dark:text-[#9BB8B5] leading-relaxed">
          Media Session API{' '}
          <strong>{isMediaSessionSupported() ? 'está disponible en este navegador' : 'no es compatible en este navegador'}</strong>.
          AudioStudy escucha los comandos multimedia estándar que envía tu sistema Android o auricular Bluetooth.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="cmd-next" className="block text-xs font-semibold text-slate-700 dark:text-[#C5DFDD]">
              Al recibir comando "Siguiente pista" (nexttrack)
            </label>
            <select
              id="cmd-next"
              value={settings.headsetConfig.onNextTrack}
              onChange={(e) =>
                void updateHeadsetConfig({
                  onNextTrack: e.target.value as typeof settings.headsetConfig.onNextTrack,
                })
              }
              className="w-full rounded-xl bg-slate-50 dark:bg-[#060C0D] border border-slate-200 dark:border-[#1A3537] px-3.5 py-2.5 text-sm"
            >
              <option value="skip_and_archive">Saltar y enviar a papelera (Recomendado)</option>
              <option value="next_only">Solo avanzar al siguiente sin archivar</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cmd-prev" className="block text-xs font-semibold text-slate-700 dark:text-[#C5DFDD]">
              Al recibir comando "Pista anterior" (previoustrack)
            </label>
            <select
              id="cmd-prev"
              value={settings.headsetConfig.onPreviousTrack}
              onChange={(e) =>
                void updateHeadsetConfig({
                  onPreviousTrack: e.target.value as typeof settings.headsetConfig.onPreviousTrack,
                })
              }
              className="w-full rounded-xl bg-slate-50 dark:bg-[#060C0D] border border-slate-200 dark:border-[#1A3537] px-3.5 py-2.5 text-sm"
            >
              <option value="previous_track">Volver al audio anterior / reiniciar</option>
              <option value="skip_and_archive">Saltar y enviar a papelera</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cmd-pause" className="block text-xs font-semibold text-slate-700 dark:text-[#C5DFDD]">
              Al recibir comando "Pausa" (habitual en 1 toque)
            </label>
            <select
              id="cmd-pause"
              value={settings.headsetConfig.onPauseCommand}
              onChange={(e) =>
                void updateHeadsetConfig({
                  onPauseCommand: e.target.value as 'pause' | 'skip_and_archive',
                })
              }
              className="w-full rounded-xl bg-slate-50 dark:bg-[#060C0D] border border-slate-200 dark:border-[#1A3537] px-3.5 py-2.5 text-sm"
            >
              <option value="pause">Pausar reproducción (Estándar sin conflicto)</option>
              <option value="skip_and_archive">Saltar y enviar a papelera (Alternativa 1 toque)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cmd-play" className="block text-xs font-semibold text-slate-700 dark:text-[#C5DFDD]">
              Al recibir comando "Reproducir" (play)
            </label>
            <select
              id="cmd-play"
              value={settings.headsetConfig.onPlayCommand}
              onChange={(e) =>
                void updateHeadsetConfig({
                  onPlayCommand: e.target.value as 'play' | 'skip_and_archive',
                })
              }
              className="w-full rounded-xl bg-slate-50 dark:bg-[#060C0D] border border-slate-200 dark:border-[#1A3537] px-3.5 py-2.5 text-sm"
            >
              <option value="play">Reanudar reproducción (Estándar)</option>
              <option value="skip_and_archive">Saltar y enviar a papelera</option>
            </select>
          </div>
        </div>

        {(pauseConflict || playConflict) && (
          <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3.5 flex items-start gap-2.5 text-xs text-amber-950 dark:text-amber-100">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong>Conflicto de botones activo:</strong> Al asignar el comando "Pausa" o "Reproducir" a saltar pista, ya no podrás pausar desde ese botón del auricular y tendrás que pausar desde la pantalla de bloqueo o la app.
            </span>
          </div>
        )}

        <div className="rounded-xl bg-slate-50 dark:bg-[#071011] border border-slate-200 dark:border-[#142B2D] p-4 text-xs text-slate-600 dark:text-[#9BB8B5] space-y-1.5 leading-relaxed">
          <p className="font-semibold text-slate-900 dark:text-white">
            Sobre el toque único en auriculares Bluetooth
          </p>
          <p>
            El navegador y Android no permiten detectar gestos físicos directos (como "1 toque" vs "2 toques"), sino únicamente el comando AVRCP que envía el auricular. En la mayoría de los auriculares, 2 toques envían <code>nexttrack</code> y 1 toque envía <code>play/pause</code>.
          </p>
          <p>
            Si la app complementaria de tu marca (ej. Sony, Samsung, Xiaomi, JBL) permite personalizar gestos, asigna 1 toque a "Siguiente pista" para tener salto directo sin conflictos. Si tu auricular no lo permite, la alternativa más práctica es usar la opción de arriba asignando "Pausa" a "Saltar y archivar" mientras repasas, y pausar desde la notificación de pantalla de bloqueo.
          </p>
        </div>
      </section>

      {/* Copias de seguridad */}
      <section className="rounded-2xl bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#193537] p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-[#0B7D6E] dark:text-[#14E3C3]" />
          <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            Copias de seguridad y privacidad
          </h2>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 dark:text-[#9BB8B5] leading-relaxed">
          Tus grabaciones personales se almacenan únicamente en tu dispositivo (IndexedDB), sin subirse a servidores externos ni cuentas en la nube.{' '}
          <strong className="text-slate-900 dark:text-white">
            Importante: si borras los datos del navegador o desinstalas la aplicación sin exportar un respaldo, perderás tus grabaciones locales.
          </strong>
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void exportAllBackup()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B7D6E] dark:bg-[#14E3C3] text-white dark:text-[#060909] px-5 py-2.5 text-sm font-bold min-h-[44px] cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>Exportar copia completa</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={(e) => void handleImportChange(e)}
            className="hidden"
          />
          <button
            type="button"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-[#1E3F41] px-5 py-2.5 text-sm font-semibold text-slate-800 dark:text-[#D1E5E3] hover:bg-slate-100 dark:hover:bg-[#102A2C] min-h-[44px] cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            <span>{importing ? 'Validando respaldo...' : 'Importar copia de seguridad'}</span>
          </button>
        </div>
      </section>

      {/* Almacenamiento disponible */}
      <section className="rounded-2xl bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#193537] p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-5 h-5 text-[#0B7D6E] dark:text-[#14E3C3]" />
            <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
              Almacenamiento disponible
            </h2>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-[#8FB3B0]">
            {storageStats.persisted ? 'Almacenamiento persistente activo' : 'Persistencia estándar'}
          </span>
        </div>

        {storageStats.supported ? (
          <div className="space-y-2">
            <div className="h-2.5 rounded-full bg-slate-200 dark:bg-[#102628] overflow-hidden">
              <div
                className="h-full bg-[#0B7D6E] dark:bg-[#14E3C3]"
                style={{ width: `${Math.min(100, Math.max(2, storageStats.percentUsed))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-600 dark:text-[#9BB8B5]">
              <span>Usado: {formatBytes(storageStats.usageBytes)}</span>
              <span>
                Límite estimado: {formatBytes(storageStats.quotaBytes)} ({storageStats.percentUsed}%)
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-[#8FB3B0]">
            Este navegador no informa la cuota exacta de IndexedDB.
          </p>
        )}

        {!storageStats.persisted && (
          <button
            type="button"
            onClick={() => void requestPersistStorage()}
            className="rounded-xl border border-slate-200 dark:border-[#1E3F41] px-4 py-2 text-xs font-semibold text-slate-800 dark:text-[#D1E5E3] hover:bg-slate-100 dark:hover:bg-[#102A2C] min-h-[40px] cursor-pointer"
          >
            Solicitar almacenamiento persistente al navegador
          </button>
        )}
      </section>

      {/* Ayuda, instalación PWA y arquitectura nativa Android */}
      <section className="rounded-2xl bg-white dark:bg-[#0B1617] border border-slate-200 dark:border-[#193537] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-[#0B7D6E] dark:text-[#14E3C3]" />
            <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
              Ayuda, pantalla apagada y compatibilidad
            </h2>
          </div>
          <PWAInstallButton compact />
        </div>

        <div className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-[#9BB8B5] leading-relaxed">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-[#0B7D6E] dark:text-[#14E3C3] shrink-0 mt-0.5" />
            <p>
              <strong>Qué ofrece esta versión web instalable (PWA):</strong> Reproducción real mediante <code>HTMLAudioElement</code>, integración completa con <code>Media Session API</code> (título, materia, pista actual, controles de bloqueo y Bluetooth en Android Chrome/Edge) y funcionamiento 100% sin conexión mediante Service Worker e IndexedDB.
            </p>
          </div>
          <p>
            <strong>Limitación honesta respecto a una app Android nativa:</strong> Una PWA depende de las políticas de ahorro de batería del navegador y de Android al apagar la pantalla o cambiar de app durante periodos largos; no equivale a un servicio nativo del sistema operativo.
          </p>
          <p>
            <strong>Componentes nativos necesarios para máxima fiabilidad en Android:</strong> Para garantizar reproducción ininterrumpida con pantalla bloqueada en cualquier fabricante Android, la capa de reproducción (<code>IPlaybackController</code>) está desacoplada para conectarse en Kotlin a <strong>Android Media3 (ExoPlayer)</strong> y un <strong>MediaSessionService</strong> ejecutándose como servicio en primer plano (<code>FOREGROUND_SERVICE_MEDIA_PLAYBACK</code>) con notificación multimedia persistente y WakeLock de audio.
          </p>
        </div>
      </section>
    </div>
  );
};
