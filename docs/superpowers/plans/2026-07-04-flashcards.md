# Flashcards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Flashcards section for fretboard memorization with Note cards (string+fret→note) and Interval cards (three difficulty levels).

**Architecture:** `FlashcardShell` owns all session state (deck, index, score, flip). `NoteCard` and `IntervalCard` are purely presentational receiving props. `MiniFretboard` is a compact standalone renderer used by `IntervalCard`. A new `view` state in `App.tsx` switches between the existing main content and `FlashcardShell`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Web Audio API, existing `Stave` and `musicTheory`/`audio` utils.

## Global Constraints

- No routing library — `view` state only in `App.tsx`
- MIDI numbers as canonical pitch. `GUITAR_TUNING[0]` = high e (E4=64), `[5]` = low E (E2=40)
- `playNote(freq, type?, duration?)` and `noteToFreq(midi)` from `src/lib/audio.ts` (both already async)
- `midiToNoteString(midi)` returns `{ note: string, octave: number }` from `src/lib/musicTheory.ts`
- `Stave` accepts `activeNotes: number[]` (grand staff, treble+bass)
- No test framework — verification is `npm run lint` (tsc --noEmit) + dev server visual check
- Base path `/Chord_Harmony_Quiz/` on GitHub Pages (no changes needed to vite config)

---

## File Map

| Action | Path |
|--------|------|
| Modify | `src/lib/musicTheory.ts` — add `STRING_NAMES` and `INTERVAL_NAMES` exports |
| Modify | `src/components/TheoryReference.tsx` — import `INTERVAL_NAMES` instead of local copy |
| Modify | `src/App.tsx` — add `view` state + Flashcards tab + conditional render |
| Create | `src/components/flashcards/MiniFretboard.tsx` — compact fretboard renderer |
| Create | `src/components/flashcards/NoteCard.tsx` — note flashcard (front + back) |
| Create | `src/components/flashcards/IntervalCard.tsx` — interval flashcard (3 levels) |
| Create | `src/components/flashcards/FlashcardShell.tsx` — session manager + filters |

---

### Task 1: Export INTERVAL_NAMES and STRING_NAMES from musicTheory.ts

**Files:**
- Modify: `src/lib/musicTheory.ts`
- Modify: `src/components/TheoryReference.tsx`

**Interfaces:**
- Produces: `STRING_NAMES: string[]` (index 0=high e, 5=low E), `INTERVAL_NAMES: Record<number, string>`

- [ ] **Step 1: Add exports to musicTheory.ts**

Append to the bottom of `src/lib/musicTheory.ts`:

```typescript
export const STRING_NAMES = ['e', 'B', 'G', 'D', 'A', 'E'];

export const INTERVAL_NAMES: Record<number, string> = {
  0: 'Root',
  1: 'Min 2nd',
  2: 'Maj 2nd',
  3: 'Min 3rd',
  4: 'Maj 3rd',
  5: 'Perf 4th',
  6: 'Tritone',
  7: 'Perf 5th',
  8: 'Aug 5th',
  9: 'Maj 6th',
  10: 'Min 7th',
  11: 'Maj 7th',
  12: 'Octave',
};
```

- [ ] **Step 2: Update TheoryReference.tsx to import INTERVAL_NAMES**

In `src/components/TheoryReference.tsx`:
- Remove the local `const INTERVAL_NAMES: Record<number, string> = { ... }` block (lines 5–19)
- Add `INTERVAL_NAMES` to the import from `../lib/musicTheory`

The import line becomes:
```typescript
import { CHORDS, SCALES, MODES, buildChord, buildScale, getMidiFromNoteStrAndOctave, NOTES, getNoteIndex, INTERVAL_NAMES } from '../lib/musicTheory';
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/timothykoerner/Desktop/harmony-hub && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/musicTheory.ts src/components/TheoryReference.tsx
git commit -m "feat: export INTERVAL_NAMES and STRING_NAMES from musicTheory"
```

---

### Task 2: Add Flashcards view to App.tsx

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `FlashcardShell` from `./components/flashcards/FlashcardShell` (import added now, component created in Task 6)
- Produces: `view` state switching between `'main'` and `'flashcards'`

- [ ] **Step 1: Add view state and tab navigation**

Replace the existing `App.tsx` content with:

