import assert from 'node:assert/strict';
import test from 'node:test';
import { formulasForCategory, THEORY_FORMULAS } from './theoryFormulas';

test('theory formulas include scale, mode, and chord relationships', () => {
  assert.equal(THEORY_FORMULAS.find(item => item.category === 'scale' && item.id === 'Major')?.formula, 'W-W-H-W-W-W-H');
  assert.equal(THEORY_FORMULAS.find(item => item.category === 'mode' && item.id === 'Dorian')?.formula, 'W-H-W-W-W-H-W');
  assert.equal(THEORY_FORMULAS.find(item => item.category === 'chord' && item.id === 'Major7')?.formula, '0–4–7–11');
});

test('formulas are unique within each drill category', () => {
  for (const category of ['scale', 'mode', 'chord'] as const) {
    const formulas = formulasForCategory(category).map(item => item.formula);
    assert.equal(new Set(formulas).size, formulas.length, category);
  }
});
