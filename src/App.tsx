import React from 'react';
import { AudioStudyProvider, useAudioStudy } from './app/AudioStudyContext';
import { NavigationShell } from './components/NavigationShell';
import { InicioPage } from './pages/InicioPage';
import { MateriasPage } from './pages/MateriasPage';
import { PlaylistPage } from './pages/PlaylistPage';
import { GrabadoraPage } from './pages/GrabadoraPage';
import { ReproductorPage } from './pages/ReproductorPage';
import { PapeleraPage } from './pages/PapeleraPage';
import { ConfiguracionPage } from './pages/ConfiguracionPage';

const AudioStudyRouter: React.FC = () => {
  const { isReady, activeSection } = useAudioStudy();

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F7F7] dark:bg-[#060909] text-slate-600 dark:text-[#9BB8B5] text-sm">
        Cargando tu biblioteca local de AudioStudy...
      </div>
    );
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'inicio':
        return <InicioPage />;
      case 'materias':
        return <MateriasPage />;
      case 'playlist':
        return <PlaylistPage />;
      case 'grabadora':
        return <GrabadoraPage />;
      case 'reproductor':
        return <ReproductorPage />;
      case 'papelera':
        return <PapeleraPage />;
      case 'configuracion':
        return <ConfiguracionPage />;
    }
  };

  return <NavigationShell>{renderSection()}</NavigationShell>;
};

export default function App() {
  return (
    <AudioStudyProvider>
      <AudioStudyRouter />
    </AudioStudyProvider>
  );
}
