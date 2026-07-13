import React, { useMemo, useState } from 'react';
import { GUITAR_TUNING, STRING_NAMES, INTERVAL_NAMES } from '../../lib/musicTheory';
import { MiniFretboard, FretDot } from './MiniFretboard';
import { playHarmonicInterval, playInterval, playIntervalSuccess } from '../../lib/audio';

export interface IntervalCardData {
  rootStringIndex: number;
  rootFret: number;
  intervalSemitones: number;
  direction: 'across' | 'along';
}

interface IntervalCardProps {
  card: IntervalCardData;
  level: 1 | 2 | 3;
  flipped: boolean;
  showSemitones?: boolean;
  allowPreListen?: boolean;
  onFlip: () => void;
  onCorrect: () => void;
  onIncorrect: () => void;
}

const ALL_INTERVAL_OPTIONS = [
  { semitones: 1, name: 'Min 2nd' },
  { semitones: 2, name: 'Maj 2nd' },
  { semitones: 3, name: 'Min 3rd' },
  { semitones: 4, name: 'Maj 3rd' },
  { semitones: 5, name: 'Perf 4th' },
  { semitones: 6, name: 'Tritone' },
  { semitones: 7, name: 'Perf 5th' },
  { semitones: 8, name: 'Aug 5th' },
  { semitones: 9, name: 'Maj 6th' },
  { semitones: 10, name: 'Min 7th' },
  { semitones: 11, name: 'Maj 7th' },
  { semitones: 12, name: 'Octave' },
];

const MAX_FRET_SPAN = 4;

function SpeakerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="4 9 8 9 13 4.5 13 19.5 8 15 4 15 4 9" fill="currentColor" stroke="none" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
      <path d="M19 6a8.5 8.5 0 0 1 0 12" />
    </svg>
  );
}

function findTarget(
  rootStr: number, rootFret: number, semitones: number, dir: 'across' | 'along'
): { stringIndex: number; fret: number } | null {
  const targetMidi = GUITAR_TUNING[rootStr] + rootFret + semitones;
  if (dir === 'along') {
    const tf = rootFret + semitones;
    return tf <= 12 && tf - rootFret <= MAX_FRET_SPAN ? { stringIndex: rootStr, fret: tf } : null;
  }
  for (let diff = 1; diff <= 5; diff++) {
    for (const sign of [1, -1] as const) {
      const ts = rootStr + diff * sign;
      if (ts < 0 || ts > 5) continue;
      const tf = targetMidi - GUITAR_TUNING[ts];
      if (tf >= 0 && tf <= 12 && Math.abs(tf - rootFret) <= MAX_FRET_SPAN) {
        return { stringIndex: ts, fret: tf };
      }
    }
  }
  return null;
}

function computeWindow(
  rootStr: number, rootFret: number, tgtStr: number, tgtFret: number
) {
  const minStr = Math.min(rootStr, tgtStr);
  const maxStr = Math.max(rootStr, tgtStr);
  const minFret = Math.min(rootFret, tgtFret);
  const maxFret = Math.max(rootFret, tgtFret);
  return {
    startString: Math.max(0, minStr - 1),
    endString: Math.min(5, maxStr + 1),
    startFret: Math.max(0, minFret - 1),
    endFret: Math.min(12, Math.max(minFret + 5, maxFret + 1)),
  };
}

