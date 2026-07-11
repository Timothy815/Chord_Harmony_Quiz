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

## Flashcard System (`src/components/flashcards/`)

Spaced-repetition drill system with three card modes, all sharing the same SRS engine.

**`src/lib/srs.ts`** — SM-2 spaced repetition engine persisted to `localStorage` under key `harmony-hub-srs-v1`. Key exports: `loadStore()`, `saveStore()`, `reviewCard(existing, correct)`, `isDue(record)`, `noteKey()`, `intervalKey()`, `pitchClassKey()`.

**`FlashcardShell.tsx`** — Top-level container. Owns all session state, SRS store ref, deck generation, and scoring logic. Three card modes selectable via tabs:

- **Note Cards** — identifies note name at a given string + fret. Supports multiple choice (auto-scores) and reveal-only (manual Got It / Try Again).
- **Interval Cards** — three difficulty levels: Identify (Level 1 MC), Locate (Level 2 fretboard tap), Produce (Level 3 free-place + Reveal). All auto-score on selection. Includes a collapsible semitone reference panel with the formula `(target − root + 12) % 12`.
- **Note Numbers** — drills pitch-class number ↔ note name associations (C=0 … B=11). Supports 4-choice MC or full 12-choice grid (harder, no process-of-elimination).

**Auto-scoring pattern:** MC and fretboard-tap cards call `onCorrect`/`onIncorrect` immediately on selection. `FlashcardShell` wires these to `handleAutoCorrect`/`handleAutoIncorrect` which save SRS and set `autoResult` state. A single **Next →** button (green/red) then advances the session. Reveal-only note cards use manual Got It / Try Again instead. Wrong answers reshuffle the card 3–5 positions ahead in the deck.

**Card key stability:** Cards use `key={\`${currentIndex}-${seen}\`}` — `seen` increments on every Next/Got It/Try Again so the component always remounts fresh on advance, preventing stale internal state after Try Again.

**`MiniFretboard.tsx`** — Full 6-string fretboard display (frets 0–12) used by interval cards. Dot types: `root` (indigo ①), `interval` (amber), `candidate` (clickable outline), `user` (green), `wrong` (red). Open-string dots render in the string-label column left of the nut; fret 0 is never a grid column when `showNut = true`.

**`IntervalCard.tsx`** — `ALL_INTERVAL_OPTIONS` covers all 12 semitones (m2 through Octave). `findTarget()` searches across/along strings within `MAX_FRET_SPAN = 4`. Root dot always visible at all three levels so learners see the starting position. `showSemitones` prop adds `(Nst)` hint to Level 1 MC buttons.

**`PitchClassCard.tsx`** — Front shows note name or number; back shows the paired value. `fullChoices` prop switches from 4-option to all-12 shuffled grid (4×3 layout).

**Default interval set:** All 12 semitones (1–12) enabled. Direction defaults to `across`. Level 1 semitone hints enabled by default.
