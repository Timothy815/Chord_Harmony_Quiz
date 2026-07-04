import React from 'react';

export type DotType = 'root' | 'interval' | 'candidate' | 'user' | 'wrong';

export interface FretDot {
  stringIndex: number;
  fret: number;
  type: DotType;
}

interface MiniFretboardProps {
  startString: number;
  endString: number;
  startFret: number;
  endFret: number;
  dots: FretDot[];
  onFretClick?: (stringIndex: number, fret: number) => void;
}

const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'];
const SINGLE_DOTS = new Set([3, 5, 7, 9]);
const DOUBLE_DOTS = new Set([12]);

const DOT_CLASSES: Record<DotType, string> = {
  root: 'bg-indigo-600 text-white',
  interval: 'bg-amber-500 text-white',
  candidate: 'border-2 border-indigo-400 bg-white hover:bg-indigo-50 cursor-pointer',
  user: 'bg-green-500 text-white',
  wrong: 'bg-red-400 text-white',
};

export function MiniFretboard({
  startString, endString, startFret, endFret, dots, onFretClick,
}: MiniFretboardProps) {
  const strings = Array.from({ length: endString - startString + 1 }, (_, i) => startString + i);
  const frets = Array.from({ length: endFret - startFret + 1 }, (_, i) => startFret + i);
  const showNut = startFret === 0;

  return (
    <div className="inline-block select-none">
      {/* Fret number header */}
      <div className="flex" style={{ marginLeft: '2rem' }}>
        {frets.map(f => (
          <div key={f} className="w-10 text-center text-xs text-gray-400">{f}</div>
        ))}
      </div>

      {strings.map(s => (
        <div key={s} className="flex items-center" style={{ height: '2.25rem' }}>
          {/* String label */}
          <span className="w-8 text-right pr-1 text-xs text-gray-500 font-mono flex-shrink-0">
            {STRING_LABELS[s]}
          </span>
          {/* Nut */}
          <div
            className="flex-shrink-0"
            style={{
              width: showNut ? '5px' : '3px',
              height: '100%',
              background: showNut ? '#1f2937' : '#9ca3af',
              borderRadius: showNut ? '2px' : '1px',
            }}
          />
          {/* Fret cells */}
          {frets.map(f => {
            const dotHere = dots.find(d => d.stringIndex === s && d.fret === f);
            return (
              <div
                key={f}
                className="w-10 flex-shrink-0 flex items-center justify-center relative"
                style={{
                  height: '100%',
                  borderRight: '1px solid #d1d5db',
                  cursor: onFretClick ? 'pointer' : 'default',
                }}
                onClick={() => onFretClick?.(s, f)}
              >
                {/* String line */}
                <div
                  className="absolute inset-x-0"
                  style={{ top: '50%', height: '1px', background: '#9ca3af' }}
                />
                {dotHere ? (
                  <div
                    className={`relative z-10 flex items-center justify-center text-xs font-bold rounded-full ${DOT_CLASSES[dotHere.type]}`}
                    style={{ width: '1.6rem', height: '1.6rem' }}
                    onClick={(e) => {
                      if (dotHere.type === 'candidate' && onFretClick) {
                        e.stopPropagation();
                        onFretClick(s, f);
                      }
                    }}
                  >
                    {dotHere.type === 'root' ? '1' : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}

      {/* Fret position dot markers */}
      <div className="flex" style={{ marginLeft: '2rem', marginTop: '5px' }}>
        {frets.map(f => (
          <div key={f} className="w-10 flex justify-center items-center" style={{ height: '0.875rem' }}>
            {DOUBLE_DOTS.has(f) ? (
              <div className="flex gap-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              </div>
            ) : SINGLE_DOTS.has(f) ? (
              <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            ) : null}
          </div>
        ))}
      </div>

      {/* Position label when not showing nut */}
      {!showNut && (
        <div className="text-xs text-gray-400 text-center mt-1" style={{ marginLeft: '2rem' }}>
          fret {startFret}
        </div>
      )}
    </div>
  );
}
