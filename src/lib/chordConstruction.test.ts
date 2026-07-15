import assert from 'node:assert/strict';
import test from 'node:test';
import { CAGED_ANCHORS } from './scalePositions';
import { GUITAR_TUNING } from './musicTheory';
import {
  ChordConstructionChallenge,
  constructionIntervals,
  generateLegalConstructionVoicings,
  ROOTLESS_STRING_SETS,
  TRIAD_STRING_SETS,
} from './chordConstruction';

function challenge(overrides: Partial<ChordConstructionChallenge>): ChordConstructionChallenge {
  return {
    root: 0,
    family: 'triad',
    quality: 'Major',
    structure: 'rooted',
    bassInterval: 0,
    stringSet: TRIAD_STRING_SETS[0],
    shape: CAGED_ANCHORS[0],
    ...overrides,
  };
}

test('triad construction includes one of every chord interval with the requested bass', () => {
  const item = challenge({ stringSet: TRIAD_STRING_SETS[1] });
  const voicings = generateLegalConstructionVoicings(item);
  assert.ok(voicings.length > 0);
  for (const voicing of voicings) {
    assert.deepEqual([...new Set(voicing.map(cell => cell.interval))].sort((a, b) => a - b), [0, 4, 7]);
    assert.equal(voicing.length, 3);
    assert.deepEqual(voicing.map(cell => cell.stringIndex), item.stringSet.stringIndices);
  }
});

test('rootless shells require only the third and seventh', () => {
  const item = challenge({
    family: 'shell',
    quality: 'Dominant7',
    structure: 'rootless',
    bassInterval: 4,
    stringSet: ROOTLESS_STRING_SETS[0],
  });
  assert.deepEqual(constructionIntervals(item), [4, 10]);
  const voicings = generateLegalConstructionVoicings(item);
  assert.ok(voicings.length > 0);
  for (const voicing of voicings) {
    assert.deepEqual([...new Set(voicing.map(cell => cell.interval))].sort((a, b) => a - b), [4, 10]);
    const bassCell = voicing.reduce((lowest, cell) =>
      GUITAR_TUNING[cell.stringIndex] + cell.fret < GUITAR_TUNING[lowest.stringIndex] + lowest.fret
        ? cell : lowest
    );
    assert.equal(bassCell.interval, 4);
  }
});

test('all generated challenges contain only requested strings and distinct chord tones', () => {
  const qualities = ['Major', 'Minor', 'Diminished', 'Augmented'] as const;
  for (let root = 0; root < 12; root++) {
    for (const quality of qualities) {
      const intervals = quality === 'Major' || quality === 'Augmented' ? [0, 4, quality === 'Major' ? 7 : 8]
        : [0, 3, quality === 'Minor' ? 7 : 6];
      for (const shape of CAGED_ANCHORS) {
        for (const stringSet of TRIAD_STRING_SETS) {
          for (const bassInterval of intervals) {
            const item = challenge({ root, quality, shape, stringSet, bassInterval });
            for (const voicing of generateLegalConstructionVoicings(item)) {
              assert.deepEqual(voicing.map(cell => cell.stringIndex), stringSet.stringIndices);
              assert.equal(new Set(voicing.map(cell => cell.interval)).size, 3);
              assert.ok(voicing.every(cell => intervals.includes(cell.interval)));
            }
          }
        }
      }
    }
  }
});
