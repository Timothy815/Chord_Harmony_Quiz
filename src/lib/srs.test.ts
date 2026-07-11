import assert from 'node:assert/strict';
import test from 'node:test';
import { CardRecord, reviewTrainerCard } from './srs';

const existing: CardRecord = {
  interval: 1,
  easeFactor: 2.5,
  repetitions: 1,
  dueDate: '2026-07-11',
  totalSeen: 1,
  totalCorrect: 1,
  bestTimeMs: 10_000,
};

test('a missed trainer attempt keeps the previous clean best', () => {
  const result = reviewTrainerCard(existing, false, 8_000);

  assert.equal(result.record.bestTimeMs, 10_000);
  assert.equal(result.improved, false);
});

test('a faster clean trainer attempt updates the best', () => {
  const result = reviewTrainerCard(existing, true, 8_000);

  assert.equal(result.previousBestMs, 10_000);
  assert.equal(result.record.bestTimeMs, 8_000);
  assert.equal(result.improved, true);
});

test('a slower clean trainer attempt reports the existing best', () => {
  const result = reviewTrainerCard(existing, true, 12_000);

  assert.equal(result.previousBestMs, 10_000);
  assert.equal(result.record.bestTimeMs, 10_000);
  assert.equal(result.improved, false);
});
