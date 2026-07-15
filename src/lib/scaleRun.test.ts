import assert from 'node:assert/strict';
import test from 'node:test';
import { GUITAR_TUNING, SCALES } from './musicTheory';
import { CAGED_ANCHORS, getCagedFretRange } from './scalePositions';
import { generateRootToRootScaleRun } from './scaleRun';

test('root-to-root runs contain every scale degree in ascending pitch order', () => {
  for (let root = 0; root < 12; root++) {
    for (const shape of CAGED_ANCHORS) {
      for (const scale of Object.values(SCALES)) {
        const run = generateRootToRootScaleRun(root, scale.steps, shape);
        assert.equal(run.length, scale.steps.length + 1, `${root} ${shape.name} ${scale.pattern}`);
        const midis = run.map(cell => GUITAR_TUNING[cell.stringIndex] + cell.fret);
        assert.deepEqual(
          midis.map(midi => midi - midis[0]),
          [...scale.steps, 12],
          `${root} ${shape.name} ${scale.pattern}`,
        );
        const range = getCagedFretRange(root, shape);
        assert.ok(run.every(cell => cell.fret >= range.startFret && cell.fret <= range.endFret));
      }
    }
  }
});
