import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GUITAR_TUNING, INTERVAL_NAMES, STRING_NAMES } from '../../lib/musicTheory';
import { NoteCard, NoteCardData } from './NoteCard';
import { IntervalCard, IntervalCardData } from './IntervalCard';
import { IntervalAttemptResult } from '../../lib/intervalScoring';
import { PracticeModule, recordPractice } from '../../lib/analytics';
import { PitchClassCard, PitchClassCardData } from './PitchClassCard';
import { IntervalNumberCard, IntervalNumberCardData } from './IntervalNumberCard';
import {
  SRSStore, CardRecord,
  loadStore, saveStore,
  noteKey, intervalKey, pitchClassKey, intervalNumberKey,
  isDue, nextDueAfterToday, reviewCard,
} from '../../lib/srs';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const LANDMARK_FRETS = [3, 5, 7, 9, 12];
const MAX_FRET_SPAN = 4;

function generateNoteCandidates(strings: number[], frets: number[]): NoteCardData[] {
  const cards: NoteCardData[] = [];
  for (const s of strings) {
    for (const f of frets) {
      cards.push({ stringIndex: s, fret: f });
    }
  }
  return cards;
}

function findTargetPos(
  rootStr: number, rootFret: number, semitones: number, dir: 'across' | 'along',
): boolean {
  const targetMidi = GUITAR_TUNING[rootStr] + rootFret + semitones;
  if (dir === 'along') {
    const tf = rootFret + semitones;
    return tf <= 12 && tf - rootFret <= MAX_FRET_SPAN;
  }
  for (let diff = 1; diff <= 5; diff++) {
    for (const sign of [1, -1] as const) {
      const ts = rootStr + diff * sign;
      if (ts < 0 || ts > 5) continue;
      const tf = targetMidi - GUITAR_TUNING[ts];
      if (tf >= 0 && tf <= 12 && Math.abs(tf - rootFret) <= MAX_FRET_SPAN) return true;
    }
  }
  return false;
}

function generateIntervalCandidates(
  strings: number[], intervals: number[], direction: 'across' | 'along' | 'both',
): IntervalCardData[] {
  const cards: IntervalCardData[] = [];
  const dirs: ('across' | 'along')[] = direction === 'both' ? ['across', 'along'] : [direction];
  for (const s of strings) {
    for (let f = 1; f <= 12; f++) {
      for (const sem of intervals) {
        for (const dir of dirs) {
          if (findTargetPos(s, f, sem, dir)) {
            cards.push({ rootStringIndex: s, rootFret: f, intervalSemitones: sem, direction: dir });
          }
        }
      }
    }
  }
  return cards;
}

interface SRSResult<T> {
  deck: T[];
  dueCount: number;
  newCount: number;
}

function srsFilter<T>(
  candidates: T[],
  getKey: (c: T) => string,
  store: SRSStore,
): SRSResult<T> {
  const due: T[] = [];
  const fresh: T[] = [];
  const scheduled: T[] = [];

  for (const c of candidates) {
    const rec = store[getKey(c)];
    if (!rec) fresh.push(c);
    else if (isDue(rec)) due.push(c);
    else scheduled.push(c);
  }

  // Due and new first; scheduled cards follow for open-ended drilling
  const deck = [...shuffle(due), ...shuffle(fresh), ...shuffle(scheduled)];

  return { deck, dueCount: due.length, newCount: fresh.length };
}

const ALL_STRING_INDICES = [0, 1, 2, 3, 4, 5];
const DEFAULT_INTERVALS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const INTERVAL_OPTIONS = [
  { s: 1, n: 'Min 2nd' }, { s: 2, n: 'Maj 2nd' }, { s: 3, n: 'Min 3rd' },
  { s: 4, n: 'Maj 3rd' }, { s: 5, n: 'Perf 4th' }, { s: 6, n: 'Tritone' },
  { s: 7, n: 'Perf 5th' }, { s: 8, n: 'Aug 5th' }, { s: 9, n: 'Maj 6th' },
  { s: 10, n: 'Min 7th' }, { s: 11, n: 'Maj 7th' }, { s: 12, n: 'Octave' },
];

