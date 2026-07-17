import React, { useEffect, useMemo, useState } from 'react';
import { GUITAR_TUNING, STRING_NAMES, midiToNoteString, NOTES } from '../../lib/musicTheory';
import { playMidiNote } from '../../lib/audio';
import { Stave } from '../Stave';

export interface NoteCardData {
  stringIndex: number;
  fret: number;
}

interface NoteCardProps {
  card: NoteCardData;
  flipped: boolean;
  multipleChoice: boolean;
  fullChoices?: boolean;
  onFlip: () => void;
  onCorrect: () => void;
  onIncorrect: () => void;
  onReveal: () => void;
}

function getDistractors(correctMidi: number): string[] {
  const correctPc = correctMidi % 12;
  return NOTES
    .filter((_, i) => i !== correctPc)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
}

export function NoteCard({ card, flipped, multipleChoice, fullChoices = false, onFlip, onCorrect, onIncorrect, onReveal }: NoteCardProps) {
  const midi = GUITAR_TUNING[card.stringIndex] + card.fret;
  const { note, octave } = midiToNoteString(midi);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answerRevealed, setAnswerRevealed] = useState(false);

  const distractors = useMemo(() => getDistractors(midi), [midi]);
  const options = useMemo(
    () => fullChoices
      ? [...NOTES].sort(() => Math.random() - 0.5)
      : [note, ...distractors].sort(() => Math.random() - 0.5),
    [note, distractors, fullChoices]
  );

  useEffect(() => {
    if (flipped) {
      playMidiNote(midi);
    }
  }, [flipped]);

  const handleOptionClick = (opt: string) => {
    setSelectedOption(opt);
    if (opt === note) {
      onFlip();
      onCorrect();
    } else {
      onIncorrect();
    }
  };

  return (
    <div className="bg-white rounded-xl border border-indigo-100 shadow-md">
      {/* Front face */}
      {!flipped && (
        <div className="flex flex-col items-center justify-center p-8">
          <div className="text-center mb-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">String</p>
            <p className="text-6xl font-bold text-indigo-600 font-mono">{STRING_NAMES[card.stringIndex]}</p>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-6 mb-2">Fret</p>
            <p className="text-6xl font-bold text-indigo-600">{card.fret}</p>
          </div>
          {multipleChoice ? (
            <div className={`grid gap-2 w-full ${fullChoices ? 'grid-cols-4 max-w-sm' : 'grid-cols-2 max-w-xs'}`}>
              {options.map(opt => (
                <button
                  key={opt}
                  onClick={() => handleOptionClick(opt)}
                  className={`py-3 px-4 rounded-lg border text-sm font-semibold transition-colors ${
                    selectedOption === opt && opt !== note
                      ? 'bg-red-50 border-red-300 text-red-700'
                      : answerRevealed && opt === note
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
              className="mt-2 px-8 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Reveal
            </button>
          )}
          {multipleChoice && selectedOption && selectedOption !== note && (
            <p className="mt-4 text-sm font-semibold text-red-700">Not quite. Stay with this card and try again.</p>
          )}
          {multipleChoice && (
            <button onClick={() => { setAnswerRevealed(true); onReveal(); }} disabled={answerRevealed} className="mt-4 text-sm font-semibold text-amber-700 hover:text-amber-900 disabled:text-amber-400">
              {answerRevealed ? `Answer shown: ${note}` : 'Show Answer'}
            </button>
          )}
        </div>
      )}

      {/* Back face */}
      {flipped && (
        <div className="flex flex-col items-center p-8">
          <p className={`mb-3 text-sm font-bold ${answerRevealed ? 'text-amber-700' : 'text-emerald-700'}`}>
            {answerRevealed ? 'Answer revealed — review it before continuing.' : 'Correct — well done.'}
          </p>
          <p className="text-7xl font-bold text-indigo-600 mb-1">{note}</p>
          <p className="text-gray-400 text-lg mb-2">{note}{octave}</p>
          <div className="w-full max-w-xs">
            <Stave activeNotes={[midi]} width={240} height={200} />
          </div>
          <button
            onClick={() => playMidiNote(midi)}
            className="mt-2 px-5 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
          >
            ▶ Play
          </button>
        </div>
      )}
    </div>
  );
}
