import assert from 'node:assert/strict';
import test from 'node:test';
import { CHORDS, GUITAR_TUNING, NOTES } from './musicTheory';
import {
  CHORD_SHAPES,
  findBestVoicingInWindow,
  getCagedVoicing,
} from './guitarVoicings';
import { CAGED_ANCHORS, getCagedFretRange } from './scalePositions';

test('C major CAGED shapes use exact playable voicings', () => {
  const expected = {
    'C-Shape': [0, 1, 0, 2, 3, 'x'],
    'A-Shape': [3, 5, 5, 5, 3, 'x'],
    'G-Shape': [8, 5, 5, 5, 7, 8],
    'E-Shape': [8, 8, 9, 10, 10, 8],
    'D-Shape': [12, 13, 12, 10, 'x', 'x'],
  };

  for (const [shape, frets] of Object.entries(expected)) {
    assert.deepEqual(getCagedVoicing('C', 'Major', shape), frets);
  }
});

test('chord types without named shapes get exact voicings in every CAGED region', () => {
  for (const [chordType, definition] of Object.entries(CHORDS)) {
    for (let root = 0; root < NOTES.length; root++) {
      const chordTones = definition.intervals.map((interval) => (root + interval) % 12);
      for (const shape of CAGED_ANCHORS) {
        if (getCagedVoicing(NOTES[root], chordType, shape.name)) continue;
        const range = getCagedFretRange(root, shape);
        const voicing = findBestVoicingInWindow(
          chordTones,
          root,
          range.startFret,
          range.endFret,
        );
        assert.ok(voicing, `${NOTES[root]} ${chordType} ${shape.name} has no voicing`);

        const playedTones = new Set<number>();
        voicing.forEach((fret, stringIndex) => {
          if (fret === 'x') return;
          assert.ok(fret >= range.startFret && fret <= range.endFret,
            `${NOTES[root]} ${chordType} ${shape.name} escaped its fret region`);
          const pitchClass = (GUITAR_TUNING[stringIndex] + fret) % 12;
          assert.ok(chordTones.includes(pitchClass),
            `${NOTES[root]} ${chordType} ${shape.name} contains a non-chord tone`);
          playedTones.add(pitchClass);
        });

        assert.deepEqual([...playedTones].sort(), [...chordTones].sort(),
          `${NOTES[root]} ${chordType} ${shape.name} omits a required chord tone`);
      }
    }
  }
});

test('every defined CAGED voicing transposes to chord tones in all keys', () => {
  for (const [chordType, shapes] of Object.entries(CHORD_SHAPES)) {
    const definition = CHORDS[chordType as keyof typeof CHORDS];
    if (!definition) continue;

    for (let root = 0; root < NOTES.length; root++) {
      const chordTones = definition.intervals.map((interval) => (root + interval) % 12);
      for (const shape of shapes) {
        const voicing = getCagedVoicing(NOTES[root], chordType, shape.name);
        assert.ok(voicing, `${NOTES[root]} ${chordType} ${shape.name} is missing`);
        const playedTones = new Set<number>();

        voicing.forEach((fret, stringIndex) => {
          if (fret === 'x') return;
          const pitchClass = (GUITAR_TUNING[stringIndex] + fret) % 12;
          assert.ok(chordTones.includes(pitchClass),
            `${NOTES[root]} ${chordType} ${shape.name} contains a non-chord tone`);
          playedTones.add(pitchClass);
        });

        assert.ok(playedTones.has(root),
          `${NOTES[root]} ${chordType} ${shape.name} omits the root`);
      }
    }
  }
});
