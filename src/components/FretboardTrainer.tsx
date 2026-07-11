import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  NOTES, SCALES, CHORDS, getNoteIndex, buildScale, buildChord, GUITAR_TUNING,
} from '../lib/musicTheory';
import {
  CAGED_ANCHORS, CagedAnchor, ScaleBoxCell, cellKey, generateScaleBox,
} from '../lib/scalePositions';
import { TrainerFretboard } from './TrainerFretboard';
import { NoteToken } from './NoteToken';
import { playMidiNote } from '../lib/audio';
import {
  SRSStore, loadStore, saveStore, trainerKey, isDue, reviewCard,
} from '../lib/srs';

function shuffle<T>(arr: T[]): T[] {
  const next = [...arr];
  for (let index = next.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

type ContentType = 'scale' | 'chord';

interface TrainerCombo {
  root: number;
  contentType: ContentType;
  typeName: string;
  shape: CagedAnchor;
}

const SCALE_TYPE_NAMES = Object.keys(SCALES);
const CHORD_TYPE_NAMES = Object.keys(CHORDS);
const ALL_ROOTS = Array.from({ length: 12 }, (_, index) => index);
const ALL_SHAPE_NAMES = CAGED_ANCHORS.map((shape) => shape.name);
const SNAP_RADIUS_PX = 40;
const MISS_FLASH_MS = 500;

function buildComboPool(
  roots: number[],
  contentTypes: ContentType[],
  scaleTypes: string[],
  chordTypes: string[],
  shapeNames: string[],
): TrainerCombo[] {
  const shapes = CAGED_ANCHORS.filter((shape) => shapeNames.includes(shape.name));
  const combos: TrainerCombo[] = [];

  for (const root of roots) {
    for (const shape of shapes) {
      if (contentTypes.includes('scale')) {
        for (const typeName of scaleTypes) {
          combos.push({ root, contentType: 'scale', typeName, shape });
        }
      }
      if (contentTypes.includes('chord')) {
        for (const typeName of chordTypes) {
          combos.push({ root, contentType: 'chord', typeName, shape });
        }
      }
    }
  }

  return combos;
}

function tonesForCombo(combo: TrainerCombo): number[] {
  const rootName = NOTES[combo.root];
  const names = combo.contentType === 'scale'
    ? buildScale(rootName, SCALES[combo.typeName as keyof typeof SCALES])
    : buildChord(rootName, CHORDS[combo.typeName as keyof typeof CHORDS]);
  return names.map((note) => getNoteIndex(note));
}

function toggleValue<T extends string | number>(
  current: T[],
  value: T,
  setValue: React.Dispatch<React.SetStateAction<T[]>>,
) {
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];

  if (next.length > 0) {
    setValue(next);
  }
}

export function FretboardTrainer() {
  const [showFilters, setShowFilters] = useState(false);
  const [roots, setRoots] = useState<number[]>(ALL_ROOTS);
  const [contentTypes, setContentTypes] = useState<ContentType[]>(['scale', 'chord']);
  const [scaleTypes, setScaleTypes] = useState<string[]>(['Major', 'Minor']);
  const [chordTypes, setChordTypes] = useState<string[]>(['Major', 'Minor']);
  const [shapeNames, setShapeNames] = useState<string[]>(ALL_SHAPE_NAMES);
  const [deck, setDeck] = useState<TrainerCombo[]>([]);
  const [deckIndex, setDeckIndex] = useState(0);
  const [roundId, setRoundId] = useState(0);
  const [currentCombo, setCurrentCombo] = useState<TrainerCombo | null>(null);
  const [filteredCells, setFilteredCells] = useState<ScaleBoxCell[]>([]);
  const [noteTokens, setNoteTokens] = useState<{ pitchClass: number; label: string }[]>([]);
  const [filledKeys, setFilledKeys] = useState<Set<string>>(new Set());
  const [missCount, setMissCount] = useState(0);
  const [missedKey, setMissedKey] = useState<string | null>(null);
  const [selectedPitchClass, setSelectedPitchClass] = useState<number | null>(null);
  const [noValidCombos, setNoValidCombos] = useState(false);
  const [roundsCompleted, setRoundsCompleted] = useState(0);
  const [roundsClean, setRoundsClean] = useState(0);

  const storeRef = useRef<SRSStore>({});
  const cellRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const missFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const registerCellRect = useCallback((key: string, rect: DOMRect | null) => {
    if (rect) {
      cellRectsRef.current.set(key, rect);
    } else {
      cellRectsRef.current.delete(key);
    }
  }, []);

  const loadRound = useCallback((pool: TrainerCombo[], startIndex: number) => {
    if (pool.length === 0) {
      setCurrentCombo(null);
      setFilteredCells([]);
      setNoteTokens([]);
      setFilledKeys(new Set());
      setNoValidCombos(true);
      return;
    }

    let index = startIndex;
    let attempts = 0;

    while (attempts < pool.length) {
      const combo = pool[index % pool.length];
      const tones = tonesForCombo(combo);
      const cells = generateScaleBox(combo.root, tones, combo.shape);

      if (cells.length > 0) {
        const uniquePitchClasses = Array.from(new Set(cells.map((cell) => cell.pitchClass)));
        setCurrentCombo(combo);
        setFilteredCells(cells);
        setNoteTokens(uniquePitchClasses.map((pitchClass) => ({ pitchClass, label: NOTES[pitchClass] })));
        setFilledKeys(new Set());
        setMissCount(0);
        setMissedKey(null);
        setSelectedPitchClass(null);
        setDeckIndex((index % pool.length) + 1);
        setRoundId((value) => value + 1);
        setNoValidCombos(false);
        return;
      }

      index++;
      attempts++;
    }

    setCurrentCombo(null);
    setFilteredCells([]);
    setNoteTokens([]);
    setFilledKeys(new Set());
    setNoValidCombos(true);
  }, []);

  const restart = useCallback(() => {
    const store = loadStore();
    storeRef.current = store;

    const pool = buildComboPool(roots, contentTypes, scaleTypes, chordTypes, shapeNames);
    setRoundsCompleted(0);
    setRoundsClean(0);

    if (pool.length === 0) {
      setDeck([]);
      setCurrentCombo(null);
      setFilteredCells([]);
      setNoteTokens([]);
      setFilledKeys(new Set());
      setNoValidCombos(true);
      return;
    }

    const due: TrainerCombo[] = [];
    const fresh: TrainerCombo[] = [];
    const scheduled: TrainerCombo[] = [];

    for (const combo of pool) {
      const key = trainerKey(combo.root, combo.contentType, combo.typeName, combo.shape.name);
      const record = store[key];
      if (!record) {
        fresh.push(combo);
      } else if (isDue(record)) {
        due.push(combo);
      } else {
        scheduled.push(combo);
      }
    }

    const nextDeck = [...shuffle(due), ...shuffle(fresh), ...shuffle(scheduled)];
    setDeck(nextDeck);
    loadRound(nextDeck, 0);
  }, [roots, contentTypes, scaleTypes, chordTypes, shapeNames, loadRound]);

  useEffect(() => {
    restart();
    return () => {
      if (missFlashTimer.current) {
        clearTimeout(missFlashTimer.current);
      }
    };
  }, [restart]);

  const flashMiss = useCallback((key: string) => {
    setMissedKey(key);
    if (missFlashTimer.current) {
      clearTimeout(missFlashTimer.current);
    }
    missFlashTimer.current = setTimeout(() => setMissedKey(null), MISS_FLASH_MS);
  }, []);

  const completeRound = useCallback((finalMissCount: number) => {
    if (!currentCombo) {
      return;
    }

    const key = trainerKey(
      currentCombo.root,
      currentCombo.contentType,
      currentCombo.typeName,
      currentCombo.shape.name,
    );
    const updated = reviewCard(storeRef.current[key], finalMissCount === 0);
    storeRef.current = { ...storeRef.current, [key]: updated };
    saveStore(storeRef.current);
    setRoundsCompleted((count) => count + 1);
    if (finalMissCount === 0) {
      setRoundsClean((count) => count + 1);
    }
    loadRound(deck, deckIndex);
  }, [currentCombo, deck, deckIndex, loadRound]);

  const attemptPlacement = useCallback((pitchClass: number, targetKey: string) => {
    const cell = filteredCells.find((candidate) => cellKey(candidate.stringIndex, candidate.fret) === targetKey);
    if (!cell || filledKeys.has(targetKey)) {
      return;
    }

    if (cell.pitchClass === pitchClass) {
      void playMidiNote(GUITAR_TUNING[cell.stringIndex] + cell.fret);
      const nextFilled = new Set(filledKeys);
      nextFilled.add(targetKey);
      setFilledKeys(nextFilled);
      setSelectedPitchClass(null);
      if (nextFilled.size === filteredCells.length) {
        completeRound(missCount);
      }
      return;
    }

    setMissCount((count) => count + 1);
    flashMiss(targetKey);
    setSelectedPitchClass(null);
  }, [filteredCells, filledKeys, missCount, completeRound, flashMiss]);

  const handleTokenDragEnd = useCallback((pitchClass: number, point: { x: number; y: number }) => {
    let nearestKey: string | null = null;
    let nearestDistance = Infinity;

    cellRectsRef.current.forEach((rect, key) => {
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.hypot(point.x - centerX, point.y - centerY);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestKey = key;
      }
    });

    if (nearestKey && nearestDistance <= SNAP_RADIUS_PX) {
      attemptPlacement(pitchClass, nearestKey);
    }
  }, [attemptPlacement]);

  const handleTokenTap = useCallback((pitchClass: number) => {
    setSelectedPitchClass((current) => (current === pitchClass ? null : pitchClass));
  }, []);

  const handleCellClick = useCallback((cell: ScaleBoxCell) => {
    if (selectedPitchClass === null) {
      return;
    }
    attemptPlacement(selectedPitchClass, cellKey(cell.stringIndex, cell.fret));
  }, [attemptPlacement, selectedPitchClass]);

  const frets = filteredCells.map((cell) => cell.fret);
  const startFret = frets.length > 0 ? Math.min(...frets) : 0;
  const endFret = frets.length > 0 ? Math.max(...frets) : 4;
  const rootName = currentCombo ? NOTES[currentCombo.root] : '';
  const typeLabel = currentCombo
    ? currentCombo.contentType === 'scale'
      ? currentCombo.typeName
      : (CHORDS[currentCombo.typeName as keyof typeof CHORDS].abbr || currentCombo.typeName)
    : '';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-indigo-700">Fretboard Trainer</h2>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500 font-medium">{roundsClean} / {roundsCompleted} clean</span>
          <button
            onClick={() => setShowFilters((value) => !value)}
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            {showFilters ? 'Hide Filters ▲' : 'Filters ▼'}
          </button>
          <button onClick={restart} className="text-gray-500 hover:text-gray-800 font-medium">
            Restart
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Roots</p>
            <div className="flex flex-wrap gap-2">
              {ALL_ROOTS.map((pitchClass) => (
                <button
                  key={pitchClass}
                  onClick={() => toggleValue(roots, pitchClass, setRoots)}
                  className={`w-9 h-9 rounded font-mono text-sm font-medium transition-colors ${
                    roots.includes(pitchClass)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-600 hover:border-indigo-400'
                  }`}
                >
                  {NOTES[pitchClass]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Content</p>
            <div className="flex gap-2">
              {(['scale', 'chord'] as ContentType[]).map((contentType) => (
                <button
                  key={contentType}
                  onClick={() => toggleValue(contentTypes, contentType, setContentTypes)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    contentTypes.includes(contentType)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-600 hover:border-indigo-400'
                  }`}
                >
                  {contentType === 'scale' ? 'Scales' : 'Chords'}
                </button>
              ))}
            </div>
          </div>

          {contentTypes.includes('scale') && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Scale Types</p>
              <div className="flex flex-wrap gap-2">
                {SCALE_TYPE_NAMES.map((name) => (
                  <button
                    key={name}
                    onClick={() => toggleValue(scaleTypes, name, setScaleTypes)}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      scaleTypes.includes(name)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-600 hover:border-indigo-400'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {contentTypes.includes('chord') && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Chord Types</p>
              <div className="flex flex-wrap gap-2">
                {CHORD_TYPE_NAMES.map((name) => (
                  <button
                    key={name}
                    onClick={() => toggleValue(chordTypes, name, setChordTypes)}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      chordTypes.includes(name)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-600 hover:border-indigo-400'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">CAGED Shapes</p>
            <div className="flex flex-wrap gap-2">
              {CAGED_ANCHORS.map((shape) => (
                <button
                  key={shape.name}
                  onClick={() => toggleValue(shapeNames, shape.name, setShapeNames)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    shapeNames.includes(shape.name)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-600 hover:border-indigo-400'
                  }`}
                >
                  {shape.name}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={restart}
            className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Apply &amp; Restart
          </button>
        </div>
      )}

      {noValidCombos ? (
        <div className="text-center py-16 text-gray-400">No cards match your filters.</div>
      ) : currentCombo ? (
        <div>
          <div className="text-center mb-4">
            <p className="text-2xl font-bold text-indigo-700">{rootName} {typeLabel}</p>
            <p className="text-sm text-gray-500">{currentCombo.shape.name} · Misses this round: {missCount}</p>
          </div>

          <TrainerFretboard
            key={roundId}
            cells={filteredCells}
            startFret={startFret}
            endFret={endFret}
            filledKeys={filledKeys}
            missedKey={missedKey}
            onCellClick={handleCellClick}
            registerCellRect={registerCellRect}
          />

          <div className="flex flex-wrap justify-center gap-3 mt-6">
            {noteTokens.map((token) => (
              <NoteToken
                key={token.pitchClass}
                pitchClass={token.pitchClass}
                label={token.label}
                selected={selectedPitchClass === token.pitchClass}
                onTap={handleTokenTap}
                onDragEnd={handleTokenDragEnd}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      )}
    </div>
  );
}
