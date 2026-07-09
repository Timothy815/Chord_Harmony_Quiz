import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GUITAR_TUNING, STRING_NAMES } from '../../lib/musicTheory';
import { NoteCard, NoteCardData } from './NoteCard';
import { IntervalCard, IntervalCardData } from './IntervalCard';
import {
  SRSStore, CardRecord,
  loadStore, saveStore,
  noteKey, intervalKey,
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
  const [cardMode, setCardMode] = useState<'note' | 'interval'>('note');
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

  // Session state
  const [noteDeck, setNoteDeck] = useState<NoteCardData[]>([]);
  const [intervalDeck, setIntervalDeck] = useState<IntervalCardData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [seen, setSeen] = useState(0);
  const [autoResult, setAutoResult] = useState<'correct' | 'incorrect' | null>(null);

  // SRS state
  const storeRef = useRef<SRSStore>({});
  const [sessionDue, setSessionDue] = useState(0);
  const [sessionNew, setSessionNew] = useState(0);
  const [nextDue, setNextDue] = useState<string | null>(null);

  const deck: (NoteCardData | IntervalCardData)[] = cardMode === 'note' ? noteDeck : intervalDeck;

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

    const active = cardMode === 'note' ? noteResult : intResult;
    setSessionDue(active.dueCount);
    setSessionNew(active.newCount);
    setNextDue(nextDueAfterToday(store));
  }, [cardMode, noteStrings, fretStart, fretEnd, fretMode, positionFret, intStrings, intIntervals, intDirection]);

  const restart = useCallback(() => {
    const store = loadStore();
    buildAndSetDecks(store);
    setCurrentIndex(0);
    setFlipped(false);
    setCorrect(0);
    setSeen(0);
    setAutoResult(null);
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

  const getCardKey = useCallback((card: NoteCardData | IntervalCardData): string => {
    if (cardMode === 'note') {
      const c = card as NoteCardData;
      return noteKey(c.stringIndex, c.fret);
    }
    const c = card as IntervalCardData;
    return intervalKey(c.rootStringIndex, c.rootFret, c.intervalSemitones, c.direction);
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

  const reshuffleCurrentCard = () => {
    if (cardMode === 'note') {
      const nd = [...noteDeck];
      const [card] = nd.splice(currentIndex, 1);
      nd.splice(Math.min(nd.length, currentIndex + 3 + Math.floor(Math.random() * 3)), 0, card);
      setNoteDeck(nd);
    } else {
      const id = [...intervalDeck];
      const [card] = id.splice(currentIndex, 1);
      id.splice(Math.min(id.length, currentIndex + 3 + Math.floor(Math.random() * 3)), 0, card);
      setIntervalDeck(id);
    }
  };

  // Auto-scoring: called directly by MC and fretboard-click cards
  const handleAutoCorrect = () => {
    recordSRS(true);
    setCorrect(c => c + 1);
    setAutoResult('correct');
  };

  const handleAutoIncorrect = () => {
    recordSRS(false);
    reshuffleCurrentCard();
    setAutoResult('incorrect');
  };

  // Advance after auto-scored card
  const handleNext = () => {
    setSeen(s => s + 1);
    if (autoResult === 'correct') setCurrentIndex(i => i + 1);
    setFlipped(false);
    setAutoResult(null);
  };

  // Manual scoring: reveal-only note cards only
  const handleGotIt = () => {
    recordSRS(true);
    setCorrect(c => c + 1);
    setSeen(s => s + 1);
    setCurrentIndex(i => i + 1);
    setFlipped(false);
  };

  const handleTryAgain = () => {
    recordSRS(false);
    setSeen(s => s + 1);
    reshuffleCurrentCard();
    setFlipped(false);
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

  const isDone = deck.length > 0 && currentIndex >= deck.length;
  const currentCard = deck[currentIndex];

  // Current card's SRS record for info display
  const cardKey = currentCard ? getCardKey(currentCard) : null;
  const cardRec: CardRecord | undefined = cardKey ? storeRef.current[cardKey] : undefined;

  const modeBtn = (mode: 'note' | 'interval', label: string) => (
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
          {cardMode === 'note' ? (
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
          ) : (
            <>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Difficulty</p>
                <div className="flex gap-2">
                  {([1, 2, 3] as const).map(lvl => (
                    <button
                      key={lvl}
                      onClick={() => setIntLevel(lvl)}
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

      {/* Card area */}
      {isDone ? (
        <div className="text-center py-16">
          <p className="text-2xl font-bold text-indigo-700 mb-2">Session Complete!</p>
          <p className="text-gray-500 mb-1">{correct} / {seen} correct</p>
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
          ) : (
            <IntervalCard
              key={`${currentIndex}-${seen}`}
              card={currentCard as IntervalCardData}
              level={intLevel}
              flipped={flipped}
              showSemitones={showSemitones}
              onFlip={handleFlip}
              onCorrect={handleAutoCorrect}
              onIncorrect={handleAutoIncorrect}
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
