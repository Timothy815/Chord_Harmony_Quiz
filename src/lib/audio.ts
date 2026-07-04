import * as Tone from 'tone';

const GUITAR_BASE = `${import.meta.env.BASE_URL}audio/guitar-acoustic/`;
const GUITAR_NOTES: Record<string, string> = {
  E2: 'E2.mp3', G2: 'G2.mp3', A2: 'A2.mp3', B2: 'B2.mp3',
  D3: 'D3.mp3', E3: 'E3.mp3', G3: 'G3.mp3', B3: 'B3.mp3',
  E4: 'E4.mp3', G4: 'G4.mp3', A4: 'A4.mp3', D5: 'D5.mp3',
};

let sampler: Tone.Sampler | null = null;
let loadPromise: Promise<void> | null = null;

function ensureLoaded(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise<void>((resolve) => {
    sampler = new Tone.Sampler({
      urls: GUITAR_NOTES,
      baseUrl: GUITAR_BASE,
      onload: resolve,
    }).toDestination();
    sampler.volume.value = 4;
  });
  return loadPromise;
}

async function resume() {
  await Tone.start();
  await ensureLoaded();
}

// Convert MIDI number to Tone.js note string (e.g. 64 → "E4")
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiToToneNote(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[midi % 12]}${octave}`;
}

export async function playGuitarNote(frequency: number, duration = 2.0) {
  await resume();
  sampler!.triggerAttackRelease(`${frequency.toFixed(3)}hz`, duration);
}

// Kept for backwards-compat — delegates to sampler, ignores oscillator type
export async function playNote(frequency: number, _type?: string, duration = 2.0) {
  await playGuitarNote(frequency, duration);
}

export async function playStrum(
  frequencies: number[],
  duration = 2.0,
  stagger = 0.05,
) {
  await resume();
  const now = Tone.now();
  frequencies.forEach((freq, i) => {
    sampler!.triggerAttackRelease(`${freq.toFixed(3)}hz`, duration, now + i * stagger);
  });
}

// Play a note by MIDI number (used internally by components)
export async function playMidiNote(midi: number, duration = 2.0) {
  await resume();
  sampler!.triggerAttackRelease(midiToToneNote(midi), duration);
}

export const noteToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
