import React, { useEffect, useMemo, useState } from 'react';
import { INTERVAL_NAMES, NOTES } from '../../lib/musicTheory';
import {
  PITCH_CLASS_LABELS,
  spellTransposedNote,
  transposePitchClass,
  TranspositionDirection,
} from '../../lib/noteTransposition';
import { IntervalAttemptResult, scoreIntervalAttempt } from '../../lib/intervalScoring';
import { playIntervalSuccess } from '../../lib/audio';
import { shuffle } from '../../lib/shuffle';

export interface NoteTranspositionCardData {
  rootPitchClass: number;
  intervalSemitones: number;
  direction: TranspositionDirection;
}

interface NoteTranspositionCardProps {
  card: NoteTranspositionCardData;
  flipped: boolean;
  showSemitones: boolean;
  onFlip: () => void;
  onCorrect: (result: IntervalAttemptResult) => void;
  onIncorrect: () => void;
}

export function NoteTranspositionCard({
  card,
  flipped,
  showSemitones,
  onFlip,
  onCorrect,
  onIncorrect,
}: NoteTranspositionCardProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const targetPitchClass = transposePitchClass(
    card.rootPitchClass,
    card.intervalSemitones,
    card.direction,
  );
  const strictSpelling = spellTransposedNote(
    card.rootPitchClass,
    card.intervalSemitones,
    card.direction,
  );
  const intervalName = INTERVAL_NAMES[card.intervalSemitones] ?? `${card.intervalSemitones} semitones`;
  const pitchChoices = useMemo(
    () => shuffle(PITCH_CLASS_LABELS.map((label, pitchClass) => ({ label, pitchClass }))),
    [card.rootPitchClass, card.intervalSemitones, card.direction],
  );

  useEffect(() => {
    if (!flipped) return;
    const rootMidi = 60 + card.rootPitchClass;
    const targetMidi = card.direction === 'up'
      ? rootMidi + card.intervalSemitones
      : rootMidi - card.intervalSemitones;
    void playIntervalSuccess(rootMidi, targetMidi);
  }, [flipped, card.rootPitchClass, card.intervalSemitones, card.direction]);

  const chooseAnswer = (pitchClass: number) => {
    if (flipped) return;
    setSelected(pitchClass);
    if (pitchClass === targetPitchClass) {
      const result = scoreIntervalAttempt(mistakes, false, false, answerRevealed);
      onFlip();
      onCorrect(result);
    } else {
      setMistakes(count => count + 1);
      onIncorrect();
    }
  };

  return (
    <div className="rounded-2xl border border-cyan-100 bg-white p-6 shadow-md">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Note transposition</p>
        <p className="mt-4 text-sm text-slate-500">Start on</p>
        <p className="mt-1 text-5xl font-bold tracking-tight text-slate-950">{NOTES[card.rootPitchClass].replace('#', '♯')}</p>
        <div className="mx-auto my-5 h-px max-w-xs bg-slate-100" />
        <p className="text-lg font-semibold text-slate-800">
          Go {card.direction}{' '}
          <span className="text-cyan-700">{intervalName}</span>
          {showSemitones && <span className="ml-1 text-xs font-normal text-slate-400">({card.intervalSemitones} st)</span>}
        </p>
        <p className="mt-1 text-xs text-slate-400">Which pitch do you land on?</p>
        <p className="mt-2 text-[11px] text-slate-400">
          Choose the matching pitch class. Exact interval spelling appears after the answer.
        </p>
      </div>

      {!flipped && (
        <div className="mx-auto mt-6 grid max-w-lg grid-cols-3 gap-2 sm:grid-cols-4">
          {pitchChoices.map(({ label, pitchClass }) => {
            const lastWrong = selected === pitchClass && pitchClass !== targetPitchClass;
            return (
              <button
                key={label}
                onClick={() => chooseAnswer(pitchClass)}
                className={`min-h-12 rounded-lg border px-2 py-2 text-sm font-semibold transition-colors ${
                  lastWrong
                    ? 'border-red-300 bg-red-50 text-red-700'
                    : answerRevealed && pitchClass === targetPitchClass
                      ? 'border-amber-400 bg-amber-100 text-amber-900'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-cyan-400 hover:bg-cyan-50'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {selected !== null && !flipped && selected !== targetPitchClass && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-center text-sm font-medium text-red-800">
          Not quite. Keep the starting note and count the interval again.
        </div>
      )}

      {!flipped && (
        <div className="mt-4 text-center">
          <button onClick={() => setAnswerRevealed(true)} disabled={answerRevealed} className="text-sm font-semibold text-amber-700 hover:text-amber-900 disabled:text-amber-400">
            {answerRevealed ? `Answer shown: ${PITCH_CLASS_LABELS[targetPitchClass]}` : 'Show Answer'}
          </button>
        </div>
      )}

      {flipped && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <p className={`mb-1 text-sm font-bold ${answerRevealed ? 'text-amber-700' : 'text-emerald-700'}`}>{answerRevealed ? 'Answer revealed — review the spelling.' : 'Correct — transposition calculated.'}</p>
          <p className="text-lg font-bold text-emerald-800">Correct: {PITCH_CLASS_LABELS[targetPitchClass]}</p>
          <p className="mt-1 text-sm text-emerald-700">
            Properly spelled as <strong>{strictSpelling}</strong> for this interval.
          </p>
          <p className="mt-2 text-xs text-emerald-600">
            {NOTES[card.rootPitchClass].replace('#', '♯')} {card.direction} {intervalName} = {strictSpelling}
          </p>
        </div>
      )}
    </div>
  );
}
