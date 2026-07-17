import React, { useState } from 'react';
import { IntervalAttemptResult, scoreIntervalAttempt } from '../../lib/intervalScoring';
import {
  formulasForCategory,
  THEORY_FORMULAS,
  TheoryFormulaCategory,
} from '../../lib/theoryFormulas';

export interface TheoryFormulaCardData {
  category: TheoryFormulaCategory;
  formulaId: string;
  direction: 'name-to-formula' | 'formula-to-name';
}

interface TheoryFormulaCardProps {
  card: TheoryFormulaCardData;
  flipped: boolean;
  onFlip: () => void;
  onCorrect: (result: IntervalAttemptResult) => void;
  onIncorrect: () => void;
}

const CATEGORY_LABELS: Record<TheoryFormulaCategory, string> = {
  scale: 'Scale pattern',
  mode: 'Mode pattern',
  chord: 'Chord formula',
};

export function TheoryFormulaCard({
  card,
  flipped,
  onFlip,
  onCorrect,
  onIncorrect,
}: TheoryFormulaCardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const formula = THEORY_FORMULAS.find(item =>
    item.category === card.category && item.id === card.formulaId
  );
  if (!formula) return null;

  const choices = formulasForCategory(card.category);
  const correctValue = card.direction === 'name-to-formula' ? formula.formula : formula.id;
  const choose = (value: string) => {
    if (flipped) return;
    setSelected(value);
    if (value === correctValue) {
      const result = scoreIntervalAttempt(mistakes, false, false, answerRevealed);
      onFlip();
      onCorrect(result);
    } else {
      setMistakes(count => count + 1);
      onIncorrect();
    }
  };

  return (
    <div className="rounded-2xl border border-amber-100 bg-white p-6 shadow-md">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
          {CATEGORY_LABELS[card.category]}
        </p>
        <p className="mt-5 text-sm text-slate-500">
          {card.direction === 'name-to-formula' ? 'What is the formula for' : 'Which type matches this formula?'}
        </p>
        <p className={`mt-2 font-bold text-slate-950 ${
          card.direction === 'name-to-formula' ? 'text-4xl' : 'font-mono text-3xl tracking-wider'
        }`}>
          {card.direction === 'name-to-formula' ? formula.name : formula.formula}
        </p>
        {card.category === 'chord' && card.direction === 'formula-to-name' && (
          <p className="mt-2 text-xs text-slate-400">Semitones measured from the root</p>
        )}
      </div>

      {!flipped && (
        <div className="mx-auto mt-7 grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-3">
          {choices.map(choice => {
            const value = card.direction === 'name-to-formula' ? choice.formula : choice.id;
            const label = card.direction === 'name-to-formula' ? choice.formula : choice.name;
            const isLastWrong = selected === value && value !== correctValue;
            return (
              <button
                key={choice.id}
                onClick={() => choose(value)}
                className={`min-h-12 rounded-lg border px-2 py-2 text-sm font-semibold transition-colors ${
                  isLastWrong
                    ? 'border-red-300 bg-red-50 text-red-700'
                    : answerRevealed && value === correctValue
                      ? 'border-amber-400 bg-amber-100 text-amber-900'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-amber-400 hover:bg-amber-50'
                } ${card.direction === 'name-to-formula' ? 'font-mono' : ''}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {selected !== null && !flipped && selected !== correctValue && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-center text-sm font-medium text-red-800">
          Not quite. Compare the distances from the root and try again.
        </div>
      )}

      {!flipped && (
        <div className="mt-4 text-center">
          <button onClick={() => setAnswerRevealed(true)} disabled={answerRevealed} className="text-sm font-semibold text-amber-700 hover:text-amber-900 disabled:text-amber-400">
            {answerRevealed ? `Answer shown: ${formula.name} — ${formula.formula}` : 'Show Answer'}
          </button>
        </div>
      )}

      {flipped && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <p className={`mb-1 text-sm font-bold ${answerRevealed ? 'text-amber-700' : 'text-emerald-700'}`}>{answerRevealed ? 'Answer revealed — review the formula.' : 'Correct — formula recalled.'}</p>
          <p className="text-lg font-bold text-emerald-800">{formula.name}: {formula.formula}</p>
          <p className="mt-1 text-sm text-emerald-700">{formula.description}</p>
        </div>
      )}
    </div>
  );
}
