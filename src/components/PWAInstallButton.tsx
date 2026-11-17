import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          compact
            ? 'px-3 py-2 text-xs bg-[#0B7D6E] text-white dark:bg-[#14E3C3] dark:text-[#060909] hover:opacity-90 min-h-[40px]'
            : 'px-4 py-2.5 text-sm bg-[#0B7D6E] text-white dark:bg-[#14E3C3] dark:text-[#060909] hover:opacity-90 min-h-[44px]'
        }`}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Instalar app</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-[#1E3A3C] px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-[#D1E5E3] hover:bg-slate-100 dark:hover:bg-[#102A2C] transition-colors whitespace-nowrap shrink-0 min-h-[44px] cursor-pointer"
        >
          <Smartphone className="w-4 h-4 shrink-0" />
          <span>Instalar en iPhone / iPad</span>
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
          >
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#0B1415] border border-slate-200 dark:border-[#1B3537] p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <h3 id="ios-install-title" className="text-lg font-bold text-slate-900 dark:text-white">
                  Instalar AudioStudy en iOS
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Cerrar guía de instalación"
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-[#102A2C] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="mt-4 space-y-2.5 text-sm text-slate-700 dark:text-[#B6CECC] list-decimal list-inside">
                <li>Toca el botón <strong>Compartir</strong> en la barra inferior de Safari.</li>
                <li>Desliza hacia abajo y elige <strong>Añadir a pantalla de inicio</strong>.</li>
                <li>Confirma tocando <strong>Añadir</strong> para usar AudioStudy sin barra del navegador.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-[#0B7D6E] dark:bg-[#14E3C3] text-white dark:text-[#060909] py-2.5 text-sm font-semibold cursor-pointer min-h-[44px]"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
