const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

export function playNote(frequency: number, type: OscillatorType = 'sine', duration: number = 0.5) {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start();
  gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
  oscillator.stop(audioCtx.currentTime + duration);
}

export function playStrum(frequencies: number[], duration: number = 2.0, stagger: number = 0.05) {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  frequencies.forEach((freq, idx) => {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    const startTime = audioCtx.currentTime + idx * stagger;

    oscillator.type = 'triangle';
    oscillator.frequency.value = freq;

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start(startTime);
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, startTime + duration);
    oscillator.stop(startTime + duration);
  });
}

// Frequencies for generic ranges
export const noteToFreq = (midiNote: number) => {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
};
