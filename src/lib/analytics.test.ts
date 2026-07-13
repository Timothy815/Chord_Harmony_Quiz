import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDailyProgress,
  currentPracticeStreak,
  PracticeEvent,
  summarizeSkills,
} from './analytics';

function practiceEvent(date: string, topic: string, score: number): PracticeEvent {
  return {
    id: `${date}-${topic}-${score}`,
    occurredAt: `${date}T18:00:00.000Z`,
    practiceDate: date,
    module: 'Interval Cards',
    topic,
    correct: score > 0,
    score,
    attempts: 1,
    durationMs: 1_000,
  };
}

test('daily progress includes empty days and averages proficiency', () => {
  const events = [
    practiceEvent('2026-07-11', 'Major 6th', 100),
    practiceEvent('2026-07-11', 'Major 6th', 50),
    practiceEvent('2026-07-13', 'Perfect 4th', 80),
  ];
  assert.deepEqual(buildDailyProgress(events, 3, '2026-07-13'), [
    { date: '2026-07-11', count: 2, score: 75, durationMs: 2_000 },
    { date: '2026-07-12', count: 0, score: null, durationMs: 0 },
    { date: '2026-07-13', count: 1, score: 80, durationMs: 1_000 },
  ]);
});

test('skill summaries expose lifetime and recent proficiency', () => {
  const events = [100, 100, 50, 50, 50, 0].map((score, index) =>
    practiceEvent(`2026-07-${String(index + 1).padStart(2, '0')}`, 'Major 6th', score)
  );
  assert.deepEqual(summarizeSkills(events), [{
    module: 'Interval Cards',
    topic: 'Major 6th',
    attempts: 6,
    score: 58,
    recentScore: 50,
    independentScore: 50,
    assistedAttempts: 0,
  }]);
});

test('skill summaries separate assisted from independent proficiency', () => {
  const independent = practiceEvent('2026-07-11', 'Major 6th', 100);
  const assisted = { ...practiceEvent('2026-07-12', 'Major 6th', 50), assisted: true };
  const [summary] = summarizeSkills([independent, assisted]);
  assert.equal(summary.recentScore, 75);
  assert.equal(summary.independentScore, 100);
  assert.equal(summary.assistedAttempts, 1);
});

test('practice streak may continue from yesterday', () => {
  const events = [
    practiceEvent('2026-07-10', 'Major 6th', 100),
    practiceEvent('2026-07-11', 'Major 6th', 100),
    practiceEvent('2026-07-12', 'Major 6th', 100),
  ];
  assert.equal(currentPracticeStreak(events, '2026-07-13'), 3);
});
