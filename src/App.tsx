import React, { useState, useEffect } from 'react';
import { BarChart3, Music, Play } from 'lucide-react';
import { Fretboard } from './components/Fretboard';
import { Piano } from './components/Piano';
import { Stave } from './components/Stave';
import { TheoryReference, ActiveChordContext } from './components/TheoryReference';
import { CircleOfFifths } from './components/CircleOfFifths';
import { QuizModule } from './components/QuizModule';
import { FlashcardShell } from './components/flashcards/FlashcardShell';
import { FretboardTrainer } from './components/FretboardTrainer';
import { ProgressDashboard } from './components/ProgressDashboard';
import { findBestVoicingInWindow, FretVal } from './lib/guitarVoicings';
import { getNoteIndex, GUITAR_TUNING } from './lib/musicTheory';
import { playStrum } from './lib/audio';
import type { PracticeTarget } from './lib/analytics';

type AppView = 'main' | 'flashcards' | 'trainer' | 'progress';

export default function App() {
  const [view, setView] = useState<AppView>('main');
  const [activeNotes, setActiveNotes] = useState<number[]>([]);
  const [voicing, setVoicing] = useState<FretVal[] | null>(null);
  const [fretFocus, setFretFocus] = useState<number | 'all'>('all');
  const [activeChord, setActiveChord] = useState<ActiveChordContext | null>(null);
  const [practiceTarget, setPracticeTarget] = useState<PracticeTarget | undefined>();
  const [flashcardSessionId, setFlashcardSessionId] = useState(0);

  const openView = (nextView: AppView) => {
    setPracticeTarget(undefined);
    setView(nextView);
  };

  const practiceSkill = (target: PracticeTarget) => {
    setPracticeTarget(target);
    if (target.module !== 'Fretboard Trainer' && target.module !== 'Chord Quiz') {
      setFlashcardSessionId(id => id + 1);
    }
    setView(target.module === 'Fretboard Trainer'
      ? 'trainer'
      : target.module === 'Chord Quiz' ? 'main' : 'flashcards');
  };

  const applyAutoVoicing = (midis: number[], chord: ActiveChordContext | null, focus: number | 'all') => {
    if (midis.length === 0) { setVoicing(null); return; }
    if (chord && chord.isScale) { setVoicing(null); return; }
    const pitchClasses = Array.from(new Set(midis.map(m => m % 12)));
    const rootClass = chord ? getNoteIndex(chord.rootNote) : null;
    let startFret = 1;
    let endFret = 5;
    if (focus !== 'all') {
      startFret = Math.max(1, focus - 1);
      endFret = Math.max(startFret + 3, focus + 2);
    }
    if (pitchClasses.length < 3 && !chord) { setVoicing(null); return; }
    let optimalVoicing = findBestVoicingInWindow(pitchClasses, rootClass, startFret, endFret);
    if (!optimalVoicing && focus === 'all') {
      optimalVoicing = findBestVoicingInWindow(pitchClasses, rootClass, 1, 15);
    }
    setVoicing(optimalVoicing ?? null);
  };

  useEffect(() => { applyAutoVoicing(activeNotes, activeChord, fretFocus); }, [fretFocus]);

  const handleNoteClick = (midi: number) => {
    setActiveChord(null);
    const updatedNotes = activeNotes.includes(midi)
      ? activeNotes.filter(n => n !== midi)
      : [...activeNotes, midi].sort((a, b) => a - b);
    setActiveNotes(updatedNotes);
    applyAutoVoicing(updatedNotes, null, fretFocus);
  };

  const handleNotesSelected = (midis: number[], chordContext?: ActiveChordContext) => {
    setActiveNotes(midis);
    setActiveChord(chordContext || null);
    applyAutoVoicing(midis, chordContext || null, fretFocus);
  };

  const handleVoicingSelected = (newVoicing: FretVal[]) => {
    setVoicing(newVoicing);
    const midis: number[] = [];
    newVoicing.forEach((val, idx) => {
      if (val !== 'x') midis.push(GUITAR_TUNING[idx] + (val as number));
    });
    setActiveNotes(Array.from(new Set(midis)).sort((a, b) => a - b));
  };

  const clearNotes = () => { setActiveNotes([]); setVoicing(null); setActiveChord(null); };

  const strumnotes = () => {
    let midisToPlay: number[] = [];
    if (voicing) {
      for (let i = 5; i >= 0; i--) {
        if (voicing[i] !== 'x') midisToPlay.push(GUITAR_TUNING[i] + (voicing[i] as number));
      }
    } else {
      midisToPlay = activeNotes;
    }
    if (midisToPlay.length > 0) {
      playStrum(midisToPlay.map(m => 440 * Math.pow(2, (m - 69) / 12)), 2.5, 0.04);
    }
  };

  const activeFocusStart = fretFocus === 'all' ? 1 : Math.max(1, (fretFocus as number) - 1);
  const activeFocusEnd = fretFocus === 'all' ? 18 : activeFocusStart + 4;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 min-h-16 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-6">
            <div className="flex items-center gap-2">
              <Music className="w-6 h-6 text-indigo-600" />
              <h1 className="hidden text-xl font-bold tracking-tight text-gray-900 sm:block">Harmony Hub</h1>
            </div>
            <nav className="flex gap-1">
              <button
                onClick={() => openView('main')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${view === 'main' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
              >
                Learn
              </button>
              <button
                onClick={() => openView('flashcards')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${view === 'flashcards' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
              >
                Flashcards
              </button>
              <button
                onClick={() => openView('trainer')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${view === 'trainer' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
              >
                Trainer
              </button>
              <button
                onClick={() => openView('progress')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${view === 'progress' ? 'bg-teal-700 text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Progress
              </button>
            </nav>
          </div>
          {view === 'main' && (
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 border border-gray-200 rounded">
                <span className="text-sm text-gray-600 font-medium">Guitar Position:</span>
                <select
                  value={fretFocus}
                  onChange={(e) => setFretFocus(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="bg-white border border-gray-300 rounded text-sm text-indigo-900 px-2 py-0.5 outline-none font-medium"
                >
                  <option value="all">Full Fretboard</option>
                  {[1,2,3,4,5,6,7,8,9,10,11,12,13,14].map(f => (
                    <option key={f} value={f}>Position {f}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={clearNotes}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
              >
                Clear Notes
              </button>
            </div>
          )}
        </div>
      </header>

      <div className={view === 'flashcards' ? '' : 'hidden'}>
        <FlashcardShell
          key={flashcardSessionId}
          practiceTarget={practiceTarget}
          active={view === 'flashcards'}
        />
      </div>

      {view === 'flashcards' ? null : view === 'trainer' ? (
        <FretboardTrainer practiceTarget={practiceTarget} />
      ) : view === 'progress' ? (
        <ProgressDashboard onPracticeSkill={practiceSkill} />
      ) : (
        <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
          <section>
            <QuizModule
              activeNotes={activeNotes}
              onSetTargetNotes={handleNotesSelected}
              onClearNotes={clearNotes}
              practiceTarget={practiceTarget}
            />
          </section>
          <section className="space-y-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col">
                  <h2 className="text-lg font-semibold tracking-tight text-indigo-700 flex items-center gap-2">
                    Fretboard View
                    {voicing && activeChord && !activeChord.hideLabel && (
                      <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5 rounded-full font-medium">
                        Auto-Voiced: {activeChord.rootNote} {activeChord.type}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    {fretFocus !== 'all'
                      ? `Focused on frets ${activeFocusStart}-${activeFocusEnd}. Chords are auto-voiced to this position.`
                      : voicing ? 'Auto-voiced in open or low position. Select a specific position to voice elsewhere.' : 'Showing all matched pitches across the neck.'}
                  </p>
                </div>
                <button
                  onClick={strumnotes}
                  className="flex items-center gap-1.5 text-sm font-medium bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded hover:bg-indigo-100 transition-colors shadow-sm"
                >
                  <Play className="w-4 h-4 fill-indigo-700" /> Strum Chord
                </button>
              </div>
              <Fretboard
                activeNotes={activeNotes}
                voicing={voicing}
                onChangeVoicing={handleVoicingSelected}
                startFret={activeFocusStart}
                endFret={activeFocusEnd}
              />
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold tracking-tight text-indigo-700 mb-4">Keyboard</h2>
              <Piano activeNotes={activeNotes} onNoteClick={handleNoteClick} />
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold tracking-tight text-indigo-700 mb-4">Musical Stave</h2>
              <Stave activeNotes={activeNotes} />
              <p className="text-center text-xs text-gray-500 mt-2">Displaying treble clef relative positions. Pitch outside standard range may not render accurately.</p>
            </div>
          </section>
          <section className="space-y-8">
            <CircleOfFifths onNotesSelected={handleNotesSelected} />
            <TheoryReference
              onNotesSelected={handleNotesSelected}
              onVoicingSelected={handleVoicingSelected}
            />
          </section>
        </main>
      )}
    </div>
  );
}