export function IntervalCard({ card, level, flipped, showSemitones = false, allowPreListen = false, onFlip, onCorrect, onIncorrect }: IntervalCardProps) {
  const [l1Answer, setL1Answer] = useState<number | null>(null);
  const [l2Selected, setL2Selected] = useState<{ stringIndex: number; fret: number } | null>(null);
  const [userDot, setUserDot] = useState<{ stringIndex: number; fret: number } | null>(null);

  const target = useMemo(
    () => findTarget(card.rootStringIndex, card.rootFret, card.intervalSemitones, card.direction),
    [card]
  );

  if (!target) return null;

  const win = computeWindow(card.rootStringIndex, card.rootFret, target.stringIndex, target.fret);
  const correctName = INTERVAL_NAMES[card.intervalSemitones] ?? `${card.intervalSemitones} st`;

  // Always display the full 6-string neck so the learner sees spatial context
  const boardStartString = 0;
  const boardEndString = 5;
  const boardStartFret = 0;
  const boardEndFret = 12;

  const l1Options = useMemo(() => {
    const others = ALL_INTERVAL_OPTIONS
      .filter(o => o.semitones !== card.intervalSemitones)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    return [{ semitones: card.intervalSemitones, name: correctName }, ...others]
      .sort(() => Math.random() - 0.5);
  }, [card]);

  const l2Candidates = useMemo(() => {
    const correct = { stringIndex: target.stringIndex, fret: target.fret, isCorrect: true };
    const targetPc = (GUITAR_TUNING[card.rootStringIndex] + card.rootFret + card.intervalSemitones) % 12;
    const wrongs: { stringIndex: number; fret: number; isCorrect: boolean }[] = [];
    for (let s = win.startString; s <= win.endString && wrongs.length < 3; s++) {
      for (let f = win.startFret; f <= win.endFret && wrongs.length < 3; f++) {
        if (s === target.stringIndex && f === target.fret) continue;
        if (s === card.rootStringIndex && f === card.rootFret) continue;
        if ((GUITAR_TUNING[s] + f) % 12 !== targetPc) {
          wrongs.push({ stringIndex: s, fret: f, isCorrect: false });
        }
      }
    }
    return [correct, ...wrongs].sort(() => Math.random() - 0.5);
  }, [card, target, win]);

  // Build dots for MiniFretboard
  const dots: FretDot[] = [];
  dots.push({ stringIndex: card.rootStringIndex, fret: card.rootFret, type: 'root' });
  if (level === 1) {
    dots.push({ stringIndex: target.stringIndex, fret: target.fret, type: 'interval' });
  } else if (level === 2) {
    if (l2Selected) {
      dots.push({ stringIndex: target.stringIndex, fret: target.fret, type: 'interval' });
      if (l2Selected.stringIndex !== target.stringIndex || l2Selected.fret !== target.fret) {
        dots.push({ stringIndex: l2Selected.stringIndex, fret: l2Selected.fret, type: 'wrong' });
      }
    } else {
      l2Candidates.forEach(c =>
        dots.push({ stringIndex: c.stringIndex, fret: c.fret, type: 'candidate' })
      );
    }
  } else if (level === 3) {
    if (flipped) {
      dots.push({ stringIndex: target.stringIndex, fret: target.fret, type: 'interval' });
      if (userDot && (userDot.stringIndex !== target.stringIndex || userDot.fret !== target.fret)) {
        dots.push({ stringIndex: userDot.stringIndex, fret: userDot.fret, type: 'wrong' });
      }
    } else if (userDot) {
      dots.push({ stringIndex: userDot.stringIndex, fret: userDot.fret, type: 'user' });
    }
  }

  const rootMidi = GUITAR_TUNING[card.rootStringIndex] + card.rootFret;
  const targetMidi = GUITAR_TUNING[target.stringIndex] + target.fret;
  const playCurrentInterval = () => { void playInterval(rootMidi, targetMidi); };
  const playCurrentIntervalHarmonically = () => { void playHarmonicInterval(rootMidi, targetMidi); };
  const playAnswerFeedback = (correct: boolean) => {
    void (correct
      ? playIntervalSuccess(rootMidi, targetMidi)
      : playInterval(rootMidi, targetMidi));
  };

  const soundButtons = (replay = false) => (
    <div className="flex justify-center gap-2">
      <button
        onClick={playCurrentInterval}
        aria-label={`${replay ? 'Replay' : 'Hear'} interval melodically`}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100 transition-colors"
      >
        <SpeakerIcon />
        Melodic
      </button>
      <button
        onClick={playCurrentIntervalHarmonically}
        aria-label={`${replay ? 'Replay' : 'Hear'} interval harmonically`}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 text-amber-800 text-sm font-medium hover:bg-amber-100 transition-colors"
      >
        <SpeakerIcon />
        Harmonic
      </button>
    </div>
  );

  const handleL1 = (semitones: number) => {
    const correct = semitones === card.intervalSemitones;
    setL1Answer(semitones);
    onFlip();
    playAnswerFeedback(correct);
    if (correct) onCorrect(); else onIncorrect();
  };

  const handleL2Click = (s: number, f: number) => {
    if (l2Selected) return;
    const candidate = l2Candidates.find(c => c.stringIndex === s && c.fret === f);
    if (!candidate) return;
    setL2Selected({ stringIndex: s, fret: f });
    onFlip();
    playAnswerFeedback(candidate.isCorrect);
    if (candidate.isCorrect) onCorrect(); else onIncorrect();
  };

  const handleL3Click = (s: number, f: number) => {
    if (flipped) return;
    setUserDot({ stringIndex: s, fret: f });
  };

  const handleL3Reveal = () => {
    if (!userDot) return;
    const correct = userDot.stringIndex === target.stringIndex && userDot.fret === target.fret;
    onFlip();
    playAnswerFeedback(correct);
    if (correct) onCorrect(); else onIncorrect();
  };

  const l2IsCorrect = l2Selected
    ? (l2Candidates.find(c => c.stringIndex === l2Selected.stringIndex && c.fret === l2Selected.fret)?.isCorrect ?? false)
    : false;
  const l3IsCorrect = userDot
    ? userDot.stringIndex === target.stringIndex && userDot.fret === target.fret
    : false;

  const answered = level === 1 ? flipped : level === 2 ? l2Selected !== null : flipped;

  return (
    <div className="bg-white rounded-xl border border-indigo-100 shadow-md p-6">
      {/* Question header */}
      <div className="text-center mb-5">
        {level === 1 && (
          <p className="text-sm text-gray-500">
            What interval is the amber dot above the{' '}
            <span className="font-semibold text-indigo-600">① root</span>?
          </p>
        )}
        {level === 2 && (
          <>
            <p className="text-xs text-gray-400 mb-1">Locate the…</p>
            <p className="text-xl font-bold text-indigo-700">{correctName}</p>
            <p className="text-xs text-gray-400 mt-1">above the <span className="font-semibold text-indigo-600">① root</span></p>
          </>
        )}
        {level === 3 && (
          <>
            <p className="text-sm text-gray-500 mb-1">
              Place the{' '}
              <span className="font-bold text-indigo-700">{correctName}</span>
            </p>
            <p className="text-xs text-gray-400">
              above {STRING_NAMES[card.rootStringIndex]} string, fret {card.rootFret}
              {' · '}
              {card.direction === 'across' ? 'across strings' : 'along string'}
            </p>
          </>
        )}
      </div>

      {/* Pre-answer listen */}
      {allowPreListen && !answered && (
        <div className="mb-5">{soundButtons()}</div>
      )}

      {/* Mini fretboard */}
      <div className="flex justify-center mb-5">
        <MiniFretboard
          startString={boardStartString}
          endString={boardEndString}
          startFret={boardStartFret}
          endFret={boardEndFret}
          dots={dots}
          onFretClick={
            level === 2 && !l2Selected
              ? handleL2Click
              : level === 3 && !flipped
              ? handleL3Click
              : undefined
          }
        />
      </div>

      {/* Level 1: multiple choice */}
      {level === 1 && !flipped && (
        <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
          {l1Options.map(opt => (
            <button
              key={opt.semitones}
              onClick={() => handleL1(opt.semitones)}
              className="py-2 px-3 rounded-lg border text-sm font-medium bg-indigo-50 border-indigo-200 text-indigo-800 hover:bg-indigo-100 transition-colors"
            >
              {opt.name}
              {showSemitones && (
                <span className="ml-1 text-xs text-indigo-400 font-normal">({opt.semitones}st)</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Level 3: reveal button */}
      {level === 3 && !flipped && userDot && (
        <div className="flex justify-center">
          <button
            onClick={handleL3Reveal}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Reveal
          </button>
        </div>
      )}

      {/* Replay interval sound */}
      {answered && (
        <div className="mb-2">{soundButtons(true)}</div>
      )}

      {/* Feedback banners */}
      {level === 1 && flipped && l1Answer !== null && (
        <div
          className={`text-center p-3 rounded-lg text-sm font-medium ${
            l1Answer === card.intervalSemitones ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {l1Answer === card.intervalSemitones ? '✓ ' : '✗ '}
          {correctName} · {card.intervalSemitones} semitones
        </div>
      )}
      {level === 2 && l2Selected && (
        <div
          className={`text-center p-3 rounded-lg text-sm font-medium mt-2 ${
            l2IsCorrect ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {l2IsCorrect
            ? `✓ ${STRING_NAMES[target.stringIndex]} string, fret ${target.fret}`
            : `✗ Answer: ${STRING_NAMES[target.stringIndex]} string, fret ${target.fret}`}
        </div>
      )}
      {level === 3 && flipped && userDot && (
        <div
          className={`text-center p-3 rounded-lg text-sm font-medium mt-2 ${
            l3IsCorrect ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {l3IsCorrect
            ? '✓ Correct!'
            : `✗ Answer: ${STRING_NAMES[target.stringIndex]} string, fret ${target.fret}`}
        </div>
      )}
    </div>
  );
}
