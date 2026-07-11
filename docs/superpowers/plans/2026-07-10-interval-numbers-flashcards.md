# Interval Numbers Flashcard Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4th flashcard mode, "Interval Numbers," that drills interval-name ↔ semitone-count pairs (Min 2nd…Octave, 1–12), with the same multiple-choice / full-choice mechanics as the existing "Note Numbers" mode.

**Architecture:** New sibling card component `IntervalNumberCard.tsx`, modeled directly on the existing `PitchClassCard.tsx`. New SRS key helper `intervalNumberKey` in `src/lib/srs.ts`, parallel to `pitchClassKey`. `FlashcardShell.tsx` gets a 4th tab, filter-panel section, deck-generation branch, and card-render branch — following the exact same pattern already used for the `pitch-class` mode. No new top-level files, no changes to `App.tsx` (already wires `FlashcardShell` in).

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4. No test framework — verification is `npx tsc --noEmit` + manual check in the dev server (`npm run dev`).

## Global Constraints

- No test framework configured — verification is `npx tsc --noEmit` (must pass with zero errors) plus manual browser check via `npm run dev`.
- `src/lib/musicTheory.ts` already exports `INTERVAL_NAMES: Record<number, string>` (keys 0–12, `0: 'Root'` … `12: 'Octave'`) — reuse this directly. Do **not** create a second constant with this name.
- Interval range for this mode is 1–12 semitones (no Unison/0), matching the existing fretboard Interval Cards' range.
- SRS persistence key format follows the existing convention: `` `interval-number:${semitones}:${direction}` ``.
- All new UI must reuse existing Tailwind utility patterns already present in `FlashcardShell.tsx` / `PitchClassCard.tsx` (indigo color scheme, `rounded-lg`/`rounded-xl`, existing button/checkbox classes) — no new design system.
- Auto-scoring: multiple-choice picks call `onCorrect`/`onIncorrect` immediately on selection (no separate submit step), matching every other MC card type in this app.
- Wrong-answer feedback must show both the picked value and the correct value in one line (e.g. "✗ You picked 5 — correct: 3"), matching `PitchClassCard`'s existing pattern.

---

## File Map

| Action | Path |
|--------|------|
| Modify | `src/lib/srs.ts` — add `intervalNumberKey` export |
| Create | `src/components/flashcards/IntervalNumberCard.tsx` — interval-name ↔ semitone-count card |
| Modify | `src/components/flashcards/FlashcardShell.tsx` — add 4th tab, filters, deck generation, render wiring |

---

### Task 1: Add `intervalNumberKey` SRS helper

**Files:**
- Modify: `src/lib/srs.ts`

**Interfaces:**
- Produces: `intervalNumberKey(semitones: number, direction: string): string`

- [ ] **Step 1: Add the new key function**

In `src/lib/srs.ts`, immediately after the existing `pitchClassKey` function:

```typescript
export function pitchClassKey(pc: number, direction: string): string {
  return `pc:${pc}:${direction}`;
}
```

add:

