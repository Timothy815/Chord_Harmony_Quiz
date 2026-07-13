import assert from 'node:assert/strict';
import test from 'node:test';
import { crossesGBBoundary, STANDARD_TUNING_GAPS } from './guitarTuningIntervals';

test('standard tuning uses perfect fourths except between G and B', () => {
  assert.deepEqual(STANDARD_TUNING_GAPS.map(gap => gap.semitones), [5, 5, 5, 4, 5]);
  assert.deepEqual(
    STANDARD_TUNING_GAPS.filter(gap => gap.exception).map(gap => `${gap.from}-${gap.to}`),
    ['G-B']
  );
});

test('G-B boundary detection covers direct and multi-string movements', () => {
  assert.equal(crossesGBBoundary(2, 1), true);
  assert.equal(crossesGBBoundary(3, 0), true);
  assert.equal(crossesGBBoundary(0, 5), true);
  assert.equal(crossesGBBoundary(5, 2), false);
  assert.equal(crossesGBBoundary(1, 0), false);
  assert.equal(crossesGBBoundary(2, 2), false);
});
