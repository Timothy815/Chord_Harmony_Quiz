export interface StandardTuningGap {
  from: string;
  to: string;
  label: 'P4' | 'M3';
  semitones: number;
  exception: boolean;
}

export const STANDARD_TUNING_GAPS: readonly StandardTuningGap[] = [
  { from: 'E', to: 'A', label: 'P4', semitones: 5, exception: false },
  { from: 'A', to: 'D', label: 'P4', semitones: 5, exception: false },
  { from: 'D', to: 'G', label: 'P4', semitones: 5, exception: false },
  { from: 'G', to: 'B', label: 'M3', semitones: 4, exception: true },
  { from: 'B', to: 'e', label: 'P4', semitones: 5, exception: false },
];

// String indices run high-to-low (e = 0 through low E = 5).
export function crossesGBBoundary(firstString: number, secondString: number): boolean {
  return Math.min(firstString, secondString) <= 1
    && Math.max(firstString, secondString) >= 2;
}