```typescript

export function intervalNumberKey(semitones: number, direction: string): string {
  return `interval-number:${semitones}:${direction}`;
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/timothykoerner/Desktop/harmony-hub && npx tsc --noEmit
```
Expected: no errors (the function is unused so far, which is fine — it's still valid TypeScript).

- [ ] **Step 3: Commit**

```bash
git add src/lib/srs.ts
git commit -m "feat(flashcards): add intervalNumberKey SRS helper"
```

---

### Task 2: Create `IntervalNumberCard` component

**Files:**
- Create: `src/components/flashcards/IntervalNumberCard.tsx`

**Interfaces:**
- Consumes: `INTERVAL_NAMES` (`src/lib/musicTheory.ts`, `Record<number, string>`)
- Produces: `IntervalNumberCard({ card, flipped, multipleChoice, fullChoices?, onFlip, onCorrect, onIncorrect })`, `IntervalNumberCardData`

- [ ] **Step 1: Create the component**

Create `src/components/flashcards/IntervalNumberCard.tsx`:

```tsx
import React, { useMemo, useState } from 'react';
import { INTERVAL_NAMES } from '../../lib/musicTheory';

export interface IntervalNumberCardData {
  semitones: number; // 1-12
  direction: 'name-to-number' | 'number-to-name';
}

interface IntervalNumberCardProps {
  card: IntervalNumberCardData;
  flipped: boolean;
  multipleChoice: boolean;
  fullChoices?: boolean;
  onFlip: () => void;
  onCorrect: () => void;
  onIncorrect: () => void;
}

const ALL_SEMITONES = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12

export function IntervalNumberCard({
  card, flipped, multipleChoice, fullChoices = false, onFlip, onCorrect, onIncorrect,
}: IntervalNumberCardProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const intervalName = INTERVAL_NAMES[card.semitones];
  const frontLabel = card.direction === 'name-to-number' ? intervalName : String(card.semitones);
  const backLabel  = card.direction === 'name-to-number' ? String(card.semitones) : intervalName;
  const frontSub   = card.direction === 'name-to-number' ? 'Interval name' : 'Semitones';
  const backSub    = card.direction === 'name-to-number' ? 'Semitones' : 'Interval name';

  const options = useMemo(() => {
    if (fullChoices) {
      return card.direction === 'name-to-number'
        ? ALL_SEMITONES.map(String).sort(() => Math.random() - 0.5)
        : ALL_SEMITONES.map(s => INTERVAL_NAMES[s]).sort(() => Math.random() - 0.5);
    }
    if (card.direction === 'name-to-number') {
      const wrongs = ALL_SEMITONES
        .filter(s => s !== card.semitones)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(String);
      return [String(card.semitones), ...wrongs].sort(() => Math.random() - 0.5);
    } else {
      const wrongs = ALL_SEMITONES
        .filter(s => s !== card.semitones)
        .map(s => INTERVAL_NAMES[s])
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      return [intervalName, ...wrongs].sort(() => Math.random() - 0.5);
    }
  }, [card, fullChoices]);

  const handlePick = (opt: string) => {
    setSelected(opt);
    onFlip();
    if (opt === backLabel) onCorrect(); else onIncorrect();
  };

  return (
    <div className="bg-white rounded-xl border border-indigo-100 shadow-md">
      {!flipped && (
        <div className="flex flex-col items-center justify-center p-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">{frontSub}</p>
          <p className="text-6xl font-bold text-indigo-600 font-mono mb-10 text-center">{frontLabel}</p>
          {multipleChoice ? (
            <div className={`grid gap-2 w-full ${fullChoices ? 'grid-cols-4 max-w-sm' : 'grid-cols-2 max-w-xs'}`}>
              {options.map(opt => (
                <button
                  key={opt}
                  onClick={() => handlePick(opt)}
                  className="py-2.5 px-2 rounded-lg border text-sm font-semibold transition-colors bg-indigo-50 border-indigo-200 text-indigo-800 hover:bg-indigo-100 active:bg-indigo-200"
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={onFlip}
              className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Reveal
            </button>
          )}
        </div>
      )}
      {flipped && (
        <div className="flex flex-col items-center p-8">
          {selected && selected !== backLabel && (
            <p className="text-red-500 text-sm mb-3">
              ✗ You picked <strong>{selected}</strong> — correct: <strong>{backLabel}</strong>
            </p>
          )}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{backSub}</p>
          <p className="text-6xl font-bold text-indigo-600 font-mono text-center">{backLabel}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/timothykoerner/Desktop/harmony-hub && npx tsc --noEmit 2>&1 | grep -i "IntervalNumberCard"
```
Expected: no output (no errors mentioning this file).

- [ ] **Step 3: Commit**

```bash
git add src/components/flashcards/IntervalNumberCard.tsx
git commit -m "feat(flashcards): add IntervalNumberCard component"
```

---

### Task 3: Wire Interval Numbers mode into `FlashcardShell`

**Files:**
- Modify: `src/components/flashcards/FlashcardShell.tsx`

**Interfaces:**
- Consumes: `IntervalNumberCard`, `IntervalNumberCardData` (Task 2), `intervalNumberKey` (Task 1)
- Produces: fully working `interval-number` branch of `cardMode`, reachable via the "Interval Numbers" tab

- [ ] **Step 1: Update imports**

In `src/components/flashcards/FlashcardShell.tsx`, replace:

```tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GUITAR_TUNING, STRING_NAMES } from '../../lib/musicTheory';
import { NoteCard, NoteCardData } from './NoteCard';
import { IntervalCard, IntervalCardData } from './IntervalCard';
import { PitchClassCard, PitchClassCardData } from './PitchClassCard';
import {
  SRSStore, CardRecord,
  loadStore, saveStore,
  noteKey, intervalKey, pitchClassKey,
  isDue, nextDueAfterToday, reviewCard,
} from '../../lib/srs';
```

with:

```tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GUITAR_TUNING, STRING_NAMES } from '../../lib/musicTheory';
import { NoteCard, NoteCardData } from './NoteCard';
import { IntervalCard, IntervalCardData } from './IntervalCard';
import { PitchClassCard, PitchClassCardData } from './PitchClassCard';
import { IntervalNumberCard, IntervalNumberCardData } from './IntervalNumberCard';
import {
  SRSStore, CardRecord,
  loadStore, saveStore,
  noteKey, intervalKey, pitchClassKey, intervalNumberKey,
  isDue, nextDueAfterToday, reviewCard,
} from '../../lib/srs';
```

- [ ] **Step 2: Extend `cardMode` type**

Replace:

```tsx
  const [cardMode, setCardMode] = useState<'note' | 'interval' | 'pitch-class'>('note');
```

with:

```tsx
  const [cardMode, setCardMode] = useState<'note' | 'interval' | 'pitch-class' | 'interval-number'>('note');
```

- [ ] **Step 3: Add interval-number filter state**

Replace:

```tsx
  // Pitch-class filters
  const [pcDirection, setPcDirection] = useState<'note-to-number' | 'number-to-note' | 'both'>('both');
  const [pcMultipleChoice, setPcMultipleChoice] = useState(true);
  const [pcFullChoices, setPcFullChoices] = useState(false);
```

with:

```tsx
  // Pitch-class filters
  const [pcDirection, setPcDirection] = useState<'note-to-number' | 'number-to-note' | 'both'>('both');
  const [pcMultipleChoice, setPcMultipleChoice] = useState(true);
  const [pcFullChoices, setPcFullChoices] = useState(false);

  // Interval-number filters
  const [inDirection, setInDirection] = useState<'name-to-number' | 'number-to-name' | 'both'>('both');
  const [inMultipleChoice, setInMultipleChoice] = useState(true);
  const [inFullChoices, setInFullChoices] = useState(false);
```

- [ ] **Step 4: Add deck state and extend the `deck` union**

Replace:

```tsx
  // Session state
  const [noteDeck, setNoteDeck] = useState<NoteCardData[]>([]);
  const [intervalDeck, setIntervalDeck] = useState<IntervalCardData[]>([]);
  const [pcDeck, setPcDeck] = useState<PitchClassCardData[]>([]);
```

with:

```tsx
  // Session state
  const [noteDeck, setNoteDeck] = useState<NoteCardData[]>([]);
  const [intervalDeck, setIntervalDeck] = useState<IntervalCardData[]>([]);
  const [pcDeck, setPcDeck] = useState<PitchClassCardData[]>([]);
  const [inDeck, setInDeck] = useState<IntervalNumberCardData[]>([]);
```

Then replace:

```tsx
  const deck: (NoteCardData | IntervalCardData | PitchClassCardData)[] =
    cardMode === 'note' ? noteDeck : cardMode === 'interval' ? intervalDeck : pcDeck;
```

with:

```tsx
  const deck: (NoteCardData | IntervalCardData | PitchClassCardData | IntervalNumberCardData)[] =
    cardMode === 'note' ? noteDeck
      : cardMode === 'interval' ? intervalDeck
      : cardMode === 'pitch-class' ? pcDeck
      : inDeck;
```

- [ ] **Step 5: Extend `buildAndSetDecks`**

Replace the whole function:

```tsx
  const buildAndSetDecks = useCallback((store: SRSStore) => {
    storeRef.current = store;

    const frets =
      fretMode === 'position' ? [positionFret] :
      fretMode === 'landmark' ? LANDMARK_FRETS :
      Array.from({ length: fretEnd - fretStart + 1 }, (_, i) => fretStart + i);

    const noteCandidates = generateNoteCandidates(noteStrings, frets);
    const noteResult = srsFilter(noteCandidates, c => noteKey(c.stringIndex, c.fret), store);
    setNoteDeck(noteResult.deck);

    const intCandidates = generateIntervalCandidates(intStrings, intIntervals, intDirection);
    const intResult = srsFilter(intCandidates, c => intervalKey(c.rootStringIndex, c.rootFret, c.intervalSemitones, c.direction), store);
    setIntervalDeck(intResult.deck);

    const pcDirs: ('note-to-number' | 'number-to-note')[] =
      pcDirection === 'both' ? ['note-to-number', 'number-to-note'] : [pcDirection];
    const pcCandidates: PitchClassCardData[] = pcDirs.flatMap(dir =>
      Array.from({ length: 12 }, (_, pc) => ({ pitchClass: pc, direction: dir }))
    );
    const pcResult = srsFilter(pcCandidates, c => pitchClassKey(c.pitchClass, c.direction), store);
    setPcDeck(pcResult.deck);

    const active = cardMode === 'note' ? noteResult : cardMode === 'interval' ? intResult : pcResult;
    setSessionDue(active.dueCount);
    setSessionNew(active.newCount);
    setNextDue(nextDueAfterToday(store));
  }, [cardMode, noteStrings, fretStart, fretEnd, fretMode, positionFret, intStrings, intIntervals, intDirection, pcDirection]);
```

with:

```tsx
  const buildAndSetDecks = useCallback((store: SRSStore) => {
    storeRef.current = store;

    const frets =
      fretMode === 'position' ? [positionFret] :
      fretMode === 'landmark' ? LANDMARK_FRETS :
      Array.from({ length: fretEnd - fretStart + 1 }, (_, i) => fretStart + i);

    const noteCandidates = generateNoteCandidates(noteStrings, frets);
    const noteResult = srsFilter(noteCandidates, c => noteKey(c.stringIndex, c.fret), store);
    setNoteDeck(noteResult.deck);

    const intCandidates = generateIntervalCandidates(intStrings, intIntervals, intDirection);
    const intResult = srsFilter(intCandidates, c => intervalKey(c.rootStringIndex, c.rootFret, c.intervalSemitones, c.direction), store);
    setIntervalDeck(intResult.deck);

    const pcDirs: ('note-to-number' | 'number-to-note')[] =
      pcDirection === 'both' ? ['note-to-number', 'number-to-note'] : [pcDirection];
    const pcCandidates: PitchClassCardData[] = pcDirs.flatMap(dir =>
      Array.from({ length: 12 }, (_, pc) => ({ pitchClass: pc, direction: dir }))
    );
    const pcResult = srsFilter(pcCandidates, c => pitchClassKey(c.pitchClass, c.direction), store);
    setPcDeck(pcResult.deck);

    const inDirs: ('name-to-number' | 'number-to-name')[] =
      inDirection === 'both' ? ['name-to-number', 'number-to-name'] : [inDirection];
    const inCandidates: IntervalNumberCardData[] = inDirs.flatMap(dir =>
      Array.from({ length: 12 }, (_, i) => ({ semitones: i + 1, direction: dir }))
    );
    const inResult = srsFilter(inCandidates, c => intervalNumberKey(c.semitones, c.direction), store);
    setInDeck(inResult.deck);

    const active =
      cardMode === 'note' ? noteResult
        : cardMode === 'interval' ? intResult
        : cardMode === 'pitch-class' ? pcResult
        : inResult;
    setSessionDue(active.dueCount);
    setSessionNew(active.newCount);
    setNextDue(nextDueAfterToday(store));
  }, [cardMode, noteStrings, fretStart, fretEnd, fretMode, positionFret, intStrings, intIntervals, intDirection, pcDirection, inDirection]);
```

- [ ] **Step 6: Extend `getCardKey`**

Replace:

```tsx
  const getCardKey = useCallback((card: NoteCardData | IntervalCardData | PitchClassCardData): string => {
    if (cardMode === 'note') {
      const c = card as NoteCardData;
      return noteKey(c.stringIndex, c.fret);
    }
    if (cardMode === 'interval') {
      const c = card as IntervalCardData;
      return intervalKey(c.rootStringIndex, c.rootFret, c.intervalSemitones, c.direction);
    }
    const c = card as PitchClassCardData;
    return pitchClassKey(c.pitchClass, c.direction);
  }, [cardMode]);
```

with:

```tsx
  const getCardKey = useCallback((card: NoteCardData | IntervalCardData | PitchClassCardData | IntervalNumberCardData): string => {
    if (cardMode === 'note') {
      const c = card as NoteCardData;
      return noteKey(c.stringIndex, c.fret);
    }
    if (cardMode === 'interval') {
      const c = card as IntervalCardData;
      return intervalKey(c.rootStringIndex, c.rootFret, c.intervalSemitones, c.direction);
    }
    if (cardMode === 'pitch-class') {
      const c = card as PitchClassCardData;
      return pitchClassKey(c.pitchClass, c.direction);
    }
    const c = card as IntervalNumberCardData;
    return intervalNumberKey(c.semitones, c.direction);
  }, [cardMode]);
```

- [ ] **Step 7: Extend `reshuffleCurrentCard`**

Replace:

```tsx
  const reshuffleCurrentCard = () => {
    const offset = 3 + Math.floor(Math.random() * 3);
    if (cardMode === 'note') {
      const nd = [...noteDeck];
      const [card] = nd.splice(currentIndex, 1);
      nd.splice(Math.min(nd.length, currentIndex + offset), 0, card);
      setNoteDeck(nd);
    } else if (cardMode === 'interval') {
      const id = [...intervalDeck];
      const [card] = id.splice(currentIndex, 1);
      id.splice(Math.min(id.length, currentIndex + offset), 0, card);
      setIntervalDeck(id);
    } else {
      const pd = [...pcDeck];
      const [card] = pd.splice(currentIndex, 1);
      pd.splice(Math.min(pd.length, currentIndex + offset), 0, card);
      setPcDeck(pd);
    }
  };
```

with:

```tsx
  const reshuffleCurrentCard = () => {
    const offset = 3 + Math.floor(Math.random() * 3);
    if (cardMode === 'note') {
      const nd = [...noteDeck];
      const [card] = nd.splice(currentIndex, 1);
      nd.splice(Math.min(nd.length, currentIndex + offset), 0, card);
      setNoteDeck(nd);
    } else if (cardMode === 'interval') {
      const id = [...intervalDeck];
      const [card] = id.splice(currentIndex, 1);
      id.splice(Math.min(id.length, currentIndex + offset), 0, card);
      setIntervalDeck(id);
    } else if (cardMode === 'pitch-class') {
      const pd = [...pcDeck];
      const [card] = pd.splice(currentIndex, 1);
      pd.splice(Math.min(pd.length, currentIndex + offset), 0, card);
      setPcDeck(pd);
    } else {
      const ind = [...inDeck];
      const [card] = ind.splice(currentIndex, 1);
      ind.splice(Math.min(ind.length, currentIndex + offset), 0, card);
      setInDeck(ind);
    }
  };
```

- [ ] **Step 8: Extend `modeBtn` signature and add the tab button**

Replace:

```tsx
  const modeBtn = (mode: 'note' | 'interval' | 'pitch-class', label: string) => (
```

with:

```tsx
  const modeBtn = (mode: 'note' | 'interval' | 'pitch-class' | 'interval-number', label: string) => (
```

Replace:

```tsx
        <div className="flex gap-2">
          {modeBtn('note', 'Note Cards')}
          {modeBtn('interval', 'Interval Cards')}
          {modeBtn('pitch-class', 'Note Numbers')}
        </div>
```

with:

```tsx
        <div className="flex gap-2">
          {modeBtn('note', 'Note Cards')}
          {modeBtn('interval', 'Interval Cards')}
          {modeBtn('pitch-class', 'Note Numbers')}
          {modeBtn('interval-number', 'Interval Numbers')}
        </div>
```

- [ ] **Step 9: Turn the final filter-panel `else` branch into an explicit `interval` check, and add the new `interval-number` branch**

The filter panel currently has three branches: `cardMode === 'pitch-class' ? (...) : cardMode === 'note' ? (...) : (...)` where the final `(...)` implicitly covers `'interval'` (the only mode left). Since there are now 4 modes, this must become explicit.

Replace:

```tsx
          ) : (
            <>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Difficulty</p>
```

with:

```tsx
          ) : cardMode === 'interval' ? (
            <>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Difficulty</p>
```

Then replace the end of that same branch (immediately before the `Apply & Restart` button):

```tsx
              {intLevel === 1 && (
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox" checked={showSemitones}
                    onChange={e => setShowSemitones(e.target.checked)}
                    className="rounded"
                  />
                  Show semitone counts on choices
                </label>
              )}
            </>
          )}
          <button
            onClick={restart}
            className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Apply &amp; Restart
          </button>
```

with:

```tsx
              {intLevel === 1 && (
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox" checked={showSemitones}
                    onChange={e => setShowSemitones(e.target.checked)}
                    className="rounded"
                  />
                  Show semitone counts on choices
                </label>
              )}
            </>
          ) : (
            <>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Direction</p>
                <div className="flex gap-2">
                  {([
                    { v: 'name-to-number', l: 'Name → Number' },
                    { v: 'number-to-name', l: 'Number → Name' },
                    { v: 'both', l: 'Both' },
                  ] as const).map(d => (
                    <button
                      key={d.v}
                      onClick={() => setInDirection(d.v)}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        inDirection === d.v ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-indigo-400'
                      }`}
                    >
                      {d.l}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox" checked={inMultipleChoice}
                  onChange={e => setInMultipleChoice(e.target.checked)}
                  className="rounded"
                />
                Multiple choice mode
              </label>
              {inMultipleChoice && (
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer ml-4">
                  <input
                    type="checkbox" checked={inFullChoices}
                    onChange={e => setInFullChoices(e.target.checked)}
                    className="rounded"
                  />
                  Show all 12 choices (harder)
                </label>
              )}
            </>
          )}
          <button
            onClick={restart}
            className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Apply &amp; Restart
          </button>