export function FlashcardShell() {
  const [cardMode, setCardMode] = useState<'note' | 'interval' | 'pitch-class' | 'interval-number'>('note');
  const [showFilters, setShowFilters] = useState(false);

  // Note filters
  const [noteStrings, setNoteStrings] = useState<number[]>(ALL_STRING_INDICES);
  const [fretStart, setFretStart] = useState(0);
  const [fretEnd, setFretEnd] = useState(12);
  const [fretMode, setFretMode] = useState<'range' | 'landmark' | 'position'>('range');
  const [positionFret, setPositionFret] = useState(5);
  const [multipleChoice, setMultipleChoice] = useState(false);

  // Interval filters
  const [intLevel, setIntLevel] = useState<1 | 2 | 3>(1);
  const [intIntervals, setIntIntervals] = useState<number[]>(DEFAULT_INTERVALS);
  const [intDirection, setIntDirection] = useState<'across' | 'along' | 'both'>('across');
  const [intStrings, setIntStrings] = useState<number[]>(ALL_STRING_INDICES);
  const [showSemitones, setShowSemitones] = useState(true);
  const [showSemitoneRef, setShowSemitoneRef] = useState(false);
  const [allowPreListen, setAllowPreListen] = useState(true);
  const [showTuningIntervals, setShowTuningIntervals] = useState(true);

  // Pitch-class filters
  const [pcDirection, setPcDirection] = useState<'note-to-number' | 'number-to-note' | 'both'>('both');
  const [pcMultipleChoice, setPcMultipleChoice] = useState(true);
  const [pcFullChoices, setPcFullChoices] = useState(false);

  // Interval-number filters
  const [inDirection, setInDirection] = useState<'name-to-number' | 'number-to-name' | 'both'>('both');
  const [inMultipleChoice, setInMultipleChoice] = useState(true);
  const [inFullChoices, setInFullChoices] = useState(false);

  // Session state
  const [noteDeck, setNoteDeck] = useState<NoteCardData[]>([]);
  const [intervalDeck, setIntervalDeck] = useState<IntervalCardData[]>([]);
  const [pcDeck, setPcDeck] = useState<PitchClassCardData[]>([]);
  const [inDeck, setInDeck] = useState<IntervalNumberCardData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [seen, setSeen] = useState(0);
  const [autoResult, setAutoResult] = useState<'correct' | 'incorrect' | null>(null);
  const [intervalStats, setIntervalStats] = useState({
    completed: 0,
    totalScore: 0,
    firstTry: 0,
    audioAssisted: 0,
    selfVerified: 0,
    answerShown: 0,
  });

  // SRS state
  const storeRef = useRef<SRSStore>({});
  const attemptStartedAtRef = useRef(performance.now());
  const [sessionDue, setSessionDue] = useState(0);
  const [sessionNew, setSessionNew] = useState(0);
  const [nextDue, setNextDue] = useState<string | null>(null);

  const deck: (NoteCardData | IntervalCardData | PitchClassCardData | IntervalNumberCardData)[] =
    cardMode === 'note' ? noteDeck
      : cardMode === 'interval' ? intervalDeck
      : cardMode === 'pitch-class' ? pcDeck
      : inDeck;

  const buildAndSetDecks = useCallback((store: SRSStore) => {
    storeRef.current = store;

    const frets =
      fretMode === 'position' ? [positionFret] :
      fretMode === 'landmark' ? LANDMARK_FRETS :
      Array.from({ length: fretEnd - fretStart + 1 }, (_, i) => fretStart + i);

    const noteCandidates = generateNoteCandidates(noteStrings, frets);
    const noteResult = srsFilter(noteCandidates, c => noteKey(c.stringIndex, c.fret), store);
    setNoteDeck(noteResult.deck);

    const intCandidates = generateIntervalCandidates(intStrings, intIntervals, intDirection);
    const intResult = srsFilter(intCandidates, c => intervalKey(c.rootStringIndex, c.rootFret, c.intervalSemitones, c.direction), store);
    setIntervalDeck(intResult.deck);

    const pcDirs: ('note-to-number' | 'number-to-note')[] =
      pcDirection === 'both' ? ['note-to-number', 'number-to-note'] : [pcDirection];
    const pcCandidates: PitchClassCardData[] = pcDirs.flatMap(dir =>
      Array.from({ length: 12 }, (_, pc) => ({ pitchClass: pc, direction: dir }))
    );
    const pcResult = srsFilter(pcCandidates, c => pitchClassKey(c.pitchClass, c.direction), store);
    setPcDeck(pcResult.deck);

    const inDirs: ('name-to-number' | 'number-to-name')[] =
      inDirection === 'both' ? ['name-to-number', 'number-to-name'] : [inDirection];
    const inCandidates: IntervalNumberCardData[] = inDirs.flatMap(dir =>
      Array.from({ length: 12 }, (_, i) => ({ semitones: i + 1, direction: dir }))
    );
    const inResult = srsFilter(inCandidates, c => intervalNumberKey(c.semitones, c.direction), store);
    setInDeck(inResult.deck);

    const active =
      cardMode === 'note' ? noteResult
        : cardMode === 'interval' ? intResult
        : cardMode === 'pitch-class' ? pcResult
        : inResult;
    setSessionDue(active.dueCount);
    setSessionNew(active.newCount);
    setNextDue(nextDueAfterToday(store));
  }, [cardMode, noteStrings, fretStart, fretEnd, fretMode, positionFret, intStrings, intIntervals, intDirection, pcDirection, inDirection]);

  const restart = useCallback(() => {
    const store = loadStore();
    buildAndSetDecks(store);
    setCurrentIndex(0);
    setFlipped(false);
    setCorrect(0);
    setSeen(0);
    setAutoResult(null);
    attemptStartedAtRef.current = performance.now();
    setIntervalStats({
      completed: 0,
      totalScore: 0,
      firstTry: 0,
      audioAssisted: 0,
      selfVerified: 0,
      answerShown: 0,
    });
  }, [buildAndSetDecks]);

  // Restart when mode tab changes
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (isMountedRef.current) restart();
  }, [cardMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial load
  useEffect(() => {
    isMountedRef.current = true;
    restart();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getCardKey = useCallback((card: NoteCardData | IntervalCardData | PitchClassCardData | IntervalNumberCardData): string => {
    if (cardMode === 'note') {
      const c = card as NoteCardData;
      return noteKey(c.stringIndex, c.fret);
    }
    if (cardMode === 'interval') {
      const c = card as IntervalCardData;
      return intervalKey(c.rootStringIndex, c.rootFret, c.intervalSemitones, c.direction);
    }
    if (cardMode === 'pitch-class') {
      const c = card as PitchClassCardData;
      return pitchClassKey(c.pitchClass, c.direction);
    }
    const c = card as IntervalNumberCardData;
    return intervalNumberKey(c.semitones, c.direction);
  }, [cardMode]);

  const handleFlip = () => setFlipped(true);

  const recordSRS = (wasCorrect: boolean) => {
    if (!currentCard) return;
    const key = getCardKey(currentCard);
    const updated = reviewCard(storeRef.current[key], wasCorrect);
    storeRef.current = { ...storeRef.current, [key]: updated };
    saveStore(storeRef.current);
    setNextDue(nextDueAfterToday(storeRef.current));
  };

  const recordAnalytics = (
    wasCorrect: boolean,
    options: { score?: number; attempts?: number; assisted?: boolean } = {},
  ) => {
    if (!currentCard) return;
    let module: PracticeModule;
    let topic: string;
    let detail: string;

    if (cardMode === 'note') {
      const card = currentCard as NoteCardData;
      module = 'Note Cards';
      topic = `${STRING_NAMES[card.stringIndex]} string notes`;
      detail = `Fret ${card.fret}`;
    } else if (cardMode === 'interval') {
      const card = currentCard as IntervalCardData;
      module = 'Interval Cards';
      topic = INTERVAL_NAMES[card.intervalSemitones] ?? `${card.intervalSemitones} semitones`;
      detail = `${card.direction} · ${STRING_NAMES[card.rootStringIndex]} root · level ${intLevel}`;
    } else if (cardMode === 'pitch-class') {
      const card = currentCard as PitchClassCardData;
      module = 'Note Numbers';
      topic = card.direction === 'note-to-number' ? 'Note to number' : 'Number to note';
      detail = `Pitch class ${card.pitchClass}`;
    } else {
      const card = currentCard as IntervalNumberCardData;
      module = 'Interval Numbers';
      topic = INTERVAL_NAMES[card.semitones] ?? `${card.semitones} semitones`;
      detail = card.direction;
    }

    const now = performance.now();
    recordPractice({
      module,
      topic,
      detail,
      correct: wasCorrect,
      score: options.score ?? (wasCorrect ? 100 : 0),
      attempts: options.attempts ?? 1,
      durationMs: now - attemptStartedAtRef.current,
      assisted: options.assisted,
    });
  };

  const reshuffleCurrentCard = () => {
    const offset = 3 + Math.floor(Math.random() * 3);
    if (cardMode === 'note') {
      const nd = [...noteDeck];
      const [card] = nd.splice(currentIndex, 1);
      nd.splice(Math.min(nd.length, currentIndex + offset), 0, card);
      setNoteDeck(nd);
    } else if (cardMode === 'interval') {
      const id = [...intervalDeck];
      const [card] = id.splice(currentIndex, 1);
      id.splice(Math.min(id.length, currentIndex + offset), 0, card);
      setIntervalDeck(id);
    } else if (cardMode === 'pitch-class') {
      const pd = [...pcDeck];
      const [card] = pd.splice(currentIndex, 1);
      pd.splice(Math.min(pd.length, currentIndex + offset), 0, card);
      setPcDeck(pd);
    } else {
      const ind = [...inDeck];
      const [card] = ind.splice(currentIndex, 1);
      ind.splice(Math.min(ind.length, currentIndex + offset), 0, card);
      setInDeck(ind);
    }
  };

  // Auto-scoring: called directly by MC and fretboard-click cards
  const handleAutoCorrect = () => {
    recordSRS(true);
    recordAnalytics(true);
    setCorrect(c => c + 1);
    setAutoResult('correct');
  };

  const handleAutoIncorrect = () => {
    recordSRS(false);
    recordAnalytics(false);
    reshuffleCurrentCard();
    setAutoResult('incorrect');
  };

  // Interval cards remain active after a miss so the learner can retry in place.
  const handleIntervalIncorrect = () => {
    recordSRS(false);
    setAutoResult(null);
  };

  const handleIntervalCorrect = (result: IntervalAttemptResult) => {
    recordSRS(true);
    recordAnalytics(true, {
      score: result.score,
      attempts: result.attempts,
      assisted: result.usedSample || result.usedShowAnswer,
    });
    setCorrect((count) => count + 1);
    setAutoResult('correct');
    setIntervalStats((stats) => ({
      completed: stats.completed + 1,
      totalScore: stats.totalScore + result.score,
      firstTry: stats.firstTry + (result.firstTry ? 1 : 0),
      audioAssisted: stats.audioAssisted + (result.usedSample ? 1 : 0),
      selfVerified: stats.selfVerified + (result.selfVerified ? 1 : 0),
      answerShown: stats.answerShown + (result.usedShowAnswer ? 1 : 0),
    }));
  };

  // Advance after auto-scored card
  const handleNext = () => {
    setSeen(s => s + 1);
    if (autoResult === 'correct') setCurrentIndex(i => i + 1);
    setFlipped(false);
    setAutoResult(null);
    attemptStartedAtRef.current = performance.now();
  };

  // Manual scoring: reveal-only note cards only
  const handleGotIt = () => {
    recordSRS(true);
    recordAnalytics(true);
    setCorrect(c => c + 1);
    setSeen(s => s + 1);
    setCurrentIndex(i => i + 1);
    setFlipped(false);
    attemptStartedAtRef.current = performance.now();
  };

  const handleTryAgain = () => {
    recordSRS(false);
    recordAnalytics(false);
    setSeen(s => s + 1);
    reshuffleCurrentCard();
    setFlipped(false);
    attemptStartedAtRef.current = performance.now();
  };

  const toggleNoteString = (s: number) => {
    const next = noteStrings.includes(s)
      ? noteStrings.filter(x => x !== s)
      : [...noteStrings, s].sort((a, b) => a - b);
    if (next.length > 0) setNoteStrings(next);
  };

  const toggleIntString = (s: number) => {
    const next = intStrings.includes(s)
      ? intStrings.filter(x => x !== s)
      : [...intStrings, s].sort((a, b) => a - b);
    if (next.length > 0) setIntStrings(next);
  };

  const toggleInterval = (s: number) => {
    const next = intIntervals.includes(s)
      ? intIntervals.filter(x => x !== s)
      : [...intIntervals, s].sort((a, b) => a - b);
    if (next.length > 0) setIntIntervals(next);
  };

  const clearIntervalFilters = () => {
    setIntIntervals([]);
    setIntStrings([]);
  };

  const isDone = deck.length > 0 && currentIndex >= deck.length;
  const currentCard = deck[currentIndex];

  // Current card's SRS record for info display
  const cardKey = currentCard ? getCardKey(currentCard) : null;
  const cardRec: CardRecord | undefined = cardKey ? storeRef.current[cardKey] : undefined;

  const modeBtn = (mode: 'note' | 'interval' | 'pitch-class' | 'interval-number', label: string) => (
    <button
      key={mode}
      onClick={() => setCardMode(mode)}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        cardMode === mode ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  );

  const strBtn = (active: number[], toggle: (s: number) => void, i: number) => (
    <button
      key={i}
      onClick={() => toggle(i)}
      className={`w-8 h-8 rounded font-mono text-sm font-medium transition-colors ${
        active.includes(i) ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-indigo-400'
      }`}
    >
      {STRING_NAMES[i]}
    </button>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex gap-2">
          {modeBtn('note', 'Note Cards')}
          {modeBtn('interval', 'Interval Cards')}
          {modeBtn('pitch-class', 'Note Numbers')}
          {modeBtn('interval-number', 'Interval Numbers')}
        </div>
        <div className="flex items-center gap-3 text-sm">
          {deck.length > 0 && (sessionDue > 0 || sessionNew > 0) && (
            <span className="text-xs text-gray-400">
              {[
                sessionDue > 0 ? `${sessionDue} due` : '',
                sessionNew > 0 ? `${sessionNew} new` : '',
              ].filter(Boolean).join(' · ')}
            </span>
          )}
          <span className="text-gray-500 font-medium">{correct} / {seen}</span>
          {cardMode === 'interval' && intervalStats.completed > 0 && (
            <span className="text-xs text-indigo-600 font-medium">
              First try {intervalStats.firstTry}/{intervalStats.completed}
              {' · '}Score {Math.round(intervalStats.totalScore / intervalStats.completed)}
            </span>
          )}
          <button
            onClick={() => setShowFilters(f => !f)}
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            {showFilters ? 'Hide Filters ▲' : 'Filters ▼'}
          </button>
          <button onClick={restart} className="text-gray-500 hover:text-gray-800">
            Restart
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
          {cardMode === 'pitch-class' ? (
            <>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Direction</p>
                <div className="flex gap-2">
                  {([
                    { v: 'note-to-number', l: 'Note → Number' },
                    { v: 'number-to-note', l: 'Number → Note' },
                    { v: 'both', l: 'Both' },
                  ] as const).map(d => (
                    <button
                      key={d.v}
                      onClick={() => setPcDirection(d.v)}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        pcDirection === d.v ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-indigo-400'
                      }`}
                    >
                      {d.l}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox" checked={pcMultipleChoice}
                  onChange={e => setPcMultipleChoice(e.target.checked)}
                  className="rounded"
                />
                Multiple choice mode
              </label>
              {pcMultipleChoice && (
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer ml-4">
                  <input
                    type="checkbox" checked={pcFullChoices}
                    onChange={e => setPcFullChoices(e.target.checked)}
                    className="rounded"
                  />
                  Show all 12 choices (harder)
                </label>
              )}
            </>
          ) : cardMode === 'note' ? (
            <>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Strings</p>
                <div className="flex gap-2">
                  {ALL_STRING_INDICES.map(i => strBtn(noteStrings, toggleNoteString, i))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Fret Selection</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setFretMode(m => m === 'landmark' ? 'range' : 'landmark')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      fretMode === 'landmark'
                        ? 'bg-amber-500 text-white'
                        : 'bg-white border border-gray-300 text-gray-600 hover:border-amber-400'
                    }`}
                  >
                    ● Dot frets
                  </button>
                  <button
                    onClick={() => setFretMode(m => m === 'position' ? 'range' : 'position')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      fretMode === 'position'
                        ? 'bg-violet-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-600 hover:border-violet-400'
                    }`}
                  >
                    ⬤ Position
                  </button>
                  <span className="text-gray-300">|</span>
                  {[{ l: '0–4', s: 0, e: 4 }, { l: '5–9', s: 5, e: 9 }, { l: '0–12', s: 0, e: 12 }].map(p => (
                    <button
                      key={p.l}
                      onClick={() => { setFretMode('range'); setFretStart(p.s); setFretEnd(p.e); }}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        fretMode === 'range' && fretStart === p.s && fretEnd === p.e
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-gray-300 text-gray-600 hover:border-indigo-400'
                      }`}
                    >
                      {p.l}
                    </button>
                  ))}
                  <input
                    type="number" min={0} max={11} value={fretStart}
                    disabled={fretMode !== 'range'}
                    onChange={e => { setFretMode('range'); setFretStart(Math.max(0, Math.min(11, +e.target.value))); }}
                    className={`w-14 border border-gray-300 rounded px-2 py-1 text-sm text-center transition-opacity ${fretMode !== 'range' ? 'opacity-30' : ''}`}
                  />
                  <span className={`text-gray-400 transition-opacity ${fretMode !== 'range' ? 'opacity-30' : ''}`}>–</span>
                  <input
                    type="number" min={1} max={12} value={fretEnd}
                    disabled={fretMode !== 'range'}
                    onChange={e => { setFretMode('range'); setFretEnd(Math.max(1, Math.min(12, +e.target.value))); }}
                    className={`w-14 border border-gray-300 rounded px-2 py-1 text-sm text-center transition-opacity ${fretMode !== 'range' ? 'opacity-30' : ''}`}
                  />
                </div>
                {fretMode === 'landmark' && (
                  <p className="text-xs text-amber-600 mt-1.5">Frets 3 · 5 · 7 · 9 · 12 only</p>
                )}
                {fretMode === 'position' && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500">Fret:</span>
                    {[0, 3, 5, 7, 9, 12].map(f => (
                      <button
                        key={f}
                        onClick={() => setPositionFret(f)}
                        className={`w-8 h-8 rounded text-sm font-mono font-medium transition-colors ${
                          positionFret === f
                            ? 'bg-violet-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-600 hover:border-violet-400'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                    <input
                      type="number" min={0} max={12} value={positionFret}
                      onChange={e => setPositionFret(Math.max(0, Math.min(12, +e.target.value)))}
                      className="w-14 border border-gray-300 rounded px-2 py-1 text-sm text-center"
                    />
                    <span className="text-xs text-violet-600">
                      {noteStrings.length === 6 ? '6 cards' : `${noteStrings.length} cards`}
                    </span>
                  </div>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox" checked={multipleChoice}
                  onChange={e => setMultipleChoice(e.target.checked)}
                  className="rounded"
                />
                Multiple choice mode
              </label>
            </>
          ) : cardMode === 'interval' ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-gray-700">Filter Selection</p>
                <button
                  onClick={clearIntervalFilters}
                  className="px-3 py-1.5 rounded border border-red-200 bg-white text-sm font-medium text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
                >
                  Clear All
                </button>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Difficulty</p>
                <div className="flex gap-2">
                  {([1, 2, 3] as const).map(lvl => (
                    <button
                      key={lvl}
                      onClick={() => {
                        setIntLevel(lvl);
                        setShowTuningIntervals(lvl !== 3);
                      }}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        intLevel === lvl ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-indigo-400'
                      }`}
                    >
                      {lvl === 1 ? 'Identify' : lvl === 2 ? 'Locate' : 'Produce'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Intervals</p>
                <div className="flex flex-wrap gap-2">
                  {INTERVAL_OPTIONS.map(opt => (
                    <button
                      key={opt.s}
                      onClick={() => toggleInterval(opt.s)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        intIntervals.includes(opt.s) ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-indigo-400'
                      }`}
                    >
                      {opt.n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Direction</p>
                <div className="flex gap-2">
                  {(['across', 'along', 'both'] as const).map(d => (
                    <button
                      key={d}
                      onClick={() => setIntDirection(d)}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        intDirection === d ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-indigo-400'
                      }`}
                    >
                      {d === 'across' ? 'Across' : d === 'along' ? 'Along' : 'Both'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Root Strings</p>
                <div className="flex gap-2">
                  {ALL_STRING_INDICES.map(i => strBtn(intStrings, toggleIntString, i))}
                </div>
              </div>
              {intLevel === 1 && (
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox" checked={showSemitones}
                    onChange={e => setShowSemitones(e.target.checked)}
                    className="rounded"
                  />
                  Show semitone counts on choices
                </label>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox" checked={allowPreListen}
                  onChange={e => setAllowPreListen(e.target.checked)}
                  className="rounded"
                />
                Allow hearing interval before answering
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox" checked={showTuningIntervals}
                  onChange={e => setShowTuningIntervals(e.target.checked)}
                  className="rounded"
                />
                Show tuning intervals
              </label>
            </>
          ) : (
            <>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Direction</p>
                <div className="flex gap-2">
                  {([
                    { v: 'name-to-number', l: 'Name → Number' },
                    { v: 'number-to-name', l: 'Number → Name' },
                    { v: 'both', l: 'Both' },
                  ] as const).map(d => (
                    <button
                      key={d.v}
                      onClick={() => setInDirection(d.v)}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        inDirection === d.v ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-indigo-400'
                      }`}
                    >
                      {d.l}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox" checked={inMultipleChoice}
                  onChange={e => setInMultipleChoice(e.target.checked)}
                  className="rounded"
                />
                Multiple choice mode
              </label>
              {inMultipleChoice && (
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer ml-4">
                  <input
                    type="checkbox" checked={inFullChoices}
                    onChange={e => setInFullChoices(e.target.checked)}
                    className="rounded"
                  />
                  Show all 12 choices (harder)
                </label>
              )}
            </>
          )}
          <button
            onClick={restart}
            className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Apply &amp; Restart
          </button>
        </div>
      )}

      {/* Semitone reference panel — interval mode only */}
      {cardMode === 'interval' && (
        <div className="mb-5">
          <button
            onClick={() => setShowSemitoneRef(v => !v)}
            className="text-xs text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-1"
          >
            ℹ Semitone reference {showSemitoneRef ? '▲' : '▼'}
          </button>
          {showSemitoneRef && (
            <div className="mt-2 p-4 bg-indigo-50 border border-indigo-100 rounded-lg text-sm space-y-4">
              {/* Number line */}
              <div className="overflow-x-auto">
                <div className="flex min-w-max">
                  {[
                    { note: 'C',   pc: 0,  natural: true },
                    { note: 'C#',  pc: 1,  natural: false },
                    { note: 'D',   pc: 2,  natural: true },
                    { note: 'D#',  pc: 3,  natural: false },
                    { note: 'E',   pc: 4,  natural: true },
                    { note: 'F',   pc: 5,  natural: true },
                    { note: 'F#',  pc: 6,  natural: false },
                    { note: 'G',   pc: 7,  natural: true },
                    { note: 'G#',  pc: 8,  natural: false },
                    { note: 'A',   pc: 9,  natural: true },
                    { note: 'A#',  pc: 10, natural: false },
                    { note: 'B',   pc: 11, natural: true },
                  ].map(({ note, pc, natural }) => (
                    <div
                      key={pc}
                      className={`flex flex-col items-center justify-center w-10 py-1.5 border-r border-indigo-200 last:border-r-0 ${
                        natural ? 'bg-white' : 'bg-indigo-200'
                      }`}
                    >
                      <span className="font-mono font-semibold text-xs text-gray-700">{note}</span>
                      <span className="font-mono text-lg font-bold text-indigo-700 leading-tight">{pc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Formula */}
              <div>
                <p className="font-semibold text-gray-700 mb-1">Formula</p>
                <p className="font-mono text-indigo-800 bg-white border border-indigo-200 rounded px-3 py-2 inline-block">
                  (target − root + 12) % 12
                </p>
                <p className="text-gray-500 mt-1.5 text-xs">
                  Example: D# → A = (9 − 3 + 12) % 12 = <strong>6 st</strong> (Tritone)
                </p>
              </div>

              {/* Always C=0 */}
              <p className="text-xs text-gray-500 border-t border-indigo-100 pt-3">
                <strong>C = 0 in every key and scale.</strong> These are fixed pitch-class labels for
                the 12 chromatic notes — they never shift. A key signature just tells you which
                subset of the 12 to focus on; the numbers themselves are absolute.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Card area */}
      {isDone ? (
        <div className="text-center py-16">
          <p className="text-2xl font-bold text-indigo-700 mb-2">Session Complete!</p>
          <p className="text-gray-500 mb-1">{correct} / {seen} correct</p>
          {cardMode === 'interval' && intervalStats.completed > 0 && (
            <div className="text-sm text-gray-500 mb-3 space-y-1">
              <p>
                First try: {intervalStats.firstTry} / {intervalStats.completed}
                {' · '}Average score: {Math.round(intervalStats.totalScore / intervalStats.completed)}
              </p>
              <p className="text-xs text-gray-400">
                Audio-assisted: {intervalStats.audioAssisted}
                {' · '}Self-verified: {intervalStats.selfVerified}
                {' · '}Answers shown: {intervalStats.answerShown}
              </p>
            </div>
          )}
          {(sessionDue > 0 || sessionNew > 0) && (
            <p className="text-sm text-gray-400 mb-1">
              {[
                sessionDue > 0 ? `${sessionDue} review${sessionDue !== 1 ? 's' : ''}` : '',
                sessionNew > 0 ? `${sessionNew} new` : '',
              ].filter(Boolean).join(' · ')}
            </p>
          )}
          {nextDue ? (
            <p className="text-sm text-gray-400 mb-8">Next review: {nextDue}</p>
          ) : (
            <div className="mb-8" />
          )}
          <button
            onClick={restart}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            New Session
          </button>
        </div>
      ) : deck.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No cards match your filters.</div>
      ) : currentCard ? (
        <div>
          <p className="text-xs text-gray-400 text-right mb-2">
            {currentIndex + 1} / {deck.length}
          </p>
          {cardMode === 'note' ? (
            <NoteCard
              key={`${currentIndex}-${seen}`}
              card={currentCard as NoteCardData}
              flipped={flipped}
              multipleChoice={multipleChoice}
              onFlip={handleFlip}
              onCorrect={multipleChoice ? handleAutoCorrect : () => {}}
              onIncorrect={multipleChoice ? handleAutoIncorrect : () => {}}
            />
          ) : cardMode === 'interval' ? (
            <IntervalCard
              key={`${currentIndex}-${seen}`}
              card={currentCard as IntervalCardData}
              level={intLevel}
              flipped={flipped}
              showSemitones={showSemitones}
              allowPreListen={allowPreListen}
              showTuningIntervals={showTuningIntervals}
              onFlip={handleFlip}
              onCorrect={handleIntervalCorrect}
              onIncorrect={handleIntervalIncorrect}
            />
          ) : cardMode === 'pitch-class' ? (
            <PitchClassCard
              key={`${currentIndex}-${seen}`}
              card={currentCard as PitchClassCardData}
              flipped={flipped}
              multipleChoice={pcMultipleChoice}
              fullChoices={pcFullChoices}
              onFlip={handleFlip}
              onCorrect={pcMultipleChoice ? handleAutoCorrect : () => {}}
              onIncorrect={pcMultipleChoice ? handleAutoIncorrect : () => {}}
            />
          ) : (
            <IntervalNumberCard
              key={`${currentIndex}-${seen}`}
              card={currentCard as IntervalNumberCardData}
              flipped={flipped}
              multipleChoice={inMultipleChoice}
              fullChoices={inFullChoices}
              onFlip={handleFlip}
              onCorrect={inMultipleChoice ? handleAutoCorrect : () => {}}
              onIncorrect={inMultipleChoice ? handleAutoIncorrect : () => {}}
            />
          )}
          {flipped && (
            <>
              {cardRec && cardRec.totalSeen > 0 && (
                <p className="text-center text-xs text-gray-400 mt-4">
                  Seen {cardRec.totalSeen}
                  {cardRec.totalSeen === 1 ? ' time' : ' times'}
                  {' · '}
                  Streak: {cardRec.repetitions}
                  {cardRec.repetitions >= 5 ? ' ★' : cardRec.repetitions >= 3 ? ' ◆' : ''}
                </p>
              )}
              {autoResult !== null ? (
                <div className="flex justify-center mt-3">
                  <button
                    onClick={handleNext}
                    className={`px-8 py-2 rounded-lg font-medium transition-colors ${
                      autoResult === 'correct'
                        ? 'bg-green-50 border border-green-200 text-green-700 hover:bg-green-100'
                        : 'bg-red-50 border border-red-200 text-red-700 hover:bg-red-100'
                    }`}
                  >
                    Next →
                  </button>
                </div>
              ) : (
                <div className="flex justify-center gap-4 mt-3">
                  <button
                    onClick={handleTryAgain}
                    className="px-6 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg font-medium hover:bg-red-100 transition-colors"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={handleGotIt}
                    className="px-6 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg font-medium hover:bg-green-100 transition-colors"
                  >
                    Got It ✓
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
