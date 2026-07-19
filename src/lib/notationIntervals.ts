export type NotationClef = 'treble' | 'bass';
export type NotationIntervalLevel = 'generic' | 'quality';
export type IntervalQuality = 'Diminished' | 'Minor' | 'Major' | 'Perfect' | 'Augmented';

export interface NotationIntervalCardData {
  clef: NotationClef;
  level: NotationIntervalLevel;
  generic: number;
  quality: IntervalQuality;
  semitones: number;
}

export const GENERIC_INTERVAL_LABELS: Record<number, string> = {
  2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th', 7: '7th', 8: 'Octave',
};

export const NOTATION_INTERVAL_DEFINITIONS = [
  { generic: 2, quality: 'Diminished' as const, semitones: 0 },
  { generic: 2, quality: 'Minor' as const, semitones: 1 },
  { generic: 2, quality: 'Major' as const, semitones: 2 },
  { generic: 2, quality: 'Augmented' as const, semitones: 3 },
  { generic: 3, quality: 'Diminished' as const, semitones: 2 },
  { generic: 3, quality: 'Minor' as const, semitones: 3 },
  { generic: 3, quality: 'Major' as const, semitones: 4 },
  { generic: 3, quality: 'Augmented' as const, semitones: 5 },
  { generic: 4, quality: 'Diminished' as const, semitones: 4 },
  { generic: 4, quality: 'Perfect' as const, semitones: 5 },
  { generic: 4, quality: 'Augmented' as const, semitones: 6 },
  { generic: 5, quality: 'Diminished' as const, semitones: 6 },
  { generic: 5, quality: 'Perfect' as const, semitones: 7 },
  { generic: 5, quality: 'Augmented' as const, semitones: 8 },
  { generic: 6, quality: 'Diminished' as const, semitones: 7 },
  { generic: 6, quality: 'Minor' as const, semitones: 8 },
  { generic: 6, quality: 'Major' as const, semitones: 9 },
  { generic: 6, quality: 'Augmented' as const, semitones: 10 },
  { generic: 7, quality: 'Diminished' as const, semitones: 9 },
  { generic: 7, quality: 'Minor' as const, semitones: 10 },
  { generic: 7, quality: 'Major' as const, semitones: 11 },
  { generic: 7, quality: 'Augmented' as const, semitones: 12 },
  { generic: 8, quality: 'Diminished' as const, semitones: 11 },
  { generic: 8, quality: 'Perfect' as const, semitones: 12 },
  { generic: 8, quality: 'Augmented' as const, semitones: 13 },
];

const NATURAL_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export function naturalMidi(absoluteDiatonic: number): number {
  const octave = Math.floor(absoluteDiatonic / 7);
  const letter = ((absoluteDiatonic % 7) + 7) % 7;
  return 12 * (octave + 1) + NATURAL_SEMITONES[letter];
}

export function spelledNote(absoluteDiatonic: number, accidental: number): string {
  const octave = Math.floor(absoluteDiatonic / 7);
  const letter = ((absoluteDiatonic % 7) + 7) % 7;
  const accidentalLabel = accidental === 1 ? '♯' : accidental === -1 ? '♭' : '';
  return `${LETTERS[letter]}${accidentalLabel}${octave}`;
}

export function intervalAnswer(card: NotationIntervalCardData): string {
  if (card.level === 'generic') return `Generic ${GENERIC_INTERVAL_LABELS[card.generic]}`;
  return `${card.quality} ${GENERIC_INTERVAL_LABELS[card.generic]}`;
}

export function targetAccidental(
  lowerDiatonic: number,
  generic: number,
  semitones: number,
): number {
  const targetDiatonic = lowerDiatonic + generic - 1;
  return naturalMidi(lowerDiatonic) + semitones - naturalMidi(targetDiatonic);
}

export function notationIntervalKey(card: NotationIntervalCardData): string {
  return card.level === 'generic'
    ? `notation-interval:${card.clef}:generic:${card.generic}`
    : `notation-interval:${card.clef}:quality:${card.generic}:${card.quality}:${card.semitones}`;
}
