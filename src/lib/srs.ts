export interface CardRecord {
  interval: number;      // days until next review
  easeFactor: number;    // SM-2 ease factor
  repetitions: number;   // consecutive correct answers
  dueDate: string;       // 'YYYY-MM-DD'
  totalSeen: number;
  totalCorrect: number;
  bestTimeMs?: number;   // fastest clean trainer completion
}

export type SRSStore = Record<string, CardRecord>;

const STORAGE_KEY = 'harmony-hub-srs-v1';
const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  // Use noon to avoid DST boundary issues
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function loadStore(): SRSStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SRSStore) : {};
  } catch {
    return {};
  }
}

export function saveStore(store: SRSStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

export function noteKey(stringIndex: number, fret: number): string {
  return `note:${stringIndex}:${fret}`;
}

export function intervalKey(
  rootStr: number, rootFret: number, semitones: number, dir: string,
): string {
  return `interval:${rootStr}:${rootFret}:${semitones}:${dir}`;
}

export function pitchClassKey(pc: number, direction: string): string {
  return `pc:${pc}:${direction}`;
}

export function intervalNumberKey(semitones: number, direction: string): string {
  return `interval-number:${semitones}:${direction}`;
}

export function noteTranspositionKey(
  rootPitchClass: number, semitones: number, direction: string,
): string {
  return `note-transposition:${rootPitchClass}:${semitones}:${direction}`;
}

export function trainerKey(
  rootPitchClass: number, contentType: 'scale' | 'chord', typeName: string, shapeName: string,
): string {
  return `trainer:${rootPitchClass}:${contentType}:${typeName}:${shapeName}`;
}

export function isDue(record: CardRecord | undefined): boolean {
  return !record || record.dueDate <= todayStr();
}

export function nextDueAfterToday(store: SRSStore): string | null {
  const today = todayStr();
  let earliest: string | null = null;
  for (const r of Object.values(store)) {
    if (r.dueDate > today && (!earliest || r.dueDate < earliest)) {
      earliest = r.dueDate;
    }
  }
  return earliest;
}

// SM-2 algorithm: correct = "Got It", incorrect = "Try Again"
export function reviewCard(existing: CardRecord | undefined, correct: boolean): CardRecord {
  const today = todayStr();
  const base: CardRecord = existing ?? {
    interval: 0,
    easeFactor: DEFAULT_EASE,
    repetitions: 0,
    dueDate: today,
    totalSeen: 0,
    totalCorrect: 0,
  };

  const totalSeen = base.totalSeen + 1;
  const totalCorrect = base.totalCorrect + (correct ? 1 : 0);

  if (correct) {
    let newInterval: number;
    if (base.repetitions === 0) newInterval = 1;
    else if (base.repetitions === 1) newInterval = 6;
    else newInterval = Math.round(base.interval * base.easeFactor);

    return {
      interval: newInterval,
      easeFactor: Math.max(MIN_EASE, base.easeFactor + 0.1),
      repetitions: base.repetitions + 1,
      dueDate: addDays(today, newInterval),
      totalSeen,
      totalCorrect,
      bestTimeMs: base.bestTimeMs,
    };
  } else {
    return {
      interval: 1,
      easeFactor: Math.max(MIN_EASE, base.easeFactor - 0.2),
      repetitions: 0,
      dueDate: today,
      totalSeen,
      totalCorrect,
      bestTimeMs: base.bestTimeMs,
    };
  }
}

export interface TrainerReview {
  record: CardRecord;
  previousBestMs?: number;
  improved: boolean;
}

export function reviewTrainerCard(
  existing: CardRecord | undefined,
  clean: boolean,
  elapsedMs: number,
): TrainerReview {
  const previousBestMs = existing?.bestTimeMs;
  const reviewed = reviewCard(existing, clean);
  const improved = clean && previousBestMs !== undefined && elapsedMs < previousBestMs;

  return {
    record: clean
      ? { ...reviewed, bestTimeMs: Math.min(previousBestMs ?? elapsedMs, elapsedMs) }
      : reviewed,
    previousBestMs,
    improved,
  };
}
