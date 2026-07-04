# Flashcard Section — Design Spec
**Date:** 2026-07-04
**Status:** Approved

---

## Overview

A dedicated Flashcards section for fretboard memorization, accessible via a new tab in the main app header. Two card types: **Note cards** (string + fret → note name) and **Interval cards** (fret diagram → interval identification). Three difficulty levels for interval cards provide a scaffolded learning path from recognition to production.

---

## 1. Navigation & Shell

### Tab bar
A "Flashcards" tab is added to the main app header. Clicking it sets a top-level `view` state in `App.tsx` to `'flashcards'`, replacing the main content area with `FlashcardShell`. No routing library required.

### File layout
```
src/components/flashcards/
  FlashcardShell.tsx    — sub-tab bar (Note / Interval), filter panel, flip state, session score
  NoteCard.tsx          — note flashcard question + answer faces
  IntervalCard.tsx      — interval flashcard question + answer faces
  MiniFretboard.tsx     — compact fretboard renderer used by IntervalCard
```
The existing `Stave` component is reused on the NoteCard answer face (already accepts `activeNotes: number[]`).

### Session flow
`FlashcardShell` generates a shuffled deck from the active filters and steps through it one card at a time. After reveal, two buttons appear:
- **Got it** — advances to next card, increments correct count
- **Try again** — requeues the card near the end of the deck

A score counter (`7 / 12`) is displayed throughout the session. A **Restart** button reshuffles the deck with current filters.

### Card flip
CSS 3D flip animation triggered by clicking anywhere on the card or a dedicated **Reveal** button (for accessibility). Front face = question; back face = answer.

---

## 2. Note Cards

### Deck generation
Each card is `{ stringIndex: number, fret: number }`.
- `stringIndex` 0–5 maps to `GUITAR_TUNING` (0 = high e, 5 = low E)
- Fret range: 0–12
- Total unfiltered deck: 78 cards
- Answer derived at runtime: `GUITAR_TUNING[stringIndex] + fret` → MIDI → `midiToNoteString()`

### Filters (collapsible panel above card)
- **Strings**: six toggle buttons labeled `e  B  G  D  A  E` — any combination
- **Fret range**: Start/End number inputs (clamped 0–12) plus quick-select presets: `0–4`, `5–9`, `0–12`
- **Multiple choice**: toggle on/off

### Front face
```
String:   A
Fret:     7
```
A small static nut/fret orientation graphic (div-based, not interactive). When multiple choice is on, four note-name buttons appear (one correct, three distractors drawn from nearby pitch classes). Selecting a button immediately flips the card and colors the choice green/red.

### Back face
- Note name large and bold (e.g. **E**)
- Octave shown smaller beneath (e.g. E3)
- Existing `Stave` component rendered below, showing the note's treble-clef position
- **Play** button triggering `playNote(noteToFreq(midi))` from `audio.ts`
- Note auto-plays on flip so the user hears it immediately

---

## 3. Interval Cards

### Intervals covered
All 11 non-unison intervals within an octave:
Minor 2nd (1), Major 2nd (2), Minor 3rd (3), Major 3rd (4), Perfect 4th (5), Tritone (6), Perfect 5th (7), Minor 6th (8), Major 6th (9), Minor 7th (10), Major 7th (11).

Default active set (most guitar-practical): m3, M3, P4, P5, M6, m7.

### Difficulty levels (pill toggle: 1 / 2 / 3)

**Level 1 — Identify**
Both dots shown on `MiniFretboard` (root = indigo, interval note = amber). Four multiple-choice buttons below: "What interval is this?" On answer, card flips to show interval name, semitone count, and a solfège hint (e.g. "Perfect 5th · 7 semitones · Sol").

**Level 2 — Locate**
One dot shown (root, indigo). Interval name shown as question (e.g. "Where is the Major 3rd from here?"). Four fret positions rendered as candidate dots on the diagram — user taps the correct one, card flips to confirm.

**Level 3 — Produce**
Blank `MiniFretboard` (no dots). Root position named in text (e.g. "Fret 5, A string") but not marked. Interval named (e.g. "Place the Perfect 4th above"). User taps a fret on the diagram to place an answer dot, then hits Reveal to confirm.

### Filters (collapsible panel)
- **Level**: 1 / 2 / 3 pill toggle
- **Intervals**: checkboxes for each of the 11 intervals
- **Direction**: Across strings (default) / Along string / Both
- **Strings**: which strings root positions are drawn from

### MiniFretboard
Renders 3–4 strings × 6 frets, centered around the relevant position on the neck. Dot rendering:
- Indigo filled circle = root
- Amber filled circle = interval note
- Ghost circle (outline only) = candidate positions in Level 2
- Tap target circles in Level 3

Keeps the diagram readable without the full 18-fret neck.

### Deck generation for Interval cards
Each card is `{ rootStringIndex: number, rootFret: number, intervalSemitones: number, direction: 'across' | 'along' }`. At generation time, valid target positions are computed (frets 0–12, strings 0–5) and cards with no valid target on the filtered string set are excluded.

---

## 4. Data Flow

```
App.tsx
  └── view === 'flashcards'
        └── FlashcardShell
              ├── filters state
              ├── deck[] (generated from filters)
              ├── currentIndex, flipped, score
              ├── NoteCard (view === 'note')
              │     ├── reads: GUITAR_TUNING, midiToNoteString, NOTES (musicTheory.ts)
              │     ├── renders: Stave (existing component)
              │     └── calls: playNote, noteToFreq (audio.ts)
              └── IntervalCard (view === 'interval')
                    ├── reads: GUITAR_TUNING, INTERVAL_NAMES (musicTheory.ts)
                    └── renders: MiniFretboard
```

`FlashcardShell` owns all session state. `NoteCard` and `IntervalCard` are purely presentational — they receive their card data and callbacks as props.

---

## 5. Migration Note

`INTERVAL_NAMES` is currently a private constant inside `TheoryReference.tsx`. It will be moved to `musicTheory.ts` and exported so both `TheoryReference` and `IntervalCard` import from the same source without a circular dependency.

---

## 6. Out of Scope

- Persistent progress / spaced repetition across sessions (no backend)
- Grand staff / bass clef on NoteCard (treble clef only via existing Stave)
- Custom interval shapes beyond across/along-string
