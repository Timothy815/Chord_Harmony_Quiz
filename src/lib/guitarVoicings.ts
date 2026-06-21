import { getNoteIndex, GUITAR_TUNING } from './musicTheory';

export type FretVal = number | 'x';
export type VoicingArray = FretVal[];

export const CHORD_SHAPES = {
  Major: [
    { name: 'E-Shape', rootString: 5, frets: [0, 0, 1, 2, 2, 0] },
    { name: 'A-Shape', rootString: 4, frets: [0, 2, 2, 2, 0, 'x'] }, 
    { name: 'D-Shape', rootString: 3, frets: [2, 3, 2, 0, 'x', 'x'] },
    { name: 'C-Shape', rootString: 4, frets: [0, 1, 0, 2, 3, 'x'] },
    { name: 'G-Shape', rootString: 5, frets: [3, 0, 0, 0, 2, 3] },
  ],
  Minor: [
    { name: 'Em-Shape', rootString: 5, frets: [0, 0, 0, 2, 2, 0] },
    { name: 'Am-Shape', rootString: 4, frets: [0, 1, 2, 2, 0, 'x'] },
    { name: 'Dm-Shape', rootString: 3, frets: [1, 3, 2, 0, 'x', 'x'] },
  ],
  Dominant7: [
    { name: 'E-Shape (7)', rootString: 5, frets: [0, 0, 1, 0, 2, 0] },
    { name: 'A-Shape (7)', rootString: 4, frets: [0, 2, 0, 2, 0, 'x'] },
    { name: 'C-Shape (7)', rootString: 4, frets: [0, 1, 3, 2, 3, 'x'] },
    { name: 'G-Shape (7)', rootString: 5, frets: [1, 0, 0, 0, 2, 3] },
  ],
  Major7: [
    { name: 'E-Shape (Maj7)', rootString: 5, frets: [0, 0, 1, 1, 'x', 0] }, 
    { name: 'A-Shape (Maj7)', rootString: 4, frets: [0, 2, 1, 2, 0, 'x'] },
    { name: 'D-Shape (Maj7)', rootString: 3, frets: [2, 2, 2, 0, 'x', 'x'] }
  ],
  Minor7: [
    { name: 'E-Shape (m7)', rootString: 5, frets: [0, 0, 0, 0, 2, 0] },
    { name: 'A-Shape (m7)', rootString: 4, frets: [0, 1, 0, 2, 0, 'x'] },
    { name: 'D-Shape (m7)', rootString: 3, frets: [1, 1, 2, 0, 'x', 'x'] }
  ],
  Diminished: [
    { name: 'A-Shape (dim)', rootString: 4, frets: ['x', 1, 2, 1, 0, 'x'] },
    { name: 'E-Shape (dim)', rootString: 5, frets: ['x', 'x', 0, 1, 1, 0] }
  ]
};

export function generateVoicings(targetRoot: string, chordType: string) {
  const shapes = CHORD_SHAPES[chordType as keyof typeof CHORD_SHAPES] || [];
  const targetRootIdx = getNoteIndex(targetRoot);
  const results: { name: string, frets: VoicingArray }[] = [];

  for (const shape of shapes) {
    const openStringMidi = GUITAR_TUNING[shape.rootString];
    const openRootIdx = openStringMidi % 12;

    let shift = (targetRootIdx - openRootIdx + 12) % 12;

    const transposed: VoicingArray = shape.frets.map((f: FretVal) => {
      if (f === 'x') return 'x';
      return parseInt((f as number).toString()) + shift;
    });

    const displayShift = shift > 0 ? ` (+${shift} fret)` : ' (Open)';
    
    results.push({
      name: shape.name + displayShift,
      frets: transposed
    });
  }
  return results;
}

export function findBestVoicingInWindow(
  pitchClasses: number[], 
  rootClass: number, 
  startFret: number, 
  endFret: number
): FretVal[] | null {
  if (pitchClasses.length === 0) return null;

  let bestVoicing: FretVal[] | null = null;
  let maxScore = -999;

  const stringOptions: FretVal[][] = [];
  // Strings from high e (0) to low E (5)
  for (let s = 0; s < 6; s++) {
    const baseMidi = GUITAR_TUNING[s];
    const options: FretVal[] = ['x']; 
    
    if (pitchClasses.includes(baseMidi % 12)) options.push(0);

    for (let f = startFret; f <= endFret; f++) {
      if (pitchClasses.includes((baseMidi + f) % 12)) {
        options.push(f);
      }
    }
    stringOptions.push(options);
  }

  function search(stringIndex: number, currentVoicing: FretVal[]) {
    if (stringIndex === 6) {
      const score = evaluateVoicing(currentVoicing, pitchClasses, rootClass);
      if (score > maxScore) {
        maxScore = score;
        bestVoicing = [...currentVoicing];
      }
      return;
    }
    for (const opt of stringOptions[stringIndex]) {
      currentVoicing.push(opt);
      search(stringIndex + 1, currentVoicing);
      currentVoicing.pop();
    }
  }

  // Optimize: Start search from low string (5) down to high string (0) to hit roots faster
  search(0, []);
  
  return maxScore > 0 ? bestVoicing : null;
}

function evaluateVoicing(voicing: FretVal[], targetPCs: number[], rootClass: number): number {
  const playedPCs = new Set<number>();
  let lowestNoteMidi = 999;
  let activeStrings = 0;

  for (let s = 0; s < 6; s++) {
    const v = voicing[s];
    if (v !== 'x') {
      const midi = GUITAR_TUNING[s] + (v as number);
      playedPCs.add(midi % 12);
      activeStrings++;
      if (midi < lowestNoteMidi) lowestNoteMidi = midi;
    }
  }

  if (activeStrings < 3) return -1; 
  if (!playedPCs.has(rootClass)) return -1;
  
  let score = 0;
  
  let matchedTarget = 0;
  for (const pc of targetPCs) {
    if (playedPCs.has(pc)) matchedTarget++;
  }
  if (matchedTarget === targetPCs.length) score += 50;
  else score += matchedTarget * 10;

  if ((lowestNoteMidi % 12) === rootClass) score += 30;
  score += activeStrings * 2;

  let minF = 99, maxF = -1;
  for (const v of voicing) {
    if (v !== 'x' && v !== 0) {
      if (v < minF) minF = v as number;
      if (v > maxF) maxF = v as number;
    }
  }
  if (maxF !== -1) {
    const stretch = maxF - minF;
    if (stretch > 4) return -1;
    score -= stretch * 5;
  }

  let islands = 0;
  let firstPlayed = -1, lastPlayed = -1;
  for(let s = 5; s >= 0; s--) {
    if(voicing[s] !== 'x') {
      if(firstPlayed === -1) firstPlayed = s;
      lastPlayed = s;
    }
  }
  
  if (firstPlayed !== -1 && lastPlayed !== -1) {
      for(let s = firstPlayed; s >= lastPlayed; s--) {
        if(voicing[s] === 'x') islands++;
      }
      score -= islands * 15;
  }

  return score;
}
