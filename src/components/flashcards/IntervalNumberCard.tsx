import React, { useEffect, useMemo, useState } from 'react';
import { INTERVAL_NAMES } from '../../lib/musicTheory';
import { playIntervalSuccess } from '../../lib/audio';

export interface IntervalNumberCardData {
  semitones: number; // 1-12
  direction: 'name-to-number' | 'number-to-name';
}

interface IntervalNumberCardProps {
  card: IntervalNumberCardData;
  flipped: boolean;
  multipleChoice: boolean;
  fullChoices?: boolean;
  onFlip: () => void;
  onCorrect: () => void;
  onIncorrect: () => void;
  onReveal: () => void;
}

const ALL_SEMITONES = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12

export function IntervalNumberCard({
  card, flipped, multipleChoice, fullChoices = false, onFlip, onCorrect, onIncorrect, onReveal,
}: IntervalNumberCardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [answerRevealed, setAnswerRevealed] = useState(false);

  const intervalName = INTERVAL_NAMES[card.semitones];
  const frontLabel = card.direction === 'name-to-number' ? intervalName : String(card.semitones);
  const backLabel  = card.direction === 'name-to-number' ? String(card.semitones) : intervalName;
  const frontSub   = card.direction === 'name-to-number' ? 'Interval name' : 'Semitones';
  const backSub    = card.direction === 'name-to-number' ? 'Semitones' : 'Interval name';

  useEffect(() => {
    if (flipped) void playIntervalSuccess(60, 60 + card.semitones);
  }, [flipped, card.semitones]);

  const options = useMemo(() => {
    if (fullChoices) {
      return card.direction === 'name-to-number'
        ? ALL_SEMITONES.map(String).sort(() => Math.random() - 0.5)
        : ALL_SEMITONES.map(s => INTERVAL_NAMES[s]).sort(() => Math.random() - 0.5);
    }
    if (card.direction === 'name-to-number') {
      const wrongs = ALL_SEMITONES
        .filter(s => s !== card.semitones)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(String);
      return [String(card.semitones), ...wrongs].sort(() => Math.random() - 0.5);
    } else {
      const wrongs = ALL_SEMITONES
        .filter(s => s !== card.semitones)
        .map(s => INTERVAL_NAMES[s])
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      return [intervalName, ...wrongs].sort(() => Math.random() - 0.5);
    }
  }, [card, fullChoices]);

  const handlePick = (opt: string) => {
    setSelected(opt);
    if (opt === backLabel) {
      onFlip();
      onCorrect();
    } else {
      onIncorrect();
    }
  };

  return (
    <div className="bg-white rounded-xl border border-indigo-100 shadow-md">
      {!flipped && (
        <div className="flex flex-col items-center justify-center p-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">{frontSub}</p>
          <p className="text-6xl font-bold text-indigo-600 font-mono mb-10 text-center">{frontLabel}</p>
          {multipleChoice ? (
            <div className={`grid gap-2 w-full ${fullChoices ? 'grid-cols-4 max-w-sm' : 'grid-cols-2 max-w-xs'}`}>
              {options.map(opt => (
                <button
                  key={opt}
                  onClick={() => handlePick(opt)}
                  className={`py-2.5 px-2 rounded-lg border text-sm font-semibold transition-colors ${
                    selected === opt && opt !== backLabel
                      ? 'bg-red-50 border-red-300 text-red-700'
                      : answerRevealed && opt === backLabel
                        ? 'bg-amber-100 border-amber-400 text-amber-900'
                        : 'bg-indigo-50 border-indigo-200 text-indigo-800 hover:bg-indigo-100 active:bg-indigo-200'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={onFlip}
              className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Reveal
            </button>
          )}
          {multipleChoice && selected && selected !== backLabel && <p className="mt-4 text-sm font-semibold text-red-700">Not quite. Count the semitone distance and try again.</p>}
          {multipleChoice && <button onClick={() => { setAnswerRevealed(true); onReveal(); }} disabled={answerRevealed} className="mt-4 text-sm font-semibold text-amber-700 hover:text-amber-900 disabled:text-amber-400">{answerRevealed ? `Answer shown: ${backLabel}` : 'Show Answer'}</button>}
        </div>
      )}
      {flipped && (
        <div className="flex flex-col items-center p-8">
          <p className={`mb-3 text-sm font-bold ${answerRevealed ? 'text-amber-700' : 'text-emerald-700'}`}>{answerRevealed ? 'Answer revealed — review it before continuing.' : 'Correct — interval relationship recalled.'}</p>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{backSub}</p>
          <p className="text-6xl font-bold text-indigo-600 font-mono text-center">{backLabel}</p>
          <p className="mt-3 text-sm text-slate-500">{intervalName} spans {card.semitones} semitones.</p>
        </div>
      )}
    </div>
  );
}
