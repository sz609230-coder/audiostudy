import test from 'node:test';
import assert from 'node:assert/strict';
import {
  arrayBufferToBase64,
  computeSafeBackupMerge,
  validateBackupJson,
} from './backupService';
import { AudioTrack, BackupBundle, CURRENT_SCHEMA_VERSION, Playlist, Subject, Topic } from '../../types/audioStudy';

const sampleSubject: Subject = {
  id: 'sub_geo',
  name: 'Geografía',
  color: '#14E3C3',
  createdAt: 1000,
  updatedAt: 1000,
};

const sampleTopic: Topic = {
  id: 'top_clima',
  subjectId: 'sub_geo',
  name: 'El clima',
  createdAt: 1000,
  updatedAt: 1000,
};

const samplePlaylist: Playlist = {
  id: 'pl_clima',
  subjectId: 'sub_geo',
  topicId: 'top_clima',
  name: 'Repaso del clima',
  createdAt: 1000,
  updatedAt: 1000,
};

const sampleTrack: AudioTrack = {
  id: 'trk_1',
  playlistId: 'pl_clima',
  subjectId: 'sub_geo',
  topicId: 'top_clima',
  title: '¿Qué es el clima?',
  durationSec: 5,
  orderIndex: 0,
  mimeType: 'audio/wav',
  byteSize: 4,
  createdAt: 1000,
  updatedAt: 1000,
  status: 'active',
};

test('validateBackupJson rechaza JSON inválido o formato incorrecto', () => {
  assert.equal(validateBackupJson('not-json').valid, false);
  assert.equal(validateBackupJson(JSON.stringify({ format: 'other' })).valid, false);
  assert.equal(
    validateBackupJson(
      JSON.stringify({
        format: 'audiostudy-backup',
        schemaVersion: CURRENT_SCHEMA_VERSION + 5,
      })
    ).valid,
    false
  );
});

test('validateBackupJson y computeSafeBackupMerge evitan duplicados y preservan datos existentes', () => {
  const bytes = new Uint8Array([82, 73, 70, 70]).buffer;
  const bundle: BackupBundle = {
    format: 'audiostudy-backup',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: 2000,
    subjects: [sampleSubject],
    topics: [sampleTopic],
    playlists: [samplePlaylist],
    tracks: [
      {
        track: sampleTrack,
        audioBase64: arrayBufferToBase64(bytes),
      },
      {
        track: { ...sampleTrack, id: 'trk_2', title: 'Factores climáticos', orderIndex: 1 },
        audioBase64: arrayBufferToBase64(bytes),
      },
    ],
    trashItems: [],
  };

  const validation = validateBackupJson(JSON.stringify(bundle));
  assert.equal(validation.valid, true);

  const merge = computeSafeBackupMerge(validation.bundle!, {
    subjects: [sampleSubject],
    topics: [sampleTopic],
    playlists: [samplePlaylist],
    tracks: [sampleTrack],
    trashItems: [],
  });

  assert.equal(merge.subjectsToAdd.length, 0);
  assert.equal(merge.tracksToAdd.length, 1);
  assert.equal(merge.tracksToAdd[0].track.id, 'trk_2');
  assert.equal(merge.skippedDuplicates, 1);
});