```tsx
import React, { useState, useEffect } from 'react';
import { Music, Play } from 'lucide-react';
import { Fretboard } from './components/Fretboard';
import { Piano } from './components/Piano';
import { Stave } from './components/Stave';
import { TheoryReference, ActiveChordContext } from './components/TheoryReference';
import { CircleOfFifths } from './components/CircleOfFifths';
import { QuizModule } from './components/QuizModule';
import { FlashcardShell } from './components/flashcards/FlashcardShell';
import { findBestVoicingInWindow, FretVal } from './lib/guitarVoicings';
import { getNoteIndex, GUITAR_TUNING } from './lib/musicTheory';
import { playStrum } from './lib/audio';

type AppView = 'main' | 'flashcards';

export default function App() {
  const [view, setView] = useState<AppView>('main');
  const [activeNotes, setActiveNotes] = useState<number[]>([]);
  const [voicing, setVoicing] = useState<FretVal[] | null>(null);
  const [fretFocus, setFretFocus] = useState<number | 'all'>('all');
  const [activeChord, setActiveChord] = useState<ActiveChordContext | null>(null);

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
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Music className="w-6 h-6 text-indigo-600" />
              <h1 className="text-xl font-bold tracking-tight text-gray-900">Harmony Hub</h1>
            </div>
            <nav className="flex gap-1">
              <button
                onClick={() => setView('main')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${view === 'main' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
              >
                Learn
              </button>
              <button
                onClick={() => setView('flashcards')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${view === 'flashcards' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
              >
                Flashcards
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

      {view === 'flashcards' ? (
        <FlashcardShell />
      ) : (
        <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
          <section>
            <QuizModule
              activeNotes={activeNotes}
              onSetTargetNotes={handleNotesSelected}
              onClearNotes={clearNotes}
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
```

