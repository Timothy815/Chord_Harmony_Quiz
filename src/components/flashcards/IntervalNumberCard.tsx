import React, { useMemo, useState } from 'react';
import { INTERVAL_NAMES } from '../../lib/musicTheory';

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
}

const ALL_SEMITONES = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12

export function IntervalNumberCard({
  card, flipped, multipleChoice, fullChoices = false, onFlip, onCorrect, onIncorrect,
}: IntervalNumberCardProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const intervalName = INTERVAL_NAMES[card.semitones];
  const frontLabel = card.direction === 'name-to-number' ? intervalName : String(card.semitones);
  const backLabel  = card.direction === 'name-to-number' ? String(card.semitones) : intervalName;
  const frontSub   = card.direction === 'name-to-number' ? 'Interval name' : 'Semitones';
  const backSub    = card.direction === 'name-to-number' ? 'Semitones' : 'Interval name';

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
    onFlip();
    if (opt === backLabel) onCorrect(); else onIncorrect();
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
                  className="py-2.5 px-2 rounded-lg border text-sm font-semibold transition-colors bg-indigo-50 border-indigo-200 text-indigo-800 hover:bg-indigo-100 active:bg-indigo-200"
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
        </div>
      )}
      {flipped && (
        <div className="flex flex-col items-center p-8">
          {selected && selected !== backLabel && (
            <p className="text-red-500 text-sm mb-3">
              ✗ You picked <strong>{selected}</strong> — correct: <strong>{backLabel}</strong>
            </p>
          )}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{backSub}</p>
          <p className="text-6xl font-bold text-indigo-600 font-mono text-center">{backLabel}</p>
        </div>
      )}
    </div>
  );
}
