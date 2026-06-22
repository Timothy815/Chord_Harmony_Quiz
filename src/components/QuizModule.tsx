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
  const [allowedChordTypes, setAllowedChordTypes] = useState<string[]>(Object.keys(CHORDS));
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const toggleChordType = (type: string) => {
    setAllowedChordTypes(prev => {
      if (prev.includes(type)) {
        // Prevent unchecking the last type
        if (prev.length === 1) return prev;
        return prev.filter(t => t !== type);
      }
      return [...prev, type];
    });
  };

  const updateTargetNotesForCustom = (root: string, type: string) => {
     onClearNotes();
     setFeedback(null);
     setHasGuessed(false);
     const scaleDef = (CHORDS as any)[type];
     const intervals = scaleDef.intervals;
     const midis = intervals.map((interval: number) => getMidiFromNoteStrAndOctave(root, 4) + interval);
     setTargetNotesMidi(midis);
  };

  const generateNewQuiz = () => {
    onClearNotes();
    setFeedback(null);
    setHasGuessed(false);
    const roots = NOTES.slice(0, 12);
    const randomRoot = roots[Math.floor(Math.random() * roots.length)];
    const chordTypes = allowedChordTypes.length > 0 ? allowedChordTypes : Object.keys(CHORDS);
    const randomType = chordTypes[Math.floor(Math.random() * chordTypes.length)];
    
    setTargetChord({ root: randomRoot, chord: randomType });
    
    const scaleDef = (CHORDS as any)[randomType];
    const intervals = scaleDef.intervals;
    const midis = intervals.map((interval: number) => getMidiFromNoteStrAndOctave(randomRoot, 4) + interval);
    setTargetNotesMidi(midis);
    
    const targetChordFull = `${randomRoot} ${randomType}`;
    const optionsSet = new Set<string>();
    optionsSet.add(targetChordFull);
    
    // Create pool of possible answers from allowed types
    let attempts = 0;
    while (optionsSet.size < Math.min(4, roots.length * chordTypes.length) && attempts < 50) {
       const rType = chordTypes[Math.floor(Math.random() * chordTypes.length)];
       const rRoot = roots[Math.floor(Math.random() * roots.length)];
       
       // Avoid adding enharmonically equivalent symmetrical chords (Augmented, Diminished7) as wrong answers
       const isSymTarget = randomType === 'Augmented' || randomType === 'Diminished7';
       const isSymGuess = rType === 'Augmented' || rType === 'Diminished7';
       
       let isEquivalent = false;
       if (isSymTarget && isSymGuess && randomType === rType) {
         const targetScaleDef = (CHORDS as any)[randomType];
         const guessScaleDef = (CHORDS as any)[rType];
         const tPcs = targetScaleDef.intervals.map((i: number) => (getNoteIndex(randomRoot) + i) % 12).sort();
         const gPcs = guessScaleDef.intervals.map((i: number) => (getNoteIndex(rRoot) + i) % 12).sort();
         if (tPcs.every((val: number, idx: number) => val === gPcs[idx])) {
           isEquivalent = true;
         }
       }

       if (!isEquivalent) {
         optionsSet.add(`${rRoot} ${rType}`);
       }
       attempts++;
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
      // Check if it's the exact root inversion based on lowest note
      const lowestMidi = Math.min(...activeNotes);
      const isRootPosition = (lowestMidi % 12) === (targetNotesMidi[0] % 12);
      
      if (isRootPosition) {
        setFeedback("Correct! You built the chord.");
      } else {
        setFeedback("Correct! You built the chord. (Note: You played an inversion, as the root isn't the lowest note.)");
      }
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
        <h2 className="text-xl font-bold tracking-tight text-indigo-900 flex items-center gap-2">
           Practice & Quiz
           <button 
             onClick={() => setShowSettings(!showSettings)}
             className="text-gray-400 hover:text-indigo-600 transition-colors p-1"
             title="Settings"
           >
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
           </button>
        </h2>
        <select 
          value={quizType}
          onChange={e => setQuizType(e.target.value as any)}
          className="px-3 py-1.5 border border-indigo-200 rounded text-sm bg-white text-indigo-900"
        >
          <option value="identify_chord">Identify this Chord visually/audibly</option>
          <option value="build_chord">Build this Chord on instruments</option>
        </select>
      </div>

      {showSettings && (
        <div className="mb-4 p-4 bg-white rounded border border-indigo-100 shadow-inner">
           <h3 className="text-sm font-semibold text-gray-700 mb-2">Allowed Chord Types</h3>
           <div className="flex flex-wrap gap-2">
             {Object.keys(CHORDS).map(type => (
               <label key={type} className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
                 <input 
                   type="checkbox" 
                   checked={allowedChordTypes.includes(type)}
                   onChange={() => toggleChordType(type)}
                   className="rounded text-indigo-600 focus:ring-indigo-500"
                 />
                 {(CHORDS as any)[type].abbr ? `${type} (${(CHORDS as any)[type].abbr})` : type}
               </label>
             ))}
           </div>
           <p className="text-xs text-gray-400 mt-2">Changes will apply to the next question generated.</p>
        </div>
      )}

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
                <div className="flex justify-center items-center gap-2 my-4">
                  <select 
                    value={targetChord.root}
                    onChange={(e) => {
                      const newRoot = e.target.value;
                      setTargetChord({ ...targetChord, root: newRoot });
                      updateTargetNotesForCustom(newRoot, targetChord.chord);
                    }}
                    className="text-3xl font-bold text-indigo-600 bg-transparent border-b-2 border-transparent hover:border-indigo-200 focus:outline-none focus:border-indigo-600 pb-1 cursor-pointer cursor-pointer text-center appearance-none text-right"
                    style={{ textAlignLast: 'right' }}
                  >
                    {NOTES.slice(0, 12).map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <select
                    value={targetChord.chord}
                    onChange={(e) => {
                       const newType = e.target.value;
                       setTargetChord({ ...targetChord, chord: newType });
                       updateTargetNotesForCustom(targetChord.root, newType);
                    }}
                    className="text-3xl font-bold text-indigo-600 bg-transparent border-b-2 border-transparent hover:border-indigo-200 focus:outline-none focus:border-indigo-600 pb-1 cursor-pointer cursor-pointer appearance-none"
                  >
                    {Object.keys(CHORDS).map(c => <option key={c} value={c}>{(CHORDS as any)[c].abbr || c}</option>)}
                  </select>
                </div>
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