- [ ] **Step 2: Type-check (FlashcardShell import will fail until Task 6, that's expected)**

```bash
cd /Users/timothykoerner/Desktop/harmony-hub && npx tsc --noEmit 2>&1 | head -20
```

Expected: Only error is "Cannot find module './components/flashcards/FlashcardShell'".

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add Flashcards tab and view routing to App"
```

---

### Task 3: Create MiniFretboard component

**Files:**
- Create: `src/components/flashcards/MiniFretboard.tsx`

**Interfaces:**
- Produces: `MiniFretboard({ startString, endString, startFret, endFret, dots, onFretClick? })`, `FretDot`, `DotType`

- [ ] **Step 1: Create the component**

Create `src/components/flashcards/MiniFretboard.tsx`:

```tsx
import React from 'react';

export type DotType = 'root' | 'interval' | 'candidate' | 'user' | 'wrong';

export interface FretDot {
  stringIndex: number;
  fret: number;
  type: DotType;
}

interface MiniFretboardProps {
  startString: number;
  endString: number;
  startFret: number;
  endFret: number;
  dots: FretDot[];
  onFretClick?: (stringIndex: number, fret: number) => void;
}

const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'];

const DOT_CLASSES: Record<DotType, string> = {
  root: 'bg-indigo-600 text-white',
  interval: 'bg-amber-500 text-white',
  candidate: 'border-2 border-indigo-400 bg-white hover:bg-indigo-50 cursor-pointer',
  user: 'bg-green-500 text-white',
  wrong: 'bg-red-400 text-white',
};

export function MiniFretboard({
  startString, endString, startFret, endFret, dots, onFretClick
}: MiniFretboardProps) {
  const strings = Array.from({ length: endString - startString + 1 }, (_, i) => startString + i);
  const frets = Array.from({ length: endFret - startFret + 1 }, (_, i) => startFret + i);
  const showNut = startFret === 0;

  return (
    <div className="inline-block select-none">
      {/* Fret number header */}
      <div className="flex" style={{ marginLeft: '2rem' }}>
        {frets.map(f => (
          <div key={f} className="w-10 text-center text-xs text-gray-400">{f}</div>
        ))}
      </div>

      {strings.map(s => (
        <div key={s} className="flex items-center" style={{ height: '2.25rem' }}>
          {/* String label */}
          <span className="w-8 text-right pr-1 text-xs text-gray-500 font-mono flex-shrink-0">
            {STRING_LABELS[s]}
          </span>
          {/* Nut */}
          <div
            className="flex-shrink-0"
            style={{
              width: '4px',
              height: '100%',
              background: showNut ? '#1f2937' : '#9ca3af',
              borderRadius: showNut ? '2px' : '0',
            }}
          />
          {/* Fret cells */}
          {frets.map(f => {
            const dotHere = dots.find(d => d.stringIndex === s && d.fret === f);
            return (
              <div
                key={f}
                className="w-10 flex-shrink-0 flex items-center justify-center relative"
                style={{ height: '100%', borderRight: '1px solid #d1d5db', cursor: onFretClick ? 'pointer' : 'default' }}
                onClick={() => onFretClick?.(s, f)}
              >
                {/* String line */}
                <div
                  className="absolute inset-x-0"
                  style={{ top: '50%', height: '1px', background: '#9ca3af' }}
                />
                {dotHere ? (
                  <div
                    className={`relative z-10 flex items-center justify-center text-xs font-bold rounded-full ${DOT_CLASSES[dotHere.type]}`}
                    style={{ width: '1.6rem', height: '1.6rem' }}
                    onClick={(e) => {
                      if (dotHere.type === 'candidate' && onFretClick) {
                        e.stopPropagation();
                        onFretClick(s, f);
                      }
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      ))}

      {/* Position label when not showing nut */}
      {!showNut && (
        <div className="text-xs text-gray-400 text-center mt-1" style={{ marginLeft: '2rem' }}>
          fret {startFret}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/timothykoerner/Desktop/harmony-hub && npx tsc --noEmit 2>&1 | grep "MiniFretboard"
```
Expected: no errors mentioning MiniFretboard.

- [ ] **Step 3: Commit**

```bash
git add src/components/flashcards/MiniFretboard.tsx
git commit -m "feat: add MiniFretboard compact fretboard component"
```

---

### Task 4: Create NoteCard component

**Files:**
- Create: `src/components/flashcards/NoteCard.tsx`

**Interfaces:**
- Consumes: `GUITAR_TUNING`, `STRING_NAMES`, `midiToNoteString` (musicTheory), `playNote`, `noteToFreq` (audio), `Stave` (components/Stave)
- Produces: `NoteCard({ card, flipped, multipleChoice, onFlip, onCorrect, onIncorrect })`, `NoteCardData`

- [ ] **Step 1: Create the component**

Create `src/components/flashcards/NoteCard.tsx`:

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { GUITAR_TUNING, STRING_NAMES, midiToNoteString, NOTES } from '../../lib/musicTheory';
import { playNote, noteToFreq } from '../../lib/audio';
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
  const pool = NOTES.filter((_, i) => i !== correctPc)
    .sort(() => Math.random() - 0.5);
  return pool.slice(0, 3);
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
      playNote(noteToFreq(midi), 'sine', 1.2);
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
            onClick={() => playNote(noteToFreq(midi), 'sine', 1.2)}
            className="mt-2 px-5 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
          >
            ▶ Play
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/timothykoerner/Desktop/harmony-hub && npx tsc --noEmit 2>&1 | grep -i "notecard\|NoteCard"
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/flashcards/NoteCard.tsx
git commit -m "feat: add NoteCard flashcard component"
```

---

### Task 5: Create IntervalCard component

**Files:**
- Create: `src/components/flashcards/IntervalCard.tsx`

**Interfaces:**
- Consumes: `GUITAR_TUNING`, `STRING_NAMES`, `INTERVAL_NAMES` (musicTheory), `MiniFretboard`, `FretDot` (MiniFretboard)
- Produces: `IntervalCard({ card, level, flipped, onFlip, onCorrect, onIncorrect })`, `IntervalCardData`

- [ ] **Step 1: Create the component**

Create `src/components/flashcards/IntervalCard.tsx`:

```tsx
import React, { useMemo, useState } from 'react';
import { GUITAR_TUNING, STRING_NAMES, INTERVAL_NAMES } from '../../lib/musicTheory';
import { MiniFretboard, FretDot } from './MiniFretboard';

export interface IntervalCardData {
  rootStringIndex: number;
  rootFret: number;
  intervalSemitones: number;
  direction: 'across' | 'along';
}

interface IntervalCardProps {
  card: IntervalCardData;
  level: 1 | 2 | 3;
  flipped: boolean;
  onFlip: () => void;
  onCorrect: () => void;
  onIncorrect: () => void;
}

const ALL_INTERVAL_OPTIONS = [
  { semitones: 1, name: 'Min 2nd' },
  { semitones: 2, name: 'Maj 2nd' },
  { semitones: 3, name: 'Min 3rd' },
  { semitones: 4, name: 'Maj 3rd' },
  { semitones: 5, name: 'Perf 4th' },
  { semitones: 6, name: 'Tritone' },
  { semitones: 7, name: 'Perf 5th' },
  { semitones: 8, name: 'Aug 5th' },
  { semitones: 9, name: 'Maj 6th' },
  { semitones: 10, name: 'Min 7th' },
  { semitones: 11, name: 'Maj 7th' },
];

function findTarget(rootString: number, rootFret: number, semitones: number, direction: 'across' | 'along') {
  const targetMidi = GUITAR_TUNING[rootString] + rootFret + semitones;
  if (direction === 'along') {
    const tf = rootFret + semitones;
    return tf <= 12 ? { stringIndex: rootString, fret: tf } : null;
  }
  for (let diff = 1; diff <= 5; diff++) {
    for (const sign of [1, -1] as const) {
      const ts = rootString + diff * sign;
      if (ts < 0 || ts > 5) continue;
      const tf = targetMidi - GUITAR_TUNING[ts];
      if (tf >= 0 && tf <= 12) return { stringIndex: ts, fret: tf };
    }
  }
  return null;
}

function computeWindow(rootStr: number, rootFret: number, tgtStr: number, tgtFret: number) {
  const minStr = Math.min(rootStr, tgtStr);
  const maxStr = Math.max(rootStr, tgtStr);
  const minFret = Math.min(rootFret, tgtFret);
  const maxFret = Math.max(rootFret, tgtFret);
  return {
    startString: Math.max(0, minStr - 1),
    endString: Math.min(5, maxStr + 1),
    startFret: Math.max(0, minFret - 1),
    endFret: Math.min(12, Math.max(minFret + 5, maxFret + 1)),
  };
}

export function IntervalCard({ card, level, flipped, onFlip, onCorrect, onIncorrect }: IntervalCardProps) {
  const [l1Answer, setL1Answer] = useState<number | null>(null);
  const [l2Selected, setL2Selected] = useState<{ stringIndex: number; fret: number } | null>(null);
  const [userDot, setUserDot] = useState<{ stringIndex: number; fret: number } | null>(null);

  const target = useMemo(
    () => findTarget(card.rootStringIndex, card.rootFret, card.intervalSemitones, card.direction),
    [card]
  );

  if (!target) return null;

  const win = computeWindow(card.rootStringIndex, card.rootFret, target.stringIndex, target.fret);
  const correctName = INTERVAL_NAMES[card.intervalSemitones] ?? `${card.intervalSemitones} st`;

  const l1Options = useMemo(() => {
    const others = ALL_INTERVAL_OPTIONS
      .filter(o => o.semitones !== card.intervalSemitones)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    return [{ semitones: card.intervalSemitones, name: correctName }, ...others]
      .sort(() => Math.random() - 0.5);
  }, [card]);

  const l2Candidates = useMemo(() => {
    const correct = { stringIndex: target.stringIndex, fret: target.fret, isCorrect: true };
    const targetPc = (GUITAR_TUNING[card.rootStringIndex] + card.rootFret + card.intervalSemitones) % 12;
    const wrongs: { stringIndex: number; fret: number; isCorrect: boolean }[] = [];
    for (let s = win.startString; s <= win.endString && wrongs.length < 3; s++) {
      for (let f = win.startFret; f <= win.endFret && wrongs.length < 3; f++) {
        if (s === target.stringIndex && f === target.fret) continue;
        if (s === card.rootStringIndex && f === card.rootFret) continue;
        if ((GUITAR_TUNING[s] + f) % 12 !== targetPc) {
          wrongs.push({ stringIndex: s, fret: f, isCorrect: false });
        }
      }
    }
    return [correct, ...wrongs].sort(() => Math.random() - 0.5);
  }, [card, target, win]);

  // Build dots
  const dots: FretDot[] = [];
  if (level !== 3) {
    dots.push({ stringIndex: card.rootStringIndex, fret: card.rootFret, type: 'root' });
  }
  if (level === 1) {
    dots.push({ stringIndex: target.stringIndex, fret: target.fret, type: 'interval' });
  } else if (level === 2) {
    if (l2Selected) {
      dots.push({ stringIndex: target.stringIndex, fret: target.fret, type: 'interval' });
      if (l2Selected.stringIndex !== target.stringIndex || l2Selected.fret !== target.fret) {
        dots.push({ stringIndex: l2Selected.stringIndex, fret: l2Selected.fret, type: 'wrong' });
      }
    } else {
      l2Candidates.forEach(c => dots.push({ stringIndex: c.stringIndex, fret: c.fret, type: 'candidate' }));
    }
  } else if (level === 3) {
    if (flipped) {
      dots.push({ stringIndex: target.stringIndex, fret: target.fret, type: 'interval' });
      if (userDot && (userDot.stringIndex !== target.stringIndex || userDot.fret !== target.fret)) {
        dots.push({ stringIndex: userDot.stringIndex, fret: userDot.fret, type: 'wrong' });
      }
    } else if (userDot) {
      dots.push({ stringIndex: userDot.stringIndex, fret: userDot.fret, type: 'user' });
    }
  }

  const handleL1 = (semitones: number) => {
    setL1Answer(semitones);
    onFlip();
    if (semitones === card.intervalSemitones) onCorrect(); else onIncorrect();
  };

  const handleL2Click = (s: number, f: number) => {
    if (l2Selected) return;
    const candidate = l2Candidates.find(c => c.stringIndex === s && c.fret === f);
    if (!candidate) return;
    setL2Selected({ stringIndex: s, fret: f });
    onFlip();
    if (candidate.isCorrect) onCorrect(); else onIncorrect();
  };

  const handleL3Click = (s: number, f: number) => {
    if (flipped) return;
    setUserDot({ stringIndex: s, fret: f });
  };

  const handleL3Reveal = () => {
    if (!userDot) return;
    const correct = userDot.stringIndex === target.stringIndex && userDot.fret === target.fret;
    onFlip();
    if (correct) onCorrect(); else onIncorrect();
  };

  const l2IsCorrect = l2Selected
    ? l2Candidates.find(c => c.stringIndex === l2Selected.stringIndex && c.fret === l2Selected.fret)?.isCorrect ?? false
    : false;
  const l3IsCorrect = userDot
    ? userDot.stringIndex === target.stringIndex && userDot.fret === target.fret
    : false;

  return (
    <div className="bg-white rounded-xl border border-indigo-100 shadow-md p-6">
      {/* Question */}
      <div className="text-center mb-5">
        {level === 1 && <p className="text-sm text-gray-500">What interval is shown?</p>}
        {level === 2 && (
          <>
            <p className="text-xs text-gray-400 mb-1">Locate the…</p>
            <p className="text-xl font-bold text-indigo-700">{correctName}</p>
            <p className="text-xs text-gray-400 mt-1">from the indigo dot</p>
          </>
        )}
        {level === 3 && (
          <>
            <p className="text-sm text-gray-500 mb-1">
              Place the <span className="font-bold text-indigo-700">{correctName}</span>
            </p>
            <p className="text-xs text-gray-400">
              above {STRING_NAMES[card.rootStringIndex]} string, fret {card.rootFret}
              {' · '}{card.direction === 'across' ? 'across strings' : 'along string'}
            </p>
          </>
        )}
      </div>

      {/* Fretboard */}
      <div className="flex justify-center mb-5">
        <MiniFretboard
          startString={win.startString}
          endString={win.endString}
          startFret={win.startFret}
          endFret={win.endFret}
          dots={dots}
          onFretClick={
            level === 2 && !l2Selected ? handleL2Click
            : level === 3 && !flipped ? handleL3Click
            : undefined
          }
        />
      </div>

      {/* Level 1: MC buttons */}
      {level === 1 && !flipped && (
        <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
          {l1Options.map(opt => (
            <button
              key={opt.semitones}
              onClick={() => handleL1(opt.semitones)}
              className="py-2 px-3 rounded-lg border text-sm font-medium bg-indigo-50 border-indigo-200 text-indigo-800 hover:bg-indigo-100 transition-colors"
            >
              {opt.name}
            </button>
          ))}
        </div>
      )}

      {/* Level 3: Reveal button */}
      {level === 3 && !flipped && userDot && (
        <div className="flex justify-center">
          <button
            onClick={handleL3Reveal}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Reveal
          </button>
        </div>
      )}

      {/* Feedback banners */}
      {level === 1 && flipped && l1Answer !== null && (
        <div className={`text-center p-3 rounded-lg text-sm font-medium ${l1Answer === card.intervalSemitones ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {l1Answer === card.intervalSemitones ? '✓ ' : '✗ '}
          {correctName} · {card.intervalSemitones} semitones
        </div>
      )}
      {level === 2 && l2Selected && (
        <div className={`text-center p-3 rounded-lg text-sm font-medium mt-2 ${l2IsCorrect ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {l2IsCorrect
            ? `✓ ${STRING_NAMES[target.stringIndex]} string, fret ${target.fret}`
            : `✗ Answer: ${STRING_NAMES[target.stringIndex]} string, fret ${target.fret}`}
        </div>
      )}
      {level === 3 && flipped && userDot && (
        <div className={`text-center p-3 rounded-lg text-sm font-medium mt-2 ${l3IsCorrect ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {l3IsCorrect
            ? '✓ Correct!'
            : `✗ Answer: ${STRING_NAMES[target.stringIndex]} string, fret ${target.fret}`}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/timothykoerner/Desktop/harmony-hub && npx tsc --noEmit 2>&1 | grep -i "intervalcard\|IntervalCard"
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/flashcards/IntervalCard.tsx
git commit -m "feat: add IntervalCard with 3 difficulty levels"
```

---

### Task 6: Create FlashcardShell and wire up

**Files:**
- Create: `src/components/flashcards/FlashcardShell.tsx`

**Interfaces:**
- Consumes: `NoteCard`, `NoteCardData` (NoteCard.tsx), `IntervalCard`, `IntervalCardData` (IntervalCard.tsx), `GUITAR_TUNING`, `STRING_NAMES` (musicTheory)
- Produces: `FlashcardShell()` — no props needed (owns all session state)

- [ ] **Step 1: Create FlashcardShell.tsx**

Create `src/components/flashcards/FlashcardShell.tsx`:

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import { GUITAR_TUNING, STRING_NAMES } from '../../lib/musicTheory';
import { NoteCard, NoteCardData } from './NoteCard';
import { IntervalCard, IntervalCardData } from './IntervalCard';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateNoteDeck(strings: number[], fretStart: number, fretEnd: number): NoteCardData[] {
  const cards: NoteCardData[] = [];
  for (const s of strings) {
    for (let f = fretStart; f <= fretEnd; f++) {
      cards.push({ stringIndex: s, fret: f });
    }
  }
  return shuffle(cards);
}

function findTargetPos(rootStr: number, rootFret: number, semitones: number, dir: 'across' | 'along') {
  const targetMidi = GUITAR_TUNING[rootStr] + rootFret + semitones;
  if (dir === 'along') {
    const tf = rootFret + semitones;
    return tf <= 12 ? { stringIndex: rootStr, fret: tf } : null;
  }
  for (let diff = 1; diff <= 5; diff++) {
    for (const sign of [1, -1] as const) {
      const ts = rootStr + diff * sign;
      if (ts < 0 || ts > 5) continue;
      const tf = targetMidi - GUITAR_TUNING[ts];
      if (tf >= 0 && tf <= 12) return { stringIndex: ts, fret: tf };
    }
  }
  return null;
}

function generateIntervalDeck(
  strings: number[],
  intervals: number[],
  direction: 'across' | 'along' | 'both'
): IntervalCardData[] {
  const cards: IntervalCardData[] = [];
  const dirs: ('across' | 'along')[] = direction === 'both' ? ['across', 'along'] : [direction];
  for (const s of strings) {
    for (let f = 0; f <= 12; f++) {
      for (const sem of intervals) {
        for (const dir of dirs) {
          if (findTargetPos(s, f, sem, dir)) {
            cards.push({ rootStringIndex: s, rootFret: f, intervalSemitones: sem, direction: dir });
          }
        }
      }
    }
  }
  return shuffle(cards).slice(0, 30);
}

const ALL_STRING_INDICES = [0, 1, 2, 3, 4, 5];
const DEFAULT_INTERVALS = [3, 4, 5, 7, 9, 10];

const INTERVAL_OPTIONS = [
  { s: 1, n: 'Min 2nd' }, { s: 2, n: 'Maj 2nd' }, { s: 3, n: 'Min 3rd' },
  { s: 4, n: 'Maj 3rd' }, { s: 5, n: 'Perf 4th' }, { s: 6, n: 'Tritone' },
  { s: 7, n: 'Perf 5th' }, { s: 8, n: 'Aug 5th' }, { s: 9, n: 'Maj 6th' },
  { s: 10, n: 'Min 7th' }, { s: 11, n: 'Maj 7th' },
];

export function FlashcardShell() {
  const [cardMode, setCardMode] = useState<'note' | 'interval'>('note');
  const [showFilters, setShowFilters] = useState(false);

  // Note filters
  const [noteStrings, setNoteStrings] = useState<number[]>(ALL_STRING_INDICES);
  const [fretStart, setFretStart] = useState(0);
  const [fretEnd, setFretEnd] = useState(12);
  const [multipleChoice, setMultipleChoice] = useState(false);

  // Interval filters
  const [intLevel, setIntLevel] = useState<1 | 2 | 3>(1);
  const [intIntervals, setIntIntervals] = useState<number[]>(DEFAULT_INTERVALS);
  const [intDirection, setIntDirection] = useState<'across' | 'along' | 'both'>('across');
  const [intStrings, setIntStrings] = useState<number[]>(ALL_STRING_INDICES);

  // Session state
  const [noteDeck, setNoteDeck] = useState<NoteCardData[]>([]);
  const [intervalDeck, setIntervalDeck] = useState<IntervalCardData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [seen, setSeen] = useState(0);

  const deck: (NoteCardData | IntervalCardData)[] = cardMode === 'note' ? noteDeck : intervalDeck;

  const buildDecks = useCallback(() => {
    setNoteDeck(generateNoteDeck(noteStrings, fretStart, fretEnd));
    setIntervalDeck(generateIntervalDeck(intStrings, intIntervals, intDirection));
  }, [noteStrings, fretStart, fretEnd, intStrings, intIntervals, intDirection]);

  const restart = () => {
    buildDecks();
    setCurrentIndex(0);
    setFlipped(false);
    setCorrect(0);
    setSeen(0);
  };

  useEffect(() => { restart(); }, [cardMode]);

  const handleFlip = () => setFlipped(true);

  const handleGotIt = () => {
    setCorrect(c => c + 1);
    setSeen(s => s + 1);
    setCurrentIndex(i => i + 1);
    setFlipped(false);
  };

  const handleTryAgain = () => {
    setSeen(s => s + 1);
    if (cardMode === 'note') {
      const nd = [...noteDeck];
      const [card] = nd.splice(currentIndex, 1);
      const insertAt = Math.min(nd.length, currentIndex + 3 + Math.floor(Math.random() * 3));
      nd.splice(insertAt, 0, card);
      setNoteDeck(nd);
    } else {
      const id = [...intervalDeck];
      const [card] = id.splice(currentIndex, 1);
      const insertAt = Math.min(id.length, currentIndex + 3 + Math.floor(Math.random() * 3));
      id.splice(insertAt, 0, card);
      setIntervalDeck(id);
    }
    setFlipped(false);
  };

  const toggleString = (arr: number[], set: (v: number[]) => void, s: number) => {
    const next = arr.includes(s) ? arr.filter(x => x !== s) : [...arr, s].sort((a, b) => a - b);
    if (next.length > 0) set(next);
  };

  const toggleInterval = (s: number) => {
    const next = intIntervals.includes(s)
      ? intIntervals.filter(x => x !== s)
      : [...intIntervals, s].sort((a, b) => a - b);
    if (next.length > 0) setIntIntervals(next);
  };

  const isDone = deck.length > 0 && currentIndex >= deck.length;
  const currentCard = deck[currentIndex];

  const tabBtn = (mode: 'note' | 'interval', label: string) => (
    <button
      onClick={() => setCardMode(mode)}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${cardMode === mode ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
    >
      {label}
    </button>
  );

  const stringBtn = (arr: number[], set: (v: number[]) => void, i: number) => (
    <button
      key={i}
      onClick={() => toggleString(arr, set, i)}
      className={`w-8 h-8 rounded font-mono text-sm font-medium transition-colors ${arr.includes(i) ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-indigo-400'}`}
    >
      {STRING_NAMES[i]}
    </button>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex gap-2">
          {tabBtn('note', 'Note Cards')}
          {tabBtn('interval', 'Interval Cards')}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500 font-medium">{correct} / {seen}</span>
          <button onClick={() => setShowFilters(f => !f)} className="text-indigo-600 hover:text-indigo-800 font-medium">
            {showFilters ? 'Hide Filters ▲' : 'Filters ▼'}
          </button>
          <button onClick={restart} className="text-gray-500 hover:text-gray-800">Restart</button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
          {cardMode === 'note' ? (
            <>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Strings</p>
                <div className="flex gap-2">{ALL_STRING_INDICES.map(i => stringBtn(noteStrings, setNoteStrings, i))}</div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Fret Range</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {[{ l: '0–4', s: 0, e: 4 }, { l: '5–9', s: 5, e: 9 }, { l: '0–12', s: 0, e: 12 }].map(p => (
                    <button key={p.l} onClick={() => { setFretStart(p.s); setFretEnd(p.e); }}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${fretStart === p.s && fretEnd === p.e ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-indigo-400'}`}
                    >{p.l}</button>
                  ))}
                  <input type="number" min={0} max={11} value={fretStart}
                    onChange={e => setFretStart(Math.max(0, Math.min(11, +e.target.value)))}
                    className="w-14 border border-gray-300 rounded px-2 py-1 text-sm text-center"
                  />
                  <span className="text-gray-400">–</span>
                  <input type="number" min={1} max={12} value={fretEnd}
                    onChange={e => setFretEnd(Math.max(1, Math.min(12, +e.target.value)))}
                    className="w-14 border border-gray-300 rounded px-2 py-1 text-sm text-center"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={multipleChoice} onChange={e => setMultipleChoice(e.target.checked)} className="rounded" />
                Multiple choice mode
              </label>
            </>
          ) : (
            <>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Difficulty</p>
                <div className="flex gap-2">
                  {([1, 2, 3] as const).map(lvl => (
                    <button key={lvl} onClick={() => setIntLevel(lvl)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${intLevel === lvl ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-indigo-400'}`}
                    >
                      {lvl === 1 ? 'Identify' : lvl === 2 ? 'Locate' : 'Produce'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Intervals</p>
                <div className="flex flex-wrap gap-2">
                  {INTERVAL_OPTIONS.map(opt => (
                    <button key={opt.s} onClick={() => toggleInterval(opt.s)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${intIntervals.includes(opt.s) ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-indigo-400'}`}
                    >{opt.n}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Direction</p>
                <div className="flex gap-2">
                  {(['across', 'along', 'both'] as const).map(d => (
                    <button key={d} onClick={() => setIntDirection(d)}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${intDirection === d ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-indigo-400'}`}
                    >
                      {d === 'across' ? 'Across' : d === 'along' ? 'Along' : 'Both'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Root Strings</p>
                <div className="flex gap-2">{ALL_STRING_INDICES.map(i => stringBtn(intStrings, setIntStrings, i))}</div>
              </div>
            </>
          )}
          <button onClick={restart} className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 transition-colors">
            Apply & Restart
          </button>
        </div>
      )}

      {/* Card area */}
      {isDone ? (
        <div className="text-center py-16">
          <p className="text-2xl font-bold text-indigo-700 mb-2">Session Complete!</p>
          <p className="text-gray-500 mb-6">{correct} / {seen} correct</p>
          <button onClick={restart} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">
            Restart
          </button>
        </div>
      ) : deck.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No cards match your filters.</div>
      ) : currentCard ? (
        <div>
          <p className="text-xs text-gray-400 text-right mb-2">{currentIndex + 1} / {deck.length}</p>
          {cardMode === 'note' ? (
            <NoteCard
              key={currentIndex}
              card={currentCard as NoteCardData}
              flipped={flipped}
              multipleChoice={multipleChoice}
              onFlip={handleFlip}
              onCorrect={() => {}}
              onIncorrect={() => {}}
            />
          ) : (
            <IntervalCard
              key={currentIndex}
              card={currentCard as IntervalCardData}
              level={intLevel}
              flipped={flipped}
              onFlip={handleFlip}
              onCorrect={() => {}}
              onIncorrect={() => {}}
            />
          )}
          {flipped && (
            <div className="flex justify-center gap-4 mt-6">
              <button onClick={handleTryAgain}
                className="px-6 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg font-medium hover:bg-red-100 transition-colors"
              >
                Try Again
              </button>
              <button onClick={handleGotIt}
                className="px-6 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg font-medium hover:bg-green-100 transition-colors"
              >
                Got It ✓
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Type-check — all files should pass now**

```bash
cd /Users/timothykoerner/Desktop/harmony-hub && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Start dev server and verify visually**

```bash
cd /Users/timothykoerner/Desktop/harmony-hub && npm run dev
```

Verify:
- "Flashcards" tab appears in header
- Note Cards tab: cards show string+fret on front, note+stave+play on back
- Multiple choice mode shows 4 note buttons on front
- Interval Cards: Level 1 shows both dots + MC; Level 2 shows root + ghost candidates; Level 3 shows blank + click to place
- Got It / Try Again buttons appear after flip
- Score counter increments correctly
- Filter panel toggles and Apply & Restart rebuilds the deck

- [ ] **Step 4: Commit**

```bash
git add src/components/flashcards/FlashcardShell.tsx
git commit -m "feat: add FlashcardShell session manager with filters and deck logic"
```

---

### Task 7: Push to GitHub

- [ ] **Step 1: Verify all changes are committed**

```bash
git status
```
Expected: clean working tree.

- [ ] **Step 2: Push**

```bash
git push
```

- [ ] **Step 3: Confirm GitHub Pages builds successfully**

Check `https://timothy815.github.io/Chord_Harmony_Quiz/` after Actions workflow completes (~2 min).
