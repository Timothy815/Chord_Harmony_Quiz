import assert from 'node:assert/strict';
import test from 'node:test';
import { chordFamily, formulaDistance, formulasForCategory, THEORY_FORMULAS } from './theoryFormulas';

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

test('jazz and gypsy-jazz chords have formulas', () => {
  const chord = (id: string) => THEORY_FORMULAS.find(item => item.category === 'chord' && item.id === id);
  assert.equal(chord('Minor6')?.formula, '0–3–7–9');
  assert.equal(chord('Minor69')?.name, 'Minor 6/9');
  assert.equal(chord('Dominant7b9')?.formula, '0–4–7–10–1');
  assert.equal(chord('Dominant9')?.name, 'Dominant 9');
});

test('every chord formula has a family, grouping them for filter UIs', () => {
  const chordIds = formulasForCategory('chord').map(item => item.id);
  for (const id of chordIds) {
    assert.ok(chordFamily(id), `${id} has no chord family`);
  }
  assert.equal(chordFamily('Minor6'), 'Sixth');
  assert.equal(chordFamily('Minor69'), 'Sixth');
  assert.equal(chordFamily('Dominant7b9'), 'Altered');
  assert.equal(chordFamily('Dominant9'), 'Ninth');
});

test('formulaDistance ranks near-miss chords ahead of unrelated ones', () => {
  const chord = (id: string) => THEORY_FORMULAS.find(item => item.category === 'chord' && item.id === id)!;
  const dominant9 = chord('Dominant9');
  // Dominant 13 shares every tone of Dominant 9 plus one more — a classic near-miss.
  const distanceToDominant13 = formulaDistance(dominant9, chord('Dominant13'));
  const distanceToDiminished = formulaDistance(dominant9, chord('Diminished'));
  assert.ok(distanceToDominant13 < distanceToDiminished);
  assert.equal(formulaDistance(dominant9, dominant9), 0);
});
