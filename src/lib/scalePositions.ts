import { GUITAR_TUNING } from './musicTheory';

export interface CagedAnchor {
  name: 'C-Shape' | 'A-Shape' | 'G-Shape' | 'E-Shape' | 'D-Shape';
  rootString: number;
  anchorPitchClass: number;
  startOffset: number;
  endOffset: number;
  stringWindows?: Array<{ start: number; end: number } | null>;
}

// Anchors use the open-string pitch class of the string that carries the shape's root.
export const CAGED_ANCHORS: CagedAnchor[] = [
  {
    name: 'C-Shape',
    rootString: 4,
    anchorPitchClass: 9,
    startOffset: 2,
    endOffset: 2,
    // Relative to the A-string root. For C, this produces the familiar open-position
    // contour: E 1/3, B 1/4, G 0/3, D 1/3, A 1/3, E 1/3.
    stringWindows: [
      { start: -2, end: 0 }, // high e
      { start: -2, end: 1 }, // B
      { start: -3, end: 0 }, // G
      { start: -2, end: 0 }, // D
      { start: -2, end: 0 }, // A
      { start: -2, end: 0 }, // low E
    ],
  },
  { name: 'A-Shape', rootString: 4, anchorPitchClass: 9, startOffset: 2, endOffset: 2 },
  { name: 'G-Shape', rootString: 5, anchorPitchClass: 4, startOffset: 2, endOffset: 2 },
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
