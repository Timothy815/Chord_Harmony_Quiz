const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

// Guitar harmonic series: amplitudes taper faster than a sawtooth,
// giving the warm, rounded timbre of a plucked string.
function makeGuitarWave(): PeriodicWave {
  const n = 32;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) {
    // Amplitude envelope: strong fundamental, harmonics roll off as ~1/k^1.5
    imag[k] = Math.pow(-1, k + 1) / Math.pow(k, 1.5);
  }
  return audioCtx.createPeriodicWave(real, imag, { disableNormalization: false });
}

const guitarWave = makeGuitarWave();

function scheduleGuitarNote(frequency: number, startTime: number, duration: number, peakGain = 0.45) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.setPeriodicWave(guitarWave);
  osc.frequency.value = frequency;

  // Pluck envelope: instant attack, quick initial decay, long exponential release
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.003);   // ~3 ms attack
  gain.gain.exponentialRampToValueAtTime(peakGain * 0.4, startTime + 0.06); // body snap
  gain.gain.exponentialRampToValueAtTime(0.00001, startTime + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

export async function playGuitarNote(frequency: number, duration = 2.0) {
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  scheduleGuitarNote(frequency, audioCtx.currentTime, duration);
}

export async function playNote(frequency: number, _type: OscillatorType = 'sine', duration: number = 0.5) {
  await playGuitarNote(frequency, duration);
}

export async function playStrum(frequencies: number[], duration: number = 2.0, stagger: number = 0.05) {
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  frequencies.forEach((freq, idx) => {
    scheduleGuitarNote(freq, audioCtx.currentTime + idx * stagger, duration, 0.35);
  });
}

// Frequencies for generic ranges
export const noteToFreq = (midiNote: number) => {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
};
