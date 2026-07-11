import { GUITAR_TUNING } from './musicTheory';

export interface CagedAnchor {
  name: 'C-Shape' | 'A-Shape' | 'G-Shape' | 'E-Shape' | 'D-Shape';
  rootString: number;
  anchorPitchClass: number;
  startOffset: number;
  endOffset: number;
}

// Use the shape letter's pitch class at shift=0 so C- and G-shapes transpose correctly.
export const CAGED_ANCHORS: CagedAnchor[] = [
  { name: 'C-Shape', rootString: 4, anchorPitchClass: 0, startOffset: 2, endOffset: 2 },
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
  const windowStart = Math.max(0, rootFret - shape.startOffset);
  const windowEnd = rootFret + shape.endOffset;
  const cells: ScaleBoxCell[] = [];

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
