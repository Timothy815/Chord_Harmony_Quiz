import { GUITAR_TUNING } from './musicTheory';

export interface CagedAnchor {
  name: 'C-Shape' | 'A-Shape' | 'G-Shape' | 'E-Shape' | 'D-Shape';
  startOffset: number;
}

// Five-fret CAGED regions measured from the requested root on the low E string.
// These match the Scale Positions implementation in Guitar_Master.
export const CAGED_ANCHORS: CagedAnchor[] = [
  { name: 'C-Shape', startOffset: 4 },
  { name: 'A-Shape', startOffset: 7 },
  { name: 'G-Shape', startOffset: 9 },
  { name: 'E-Shape', startOffset: -1 },
  { name: 'D-Shape', startOffset: 2 },
];

const LOW_E_PITCH_CLASS = GUITAR_TUNING[5] % 12;
const CAGED_FRET_SPAN = 4;

export interface ScaleBoxCell {
  stringIndex: number;
  fret: number;
  pitchClass: number;
}

export function cellKey(stringIndex: number, fret: number): string {
  return `${stringIndex}:${fret}`;
}

export function getCagedFretRange(
  targetRootIdx: number,
  shape: CagedAnchor,
): { startFret: number; endFret: number } {
  const lowERootFret = (targetRootIdx - LOW_E_PITCH_CLASS + 12) % 12;
  let startFret = lowERootFret + shape.startOffset;

  // Keep open-position shapes at the nut and wrap upper positions down one octave.
  if (startFret < 0) startFret = 0;
  if (startFret > 11) startFret %= 12;

  return { startFret, endFret: startFret + CAGED_FRET_SPAN };
}

export function generateScaleBox(
  targetRootIdx: number,
  tones: number[],
  shape: CagedAnchor,
): ScaleBoxCell[] {
  const { startFret, endFret } = getCagedFretRange(targetRootIdx, shape);
  const cells: ScaleBoxCell[] = [];

  for (let stringIndex = 0; stringIndex < GUITAR_TUNING.length; stringIndex++) {
    const baseMidi = GUITAR_TUNING[stringIndex];
    for (let fret = startFret; fret <= endFret; fret++) {
      const pitchClass = (baseMidi + fret) % 12;
      if (tones.includes(pitchClass)) {
        cells.push({ stringIndex, fret, pitchClass });
      }
    }
  }

  return cells;
}