```

- [ ] **Step 10: Extend the card-area render switch**

Replace:

```tsx
          {cardMode === 'note' ? (
            <NoteCard
              key={`${currentIndex}-${seen}`}
              card={currentCard as NoteCardData}
              flipped={flipped}
              multipleChoice={multipleChoice}
              onFlip={handleFlip}
              onCorrect={multipleChoice ? handleAutoCorrect : () => {}}
              onIncorrect={multipleChoice ? handleAutoIncorrect : () => {}}
            />
          ) : cardMode === 'interval' ? (
            <IntervalCard
              key={`${currentIndex}-${seen}`}
              card={currentCard as IntervalCardData}
              level={intLevel}
              flipped={flipped}
              showSemitones={showSemitones}
              onFlip={handleFlip}
              onCorrect={handleAutoCorrect}
              onIncorrect={handleAutoIncorrect}
            />
          ) : (
            <PitchClassCard
              key={`${currentIndex}-${seen}`}
              card={currentCard as PitchClassCardData}
              flipped={flipped}
              multipleChoice={pcMultipleChoice}
              fullChoices={pcFullChoices}
              onFlip={handleFlip}
              onCorrect={pcMultipleChoice ? handleAutoCorrect : () => {}}
              onIncorrect={pcMultipleChoice ? handleAutoIncorrect : () => {}}
            />
          )}
