export type PracticeModule =
  | 'Note Cards'
  | 'Interval Cards'
  | 'Note Numbers'
  | 'Interval Numbers'
  | 'Fretboard Trainer'
  | 'Chord Quiz';

export interface PracticeTarget {
  module: PracticeModule;
  topic: string;
}

export interface PracticeEvent {
  id: string;
  occurredAt: string;
  practiceDate: string;
  module: PracticeModule;
  topic: string;
  detail?: string;
  correct: boolean;
  score: number;
  attempts: number;
  durationMs?: number;
  assisted?: boolean;
}

export type PracticeEventInput = Omit<PracticeEvent, 'id' | 'occurredAt' | 'practiceDate'>;

export interface DailyProgress {
  date: string;
  count: number;
  score: number | null;
  durationMs: number;
}

export interface SkillSummary {
  module: PracticeModule;
  topic: string;
  attempts: number;
  score: number;
  recentScore: number;
  independentScore: number | null;
  assistedAttempts: number;
}

const STORAGE_KEY = 'harmony-hub-analytics-v1';
const MAX_EVENTS = 20_000;

function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return localDate(value);
}

export function loadPracticeEvents(): PracticeEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as PracticeEvent[] : [];
  } catch {
    return [];
  }
}

export function savePracticeEvents(events: PracticeEvent[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {}
}

export function recordPractice(input: PracticeEventInput): PracticeEvent {
  const now = new Date();
  const event: PracticeEvent = {
    ...input,
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 9)}`,
    occurredAt: now.toISOString(),
    practiceDate: localDate(now),
    score: Math.max(0, Math.min(100, Math.round(input.score))),
    attempts: Math.max(1, Math.round(input.attempts)),
    durationMs: input.durationMs === undefined ? undefined : Math.max(0, Math.round(input.durationMs)),
  };

  try {
    const events = [...loadPracticeEvents(), event].slice(-MAX_EVENTS);
    savePracticeEvents(events);
  } catch {}

  return event;
}

export function buildDailyProgress(
  events: PracticeEvent[],
  days: number,
  endDate = localDate(new Date()),
): DailyProgress[] {
  const safeDays = Math.max(1, Math.round(days));
  const startDate = shiftDate(endDate, -(safeDays - 1));
  const buckets = new Map<string, { count: number; scoreTotal: number; durationMs: number }>();

  for (const event of events) {
    if (event.practiceDate < startDate || event.practiceDate > endDate) continue;
    const bucket = buckets.get(event.practiceDate) ?? { count: 0, scoreTotal: 0, durationMs: 0 };
    bucket.count += 1;
    bucket.scoreTotal += event.score;
    bucket.durationMs += event.durationMs ?? 0;
    buckets.set(event.practiceDate, bucket);
  }

  return Array.from({ length: safeDays }, (_, index) => {
    const date = shiftDate(startDate, index);
    const bucket = buckets.get(date);
    return {
      date,
      count: bucket?.count ?? 0,
      score: bucket ? Math.round(bucket.scoreTotal / bucket.count) : null,
      durationMs: bucket?.durationMs ?? 0,
    };
  });
}

export function summarizeSkills(events: PracticeEvent[]): SkillSummary[] {
  const groups = new Map<string, PracticeEvent[]>();
  for (const event of events) {
    const key = `${event.module}\u0000${event.topic}`;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }

  return Array.from(groups.values()).map(group => {
    const recent = group.slice(-5);
    const independent = group.filter(event => !event.assisted).slice(-5);
    return {
      module: group[0].module,
      topic: group[0].topic,
      attempts: group.length,
      score: Math.round(group.reduce((total, event) => total + event.score, 0) / group.length),
      recentScore: Math.round(recent.reduce((total, event) => total + event.score, 0) / recent.length),
      independentScore: independent.length
        ? Math.round(independent.reduce((total, event) => total + event.score, 0) / independent.length)
        : null,
      assistedAttempts: group.filter(event => event.assisted).length,
    };
  });
}

export function currentPracticeStreak(events: PracticeEvent[], today = localDate(new Date())): number {
  const practiced = new Set(events.map(event => event.practiceDate));
  let cursor = practiced.has(today) ? today : shiftDate(today, -1);
  let streak = 0;
  while (practiced.has(cursor)) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}
