import { NOTES } from './musicTheory';

export type TranspositionDirection = 'up' | 'down';

export const PITCH_CLASS_LABELS = [
  'C', 'C♯ / D♭', 'D', 'D♯ / E♭', 'E', 'F',
  'F♯ / G♭', 'G', 'G♯ / A♭', 'A', 'A♯ / B♭', 'B',
] as const;

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const NATURAL_PITCH_CLASSES: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};
const INTERVAL_DEGREES: Record<number, number> = {
  1: 2,
  2: 2,
  3: 3,
  4: 3,
  5: 4,
  6: 4, // Spell the tritone as an augmented fourth.
  7: 5,
  8: 6,
  9: 6,
  10: 7,
  11: 7,
  12: 8,
};

export function transposePitchClass(
  rootPitchClass: number,
  semitones: number,
  direction: TranspositionDirection,
): number {
  const movement = direction === 'up' ? semitones : -semitones;
  return (rootPitchClass + movement + 120) % 12;
}

export function spellTransposedNote(
  rootPitchClass: number,
  semitones: number,
  direction: TranspositionDirection,
): string {
  const rootName = NOTES[rootPitchClass];
  const rootLetterIndex = LETTERS.indexOf(rootName[0] as typeof LETTERS[number]);
  const degree = INTERVAL_DEGREES[semitones] ?? 1;
  const letterMovement = degree - 1;
  const targetLetterIndex = direction === 'up'
    ? (rootLetterIndex + letterMovement) % LETTERS.length
    : (rootLetterIndex - letterMovement + LETTERS.length * 2) % LETTERS.length;
  const targetLetter = LETTERS[targetLetterIndex];
  const targetPitchClass = transposePitchClass(rootPitchClass, semitones, direction);
  let accidentalDistance = (targetPitchClass - NATURAL_PITCH_CLASSES[targetLetter] + 12) % 12;
  if (accidentalDistance > 6) accidentalDistance -= 12;

  const accidental = accidentalDistance > 0
    ? '♯'.repeat(accidentalDistance)
    : '♭'.repeat(Math.abs(accidentalDistance));
  return `${targetLetter}${accidental}`;
}
