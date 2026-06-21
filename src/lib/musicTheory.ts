export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const SCALES = {
  Major: { intervals: [2, 2, 1, 2, 2, 2, 1], pattern: 'W-W-H-W-W-W-H', steps: [0, 2, 4, 5, 7, 9, 11] },
  Minor: { intervals: [2, 1, 2, 2, 1, 2, 2], pattern: 'W-H-W-W-H-W-W', steps: [0, 2, 3, 5, 7, 8, 10] },
  HarmonicMinor: { intervals: [2, 1, 2, 2, 1, 3, 1], pattern: 'W-H-W-W-H-WH-H', steps: [0, 2, 3, 5, 7, 8, 11] },
  MelodicMinor: { intervals: [2, 1, 2, 2, 2, 2, 1], pattern: 'W-H-W-W-W-W-H', steps: [0, 2, 3, 5, 7, 9, 11] },
  PentatonicMajor: { intervals: [2, 2, 3, 2, 3], pattern: 'W-W-WH-W-WH', steps: [0, 2, 4, 7, 9] },
  PentatonicMinor: { intervals: [3, 2, 2, 3, 2], pattern: 'WH-W-W-WH-W', steps: [0, 3, 5, 7, 10] },
};

export const MODES = {
  Ionian: { intervals: [0, 2, 4, 5, 7, 9, 11], hint: 'Major Scale' },
  Dorian: { intervals: [0, 2, 3, 5, 7, 9, 10], hint: 'Minor with natural 6' },
  Phrygian: { intervals: [0, 1, 3, 5, 7, 8, 10], hint: 'Minor with flat 2' },
  Lydian: { intervals: [0, 2, 4, 6, 7, 9, 11], hint: 'Major with sharp 4' },
  Mixolydian: { intervals: [0, 2, 4, 5, 7, 9, 10], hint: 'Major with flat 7' },
  Aeolian: { intervals: [0, 2, 3, 5, 7, 8, 10], hint: 'Natural Minor Scale' },
  Locrian: { intervals: [0, 1, 3, 5, 6, 8, 10], hint: 'Minor with flat 2 and flat 5' },
};

export const CHORDS = {
  Major: { intervals: [0, 4, 7], abbr: '' },
  Minor: { intervals: [0, 3, 7], abbr: 'm' },
  Diminished: { intervals: [0, 3, 6], abbr: 'dim' },
  Augmented: { intervals: [0, 4, 8], abbr: 'aug' },
  Major7: { intervals: [0, 4, 7, 11], abbr: 'maj7' },
  Minor7: { intervals: [0, 3, 7, 10], abbr: 'm7' },
  Dominant7: { intervals: [0, 4, 7, 10], abbr: '7' },
  HalfDiminished7: { intervals: [0, 3, 6, 10], abbr: 'm7b5' },
  Diminished7: { intervals: [0, 3, 6, 9], abbr: 'dim7' },
};

export function getNoteIndex(noteDef: string): number {
  switch(noteDef) {
    case 'Db': return 1;
    case 'Eb': return 3;
    case 'Gb': return 6;
    case 'Ab': return 8;
    case 'Bb': return 10;
  }
  return NOTES.findIndex((n) => n === noteDef);
}

export function buildScale(root: string, scaleDef: { steps: number[] }) {
  const rootIdx = getNoteIndex(root);
  if (rootIdx === -1) return [];
  return scaleDef.steps.map((interval) => NOTES[(rootIdx + interval) % 12]);
}

export function buildChord(root: string, chordDef: { intervals: number[] }) {
  const rootIdx = getNoteIndex(root);
  if (rootIdx === -1) return [];
  return chordDef.intervals.map((interval) => NOTES[(rootIdx + interval) % 12]);
}

export function getMidiFromNoteStrAndOctave(noteStr: string, octave: number) {
  const idx = getNoteIndex(noteStr);
  // Midi 60 is Middle C (C4)
  return 12 * (octave + 1) + idx;
}

export function midiToNoteString(midi: number): { note: string, octave: number } {
  const noteIdx = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  return { note: NOTES[noteIdx], octave };
}

// Map standard notes to their white/black keys for piano rendering
export const PIANO_KEYS = Array.from({ length: 36 }, (_, i) => {
  const midi = 48 + i; // C3 to B5 (3 octaves)
  const info = midiToNoteString(midi);
  const isBlack = info.note.includes('#');
  return { midi, note: info.note, octave: info.octave, isBlack };
});

// Settings for standard guitar tuning: E2, A2, D3, G3, B3, E4
export const GUITAR_TUNING = [
  { note: 'E', octave: 4, stringName: 'e' },
  { note: 'B', octave: 3, stringName: 'B' },
  { note: 'G', octave: 3, stringName: 'G' },
  { note: 'D', octave: 3, stringName: 'D' },
  { note: 'A', octave: 2, stringName: 'A' },
  { note: 'E', octave: 2, stringName: 'E' },
].map(s => getMidiFromNoteStrAndOctave(s.note, s.octave));
