import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  NOTES, SCALES, CHORDS, getNoteIndex, buildScale, buildChord, GUITAR_TUNING,
} from '../lib/musicTheory';
import {
  CAGED_ANCHORS, CagedAnchor, ScaleBoxCell, cellKey, generateScaleBox, getCagedFretRange,
} from '../lib/scalePositions';
import { findBestVoicingInWindow, getCagedVoicing } from '../lib/guitarVoicings';
import { TrainerFretboard } from './TrainerFretboard';
import { NoteToken } from './NoteToken';
import { playMidiNote } from '../lib/audio';
import {
  SRSStore, loadStore, saveStore, trainerKey, scaleRunKey, isDue, reviewTrainerCard,
} from '../lib/srs';
import { recordPractice } from '../lib/analytics';
import type { PracticeTarget } from '../lib/analytics';
import { generateRootToRootScaleRun } from '../lib/scaleRun';
import { ChordConstructionTrainer } from './ChordConstructionTrainer';

function shuffle<T>(arr: T[]): T[] {
  const next = [...arr];
  for (let index = next.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

type ContentType = 'scale' | 'chord';
type TrainerMode = 'shape-map' | 'scale-run' | 'chord-construction';

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

function cellsForCombo(combo: TrainerCombo, trainerMode: TrainerMode): ScaleBoxCell[] {
  if (combo.contentType === 'scale') {
    if (trainerMode === 'scale-run') {
      return generateRootToRootScaleRun(
        combo.root,
        SCALES[combo.typeName as keyof typeof SCALES].steps,
        combo.shape,
      );
    }
    return generateScaleBox(combo.root, tonesForCombo(combo), combo.shape);
  }

  const tones = tonesForCombo(combo);
  const range = getCagedFretRange(combo.root, combo.shape);
  const voicing = getCagedVoicing(NOTES[combo.root], combo.typeName, combo.shape.name)
    ?? findBestVoicingInWindow(tones, combo.root, range.startFret, range.endFret);
  if (!voicing) return [];
  return voicing.flatMap((fret, stringIndex) => fret === 'x' ? [] : [{
    stringIndex,
    fret,
    pitchClass: (GUITAR_TUNING[stringIndex] + fret) % 12,
  }]);
}

function comboKey(combo: TrainerCombo, trainerMode: TrainerMode): string {
  return trainerMode === 'scale-run'
    ? scaleRunKey(combo.root, combo.typeName, combo.shape.name)
    : trainerKey(combo.root, combo.contentType, combo.typeName, combo.shape.name);
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

export function FretboardTrainer({ practiceTarget }: { practiceTarget?: PracticeTarget }) {
  const targetParts = practiceTarget?.module === 'Fretboard Trainer'
    ? practiceTarget.topic.split(' · ')
    : [];
  const targetContentType = targetParts[1] === 'scale' || targetParts[1] === 'chord'
    ? targetParts[1] as ContentType
    : targetParts[1] === 'scale-run' ? 'scale' : null;
  const [trainerMode, setTrainerMode] = useState<TrainerMode>(
    practiceTarget?.topic.startsWith('Triad Voicing') || practiceTarget?.topic.startsWith('Shell Voicing')
      ? 'chord-construction'
      : targetParts[1] === 'scale-run' ? 'scale-run' : 'shape-map'
  );
  const [showStepPattern, setShowStepPattern] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [roots, setRoots] = useState<number[]>(ALL_ROOTS);
  const [contentTypes, setContentTypes] = useState<ContentType[]>(targetContentType ? [targetContentType] : ['scale', 'chord']);
  const [scaleTypes, setScaleTypes] = useState<string[]>(targetContentType === 'scale' && targetParts[2] ? [targetParts[2]] : ['Major', 'Minor']);
  const [chordTypes, setChordTypes] = useState<string[]>(targetContentType === 'chord' && targetParts[2] ? [targetParts[2]] : ['Major', 'Minor']);
  const [shapeNames, setShapeNames] = useState<string[]>(
    (ALL_SHAPE_NAMES as readonly string[]).includes(targetParts[0]) ? [targetParts[0]] : ALL_SHAPE_NAMES
  );
  const [deck, setDeck] = useState<TrainerCombo[]>([]);
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
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const storeRef = useRef<SRSStore>({});
  const roundStartedAtRef = useRef(0);
  const showStepPatternRef = useRef(showStepPattern);
  const usedStepPatternInRoundRef = useRef(false);
  const cellElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const missFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFilters = () => {
    setRoots([]);
    setContentTypes([]);
    setScaleTypes([]);
    setChordTypes([]);
    setShapeNames([]);
  };

  const registerCellElement = useCallback((key: string, element: HTMLDivElement | null) => {
    if (element) {
      cellElementsRef.current.set(key, element);
    } else {
      cellElementsRef.current.delete(key);
    }
  }, []);

  const loadRound = useCallback((queue: TrainerCombo[]) => {
    const remaining = [...queue];

    while (remaining.length > 0) {
      const combo = remaining.shift()!;
      const cells = cellsForCombo(combo, trainerMode);

      if (cells.length > 0) {
        const uniquePitchClasses = Array.from(new Set(cells.map((cell) => cell.pitchClass)));
        setCurrentCombo(combo);
        setFilteredCells(cells);
        setNoteTokens(uniquePitchClasses.map((pitchClass) => ({ pitchClass, label: NOTES[pitchClass] })));
        setFilledKeys(new Set());
        setMissCount(0);
        setMissedKey(null);
        setSelectedPitchClass(null);
        setDeck(remaining);
        setRoundId((value) => value + 1);
        setNoValidCombos(false);
        setSessionComplete(false);
        usedStepPatternInRoundRef.current = trainerMode === 'scale-run' && showStepPatternRef.current;
        roundStartedAtRef.current = performance.now();
        return;
      }
    }

    setCurrentCombo(null);
    setFilteredCells([]);
    setNoteTokens([]);
    setFilledKeys(new Set());
    setDeck([]);
    setSessionComplete(true);
  }, [trainerMode]);

  const restart = useCallback(() => {
    const store = loadStore();
    storeRef.current = store;

    const pool = buildComboPool(
      roots,
      trainerMode === 'scale-run' ? ['scale'] : contentTypes,
      scaleTypes,
      chordTypes,
      shapeNames,
    );
    setRoundsCompleted(0);
    setRoundsClean(0);
    setSessionComplete(false);
    setLastResult(null);

    if (pool.length === 0) {
      setDeck([]);
      setCurrentCombo(null);
      setFilteredCells([]);
      setNoteTokens([]);
      setFilledKeys(new Set());
      setNoValidCombos(true);
      setSessionTotal(0);
      return;
    }

    const due: TrainerCombo[] = [];
    const fresh: TrainerCombo[] = [];
    const scheduled: TrainerCombo[] = [];

    for (const combo of pool) {
      const key = comboKey(combo, trainerMode);
      const record = store[key];
      if (!record) {
        fresh.push(combo);
      } else if (isDue(record)) {
        due.push(combo);
      } else {
        scheduled.push(combo);
      }
    }

    const nextDeck = [...shuffle(due), ...shuffle(fresh), ...shuffle(scheduled)]
      .filter((combo) => cellsForCombo(combo, trainerMode).length > 0);
    if (nextDeck.length === 0) {
      setDeck([]);
      setCurrentCombo(null);
      setFilteredCells([]);
      setNoteTokens([]);
      setFilledKeys(new Set());
      setNoValidCombos(true);
      setSessionTotal(0);
      return;
    }
    setSessionTotal(nextDeck.length);
    loadRound(nextDeck);
  }, [roots, contentTypes, scaleTypes, chordTypes, shapeNames, trainerMode, loadRound]);

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

    const key = comboKey(currentCombo, trainerMode);
    const wasClean = finalMissCount === 0;
    const elapsedMs = Math.max(1, Math.round(performance.now() - roundStartedAtRef.current));
    const review = reviewTrainerCard(storeRef.current[key], wasClean, elapsedMs);
    const previousBest = review.previousBestMs;
    storeRef.current = { ...storeRef.current, [key]: review.record };
    saveStore(storeRef.current);
    recordPractice({
      module: 'Fretboard Trainer',
      topic: trainerMode === 'scale-run'
        ? `${currentCombo.shape.name} · scale-run · ${currentCombo.typeName}`
        : `${currentCombo.shape.name} · ${currentCombo.contentType} · ${currentCombo.typeName}`,
      detail: `${NOTES[currentCombo.root]} root`,
      correct: wasClean,
      score: Math.round(100 / (finalMissCount + 1)),
      attempts: finalMissCount + 1,
      durationMs: elapsedMs,
      assisted: trainerMode === 'scale-run' && usedStepPatternInRoundRef.current,
    });
    setRoundsCompleted((count) => count + 1);
    if (wasClean) {
      setRoundsClean((count) => count + 1);
    }

    const seconds = (elapsedMs / 1000).toFixed(1);
    if (!wasClean) {
      setLastResult(`${currentCombo.shape.name}: ${seconds}s · requeued after ${finalMissCount} ${finalMissCount === 1 ? 'miss' : 'misses'}`);
    } else if (previousBest === undefined) {
      setLastResult(`${currentCombo.shape.name}: clean in ${seconds}s · first recorded time`);
    } else if (review.improved) {
      setLastResult(`${currentCombo.shape.name}: clean in ${seconds}s · ${((previousBest - elapsedMs) / 1000).toFixed(1)}s faster`);
    } else {
      setLastResult(`${currentCombo.shape.name}: clean in ${seconds}s · best ${(previousBest / 1000).toFixed(1)}s`);
    }

    loadRound(wasClean ? deck : [...deck, currentCombo]);
  }, [currentCombo, deck, loadRound, trainerMode]);

  const attemptPlacement = useCallback((pitchClass: number, targetKey: string) => {
    const cell = filteredCells.find((candidate) => cellKey(candidate.stringIndex, candidate.fret) === targetKey);
    if (filledKeys.has(targetKey)) {
      return;
    }

    if (trainerMode === 'scale-run') {
      const [stringIndex, fret] = targetKey.split(':').map(Number);
      const clickedMidi = GUITAR_TUNING[stringIndex] + fret;
      const requiredMidis = new Set(filteredCells.map(candidate =>
        GUITAR_TUNING[candidate.stringIndex] + candidate.fret
      ));
      const filledMidis = new Set([...filledKeys].map(key => {
        const [filledString, filledFret] = key.split(':').map(Number);
        return GUITAR_TUNING[filledString] + filledFret;
      }));

      if (requiredMidis.has(clickedMidi) && !filledMidis.has(clickedMidi) && clickedMidi % 12 === pitchClass) {
        void playMidiNote(clickedMidi);
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
      return;
    }

    if (cell && cell.pitchClass === pitchClass) {
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
  }, [filteredCells, filledKeys, missCount, completeRound, flashMiss, trainerMode]);

  const handleTokenDragEnd = useCallback((pitchClass: number, point: { x: number; y: number }) => {
    let nearestKey: string | null = null;
    let nearestDistance = Infinity;

    cellElementsRef.current.forEach((element, key) => {
      const rect = element.getBoundingClientRect();
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
  const scaleRunRange = currentCombo
    ? getCagedFretRange(currentCombo.root, currentCombo.shape)
    : null;
  const startFret = trainerMode === 'scale-run' && scaleRunRange
    ? scaleRunRange.startFret
    : frets.length > 0 ? Math.min(...frets) : 0;
  const endFret = trainerMode === 'scale-run' && scaleRunRange
    ? scaleRunRange.endFret
    : frets.length > 0 ? Math.max(...frets) : 4;
  const rootName = currentCombo ? NOTES[currentCombo.root] : '';
  const typeLabel = currentCombo
    ? currentCombo.contentType === 'scale'
      ? currentCombo.typeName
      : (CHORDS[currentCombo.typeName as keyof typeof CHORDS].abbr || currentCombo.typeName)
    : '';
  const stepPattern = currentCombo?.contentType === 'scale'
    ? SCALES[currentCombo.typeName as keyof typeof SCALES].pattern
    : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-indigo-700">Fretboard Trainer</h2>
        {trainerMode !== 'chord-construction' && <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500 font-medium">{roundsClean} / {sessionTotal} mastered · {roundsCompleted} attempts</span>
          <button
            onClick={() => setShowFilters((value) => !value)}
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            {showFilters ? 'Hide Filters ▲' : 'Filters ▼'}
          </button>
          <button onClick={restart} className="text-gray-500 hover:text-gray-800 font-medium">
            Restart
          </button>
        </div>}
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5">
        <button
          onClick={() => setTrainerMode('shape-map')}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            trainerMode === 'shape-map'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-500 hover:bg-white'
          }`}
        >
          Map Full Shape
        </button>
        <button
          onClick={() => setTrainerMode('scale-run')}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            trainerMode === 'scale-run'
              ? 'bg-cyan-700 text-white shadow-sm'
              : 'text-slate-500 hover:bg-white'
          }`}
        >
          Build Root → Root
        </button>
        <button
          onClick={() => setTrainerMode('chord-construction')}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            trainerMode === 'chord-construction'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-500 hover:bg-white'
          }`}
        >
          Build Voicings
        </button>
      </div>

      {trainerMode === 'chord-construction' ? <ChordConstructionTrainer /> : <>

      {showFilters && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-gray-700">Filter Selection</p>
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 rounded border border-red-200 bg-white text-sm font-medium text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
            >
              Clear All
            </button>
          </div>

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

          {trainerMode === 'shape-map' && (
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
          )}

          {(trainerMode === 'scale-run' || contentTypes.includes('scale')) && (
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

          {trainerMode === 'scale-run' && (
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showStepPattern}
                onChange={event => {
                  showStepPatternRef.current = event.target.checked;
                  if (event.target.checked) usedStepPatternInRoundRef.current = true;
                  setShowStepPattern(event.target.checked);
                }}
                className="rounded"
              />
              Show whole-step / half-step pattern
            </label>
          )}

          {trainerMode === 'shape-map' && contentTypes.includes('chord') && (
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
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {trainerMode === 'scale-run' ? 'CAGED Positions' : 'CAGED Shapes'}
            </p>
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

      {lastResult && !noValidCombos && (
        <div className="mb-5 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-center text-sm font-medium text-indigo-800">
          {lastResult}
        </div>
      )}

      {noValidCombos ? (
        <div className="text-center py-16 text-gray-400">No cards match your filters.</div>
      ) : sessionComplete ? (
        <div className="text-center py-16">
          <p className="text-2xl font-bold text-green-700">Practice set complete</p>
          <p className="mt-2 text-gray-500">All {sessionTotal} selected shapes were completed cleanly.</p>
          <button
            onClick={restart}
            className="mt-6 px-5 py-2 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700 transition-colors"
          >
            Practice Again
          </button>
        </div>
      ) : currentCombo ? (
        <div>
          <div className="text-center mb-4">
            <p className="text-2xl font-bold text-indigo-700">{rootName} {typeLabel}</p>
            <p className="text-sm text-gray-500">
              {currentCombo.shape.name}
              {trainerMode === 'scale-run' ? ' · root to octave' : ''}
              {' · '}Misses this round: {missCount}
            </p>
            {trainerMode === 'scale-run' && showStepPattern && stepPattern && (
              <p className="mt-2 inline-block rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 font-mono text-sm font-bold tracking-wider text-cyan-800">
                {stepPattern}
              </p>
            )}
            {trainerMode === 'scale-run' && !showStepPattern && (
              <button
                onClick={() => {
                  showStepPatternRef.current = true;
                  usedStepPatternInRoundRef.current = true;
                  setShowStepPattern(true);
                }}
                className="mt-2 text-xs font-medium text-cyan-700 hover:text-cyan-900"
              >
                Show step-pattern hint
              </button>
            )}
          </div>

          <TrainerFretboard
            key={roundId}
            cells={filteredCells}
            startFret={startFret}
            endFret={endFret}
            filledKeys={filledKeys}
            missedKey={missedKey}
            onCellClick={handleCellClick}
            registerCellElement={registerCellElement}
            showTargets={trainerMode === 'shape-map'}
          />

          {trainerMode === 'scale-run' && (
            <p className="mt-2 text-center text-xs text-slate-500">
              Place the scale from its lowest root to the next root. Correct locations are hidden.
            </p>
          )}

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
      </>}
    </div>
  );
}
