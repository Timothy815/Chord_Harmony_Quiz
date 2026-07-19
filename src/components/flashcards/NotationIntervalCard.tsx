import React, { useEffect, useMemo, useState } from 'react';
import { playIntervalSuccess } from '../../lib/audio';
import { scoreIntervalAttempt, IntervalAttemptResult } from '../../lib/intervalScoring';
import {
  GENERIC_INTERVAL_LABELS,
  intervalAnswer,
  naturalMidi,
  NotationIntervalCardData,
  NOTATION_INTERVAL_DEFINITIONS,
  spelledNote,
  targetAccidental,
} from '../../lib/notationIntervals';
import { shuffle } from '../../lib/shuffle';

interface NotationIntervalCardProps {
  card: NotationIntervalCardData;
  flipped: boolean;
  onFlip: () => void;
  onCorrect: (result: IntervalAttemptResult) => void;
  onIncorrect: () => void;
}

function StaffDyad({
  clef,
  lowerDiatonic,
  upperDiatonic,
  upperAccidental,
  showLabels,
}: {
  clef: 'treble' | 'bass';
  lowerDiatonic: number;
  upperDiatonic: number;
  upperAccidental: number;
  showLabels: boolean;
}) {
  const bottomLine = clef === 'treble' ? 30 : 18; // E4 or G2
  const topLine = bottomLine + 8;
  const yFor = (diatonic: number) => 120 - (diatonic - bottomLine) * 6;
  const notes = [
    { diatonic: lowerDiatonic, accidental: 0, x: 146 },
    { diatonic: upperDiatonic, accidental: upperAccidental, x: upperDiatonic - lowerDiatonic === 1 ? 157 : 146 },
  ];

  const ledgerPositions = (diatonic: number) => {
    const positions: number[] = [];
    if (diatonic < bottomLine) {
      for (let value = bottomLine - 2; value >= diatonic; value -= 2) positions.push(value);
    } else if (diatonic > topLine) {
      for (let value = topLine + 2; value <= diatonic; value += 2) positions.push(value);
    }
    return positions;
  };

  return (
    <div className="mx-auto mt-5 max-w-md rounded-xl border border-slate-200 bg-[#fffdf7] p-3 shadow-inner">
      <svg viewBox="0 0 310 205" className="h-auto w-full" role="img" aria-label={`${clef} clef with a stacked dyad`}>
        {[72, 84, 96, 108, 120].map(y => <line key={y} x1="38" y1={y} x2="280" y2={y} stroke="#1f2937" strokeWidth="1.5" />)}
        <line x1="38" y1="72" x2="38" y2="120" stroke="#1f2937" strokeWidth="1.5" />
        <text x="48" y={clef === 'treble' ? 119 : 113} fontSize={clef === 'treble' ? 67 : 58} fontFamily="serif" fill="#111827">
          {clef === 'treble' ? '𝄞' : '𝄢'}
        </text>
        {notes.map((note, index) => {
          const y = yFor(note.diatonic);
          const label = spelledNote(note.diatonic, note.accidental);
          return (
            <g key={`${note.diatonic}-${index}`}>
              {ledgerPositions(note.diatonic).map(position => (
                <line key={position} x1={note.x - 14} y1={yFor(position)} x2={note.x + 14} y2={yFor(position)} stroke="#111827" strokeWidth="1.8" />
              ))}
              {note.accidental !== 0 && <text x={note.x - 28} y={y + 6} fontSize="22" fontFamily="serif" fill="#111827">{note.accidental === 1 ? '♯' : '♭'}</text>}
              <ellipse cx={note.x} cy={y} rx="8" ry="5.5" fill="#111827" transform={`rotate(-14 ${note.x} ${y})`} />
              <line x1={note.x + 7} y1={y} x2={note.x + 7} y2={y - 34} stroke="#111827" strokeWidth="1.6" />
              {showLabels && <text x={note.x} y="176" textAnchor="middle" fontSize="13" fontWeight="700" fill={index === 0 ? '#4f46e5' : '#b45309'}>{label}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function NotationIntervalCard({ card, flipped, onFlip, onCorrect, onIncorrect }: NotationIntervalCardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const lowerDiatonic = useMemo(() => {
    const start = card.clef === 'treble' ? 28 : 18;
    return start + Math.floor(Math.random() * 7);
  }, [card.clef, card.generic, card.quality, card.semitones, card.level]);
  const upperDiatonic = lowerDiatonic + card.generic - 1;
  const upperAccidental = card.level === 'quality'
    ? targetAccidental(lowerDiatonic, card.generic, card.semitones)
    : 0;
  const lowerMidi = naturalMidi(lowerDiatonic);
  const upperMidi = naturalMidi(upperDiatonic) + upperAccidental;
  const correctAnswer = intervalAnswer(card);
  const choices = useMemo(() => {
    if (card.level === 'generic') return shuffle(Object.values(GENERIC_INTERVAL_LABELS));
    return shuffle([...new Set(NOTATION_INTERVAL_DEFINITIONS.map(definition => intervalAnswer({
      clef: card.clef,
      level: 'quality',
      ...definition,
    })))]);
  }, [card.clef, card.level]);

  useEffect(() => {
    if (flipped) void playIntervalSuccess(lowerMidi, upperMidi);
  }, [flipped, lowerMidi, upperMidi]);

  const choose = (answer: string) => {
    if (flipped) return;
    setSelected(answer);
    if (answer === correctAnswer) {
      onFlip();
      onCorrect(scoreIntervalAttempt(mistakes, false, false, answerRevealed));
    } else {
      setMistakes(count => count + 1);
      onIncorrect();
    }
  };

  return (
    <div className="rounded-2xl border border-sky-100 bg-white p-6 shadow-md">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">Notation interval · {card.clef} clef</p>
        <p className="mt-2 text-sm text-slate-500">{card.level === 'generic' ? 'Count both notes: what is the staff distance?' : 'Identify the interval number and quality.'}</p>
      </div>

      <StaffDyad clef={card.clef} lowerDiatonic={lowerDiatonic} upperDiatonic={upperDiatonic} upperAccidental={upperAccidental} showLabels={flipped} />

      {!flipped && (
        <div className="mx-auto mt-5 grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-4">
          {choices.map(choice => (
            <button key={choice} onClick={() => choose(choice)} className={`min-h-11 rounded-lg border px-2 py-2 text-sm font-semibold transition-colors ${
              selected === choice && choice !== correctAnswer
                ? 'border-red-300 bg-red-50 text-red-700'
                : answerRevealed && choice === correctAnswer
                  ? 'border-amber-400 bg-amber-100 text-amber-900'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-400 hover:bg-sky-50'
            }`}>{choice}</button>
          ))}
        </div>
      )}

      {selected && selected !== correctAnswer && !flipped && <p className="mt-4 text-center text-sm font-semibold text-red-700">Not quite. Count line and space positions inclusively, then try again.</p>}
      {!flipped && <div className="mt-4 text-center"><button onClick={() => setAnswerRevealed(true)} disabled={answerRevealed} className="text-sm font-semibold text-amber-700 hover:text-amber-900 disabled:text-amber-400">{answerRevealed ? `Answer shown: ${correctAnswer}` : 'Show Answer'}</button></div>}

      {flipped && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <p className={`text-sm font-bold ${answerRevealed ? 'text-amber-700' : 'text-emerald-700'}`}>{answerRevealed ? 'Answer revealed — review the notation.' : 'Correct — interval recognized.'}</p>
          <p className="mt-1 text-xl font-bold text-emerald-900">{correctAnswer}</p>
          <p className="mt-1 text-sm text-emerald-700">
            {spelledNote(lowerDiatonic, 0)} to {spelledNote(upperDiatonic, upperAccidental)} spans {card.generic} staff positions{card.level === 'quality' ? ` and ${card.semitones} semitones` : ''}.
          </p>
        </div>
      )}
    </div>
  );
}
