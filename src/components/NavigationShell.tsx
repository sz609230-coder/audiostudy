import React from 'react';
import {
  Disc3,
  FolderKanban,
  Home,
  ListMusic,
  Mic,
  Pause,
  Play,
  Settings,
  SkipForward,
  Sun,
  Moon,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react';
import { useAudioStudy } from '../app/AudioStudyContext';
import { AppSection } from '../types/audioStudy';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { formatDuration } from '../utils/audioUtils';
import { PWAInstallButton } from './PWAInstallButton';

interface NavigationShellProps {
  children: React.ReactNode;
}

export const NavigationShell: React.FC<NavigationShellProps> = ({ children }) => {
  const {
    activeSection,
    setActiveSection,
    playback,
    tracks,
    subjects,
    trashItems,
    settings,
    setTheme,
    togglePlayPause,
    skipNextAndArchive,
    banner,
    dismissBanner,
  } = useAudioStudy();

  const isOnline = useOnlineStatus();

  const currentTrack = playback.currentTrackId
    ? tracks.find((t) => t.id === playback.currentTrackId)
    : undefined;
  const currentSubject = currentTrack
    ? subjects.find((s) => s.id === currentTrack.subjectId)
    : undefined;

  const navItems: Array<{
    id: AppSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    { id: 'inicio', label: 'Inicio', icon: Home },
    { id: 'materias', label: 'Materias', icon: FolderKanban },
    { id: 'playlist', label: 'Playlist', icon: ListMusic },
    { id: 'grabadora', label: 'Grabadora', icon: Mic },
    { id: 'reproductor', label: 'Reproductor', icon: Disc3 },
    { id: 'papelera', label: 'Papelera', icon: Trash2, count: trashItems.length },
    { id: 'configuracion', label: 'Configuración', icon: Settings },
  ];

  // Navegación inferior móvil ergonómica (5 destinos clave en la zona natural del pulgar)
  const mobileBottomItems: Array<{
    id: AppSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { id: 'inicio', label: 'Inicio', icon: Home },
    { id: 'materias', label: 'Materias', icon: FolderKanban },
    { id: 'grabadora', label: 'Grabar', icon: Mic },
    { id: 'reproductor', label: 'Reproductor', icon: Disc3 },
    { id: 'papelera', label: 'Papelera', icon: Trash2, badge: trashItems.length },
  ];

  const showMiniPlayer = !!currentTrack && activeSection !== 'reproductor';

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F4F7F7] text-[#0B1C1E] dark:bg-[#060909] dark:text-[#EEF5F4]">
      {/* Sidebar Desktop (>= lg) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 dark:border-[#162C2E] bg-white dark:bg-[#091011] z-30">
        <div className="px-6 py-6 border-b border-slate-200 dark:border-[#162C2E] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setActiveSection('inicio')}
            className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14E3C3] rounded-lg cursor-pointer"
          >
            <span className="font-display text-xl font-extrabold tracking-tight text-[#0B1C1E] dark:text-white whitespace-nowrap">
              AudioStudy
            </span>
          </button>
          <button
            type="button"
            onClick={() => void setTheme(settings.theme === 'dark' ? 'light' : 'dark')}
            aria-label={settings.theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-[#1A3537] text-slate-700 dark:text-[#A3C4C1] hover:bg-slate-100 dark:hover:bg-[#102A2C] transition-colors cursor-pointer"
          >
            {settings.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        <nav aria-label="Navegación principal" className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#0D3B3E] text-[#14E3C3] dark:bg-[#102E30] dark:text-[#14E3C3]'
                    : 'text-slate-700 dark:text-[#9BB8B5] hover:bg-slate-100 dark:hover:bg-[#0E1E20] hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span className="font-mono text-xs tabular-nums opacity-80">{item.count}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-[#162C2E] space-y-3">
          {!isOnline && (
            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 px-1">
              <WifiOff className="w-3.5 h-3.5 shrink-0" />
              <span>Sin conexión · Modo local activo</span>
            </div>
          )}
          <PWAInstallButton />
        </div>
      </aside>

      {/* Mobile Compact Top App Bar (< lg, 52px height to respect 15% sticky budget) */}
      <header className="lg:hidden sticky top-0 z-30 h-[52px] px-4 flex items-center justify-between gap-4 bg-white/90 dark:bg-[#060909]/90 backdrop-blur-md border-b border-slate-200 dark:border-[#162C2E]">
        <button
          type="button"
          onClick={() => setActiveSection('inicio')}
          className="font-display text-lg font-extrabold tracking-tight text-[#0B1C1E] dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
        >
          AudioStudy
        </button>

        <div className="flex items-center gap-1">
          {!isOnline && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300 mr-1 whitespace-nowrap">
              <WifiOff className="w-3.5 h-3.5" />
              <span>Offline</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => void setTheme(settings.theme === 'dark' ? 'light' : 'dark')}
            aria-label={settings.theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-700 dark:text-[#A3C4C1] hover:bg-slate-100 dark:hover:bg-[#102A2C] cursor-pointer"
          >
            {settings.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('configuracion')}
            aria-label="Abrir configuración"
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
              activeSection === 'configuracion'
                ? 'text-[#0B7D6E] dark:text-[#14E3C3] bg-slate-100 dark:bg-[#102A2C]'
                : 'text-slate-700 dark:text-[#A3C4C1] hover:bg-slate-100 dark:hover:bg-[#102A2C]'
            }`}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {banner && (
          <div className="px-4 sm:px-6 lg:px-8 pt-4">
            <div
              role="status"
              className={`max-w-5xl mx-auto rounded-xl px-4 py-3 text-sm flex items-start justify-between gap-3 border ${
                banner.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950/50 dark:border-red-900/70 dark:text-red-200'
                  : banner.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/50 dark:border-amber-900/70 dark:text-amber-200'
                  : banner.type === 'success'
                  ? 'bg-teal-50 border-teal-200 text-teal-950 dark:bg-[#0D3B3E]/60 dark:border-[#14E3C3]/30 dark:text-[#D5FBF4]'
                  : 'bg-slate-100 border-slate-200 text-slate-900 dark:bg-[#0C1D1E] dark:border-[#1B3A3C] dark:text-[#DCECEB]'
              }`}
            >
              <span className="leading-relaxed">{banner.message}</span>
              <button
                type="button"
                onClick={dismissBanner}
                aria-label="Cerrar notificación"
                className="p-1 rounded-lg opacity-75 hover:opacity-100 shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <main
          className={`flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 ${
            showMiniPlayer ? 'pb-40 lg:pb-28' : 'pb-24 lg:pb-12'
          }`}
        >
          {children}
        </main>
      </div>

      {/* Persistent Compact Mini-Player when active outside Reproductor view */}
      {showMiniPlayer && currentTrack && (
        <div className="fixed bottom-16 lg:bottom-4 left-2 right-2 lg:left-72 lg:right-8 z-30">
          <div className="max-w-4xl mx-auto rounded-2xl bg-white/95 dark:bg-[#0B1A1B]/95 backdrop-blur-md border border-slate-200 dark:border-[#1B3B3D] shadow-xl px-3.5 py-2.5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setActiveSection('reproductor')}
              className="flex-1 min-w-0 text-left cursor-pointer"
            >
              <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {currentTrack.title}
              </div>
              <div className="text-xs text-slate-500 dark:text-[#8FB3B0] truncate font-mono tabular-nums">
                {currentSubject?.name ?? 'Estudio'} · {formatDuration(playback.currentTimeSec)} /{' '}
                {formatDuration(playback.durationSec || currentTrack.durationSec)}
              </div>
            </button>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => void togglePlayPause()}
                aria-label={playback.status === 'playing' ? 'Pausar reproducción' : 'Reanudar reproducción'}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-[#0B7D6E] dark:bg-[#14E3C3] text-white dark:text-[#060909] hover:opacity-90 transition-opacity cursor-pointer"
              >
                {playback.status === 'playing' ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => void skipNextAndArchive()}
                aria-label="Saltar al siguiente audio y enviar actual a papelera"
                title="Saltar y archivar en papelera"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-[#1E3F41] text-slate-800 dark:text-[#D1E5E3] hover:bg-slate-100 dark:hover:bg-[#102A2C] cursor-pointer"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (Natural Thumb Zone, 60px) */}
      <nav
        aria-label="Navegación móvil"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-[60px] bg-white/95 dark:bg-[#060909]/95 backdrop-blur-md border-t border-slate-200 dark:border-[#162C2E] grid grid-cols-5 items-center"
      >
        {mobileBottomItems.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={`relative h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                active
                  ? 'text-[#0B7D6E] dark:text-[#14E3C3]'
                  : 'text-slate-500 dark:text-[#7E9E9B] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="truncate max-w-full px-1">{item.label}</span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span className="absolute top-1.5 right-3 text-[10px] font-mono tabular-nums font-bold text-[#0B7D6E] dark:text-[#14E3C3]">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