```

with:

```tsx
          {cardMode === 'note' ? (
            <NoteCard
              key={`${currentIndex}-${seen}`}
              card={currentCard as NoteCardData}
              flipped={flipped}
              multipleChoice={multipleChoice}
              onFlip={handleFlip}
              onCorrect={multipleChoice ? handleAutoCorrect : () => {}}
              onIncorrect={multipleChoice ? handleAutoIncorrect : () => {}}
            />
          ) : cardMode === 'interval' ? (
            <IntervalCard
              key={`${currentIndex}-${seen}`}
              card={currentCard as IntervalCardData}
              level={intLevel}
              flipped={flipped}
              showSemitones={showSemitones}
              onFlip={handleFlip}
              onCorrect={handleAutoCorrect}
              onIncorrect={handleAutoIncorrect}
            />
          ) : cardMode === 'pitch-class' ? (
            <PitchClassCard
              key={`${currentIndex}-${seen}`}
              card={currentCard as PitchClassCardData}
              flipped={flipped}
              multipleChoice={pcMultipleChoice}
              fullChoices={pcFullChoices}
              onFlip={handleFlip}
              onCorrect={pcMultipleChoice ? handleAutoCorrect : () => {}}
              onIncorrect={pcMultipleChoice ? handleAutoIncorrect : () => {}}
            />
          ) : (
            <IntervalNumberCard
              key={`${currentIndex}-${seen}`}
              card={currentCard as IntervalNumberCardData}
              flipped={flipped}
              multipleChoice={inMultipleChoice}
              fullChoices={inFullChoices}
              onFlip={handleFlip}
              onCorrect={inMultipleChoice ? handleAutoCorrect : () => {}}
              onIncorrect={inMultipleChoice ? handleAutoIncorrect : () => {}}
            />
          )}
