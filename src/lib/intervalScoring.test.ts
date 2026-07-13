import assert from 'node:assert/strict';
import test from 'node:test';
import { scoreIntervalAttempt } from './intervalScoring';

test('interval score rewards fewer attempts', () => {
  assert.equal(scoreIntervalAttempt(0, false, false, false).score, 100);
  assert.equal(scoreIntervalAttempt(1, false, false, false).score, 50);
  assert.equal(scoreIntervalAttempt(2, false, false, false).score, 33);
  assert.equal(scoreIntervalAttempt(3, false, false, false).score, 25);
});

test('listening assistance is tracked without reducing the score', () => {
  const result = scoreIntervalAttempt(0, true, true, false);
  assert.equal(result.score, 100);
  assert.equal(result.usedSample, true);
  assert.equal(result.selfVerified, true);
});

test('showing the answer makes the result assisted with zero points', () => {
  const result = scoreIntervalAttempt(0, false, false, true);
  assert.equal(result.score, 0);
  assert.equal(result.usedShowAnswer, true);
});
