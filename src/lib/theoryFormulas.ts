import { CHORDS, MODES, SCALES } from './musicTheory';

export type TheoryFormulaCategory = 'scale' | 'mode' | 'chord';

export interface TheoryFormula {
  id: string;
  category: TheoryFormulaCategory;
  name: string;
  formula: string;
  description: string;
}

function spacedName(name: string): string {
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
  })),
  ...Object.entries(MODES).map(([id, mode]) => ({
    id,
    category: 'mode' as const,
    name: id,
    formula: stepPattern(mode.intervals),
    description: mode.hint,
  })),
  ...Object.entries(CHORDS).map(([id, chord]) => ({
    id,
    category: 'chord' as const,
    name: spacedName(id),
    formula: chord.intervals.join('–'),
    description: 'Semitone distances from the root',
  })),
];

export function formulasForCategory(category: TheoryFormulaCategory): TheoryFormula[] {
  return THEORY_FORMULAS.filter(formula => formula.category === category);
}
