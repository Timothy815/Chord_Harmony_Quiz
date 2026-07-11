# Interval Numbers Flashcard Mode — Design Spec
**Date:** 2026-07-10
**Status:** Approved

---

## Overview

A 4th flashcard mode, "Interval Numbers," drilling the association between interval names (Min 2nd, Maj 3rd, Perf 5th, …) and their semitone counts (1–12), independent of any fretboard position. It sits alongside the existing Note Cards, Interval Cards, and Note Numbers modes as a new tab in `FlashcardShell`.

Architecturally this mode is a near-exact sibling of the existing "Note Numbers" mode (`PitchClassCard.tsx`), which already drills note-name ↔ pitch-class-number. Interval Numbers does the same thing for interval-name ↔ semitone-count.

---

## 1. Shared interval name data

`INTERVAL_OPTIONS` (currently a private const in `FlashcardShell.tsx`: `{ s: number, n: string }[]`, covering semitones 1–12, Min 2nd through Octave — no Unison) is extracted into `src/lib/musicTheory.ts` as an exported constant:

```ts
export const INTERVAL_NAMES: { semitones: number; name: string }[] = [
  { semitones: 1,  name: 'Min 2nd' },
  { semitones: 2,  name: 'Maj 2nd' },
  { semitones: 3,  name: 'Min 3rd' },
  { semitones: 4,  name: 'Maj 3rd' },
  { semitones: 5,  name: 'Perf 4th' },
  { semitones: 6,  name: 'Tritone' },
  { semitones: 7,  name: 'Perf 5th' },
  { semitones: 8,  name: 'Aug 5th' },
  { semitones: 9,  name: 'Maj 6th' },
  { semitones: 10, name: 'Min 7th' },
  { semitones: 11, name: 'Maj 7th' },
  { semitones: 12, name: 'Octave' },
];
```

`FlashcardShell.tsx`'s existing interval filter panel (used by the fretboard-based Interval Cards) is updated to read from this shared constant instead of its own local copy, so interval naming stays in sync everywhere. No Unison (0 semitones) option is added — this mode covers the same 1–12 range as the rest of the app.

---

## 2. New component: `IntervalNumberCard.tsx`

Modeled directly on `PitchClassCard.tsx`.

```ts
export interface IntervalNumberCardData {
  semitones: number; // 1–12
  direction: 'name-to-number' | 'number-to-name';
}
```

- Front/back labels resolved via `INTERVAL_NAMES`.
- `multipleChoice` prop: when off, front shows a **Reveal** button; scoring is manual (Got It / Try Again, handled by `FlashcardShell` as with reveal-only Note Cards).
- `fullChoices` prop (only meaningful when `multipleChoice` is on):
  - `false` (default, less advanced): 4 choices — correct answer + 3 random wrong, shuffled.
  - `true` (advanced): all 12 choices shown, shuffled, 4-column grid.
- On pick, calls `onFlip`, then `onCorrect`/`onIncorrect` immediately (auto-scoring), matching `PitchClassCard`'s behavior. Wrong picks show "✗ You picked X — correct: Y" on the back face.

---

## 3. SRS key

New export in `src/lib/srs.ts`, parallel to `pitchClassKey`:

```ts
export function intervalNumberKey(semitones: number, direction: string): string {
  return `interval-number:${semitones}:${direction}`;
}
```

Review history for this mode is tracked independently of both the fretboard Interval Cards (`intervalKey`) and Note Numbers (`pitchClassKey`) decks.

---

## 4. `FlashcardShell` wiring

- `cardMode` union extended: `'note' | 'interval' | 'pitch-class' | 'interval-number'`.
- New tab button: **"Interval Numbers"**.
- New filter state, mirroring the pitch-class block:
  - `inDirection: 'name-to-number' | 'number-to-name' | 'both'` (default `'both'`)
  - `inMultipleChoice: boolean` (default `true`)
  - `inFullChoices: boolean` (default `false`)
- New filter panel section (shown when `cardMode === 'interval-number'`): Direction toggle (Name→Number / Number→Name / Both), Multiple choice checkbox, and (when MC on) "Show all 12 choices (harder)" checkbox — copied structure from the pitch-class filter panel.
- Deck generation in `buildAndSetDecks`: candidates are `INTERVAL_NAMES` × selected direction(s) (12 or 24 cards), filtered/sorted through the existing `srsFilter` helper keyed by `intervalNumberKey`.
- `getCardKey` switch extended with an `'interval-number'` branch.
- Card area render switch extended: renders `IntervalNumberCard`, wired to `handleAutoCorrect`/`handleAutoIncorrect` when `inMultipleChoice` is true, else `() => {}` (manual Got It / Try Again path used instead, same pattern as the other two card types).
- `deck` union type and `currentCard` casts extended to include `IntervalNumberCardData`.

No changes to the existing Note Cards, fretboard Interval Cards, or Note Numbers behavior, filters, or SRS keys.

---

## 5. Out of scope

- Unison (0 semitones) as a drillable interval.
- Any fretboard/visual component for this mode — it's a pure name↔number pair, like Note Numbers.
- Generalizing `PitchClassCard` and `IntervalNumberCard` into a single shared "label pair card" component — deferred; the two components are similar but independently simple, and merging them now isn't justified by the current scope.
