import assert from 'node:assert/strict';
import test from 'node:test';
import { spellTransposedNote, transposePitchClass } from './noteTransposition';

test('note transposition finds ascending and descending pitch classes', () => {
  assert.equal(transposePitchClass(4, 4, 'up'), 8);
  assert.equal(transposePitchClass(4, 4, 'down'), 0);
  assert.equal(transposePitchClass(0, 1, 'down'), 11);
});

test('interval spelling preserves the required target letter', () => {
  assert.equal(spellTransposedNote(4, 4, 'up'), 'G♯');
  assert.equal(spellTransposedNote(1, 4, 'up'), 'E♯');
  assert.equal(spellTransposedNote(0, 4, 'down'), 'A♭');
  assert.equal(spellTransposedNote(10, 4, 'up'), 'C♯♯');
});

test('tritones are spelled as augmented fourths', () => {
  assert.equal(spellTransposedNote(0, 6, 'up'), 'F♯');
  assert.equal(spellTransposedNote(0, 6, 'down'), 'G♭');
});

test('every generated spelling resolves to its transposed pitch class', () => {
  const naturalPitchClasses: Record<string, number> = {
    C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
  };
  for (let root = 0; root < 12; root++) {
    for (let semitones = 1; semitones <= 12; semitones++) {
      for (const direction of ['up', 'down'] as const) {
        const spelling = spellTransposedNote(root, semitones, direction);
        const accidentalOffset = [...spelling.slice(1)].reduce(
          (total, accidental) => total + (accidental === '♯' ? 1 : -1),
          0,
        );
        const resolvedPitchClass = (naturalPitchClasses[spelling[0]] + accidentalOffset + 12) % 12;
        assert.equal(
          resolvedPitchClass,
          transposePitchClass(root, semitones, direction),
          `${root}, ${semitones}, ${direction}: ${spelling}`,
        );
      }
    }
  }
});
