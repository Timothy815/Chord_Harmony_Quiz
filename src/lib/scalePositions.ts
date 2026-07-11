import { GUITAR_TUNING } from './musicTheory';

export interface CagedAnchor {
  name: 'C-Shape' | 'A-Shape' | 'G-Shape' | 'E-Shape' | 'D-Shape';
  rootString: number;
  anchorPitchClass: number;
  startOffset: number;
  endOffset: number;
  stringWindows?: Array<{ start: number; end: number } | null>;
}

// Use the shape letter's pitch class at shift=0 so C- and G-shapes transpose correctly.
export const CAGED_ANCHORS: CagedAnchor[] = [
  {
    name: 'C-Shape',
    rootString: 4,
    anchorPitchClass: 0,
    startOffset: 2,
    endOffset: 2,
    // Nut-position C-shapes need per-string bounds so the position keeps its real contour
    // instead of collapsing into a tiny 0-2 rectangle when shifted against fret 0.
    stringWindows: [
      { start: 1, end: 1 }, // high e
      { start: 1, end: 4 }, // B
      { start: 0, end: 3 }, // G
      { start: 1, end: 3 }, // D
      { start: 1, end: 3 }, // A
      { start: 1, end: 1 }, // low E
    ],
  },
  { name: 'A-Shape', rootString: 4, anchorPitchClass: 9, startOffset: 2, endOffset: 2 },
  { name: 'G-Shape', rootString: 5, anchorPitchClass: 7, startOffset: 2, endOffset: 2 },
  { name: 'E-Shape', rootString: 5, anchorPitchClass: 4, startOffset: 2, endOffset: 2 },
  { name: 'D-Shape', rootString: 3, anchorPitchClass: 2, startOffset: 2, endOffset: 2 },
];

export interface ScaleBoxCell {
  stringIndex: number;
  fret: number;
  pitchClass: number;
}

export function cellKey(stringIndex: number, fret: number): string {
  return `${stringIndex}:${fret}`;
}

export function generateScaleBox(
  targetRootIdx: number, tones: number[], shape: CagedAnchor,
): ScaleBoxCell[] {
  const rootFret = (targetRootIdx - shape.anchorPitchClass + 12) % 12;
  const cells: ScaleBoxCell[] = [];

  if (shape.stringWindows) {
    for (let stringIndex = 0; stringIndex < 6; stringIndex++) {
      const window = shape.stringWindows[stringIndex];
      if (!window) continue;
      const baseMidi = GUITAR_TUNING[stringIndex];
      const startFret = Math.max(0, rootFret + window.start);
      const endFret = rootFret + window.end;

      for (let fret = startFret; fret <= endFret; fret++) {
        const pitchClass = (baseMidi + fret) % 12;
        if (tones.includes(pitchClass)) {
          cells.push({ stringIndex, fret, pitchClass });
        }
      }
    }

    return cells;
  }

  let windowStart = rootFret - shape.startOffset;
  let windowEnd = rootFret + shape.endOffset;
  if (windowStart < 0) {
    windowEnd += -windowStart;
    windowStart = 0;
  }

  for (let stringIndex = 0; stringIndex < 6; stringIndex++) {
    const baseMidi = GUITAR_TUNING[stringIndex];
    for (let fret = windowStart; fret <= windowEnd; fret++) {
      const pitchClass = (baseMidi + fret) % 12;
      if (tones.includes(pitchClass)) {
        cells.push({ stringIndex, fret, pitchClass });
      }
    }
  }

  return cells;
}
