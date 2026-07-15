import React, { useCallback, useEffect, useRef, useState } from 'react';
import { playMidiNote } from '../lib/audio';
import {
  ChordConstructionChallenge,
  constructionIntervals,
  constructionKey,
  generateLegalConstructionVoicings,
  ROOTLESS_STRING_SETS,
  SHELL_STRING_SETS,
  ShellQuality,
  ShellStructure,
  TRIAD_STRING_SETS,
  TriadQuality,
  voicingContainsKeys,
  VoicingFamily,
} from '../lib/chordConstruction';
import { CAGED_ANCHORS, cellKey, getCagedFretRange, ScaleBoxCell } from '../lib/scalePositions';
import { GUITAR_TUNING, NOTES } from '../lib/musicTheory';
import { recordPractice } from '../lib/analytics';
import { isDue, loadStore, reviewTrainerCard, saveStore, SRSStore } from '../lib/srs';
import { NoteToken } from './NoteToken';
import { TrainerFretboard } from './TrainerFretboard';

const ROOTS = Array.from({ length: 12 }, (_, index) => index);
const TRIAD_QUALITIES: TriadQuality[] = ['Major', 'Minor', 'Diminished', 'Augmented'];
const SHELL_QUALITIES: ShellQuality[] = ['Major7', 'Minor7', 'Dominant7'];
const BASS_LABELS: Record<number, string> = { 0: 'Root', 3: 'Minor 3rd', 4: 'Major 3rd', 6: 'Diminished 5th', 7: '5th', 8: 'Augmented 5th', 10: 'Minor 7th', 11: 'Major 7th' };
const MISS_FLASH_MS = 500;

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function toggle<T>(items: T[], item: T, setter: React.Dispatch<React.SetStateAction<T[]>>) {
  setter(items.includes(item) ? items.filter(value => value !== item) : [...items, item]);
}

function intervalLabel(interval: number): string {
  return BASS_LABELS[interval] ?? `${interval} semitones`;
}

function inversionLabel(challenge: ChordConstructionChallenge): string {
  if (challenge.family === 'triad') {
    return challenge.bassInterval === 0 ? 'Root position'
      : challenge.bassInterval === CHORD_INTERVALS[challenge.quality][1] ? '1st inversion'
        : '2nd inversion';
  }
  return `${intervalLabel(challenge.bassInterval)} in bass`;
}

const CHORD_INTERVALS: Record<TriadQuality | ShellQuality, number[]> = {
  Major: [0, 4, 7], Minor: [0, 3, 7], Diminished: [0, 3, 6], Augmented: [0, 4, 8],
  Major7: [0, 4, 7, 11], Minor7: [0, 3, 7, 10], Dominant7: [0, 4, 7, 10],
};

