import { CHORDS, MODES, SCALES } from './musicTheory';

export type TheoryFormulaCategory = 'scale' | 'mode' | 'chord';

export interface TheoryFormula {
  id: string;
  category: TheoryFormulaCategory;
  name: string;
  formula: string;
  description: string;
  /** Pitch classes (semitones from the root, 0-11) that make up this scale/mode/chord. */
  pitchClasses: number[];
}

export type ChordFamily = 'Triad' | 'Sixth' | 'Seventh' | 'Ninth' | 'Altered';

export const CHORD_FAMILY_ORDER: ChordFamily[] = ['Triad', 'Sixth', 'Seventh', 'Ninth', 'Altered'];

const CHORD_FAMILIES: Record<string, ChordFamily> = {
  Major: 'Triad',
  Minor: 'Triad',
  Diminished: 'Triad',
  Augmented: 'Triad',
  Major6: 'Sixth',
  Minor6: 'Sixth',
  Major69: 'Sixth',
  Minor69: 'Sixth',
  Major7: 'Seventh',
  Minor7: 'Seventh',
  Dominant7: 'Seventh',
  HalfDiminished7: 'Seventh',
  Diminished7: 'Seventh',
  MinorMajor7: 'Seventh',
  Dominant9: 'Ninth',
  Major9: 'Ninth',
  Minor9: 'Ninth',
  Dominant7b9: 'Altered',
  Dominant7s9: 'Altered',
  Dominant7b5: 'Altered',
  Augmented7: 'Altered',
  Dominant13: 'Altered',
  Dominant7sus4: 'Altered',
};

/** Which family a chord id belongs to, for grouping filter lists. Undefined for non-chord ids. */
export function chordFamily(chordId: string): ChordFamily | undefined {
  return CHORD_FAMILIES[chordId];
}

/** How confusable two formulas are: the size of the symmetric difference between their pitch-class sets. */
export function formulaDistance(a: TheoryFormula, b: TheoryFormula): number {
  const setA = new Set(a.pitchClasses);
  const setB = new Set(b.pitchClasses);
  let diff = 0;
  for (const pc of setA) if (!setB.has(pc)) diff++;
  for (const pc of setB) if (!setA.has(pc)) diff++;
  return diff;
}

const DISPLAY_NAMES: Record<string, string> = {
  MinorMajor7: 'Minor/Major 7',
  Major69: 'Major 6/9',
  Minor69: 'Minor 6/9',
  Dominant7s9: 'Dominant 7♯9',
  Dominant7b9: 'Dominant 7♭9',
  Dominant7b5: 'Dominant 7♭5',
  Dominant7sus4: 'Dominant 7 sus4',
};

function spacedName(name: string): string {
  if (DISPLAY_NAMES[name]) return DISPLAY_NAMES[name];
  return name.replace(/([a-z])([A-Z0-9])/g, '$1 $2');
}

function stepPattern(steps: number[]): string {
  const complete = [...steps, 12];
  return complete.slice(1).map((step, index) => {
    const distance = step - complete[index];
    return distance === 1 ? 'H' : distance === 2 ? 'W' : `${distance}st`;
  }).join('-');
}

export const THEORY_FORMULAS: TheoryFormula[] = [
  ...Object.entries(SCALES).map(([id, scale]) => ({
    id,
    category: 'scale' as const,
    name: spacedName(id),
    formula: scale.pattern,
    description: `${scale.steps.join('–')} semitones from the root`,
    pitchClasses: scale.steps,
  })),
  ...Object.entries(MODES).map(([id, mode]) => ({
    id,
    category: 'mode' as const,
    name: id,
    formula: stepPattern(mode.intervals),
    description: mode.hint,
    pitchClasses: mode.intervals,
  })),
  ...Object.entries(CHORDS).map(([id, chord]) => ({
    id,
    category: 'chord' as const,
    name: spacedName(id),
    formula: chord.intervals.join('–'),
    description: 'Semitone distances from the root',
    pitchClasses: chord.intervals,
  })),
];

export function formulasForCategory(category: TheoryFormulaCategory): TheoryFormula[] {
  return THEORY_FORMULAS.filter(formula => formula.category === category);
}
