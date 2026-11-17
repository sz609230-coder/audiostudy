import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceOnTrackEnd,
  buildPlaylistQueue,
  createInitialPlaybackState,
  goToPreviousTrack,
  reorderTrackInPlaylist,
  skipCurrentTrackToTrash,
} from './playbackEngine';
import { AudioTrack } from '../../types/audioStudy';
import { generateNextAutoTitle } from '../../utils/audioUtils';

function makeTrack(id: string, orderIndex: number, title = `Pista ${orderIndex + 1}`): AudioTrack {
  return {
    id,
    playlistId: 'pl_1',
    subjectId: 'sub_1',
    topicId: 'top_1',
    title,
    durationSec: 12,
    orderIndex,
    mimeType: 'audio/wav',
    byteSize: 1024,
    createdAt: 1000 + orderIndex * 100,
    updatedAt: 1000 + orderIndex * 100,
    status: 'active',
  };
}

test('PRUEBA 4: skipCurrentTrackToTrash mueve la pista actual a papelera y carga la siguiente', () => {
  const tracks = [makeTrack('t1', 0), makeTrack('t2', 1), makeTrack('t3', 2)];
  const state = {
    ...createInitialPlaybackState(false, 1),
    status: 'playing' as const,
    currentPlaylistId: 'pl_1',
    currentTrackId: 't1',
    queueTrackIds: buildPlaylistQueue(tracks, 'pl_1'),
  };

  const res = skipCurrentTrackToTrash(state, tracks, 5000);
  assert.equal(res.throttled, false);
  assert.equal(res.addedTrashItem?.trackId, 't1');
  assert.equal(res.addedTrashItem?.reason, 'skipped');
  assert.equal(res.nextTrackToLoad?.id, 't2');
  assert.equal(res.shouldAutoPlay, true);
  assert.deepEqual(res.nextState.queueTrackIds, ['t2', 't3']);
  assert.equal(res.updatedTracks.find((t) => t.id === 't1')?.status, 'trashed');
  assert.equal(res.nextState.lastUndoSkip?.track.id, 't1');
});

test('skipCurrentTrackToTrash protege contra doble pulsación rápida (debounce)', () => {
  const tracks = [makeTrack('t1', 0), makeTrack('t2', 1), makeTrack('t3', 2)];
  const state = {
    ...createInitialPlaybackState(false, 1),
    status: 'playing' as const,
    currentPlaylistId: 'pl_1',
    currentTrackId: 't1',
    queueTrackIds: ['t1', 't2', 't3'],
    lastSkipTimestamp: 5000,
  };

  const res = skipCurrentTrackToTrash(state, tracks, 5100);
  assert.equal(res.throttled, true);
  assert.equal(res.addedTrashItem, null);
  assert.equal(res.nextState.currentTrackId, 't1');
});

test('PRUEBA 6: advanceOnTrackEnd avanza al siguiente y NO elimina la pista al terminar normalmente', () => {
  const tracks = [makeTrack('t1', 0), makeTrack('t2', 1)];
  const state = {
    ...createInitialPlaybackState(false, 1),
    status: 'playing' as const,
    currentPlaylistId: 'pl_1',
    currentTrackId: 't1',
    queueTrackIds: ['t1', 't2'],
  };

  const res = advanceOnTrackEnd(state, tracks);
  assert.equal(res.nextTrackToLoad?.id, 't2');
  assert.equal(res.shouldAutoPlay, true);
  assert.equal(tracks.every((t) => t.status === 'active'), true);
});

test('advanceOnTrackEnd detiene la lista al terminar la última pista cuando repeatPlaylist es false', () => {
  const tracks = [makeTrack('t1', 0), makeTrack('t2', 1)];
  const state = {
    ...createInitialPlaybackState(false, 1),
    status: 'playing' as const,
    currentPlaylistId: 'pl_1',
    currentTrackId: 't2',
    queueTrackIds: ['t1', 't2'],
    durationSec: 12,
  };

  const res = advanceOnTrackEnd(state, tracks);
  assert.equal(res.nextTrackToLoad, null);
  assert.equal(res.shouldAutoPlay, false);
  assert.equal(res.nextState.status, 'completed');
  assert.ok(res.nextState.endedMessage?.includes('terminó'));
});

test('advanceOnTrackEnd repite desde el inicio cuando repeatPlaylist es true', () => {
  const tracks = [makeTrack('t1', 0), makeTrack('t2', 1)];
  const state = {
    ...createInitialPlaybackState(true, 1),
    status: 'playing' as const,
    currentPlaylistId: 'pl_1',
    currentTrackId: 't2',
    queueTrackIds: ['t1', 't2'],
  };

  const res = advanceOnTrackEnd(state, tracks);
  assert.equal(res.nextTrackToLoad?.id, 't1');
  assert.equal(res.shouldAutoPlay, true);
});

test('goToPreviousTrack reinicia si pasaron > 3s o retrocede si <= 3s', () => {
  const tracks = [makeTrack('t1', 0), makeTrack('t2', 1)];
  const stateAfter3s = {
    ...createInitialPlaybackState(false, 1),
    status: 'playing' as const,
    currentPlaylistId: 'pl_1',
    currentTrackId: 't2',
    currentTimeSec: 5,
    queueTrackIds: ['t1', 't2'],
  };
  const restart = goToPreviousTrack(stateAfter3s, tracks);
  assert.equal(restart.restartCurrent, true);
  assert.equal(restart.trackToLoad, null);

  const stateEarly = { ...stateAfter3s, currentTimeSec: 1.5 };
  const prev = goToPreviousTrack(stateEarly, tracks);
  assert.equal(prev.restartCurrent, false);
  assert.equal(prev.trackToLoad?.id, 't1');
});

test('reorderTrackInPlaylist actualiza el orden manualmente', () => {
  const tracks = [makeTrack('t1', 0), makeTrack('t2', 1), makeTrack('t3', 2)];
  const reordered = reorderTrackInPlaylist(tracks, 'pl_1', 't2', 'up');
  const queue = buildPlaylistQueue(reordered, 'pl_1');
  assert.deepEqual(queue, ['t2', 't1', 't3']);
});

test('generateNextAutoTitle genera Audio 001, Audio 002, etc.', () => {
  assert.equal(generateNextAutoTitle([]), 'Audio 001');
  assert.equal(generateNextAutoTitle([{ title: 'Audio 001' }, { title: 'Resumen' }]), 'Audio 002');
  assert.equal(generateNextAutoTitle([{ title: 'Audio 009' }]), 'Audio 010');
});
