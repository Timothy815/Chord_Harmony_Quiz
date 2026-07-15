import { GUITAR_TUNING } from './musicTheory';
import { CagedAnchor, generateScaleBox, ScaleBoxCell } from './scalePositions';

function midiForCell(cell: ScaleBoxCell): number {
  return GUITAR_TUNING[cell.stringIndex] + cell.fret;
}

function pathCost(path: ScaleBoxCell[]): number {
  let cost = 0;
  for (let index = 1; index < path.length; index++) {
    cost += Math.abs(path[index].fret - path[index - 1].fret);
    cost += Math.abs(path[index].stringIndex - path[index - 1].stringIndex) * 0.75;
  }
  const frets = path.map(cell => cell.fret);
  return cost + (Math.max(...frets) - Math.min(...frets)) * 2;
}

export function generateRootToRootScaleRun(
  rootPitchClass: number,
  scaleSteps: number[],
  shape: CagedAnchor,
): ScaleBoxCell[] {
  const pitchClasses = scaleSteps.map(step => (rootPitchClass + step) % 12);
  const box = generateScaleBox(rootPitchClass, pitchClasses, shape);
  const offsets = [...scaleSteps, 12];
  const rootCandidates = box.filter(cell => cell.pitchClass === rootPitchClass);
  const validPaths: ScaleBoxCell[][] = [];

  for (const rootCell of rootCandidates) {
    const rootMidi = midiForCell(rootCell);
    const candidatesByDegree = offsets.map(offset =>
      box.filter(cell => midiForCell(cell) === rootMidi + offset)
    );
    if (candidatesByDegree.some(candidates => candidates.length === 0)) continue;

    let paths = candidatesByDegree[0].map(cell => [cell]);
    for (const candidates of candidatesByDegree.slice(1)) {
      paths = paths.flatMap(path => candidates.map(cell => [...path, cell]));
    }
    validPaths.push(...paths);
  }

  return validPaths.sort((first, second) =>
    midiForCell(first[0]) - midiForCell(second[0]) || pathCost(first) - pathCost(second)
  )[0] ?? [];
}
