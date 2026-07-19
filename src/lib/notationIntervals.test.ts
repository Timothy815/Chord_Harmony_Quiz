import assert from 'node:assert/strict';
import test from 'node:test';
import {
  intervalAnswer,
  naturalMidi,
  NOTATION_INTERVAL_DEFINITIONS,
  targetAccidental,
} from './notationIntervals';

test('diatonic staff positions map to natural MIDI notes', () => {
  assert.equal(naturalMidi(28), 60); // C4
  assert.equal(naturalMidi(30), 64); // E4
  assert.equal(naturalMidi(35), 72); // C5
});

test('quality spelling calculates the required accidental', () => {
  assert.equal(targetAccidental(28, 3, 3), -1); // C to E-flat
  assert.equal(targetAccidental(30, 3, 4), 1); // E to G-sharp
  assert.equal(targetAccidental(31, 4, 5), -1); // F to B-flat
});

test('every core quality definition has a readable answer', () => {
  for (const definition of NOTATION_INTERVAL_DEFINITIONS) {
    const answer = intervalAnswer({ clef: 'treble', level: 'quality', ...definition });
    assert.ok(answer.length > 2);
  }
});
