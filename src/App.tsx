import React, { useState, useEffect } from 'react';
import { Music, Play } from 'lucide-react';
import { Fretboard } from './components/Fretboard';
import { Piano } from './components/Piano';
import { Stave } from './components/Stave';
import { TheoryReference, ActiveChordContext } from './components/TheoryReference';
import { QuizModule } from './components/QuizModule';
import { findBestVoicingInWindow, FretVal } from './lib/guitarVoicings';
import { getNoteIndex, GUITAR_TUNING } from './lib/musicTheory';
import { playStrum } from './lib/audio';

export default function App() {
  const [activeNotes, setActiveNotes] = useState<number[]>([]);
  const [voicing, setVoicing] = useState<FretVal[] | null>(null);
  const [fretFocus, setFretFocus] = useState<number | 'all'>('all');
  const [activeChord, setActiveChord] = useState<ActiveChordContext | null>(null);

  const applyAutoVoicing = (chord: ActiveChordContext, focus: number | 'all') => {
    if (focus === 'all' || chord.isScale) {
       setVoicing(null);
       return;
    }
    
    const rootClass = getNoteIndex(chord.rootNote);
    const pitchClasses = chord.intervals.map(i => (rootClass + i) % 12);
    
    // Create a 4 fret window based on the focus selection, ensuring it fits bounds
    const startFret = Math.max(1, focus - 1);
    const endFret = Math.max(startFret + 3, focus + 2); // usually 4 frets wide search area
    
    const optimalVoicing = findBestVoicingInWindow(pitchClasses, rootClass, startFret, endFret);
    if (optimalVoicing) {
        handleVoicingSelected(optimalVoicing);
    } else {
        setVoicing(null); // Fallback to raw notes if no neat voicing found
    }
  };

  useEffect(() => {
    if (activeChord && !activeChord.isScale && fretFocus !== 'all') {
      applyAutoVoicing(activeChord, fretFocus as number);
    }
  }, [fretFocus]);

  const handleNoteClick = (midi: number) => {
    setVoicing(null);
    setActiveChord(null);
    setActiveNotes(prev => {
      if (prev.includes(midi)) return prev.filter(n => n !== midi);
      return [...prev, midi].sort((a, b) => a - b);
    });
  };

  const handleNotesSelected = (midis: number[], chordContext?: ActiveChordContext) => {
    setActiveNotes(midis);
    setActiveChord(chordContext || null);
    
    if (chordContext && fretFocus !== 'all') {
        applyAutoVoicing(chordContext, fretFocus as number);
    } else {
        setVoicing(null);
    }
  };

  const handleVoicingSelected = (newVoicing: FretVal[]) => {
    setVoicing(newVoicing);
    
    const midis: number[] = [];
    newVoicing.forEach((val, idx) => {
      if (val !== 'x') {
        midis.push(GUITAR_TUNING[idx] + (val as number));
      }
    });
    
    setActiveNotes(Array.from(new Set(midis)).sort((a, b) => a - b));
  };

  const clearNotes = () => {
    setActiveNotes([]);
    setVoicing(null);
    setActiveChord(null);
  };

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
      const freqs = midisToPlay.map(m => 440 * Math.pow(2, (m - 69) / 12));
      playStrum(freqs, 2.5, 0.04);
    }
  };

  const activeFocusStart = fretFocus === 'all' ? 1 : Math.max(1, (fretFocus as number) - 1);
  const activeFocusEnd = fretFocus === 'all' ? 18 : activeFocusStart + 4; // 5 frets wide display window

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="w-6 h-6 text-indigo-600" />
            <h1 className="text-xl font-bold tracking-tight text-gray-900">Harmony Hub</h1>
          </div>
          <div className="flex gap-4 items-center">
            {/* Position Fret Selector Component */}
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 border border-gray-200 rounded">
                <span className="text-sm text-gray-600 font-medium">Guitar Position:</span>
                <select 
                    value={fretFocus}
                    onChange={(e) => setFretFocus(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    className="bg-white border border-gray-300 rounded text-sm text-indigo-900 px-2 py-0.5 outline-none font-medium"
                >
                    <option value="all">Full Fretboard</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(f => (
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
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        
        {/* Quiz Module */}
        <section>
          <QuizModule 
            activeNotes={activeNotes} 
            onSetTargetNotes={handleNotesSelected} 
            onClearNotes={clearNotes} 
          />
        </section>

        {/* Visualizers Container */}
        <section className="space-y-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col">
                  <h2 className="text-lg font-semibold tracking-tight text-indigo-700 flex items-center gap-2">
                    Fretboard View
                    {voicing && activeChord && (
                        <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5 rounded-full font-medium">
                          Auto-Voiced: {activeChord.rootNote} {activeChord.type}
                        </span>
                    )}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                      {fretFocus !== 'all' ? `Focused on frets ${activeFocusStart}-${activeFocusEnd}. Chords are auto-voiced to this position.` : 'Showing all matched pitches across the neck.'}
                  </p>
              </div>
              <button 
                onClick={strumnotes}
                className="flex items-center gap-1.5 text-sm font-medium bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded hover:bg-indigo-100 transition-colors shadow-sm"
                title="Strum Current Notes"
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

        {/* Theory & Logic */}
        <section>
          <TheoryReference 
            onNotesSelected={handleNotesSelected} 
            onVoicingSelected={handleVoicingSelected}
          />
        </section>
        
      </main>
    </div>
  );
}
