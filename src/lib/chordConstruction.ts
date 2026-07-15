import { CHORDS, GUITAR_TUNING } from './musicTheory';
import { CagedAnchor, cellKey, getCagedFretRange } from './scalePositions';

export type VoicingFamily = 'triad' | 'shell';
export type TriadQuality = 'Major' | 'Minor' | 'Diminished' | 'Augmented';
export type ShellQuality = 'Major7' | 'Minor7' | 'Dominant7';
export type ShellStructure = 'rooted' | 'rootless';

export interface StringSet {
  label: string;
  stringIndices: number[];
}

export interface ChordConstructionChallenge {
  root: number;
  family: VoicingFamily;
  quality: TriadQuality | ShellQuality;
  structure: ShellStructure;
  bassInterval: number;
  stringSet: StringSet;
  shape: CagedAnchor;
}

export interface ConstructionCell {
  stringIndex: number;
  fret: number;
  pitchClass: number;
  interval: number;
}

export const TRIAD_STRING_SETS: StringSet[] = [
  { label: '6–5–4', stringIndices: [5, 4, 3] },
  { label: '5–4–3', stringIndices: [4, 3, 2] },
  { label: '4–3–2', stringIndices: [3, 2, 1] },
  { label: '3–2–1', stringIndices: [2, 1, 0] },
];

export const SHELL_STRING_SETS: StringSet[] = TRIAD_STRING_SETS;
export const ROOTLESS_STRING_SETS: StringSet[] = [
  { label: '6–5', stringIndices: [5, 4] },
  { label: '5–4', stringIndices: [4, 3] },
  { label: '4–3', stringIndices: [3, 2] },
  { label: '3–2', stringIndices: [2, 1] },
  { label: '2–1', stringIndices: [1, 0] },
];

export function constructionIntervals(challenge: ChordConstructionChallenge): number[] {
  const intervals = CHORDS[challenge.quality].intervals;
  if (challenge.family === 'triad') return intervals;
  return challenge.structure === 'rooted'
    ? [intervals[0], intervals[1], intervals[3]]
    : [intervals[1], intervals[3]];
}

export function generateLegalConstructionVoicings(
  challenge: ChordConstructionChallenge,
): ConstructionCell[][] {
  const intervals = constructionIntervals(challenge);
  if (challenge.stringSet.stringIndices.length !== intervals.length) return [];

  const range = getCagedFretRange(challenge.root, challenge.shape);
  const choices = challenge.stringSet.stringIndices.map(stringIndex => {
    const cells: ConstructionCell[] = [];
    for (let fret = range.startFret; fret <= range.endFret; fret++) {
      const pitchClass = (GUITAR_TUNING[stringIndex] + fret) % 12;
      const interval = (pitchClass - challenge.root + 12) % 12;
      if (intervals.includes(interval)) {
        cells.push({ stringIndex, fret, pitchClass, interval });
      }
    }
    return cells;
  });

  if (choices.some(option => option.length === 0)) return [];
  const results: ConstructionCell[][] = [];

  const search = (index: number, current: ConstructionCell[]) => {
    if (index < choices.length) {
      for (const cell of choices[index]) search(index + 1, [...current, cell]);
      return;
    }

    const usedIntervals = new Set(current.map(cell => cell.interval));
    if (usedIntervals.size !== intervals.length || intervals.some(interval => !usedIntervals.has(interval))) return;

    const bass = current.reduce((lowest, cell) => {
      const midi = GUITAR_TUNING[cell.stringIndex] + cell.fret;
      return midi < lowest.midi ? { midi, interval: cell.interval } : lowest;
    }, { midi: Number.POSITIVE_INFINITY, interval: -1 });
    if (bass.interval !== challenge.bassInterval) return;

    const frets = current.map(cell => cell.fret);
    if (Math.max(...frets) - Math.min(...frets) > 4) return;
    results.push(current);
  };

  search(0, []);
  return results;
}

export function voicingContainsKeys(voicing: ConstructionCell[], keys: Set<string>): boolean {
  const voicingKeys = new Set(voicing.map(cell => cellKey(cell.stringIndex, cell.fret)));
  return [...keys].every(key => voicingKeys.has(key));
}

export function constructionKey(challenge: ChordConstructionChallenge): string {
  return [
    'chord-construction', challenge.root, challenge.family, challenge.quality,
    challenge.structure, challenge.bassInterval, challenge.stringSet.label, challenge.shape.name,
  ].join(':');
}
