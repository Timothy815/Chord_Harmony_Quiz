import React, { useMemo, useState } from 'react';

export interface PitchClassCardData {
  pitchClass: number;
  direction: 'note-to-number' | 'number-to-note';
}

interface PitchClassCardProps {
  card: PitchClassCardData;
  flipped: boolean;
  multipleChoice: boolean;
  onFlip: () => void;
  onCorrect: () => void;
  onIncorrect: () => void;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function PitchClassCard({
  card, flipped, multipleChoice, onFlip, onCorrect, onIncorrect,
}: PitchClassCardProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const noteName = NOTE_NAMES[card.pitchClass];
  const frontLabel = card.direction === 'note-to-number' ? noteName : String(card.pitchClass);
  const backLabel  = card.direction === 'note-to-number' ? String(card.pitchClass) : noteName;
  const frontSub   = card.direction === 'note-to-number' ? 'Note name' : 'Semitone #';
  const backSub    = card.direction === 'note-to-number' ? 'Semitone #' : 'Note name';

  const options = useMemo(() => {
    if (card.direction === 'note-to-number') {
      const wrongs = Array.from({ length: 12 }, (_, i) => i)
        .filter(i => i !== card.pitchClass)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(String);
      return [String(card.pitchClass), ...wrongs].sort(() => Math.random() - 0.5);
    } else {
      const wrongs = NOTE_NAMES
        .filter((_, i) => i !== card.pitchClass)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      return [noteName, ...wrongs].sort(() => Math.random() - 0.5);
    }
  }, [card]);

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
          <p className="text-8xl font-bold text-indigo-600 font-mono mb-10">{frontLabel}</p>
          {multipleChoice ? (
            <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
              {options.map(opt => (
                <button
                  key={opt}
                  onClick={() => handlePick(opt)}
                  className="py-3 px-4 rounded-lg border text-sm font-semibold transition-colors bg-indigo-50 border-indigo-200 text-indigo-800 hover:bg-indigo-100 active:bg-indigo-200"
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
          <p className="text-8xl font-bold text-indigo-600 font-mono">{backLabel}</p>
        </div>
      )}
    </div>
  );
}
