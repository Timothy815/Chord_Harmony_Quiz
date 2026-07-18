import assert from 'node:assert/strict';
import test from 'node:test';
import { shuffle } from './shuffle';

test('Fisher-Yates shuffle does not mutate its input', () => {
  const source = [1, 2, 3, 4];
  const result = shuffle(source, () => 0);
  assert.deepEqual(source, [1, 2, 3, 4]);
  assert.deepEqual(result, [2, 3, 4, 1]);
});

test('shuffle retains every choice exactly once', () => {
  const source = Array.from({ length: 12 }, (_, index) => index);
  const result = shuffle(source);
  assert.deepEqual([...result].sort((a, b) => a - b), source);
});
