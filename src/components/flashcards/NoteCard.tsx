import React, { useEffect, useMemo, useState } from 'react';
import { GUITAR_TUNING, STRING_NAMES, midiToNoteString, NOTES } from '../../lib/musicTheory';
import { playGuitarNote, noteToFreq } from '../../lib/audio';
import { Stave } from '../Stave';

export interface NoteCardData {
  stringIndex: number;
  fret: number;
}

interface NoteCardProps {
  card: NoteCardData;
  flipped: boolean;
  multipleChoice: boolean;
  onFlip: () => void;
  onCorrect: () => void;
  onIncorrect: () => void;
}

function getDistractors(correctMidi: number): string[] {
  const correctPc = correctMidi % 12;
  return NOTES
    .filter((_, i) => i !== correctPc)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
}

export function NoteCard({ card, flipped, multipleChoice, onFlip, onCorrect, onIncorrect }: NoteCardProps) {
  const midi = GUITAR_TUNING[card.stringIndex] + card.fret;
  const { note, octave } = midiToNoteString(midi);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const distractors = useMemo(() => getDistractors(midi), [midi]);
  const options = useMemo(
    () => [note, ...distractors].sort(() => Math.random() - 0.5),
    [note, distractors]
  );

  useEffect(() => {
    if (flipped) {
      playGuitarNote(noteToFreq(midi), 1.8);
    }
  }, [flipped]);

  const handleOptionClick = (opt: string) => {
    setSelectedOption(opt);
    onFlip();
    if (opt === note) onCorrect(); else onIncorrect();
  };

  return (
    <div style={{ perspective: '1200px' }}>
      <div
        style={{
          position: 'relative',
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: 'transform 0.45s ease',
          minHeight: '380px',
        }}
      >
        {/* Front face */}
        <div
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
          className="absolute inset-0 bg-white rounded-xl border border-indigo-100 shadow-md flex flex-col items-center justify-center p-8"
        >
          <div className="text-center mb-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">String</p>
            <p className="text-6xl font-bold text-indigo-600 font-mono">{STRING_NAMES[card.stringIndex]}</p>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-6 mb-2">Fret</p>
            <p className="text-6xl font-bold text-indigo-600">{card.fret}</p>
          </div>
          {multipleChoice ? (
            <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
              {options.map(opt => (
                <button
                  key={opt}
                  onClick={() => handleOptionClick(opt)}
                  className="py-3 px-4 rounded-lg border text-sm font-semibold transition-colors bg-indigo-50 border-indigo-200 text-indigo-800 hover:bg-indigo-100 active:bg-indigo-200"
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={onFlip}
              className="mt-2 px-8 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Reveal
            </button>
          )}
        </div>

        {/* Back face */}
        <div
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
          className="absolute inset-0 bg-white rounded-xl border border-indigo-100 shadow-md flex flex-col items-center justify-center p-8"
        >
          {selectedOption && selectedOption !== note && (
            <p className="text-red-500 text-sm mb-2">You picked {selectedOption}</p>
          )}
          <p className="text-7xl font-bold text-indigo-600 mb-1">{note}</p>
          <p className="text-gray-400 text-lg mb-4">{note}{octave}</p>
          <div className="w-full max-w-xs">
            <Stave activeNotes={[midi]} width={240} height={200} />
          </div>
          <button
            onClick={() => playGuitarNote(noteToFreq(midi), 1.8)}
            className="mt-2 px-5 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
          >
            ▶ Play
          </button>
        </div>
      </div>
    </div>
  );
}