```

- [ ] **Step 11: Type-check**

```bash
cd /Users/timothykoerner/Desktop/harmony-hub && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 12: Manual verification in dev server**

```bash
cd /Users/timothykoerner/Desktop/harmony-hub && npm run dev
```

Open the Flashcards view and verify:
- A 4th tab "Interval Numbers" appears next to "Note Numbers"
- Clicking it loads a deck; front/back show interval name and semitone count correctly for both directions
- Filters panel (for this mode) shows Direction (Name→Number / Number→Name / Both), Multiple choice checkbox, and "Show all 12 choices (harder)" checkbox when MC is on
- 4-choice mode shows exactly 4 buttons, always including the correct answer
- Full-choice mode shows all 12 choices in a 4-column grid
- Selecting a wrong answer shows "✗ You picked X — correct: Y" and colors the Next button red; selecting correct shows a green Next button
- Score counter and due/new counts update as in other modes
- Switching away from and back to the tab preserves independent SRS progress (spot check: answer a couple of cards, switch to Note Numbers, switch back — due/new counts should reflect what was answered)

- [ ] **Step 13: Commit**

```bash
git add src/components/flashcards/FlashcardShell.tsx
git commit -m "feat(flashcards): wire Interval Numbers mode into FlashcardShell"
```

---

## Self-Review Notes

- **Spec coverage:** Section 1 (shared interval data) → satisfied by reusing existing `INTERVAL_NAMES` (Task 2). Section 2 (`IntervalNumberCard`) → Task 2. Section 3 (SRS key) → Task 1. Section 4 (`FlashcardShell` wiring) → Task 3, all sub-bullets covered (cardMode union, tab, filter state/panel, deck generation, `getCardKey`, render switch, `deck` union type). Section 5 (out of scope) → no tasks touch Unison, no fretboard component added, no `PitchClassCard`/`IntervalNumberCard` merge attempted.
- **Type consistency:** `IntervalNumberCardData` shape (`{ semitones: number; direction: 'name-to-number' | 'number-to-name' }`) is identical everywhere it's used — Task 2's component, and Task 3's deck state, `buildAndSetDecks`, `getCardKey`, `reshuffleCurrentCard`, and render switch all reference the same field names.
