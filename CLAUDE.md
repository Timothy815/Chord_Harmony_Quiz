# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install dependencies
npm run dev          # start dev server at http://localhost:3000
npm run build        # production build (Vite)
npm run lint         # type-check only (tsc --noEmit — no eslint configured)
npm run clean        # remove dist/ and server.js
```

No test framework is configured. Type checking via `npm run lint` is the primary static verification step.

## Environment

Requires a `.env.local` file (not committed) with:
```
GEMINI_API_KEY=your_key_here
```

The app has `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` declared in `metadata.json`, but the current codebase does not implement a backend server — `GEMINI_API_KEY` is referenced in `.env.example` for future use. Vite serves the app as a pure client-side SPA.

## Architecture

**Stack:** React 19 + TypeScript + Vite + Tailwind CSS v4 (via `@tailwindcss/vite`). No routing library — single-page app with a single `App.tsx` root.

**State lives entirely in `App.tsx`** and flows down via props. There is no global state manager, context, or store. The two core pieces of shared state are:

- `activeNotes: number[]` — MIDI note numbers currently selected/active across all visualizers
- `voicing: FretVal[] | null` — guitar voicing (one fret value per string, or `'x'` for muted) derived from active notes

**Data flow pattern:**
1. User interacts with any component (Piano click, TheoryReference chord selection, CircleOfFifths, QuizModule, or Fretboard)
2. Component calls a callback prop (`onNoteClick`, `onNotesSelected`, or `onVoicingSelected`)
3. `App.tsx` updates `activeNotes` and runs `applyAutoVoicing()` to derive the best guitar voicing
4. All visualizers re-render with the new shared state

**Music theory domain (`src/lib/musicTheory.ts`):**
- All pitch representations use MIDI numbers (integers) as the canonical format
- `NOTES` is a 12-element array indexed by pitch class (0=C, 1=C#, …, 11=B)
- `GUITAR_TUNING` is an array of 6 MIDI values for standard tuning, indexed 0=high e, 5=low E (reversed from physical left-to-right tab notation)
- `getNoteIndex()` handles both sharp names (`C#`) and flat aliases (`Db`, `Eb`, `Gb`, `Ab`, `Bb`)

**Guitar voicings (`src/lib/guitarVoicings.ts`):**
- `FretVal = number | 'x'` — a fret number (0 = open string) or muted
- `findBestVoicingInWindow()` does brute-force search over all string/fret combinations and scores each candidate voicing via `evaluateVoicing()`. Key scoring criteria: all target pitch classes present, root in bass, no stretch >4 frets, no muted strings in the middle of a voicing (penalizes "islands")
- `generateVoicings()` transposes named CAGED shapes by shifting all fret values

**Audio (`src/lib/audio.ts`):** Uses the Web Audio API via a module-level singleton `AudioContext`. `playStrum()` staggers note onsets by 50ms to simulate strumming.

**Components:**
- `TheoryReference` — exports the `ActiveChordContext` interface used by App.tsx to distinguish chord vs. scale selections (scales skip auto-voicing)
- `QuizModule` — self-contained quiz logic; reads `activeNotes` from props to check user answers
- `Fretboard` — renders 6 strings × N frets; accepts both `activeNotes` (pitch highlighting) and `voicing` (fret dot placement); calls `onChangeVoicing` when user clicks a fret
- `Piano` — 3-octave keyboard (C3–B5, MIDI 48–83); uses `PIANO_KEYS` constant from musicTheory
- `Stave` — renders treble clef notation using absolute positioning; no external notation library
- `CircleOfFifths` — purely presentational SVG-based component; calls `onNotesSelected` on click

**Path alias:** `@/` resolves to the project root (not `src/`), so imports like `@/src/lib/...` are valid but the convention in existing code is relative imports within `src/`.
