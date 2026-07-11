import * as Tone from 'tone';

const GUITAR_BASE = `${import.meta.env.BASE_URL}audio/guitar-acoustic/`;
const GUITAR_NOTES: Record<string, string> = {
  E2: 'E2.mp3', G2: 'G2.mp3', A2: 'A2.mp3', B2: 'B2.mp3',
  D3: 'D3.mp3', E3: 'E3.mp3', G3: 'G3.mp3', B3: 'B3.mp3',
  E4: 'E4.mp3', G4: 'G4.mp3', A4: 'A4.mp3', D5: 'D5.mp3',
};

let sampler: Tone.Sampler | null = null;
let reverb: Tone.Reverb | null = null;
let loadPromise: Promise<void> | null = null;

function ensureLoaded(): Promise<void> {
  if (loadPromise) return loadPromise;

  reverb = new Tone.Reverb({ decay: 2.5, preDelay: 0.01 });
  reverb.wet.value = 0.35;
  reverb.toDestination();

  loadPromise = new Promise<void>((resolve) => {
    sampler = new Tone.Sampler({
      urls: GUITAR_NOTES,
      baseUrl: GUITAR_BASE,
      release: 1.5,   // fade-out time when note is released
      onload: () => { reverb!.generate().then(() => resolve()); },
    }).connect(reverb!);
    sampler.volume.value = 4;
  });

  return loadPromise;
}

async function resume() {
  await Tone.start();
  await ensureLoaded();
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiToToneNote(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[midi % 12]}${octave}`;
}

// Play a note and let the sample decay naturally (no hard cutoff)
async function trigger(noteOrHz: string, velocity = 0.9) {
  sampler!.triggerAttack(noteOrHz, Tone.now(), velocity);
}

export async function playMidiNote(midi: number) {
  await resume();
  trigger(midiToToneNote(midi));
}

export async function playGuitarNote(frequency: number) {
  await resume();
  trigger(`${frequency.toFixed(3)}hz`);
}

// Kept for backwards-compat
export async function playNote(frequency: number, _type?: string, _duration?: number) {
  await playGuitarNote(frequency);
}

export async function playStrum(frequencies: number[], _duration = 2.0, stagger = 0.05) {
  await resume();
  const now = Tone.now();
  frequencies.forEach((freq, i) => {
    sampler!.triggerAttack(`${freq.toFixed(3)}hz`, now + i * stagger, 0.85);
  });
}

// Plays two notes one after another (root, then target) so the interval's sound can be heard
export async function playInterval(midiA: number, midiB: number, gapMs = 450) {
  await resume();
  const now = Tone.now();
  sampler!.triggerAttack(midiToToneNote(midiA), now, 0.9);
  sampler!.triggerAttack(midiToToneNote(midiB), now + gapMs / 1000, 0.9);
}

export const noteToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
