import React, { useState, useEffect } from 'react';
import { NOTES, CHORDS, buildChord, SCALES, buildScale, getMidiFromNoteStrAndOctave, getNoteIndex } from '../lib/musicTheory';

interface QuizModuleProps {
  activeNotes: number[];
  onSetTargetNotes: (midis: number[], context?: any) => void;
  onClearNotes: () => void;
}

export function QuizModule({ activeNotes, onSetTargetNotes, onClearNotes }: QuizModuleProps) {
  const [quizType, setQuizType] = useState<'identify_chord' | 'build_chord'>('identify_chord');
  const [targetChord, setTargetChord] = useState<{ root: string, chord: string } | null>(null);
  const [targetNotesMidi, setTargetNotesMidi] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [hasGuessed, setHasGuessed] = useState<boolean>(false);

  const generateNewQuiz = () => {
    onClearNotes();
    setFeedback(null);
    setHasGuessed(false);
    const roots = NOTES.slice(0, 12);
    const randomRoot = roots[Math.floor(Math.random() * roots.length)];
    const chordTypes = Object.keys(CHORDS);
    const randomType = chordTypes[Math.floor(Math.random() * chordTypes.length)];
    
    setTargetChord({ root: randomRoot, chord: randomType });
    
    const scaleDef = (CHORDS as any)[randomType];
    const intervals = scaleDef.intervals;
    const midis = intervals.map((interval: number) => getMidiFromNoteStrAndOctave(randomRoot, 4) + interval);
    setTargetNotesMidi(midis);
    
    const targetChordFull = `${randomRoot} ${randomType}`;
    const optionsSet = new Set<string>();
    optionsSet.add(targetChordFull);
    while (optionsSet.size < 4) {
       const rType = chordTypes[Math.floor(Math.random() * chordTypes.length)];
       const rRoot = roots[Math.floor(Math.random() * roots.length)];
       optionsSet.add(`${rRoot} ${rType}`);
    }
    const shuffledOptions = Array.from(optionsSet).sort(() => Math.random() - 0.5);
    setOptions(shuffledOptions);

    if (quizType === 'identify_chord') {
      onSetTargetNotes(midis, {
        rootNote: randomRoot,
        type: randomType,
        intervals: intervals,
        hideLabel: true
      });
    }
  };

  useEffect(() => {
    generateNewQuiz();
  }, [quizType]);

  const checkBuildChord = () => {
    if (!targetNotesMidi.length || activeNotes.length === 0) return;
    
    const targetPitchClasses = [...new Set(targetNotesMidi.map(n => n % 12))].sort((a: number, b: number) => a - b);
    const activePitchClasses = [...new Set(activeNotes.map(n => n % 12))].sort((a: number, b: number) => a - b);
    
    if (targetPitchClasses.length === activePitchClasses.length && targetPitchClasses.every((v, i) => v === activePitchClasses[i])) {
      setFeedback("Correct! You built the chord.");
      setHasGuessed(true);
    } else {
      setFeedback("Not quite. You can keep trying, or click 'Show Answer'.");
      setHasGuessed(true);
    }
  };

  const showBuildAnswer = () => {
     if (targetChord) {
       const scaleDef = (CHORDS as any)[targetChord.chord];
       onSetTargetNotes(targetNotesMidi, {
         rootNote: targetChord.root,
         type: targetChord.chord,
         intervals: scaleDef.intervals
       });
     }
  };

  return (
    <div className="bg-indigo-50 p-6 rounded-lg shadow-sm border border-indigo-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold tracking-tight text-indigo-900">Practice & Quiz</h2>
        <select 
          value={quizType}
          onChange={e => setQuizType(e.target.value as any)}
          className="px-3 py-1.5 border border-indigo-200 rounded text-sm bg-white text-indigo-900"
        >
          <option value="identify_chord">Identify this Chord visually/audibly</option>
          <option value="build_chord">Build this Chord on instruments</option>
        </select>
      </div>

      <div className="bg-white p-6 rounded text-center border border-indigo-100">
        {targetChord && (
          <>
            {quizType === 'identify_chord' ? (
              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">What chord is currently displayed on the instruments?</p>
                <div className="flex justify-center gap-2 mt-4 flex-wrap">
                  {options.map(guess => (
                    <button 
                      key={guess}
                      disabled={hasGuessed}
                      onClick={() => {
                          setHasGuessed(true);
                          if (guess === `${targetChord.root} ${targetChord.chord}`) {
                              setFeedback("Correct! Well done.");
                          } else {
                              setFeedback(`Incorrect. The correct answer was ${targetChord.root} ${targetChord.chord}.`);
                          }
                          // Reveal the label
                          const scaleDef = (CHORDS as any)[targetChord.chord];
                          onSetTargetNotes(targetNotesMidi, {
                            rootNote: targetChord.root,
                            type: targetChord.chord,
                            intervals: scaleDef.intervals,
                            hideLabel: false
                          });
                      }}
                      className="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 disabled:opacity-50 text-indigo-800 rounded text-sm font-medium transition-colors"
                    >
                      {guess}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">Select keys/frets/notes to build this chord:</p>
                <h3 className="text-3xl font-bold text-indigo-600 my-4">
                  {targetChord.root} {(CHORDS as any)[targetChord.chord].abbr || 'Major'}
                </h3>
                <p className="text-xs text-gray-400 mb-4">{(CHORDS as any)[targetChord.chord].intervals.join(', ')}</p>
                <div className="flex justify-center gap-2">
                  <button 
                    onClick={checkBuildChord}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium shadow-sm transition-colors"
                  >
                    Check Answer
                  </button>
                  {hasGuessed && feedback && !feedback.includes("Correct") && (
                     <button
                        onClick={showBuildAnswer}
                        className="px-6 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded font-medium shadow-sm transition-colors"
                     >
                       Show Answer
                     </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
        
        {feedback && (
          <div className={`mt-4 p-3 rounded font-medium ${feedback.includes('Correct') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {feedback}
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <button 
          onClick={generateNewQuiz}
          className="px-4 py-2 text-sm text-indigo-600 font-medium hover:bg-indigo-100 rounded transition-colors"
        >
          Next Question &rarr;
        </button>
      </div>
    </div>
  );
}