export function ChordConstructionTrainer() {
  const [showFilters, setShowFilters] = useState(false);
  const [family, setFamily] = useState<VoicingFamily>('triad');
  const [roots, setRoots] = useState<number[]>([0]);
  const [triadQualities, setTriadQualities] = useState<TriadQuality[]>(['Major', 'Minor']);
  const [shellQualities, setShellQualities] = useState<ShellQuality[]>(SHELL_QUALITIES);
  const [shellStructures, setShellStructures] = useState<ShellStructure[]>(['rooted']);
  const [bassIntervals, setBassIntervals] = useState<number[]>([0]);
  const [stringSetLabels, setStringSetLabels] = useState<string[]>(TRIAD_STRING_SETS.map(set => set.label));
  const [shapeNames, setShapeNames] = useState<string[]>(CAGED_ANCHORS.map(shape => shape.name));
  const [showFormula, setShowFormula] = useState(false);
  const [showRoots, setShowRoots] = useState(true);

  const [deck, setDeck] = useState<ChordConstructionChallenge[]>([]);
  const [current, setCurrent] = useState<ChordConstructionChallenge | null>(null);
  const [legalVoicings, setLegalVoicings] = useState<ReturnType<typeof generateLegalConstructionVoicings>>([]);
  const [filledKeys, setFilledKeys] = useState<Set<string>>(new Set());
  const [selectedPitchClass, setSelectedPitchClass] = useState<number | null>(null);
  const [missCount, setMissCount] = useState(0);
  const [missedKey, setMissedKey] = useState<string | null>(null);
  const [roundId, setRoundId] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [roundsClean, setRoundsClean] = useState(0);
  const [roundsCompleted, setRoundsCompleted] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [noValidChallenges, setNoValidChallenges] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const storeRef = useRef<SRSStore>({});
  const roundStartedAtRef = useRef(0);
  const usedFormulaRef = useRef(false);
  const showFormulaRef = useRef(showFormula);
  const usedRootHintRef = useRef(showRoots);
  const showRootsRef = useRef(showRoots);
  const cellElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const missTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeStringSets = family === 'triad'
    ? TRIAD_STRING_SETS
    : shellStructures.length === 1 && shellStructures[0] === 'rooted'
      ? SHELL_STRING_SETS
      : shellStructures.length === 1 && shellStructures[0] === 'rootless'
        ? ROOTLESS_STRING_SETS
        : [...SHELL_STRING_SETS, ...ROOTLESS_STRING_SETS];

  const availableBassIntervals = family === 'triad'
    ? [...new Set(triadQualities.flatMap(quality => CHORD_INTERVALS[quality]))]
    : [...new Set(shellQualities.flatMap(quality => {
      const intervals = CHORD_INTERVALS[quality];
      return shellStructures.flatMap(structure => structure === 'rooted' ? [0, intervals[1], intervals[3]] : [intervals[1], intervals[3]]);
    }))];

  const buildPool = useCallback(() => {
    const challenges: ChordConstructionChallenge[] = [];
    const qualities = family === 'triad' ? triadQualities : shellQualities;
    const structures: ShellStructure[] = family === 'triad' ? ['rooted'] : shellStructures;

    for (const root of roots) {
      for (const quality of qualities) {
        const intervals = CHORD_INTERVALS[quality];
        for (const structure of structures) {
          const requiredCount = family === 'triad' || structure === 'rooted' ? 3 : 2;
          const validBass = family === 'triad' ? intervals
            : structure === 'rooted' ? [0, intervals[1], intervals[3]] : [intervals[1], intervals[3]];
          const stringSets = requiredCount === 3 ? TRIAD_STRING_SETS : ROOTLESS_STRING_SETS;
          for (const bassInterval of bassIntervals.filter(interval => validBass.includes(interval))) {
            for (const stringSet of stringSets.filter(set => stringSetLabels.includes(set.label))) {
              for (const shape of CAGED_ANCHORS.filter(item => shapeNames.includes(item.name))) {
                const challenge: ChordConstructionChallenge = {
                  root, family, quality, structure, bassInterval, stringSet, shape,
                };
                if (generateLegalConstructionVoicings(challenge).length > 0) challenges.push(challenge);
              }
            }
          }
        }
      }
    }
    return challenges;
  }, [family, roots, triadQualities, shellQualities, shellStructures, bassIntervals, stringSetLabels, shapeNames]);

  const loadRound = useCallback((queue: ChordConstructionChallenge[]) => {
    if (queue.length === 0) {
      setCurrent(null);
      setDeck([]);
      setSessionComplete(true);
      return;
    }
    const [next, ...remaining] = queue;
    setCurrent(next);
    setDeck(remaining);
    setLegalVoicings(generateLegalConstructionVoicings(next));
    setFilledKeys(new Set());
    setSelectedPitchClass(null);
    setMissCount(0);
    setMissedKey(null);
    setRoundId(value => value + 1);
    setSessionComplete(false);
    usedFormulaRef.current = showFormulaRef.current;
    usedRootHintRef.current = showRootsRef.current;
    roundStartedAtRef.current = performance.now();
  }, []);

  const restart = useCallback(() => {
    const store = loadStore();
    storeRef.current = store;
    const pool = buildPool();
    const due = pool.filter(item => isDue(store[constructionKey(item)]));
    const scheduled = pool.filter(item => !isDue(store[constructionKey(item)]));
    const nextDeck = [...shuffle(due), ...shuffle(scheduled)];
    setRoundsClean(0);
    setRoundsCompleted(0);
    setLastResult(null);
    setSessionTotal(nextDeck.length);
    setNoValidChallenges(nextDeck.length === 0);
    if (nextDeck.length) loadRound(nextDeck);
    else {
      setCurrent(null);
      setDeck([]);
      setSessionComplete(false);
    }
  }, [buildPool, loadRound]);

  useEffect(() => {
    restart();
    return () => { if (missTimerRef.current) clearTimeout(missTimerRef.current); };
  }, [restart]);

  const registerCellElement = useCallback((key: string, element: HTMLDivElement | null) => {
    if (element) cellElementsRef.current.set(key, element);
    else cellElementsRef.current.delete(key);
  }, []);

  const flashMiss = (key: string) => {
    setMissedKey(key);
    if (missTimerRef.current) clearTimeout(missTimerRef.current);
    missTimerRef.current = setTimeout(() => setMissedKey(null), MISS_FLASH_MS);
  };

  const completeRound = useCallback((finalMissCount: number) => {
    if (!current) return;
    const key = constructionKey(current);
    const elapsedMs = Math.max(1, Math.round(performance.now() - roundStartedAtRef.current));
    const clean = finalMissCount === 0;
    const review = reviewTrainerCard(storeRef.current[key], clean, elapsedMs);
    storeRef.current = { ...storeRef.current, [key]: review.record };
    saveStore(storeRef.current);
    const familyLabel = current.family === 'triad' ? 'Triad Voicing' : 'Shell Voicing';
    recordPractice({
      module: 'Fretboard Trainer',
      topic: `${familyLabel} · ${current.quality} · ${inversionLabel(current)}`,
      detail: `${NOTES[current.root]} · strings ${current.stringSet.label} · ${current.shape.name}${current.family === 'shell' ? ` · ${current.structure}` : ''}`,
      correct: clean,
      score: Math.round(100 / (finalMissCount + 1)),
      attempts: finalMissCount + 1,
      durationMs: elapsedMs,
      assisted: usedFormulaRef.current || usedRootHintRef.current,
    });
    setRoundsCompleted(count => count + 1);
    if (clean) setRoundsClean(count => count + 1);
    const seconds = (elapsedMs / 1000).toFixed(1);
    setLastResult(clean
      ? `${NOTES[current.root]} ${current.quality}: clean in ${seconds}s${review.improved ? ' · new best' : ''}`
      : `${NOTES[current.root]} ${current.quality}: ${finalMissCount} ${finalMissCount === 1 ? 'miss' : 'misses'} · requeued`);
    loadRound(clean ? deck : [...deck, current]);
  }, [current, deck, loadRound]);

  const attemptPlacement = useCallback((pitchClass: number, targetKey: string) => {
    if (!current || filledKeys.has(targetKey)) return;
    const [stringIndex, fret] = targetKey.split(':').map(Number);
    const actualPitchClass = (GUITAR_TUNING[stringIndex] + fret) % 12;
    const nextKeys = new Set(filledKeys).add(targetKey);
    const compatible = pitchClass === actualPitchClass
      && legalVoicings.some(voicing => voicingContainsKeys(voicing, nextKeys));
    if (!compatible) {
      setMissCount(count => count + 1);
      setSelectedPitchClass(null);
      flashMiss(targetKey);
      return;
    }
    void playMidiNote(GUITAR_TUNING[stringIndex] + fret);
    setFilledKeys(nextKeys);
    setSelectedPitchClass(null);
    if (nextKeys.size === constructionIntervals(current).length) completeRound(missCount);
  }, [current, filledKeys, legalVoicings, missCount, completeRound]);

  const handleCellClick = useCallback((cell: ScaleBoxCell) => {
    if (selectedPitchClass !== null) attemptPlacement(selectedPitchClass, cellKey(cell.stringIndex, cell.fret));
  }, [attemptPlacement, selectedPitchClass]);

  const handleDragEnd = useCallback((pitchClass: number, point: { x: number; y: number }) => {
    let nearest: string | null = null;
    let distance = Infinity;
    cellElementsRef.current.forEach((element, key) => {
      const rect = element.getBoundingClientRect();
      const nextDistance = Math.hypot(point.x - (rect.left + rect.width / 2), point.y - (rect.top + rect.height / 2));
      if (nextDistance < distance) { nearest = key; distance = nextDistance; }
    });
    if (nearest && distance <= 40) attemptPlacement(pitchClass, nearest);
  }, [attemptPlacement]);

  const clearFilters = () => {
    setRoots([]); setTriadQualities([]); setShellQualities([]); setShellStructures([]);
    setBassIntervals([]); setStringSetLabels([]); setShapeNames([]);
  };

  const formula = current ? constructionIntervals(current).map(interval => interval === 0 ? 'R' : intervalLabel(interval)).join(' – ') : '';
  const range = current ? getCagedFretRange(current.root, current.shape) : { startFret: 0, endFret: 4 };
  const cells = legalVoicings.flat();
  const rootReferenceKeys = new Set<string>();
  if (current && showRoots) {
    if (constructionIntervals(current).includes(0)) {
      legalVoicings.flat().filter(cell => cell.interval === 0)
        .forEach(cell => rootReferenceKeys.add(cellKey(cell.stringIndex, cell.fret)));
    } else {
      for (let stringIndex = 0; stringIndex < GUITAR_TUNING.length; stringIndex++) {
        for (let fret = range.startFret; fret <= range.endFret; fret++) {
          if ((GUITAR_TUNING[stringIndex] + fret) % 12 === current.root) {
            rootReferenceKeys.add(cellKey(stringIndex, fret));
          }
        }
      }
    }
  }
  const tokens = current ? constructionIntervals(current).map(interval => ({
    interval,
    pitchClass: (current.root + interval) % 12,
  })) : [];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Chord construction</p>
          <p className="text-sm text-slate-500">Build a valid voicing; alternate correct fingerings are accepted.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="font-medium text-slate-500">{roundsClean} / {sessionTotal} mastered · {roundsCompleted} attempts</span>
          <button onClick={() => setShowFilters(value => !value)} className="font-semibold text-amber-700 hover:text-amber-900">
            {showFilters ? 'Hide Filters ▲' : 'Filters ▼'}
          </button>
          <button onClick={restart} className="font-medium text-slate-500 hover:text-slate-800">Restart</button>
        </div>
      </div>

      {showFilters && (
        <div className="mb-6 space-y-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-center justify-between"><p className="text-sm font-bold text-slate-700">Voicing Filters</p><button onClick={clearFilters} className="rounded border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50">Clear All</button></div>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-white p-1">
            {(['triad', 'shell'] as VoicingFamily[]).map(value => <button key={value} onClick={() => { setFamily(value); setBassIntervals([0]); setStringSetLabels((value === 'triad' ? TRIAD_STRING_SETS : [...SHELL_STRING_SETS, ...ROOTLESS_STRING_SETS]).map(set => set.label)); }} className={`rounded px-3 py-2 text-sm font-bold ${family === value ? 'bg-amber-600 text-white' : 'text-slate-500 hover:bg-amber-50'}`}>{value === 'triad' ? 'Triads' : 'Shell Voicings'}</button>)}
          </div>
          <FilterGroup label="Roots">{ROOTS.map(root => <FilterButton key={root} active={roots.includes(root)} onClick={() => toggle(roots, root, setRoots)}>{NOTES[root]}</FilterButton>)}</FilterGroup>
          <FilterGroup label="Quality">{(family === 'triad' ? TRIAD_QUALITIES : SHELL_QUALITIES).map(quality => <FilterButton key={quality} active={(family === 'triad' ? triadQualities : shellQualities).includes(quality as never)} onClick={() => family === 'triad' ? toggle(triadQualities, quality as TriadQuality, setTriadQualities) : toggle(shellQualities, quality as ShellQuality, setShellQualities)}>{quality}</FilterButton>)}</FilterGroup>
          {family === 'shell' && <FilterGroup label="Structure">{(['rooted', 'rootless'] as ShellStructure[]).map(structure => <FilterButton key={structure} active={shellStructures.includes(structure)} onClick={() => {
            toggle(shellStructures, structure, setShellStructures);
            if (structure === 'rootless' && !shellStructures.includes('rootless')) {
              setBassIntervals(currentBass => [...new Set([...currentBass, 3, 4, 10, 11])]);
            }
          }}>{structure === 'rooted' ? 'Rooted R–3–7' : 'Rootless 3–7'}</FilterButton>)}</FilterGroup>}
          <FilterGroup label={family === 'triad' ? 'Inversion / Bass' : 'Bass Tone'}>{availableBassIntervals.map(interval => <FilterButton key={interval} active={bassIntervals.includes(interval)} onClick={() => toggle(bassIntervals, interval, setBassIntervals)}>{intervalLabel(interval)}</FilterButton>)}</FilterGroup>
          <FilterGroup label="String Set">{activeStringSets.map(set => <FilterButton key={set.label} active={stringSetLabels.includes(set.label)} onClick={() => toggle(stringSetLabels, set.label, setStringSetLabels)}>{set.label}</FilterButton>)}</FilterGroup>
          <FilterGroup label="Fretboard Position">{CAGED_ANCHORS.map(shape => <FilterButton key={shape.name} active={shapeNames.includes(shape.name)} onClick={() => toggle(shapeNames, shape.name, setShapeNames)}>{shape.name}</FilterButton>)}</FilterGroup>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={showFormula} onChange={event => { showFormulaRef.current = event.target.checked; setShowFormula(event.target.checked); if (event.target.checked) usedFormulaRef.current = true; }} /> Show interval formula</label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={showRoots} onChange={event => { showRootsRef.current = event.target.checked; setShowRoots(event.target.checked); if (event.target.checked) usedRootHintRef.current = true; }} /> Show root locations</label>
          <button onClick={restart} className="rounded bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700">Apply &amp; Restart</button>
        </div>
      )}

      {lastResult && !noValidChallenges && <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-900">{lastResult}</div>}
      {noValidChallenges ? <div className="py-16 text-center text-slate-400">No playable voicings match these filters.</div>
        : sessionComplete ? <div className="py-16 text-center"><p className="text-2xl font-bold text-emerald-700">Practice set complete</p><p className="mt-2 text-slate-500">All {sessionTotal} selected voicings were completed cleanly.</p><button onClick={restart} className="mt-6 rounded bg-amber-600 px-5 py-2 font-bold text-white hover:bg-amber-700">Practice Again</button></div>
          : current ? <div>
            <div className="mb-4 text-center">
              <p className="text-2xl font-bold text-slate-900">Build {NOTES[current.root]} {current.quality} {current.family === 'triad' ? 'triad' : 'shell'}</p>
              <p className="mt-1 text-sm text-slate-500">{inversionLabel(current)} · strings {current.stringSet.label} · {current.shape.name} · misses {missCount}</p>
              {current.family === 'shell' && <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-amber-700">{current.structure === 'rooted' ? 'Root–3rd–7th' : 'Rootless 3rd–7th'}</p>}
              {showFormula ? <p className="mt-2 inline-block rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 font-mono text-sm font-bold text-amber-900">{formula}</p> : <button onClick={() => { showFormulaRef.current = true; setShowFormula(true); usedFormulaRef.current = true; }} className="mt-2 text-xs font-semibold text-amber-700 hover:text-amber-900">Show interval-formula hint</button>}
              <div className="mt-2">
                {showRoots ? <button onClick={() => { showRootsRef.current = false; setShowRoots(false); }} className="text-xs font-semibold text-amber-700 hover:text-amber-900">Hide root locations</button> : <button onClick={() => { showRootsRef.current = true; setShowRoots(true); usedRootHintRef.current = true; }} className="text-xs font-semibold text-amber-700 hover:text-amber-900">Show root locations</button>}
              </div>
            </div>
            <TrainerFretboard key={roundId} cells={cells} startFret={range.startFret} endFret={range.endFret} filledKeys={filledKeys} missedKey={missedKey} onCellClick={handleCellClick} registerCellElement={registerCellElement} showTargets={false} referenceKeys={rootReferenceKeys} referenceLabel={NOTES[current.root]} />
            <p className="mt-2 text-center text-xs text-slate-500">Use each required chord tone once on the specified strings. {showRoots ? 'Amber markers show the root; other locations remain hidden.' : 'Correct locations are hidden.'}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">{tokens.map(token => <NoteToken key={token.interval} pitchClass={token.pitchClass} label={NOTES[token.pitchClass]} selected={selectedPitchClass === token.pitchClass} onTap={pitchClass => setSelectedPitchClass(value => value === pitchClass ? null : pitchClass)} onDragEnd={handleDragEnd} />)}</div>
          </div> : <div className="py-16 text-center text-slate-400">Loading…</div>}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><div className="flex flex-wrap gap-2">{children}</div></div>;
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`rounded px-3 py-1.5 text-sm font-semibold transition-colors ${active ? 'bg-amber-600 text-white' : 'border border-slate-300 bg-white text-slate-600 hover:border-amber-400'}`}>{children}</button>;
}
