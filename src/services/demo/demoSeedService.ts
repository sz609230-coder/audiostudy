import { AudioTrack, Playlist, Subject, Topic } from '../../types/audioStudy';
import { createStableId, synthesizeStudyToneWav } from '../../utils/audioUtils';

export interface DemoBundleResult {
  subjects: Subject[];
  topics: Topic[];
  playlists: Playlist[];
  tracksWithBlobs: Array<{ track: AudioTrack; blob: Blob }>;
}

/**
 * Genera datos de demostración opcionales con audios WAV reales reproducibles
 * para probar el reproductor, la papelera y los controles Bluetooth sin grabar primero.
 */
export function buildOptionalDemoData(): DemoBundleResult {
  const now = Date.now();

  const geoId = createStableId('sub_demo');
  const bioId = createStableId('sub_demo');
  const ciuId = createStableId('sub_demo');

  const subjects: Subject[] = [
    {
      id: geoId,
      name: 'Geografía',
      color: '#14E3C3',
      createdAt: now,
      updatedAt: now,
      isDemo: true,
    },
    {
      id: bioId,
      name: 'Biología',
      color: '#2DD4BF',
      createdAt: now + 1,
      updatedAt: now + 1,
      isDemo: true,
    },
    {
      id: ciuId,
      name: 'Ciudadanía',
      color: '#38BDF8',
      createdAt: now + 2,
      updatedAt: now + 2,
      isDemo: true,
    },
  ];

  const topClimaId = createStableId('top_demo');
  const topRelieveId = createStableId('top_demo');
  const topCelulasId = createStableId('top_demo');
  const topConstitucionId = createStableId('top_demo');

  const topics: Topic[] = [
    { id: topClimaId, subjectId: geoId, name: 'El clima', createdAt: now, updatedAt: now, isDemo: true },
    { id: topRelieveId, subjectId: geoId, name: 'Relieve', createdAt: now + 1, updatedAt: now + 1, isDemo: true },
    { id: topCelulasId, subjectId: bioId, name: 'Células', createdAt: now + 2, updatedAt: now + 2, isDemo: true },
    { id: topConstitucionId, subjectId: ciuId, name: 'Constitución y soberanía', createdAt: now + 3, updatedAt: now + 3, isDemo: true },
  ];

  const plClimaId = createStableId('pl_demo');
  const plCelulasId = createStableId('pl_demo');

  const playlists: Playlist[] = [
    {
      id: plClimaId,
      subjectId: geoId,
      topicId: topClimaId,
      name: 'El clima — Repaso completo',
      createdAt: now,
      updatedAt: now,
      isDemo: true,
    },
    {
      id: plCelulasId,
      subjectId: bioId,
      topicId: topCelulasId,
      name: 'Células y organelos',
      createdAt: now + 1,
      updatedAt: now + 1,
      isDemo: true,
    },
  ];

  const climaTracksSpec = [
    { title: '¿Qué es el clima?', freqs: [261.63, 293.66, 329.63, 392.0], duration: 4.5 },
    { title: 'Factores climáticos', freqs: [293.66, 349.23, 392.0, 440.0], duration: 4.8 },
    { title: 'Tipos de clima', freqs: [329.63, 392.0, 440.0, 493.88], duration: 4.4 },
    { title: 'Mi respuesta sobre el clima', freqs: [349.23, 440.0, 523.25, 440.0], duration: 5.0 },
    { title: 'Repaso final', freqs: [392.0, 493.88, 587.33, 523.25], duration: 4.6 },
  ];

  const bioTracksSpec = [
    { title: 'Célula procariota y eucariota', freqs: [246.94, 293.66, 329.63], duration: 4.2 },
    { title: 'Función de las mitocondrias', freqs: [293.66, 369.99, 440.0], duration: 4.2 },
  ];

  const tracksWithBlobs: Array<{ track: AudioTrack; blob: Blob }> = [];

  climaTracksSpec.forEach((spec, idx) => {
    const blob = synthesizeStudyToneWav(spec.freqs, spec.duration);
    tracksWithBlobs.push({
      track: {
        id: createStableId('trk_demo'),
        playlistId: plClimaId,
        subjectId: geoId,
        topicId: topClimaId,
        title: spec.title,
        durationSec: spec.duration,
        orderIndex: idx,
        mimeType: 'audio/wav',
        byteSize: blob.size,
        createdAt: now + idx * 100,
        updatedAt: now + idx * 100,
        status: 'active',
        isDemo: true,
      },
      blob,
    });
  });

  bioTracksSpec.forEach((spec, idx) => {
    const blob = synthesizeStudyToneWav(spec.freqs, spec.duration);
    tracksWithBlobs.push({
      track: {
        id: createStableId('trk_demo'),
        playlistId: plCelulasId,
        subjectId: bioId,
        topicId: topCelulasId,
        title: spec.title,
        durationSec: spec.duration,
        orderIndex: idx,
        mimeType: 'audio/wav',
        byteSize: blob.size,
        createdAt: now + 1000 + idx * 100,
        updatedAt: now + 1000 + idx * 100,
        status: 'active',
        isDemo: true,
      },
      blob,
    });
  });

  return {
    subjects,
    topics,
    playlists,
    tracksWithBlobs,
  };
}
