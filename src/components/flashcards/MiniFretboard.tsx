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

function Dot({ dot, onClick }: { dot: FretDot; onClick?: () => void }) {
  return (
    <div
      className={`flex items-center justify-center text-xs font-bold rounded-full ${DOT_CLASSES[dot.type]}`}
      style={{ width: '1.6rem', height: '1.6rem' }}
      onClick={onClick}
    >
      {dot.type === 'root' ? '1' : null}
    </div>
  );
}

export function MiniFretboard({
  startString, endString, startFret, endFret, dots, onFretClick,
}: MiniFretboardProps) {
  const strings = Array.from({ length: endString - startString + 1 }, (_, i) => startString + i);
  const showNut = startFret === 0;
  // When the nut is shown, fret 0 is represented by the string label area — not a grid column
  const gridFrets = Array.from(
    { length: endFret - startFret + 1 },
    (_, i) => startFret + i,
  ).filter(f => f > 0 || !showNut);

  return (
    <div className="inline-block select-none">
      {/* Fret number header — aligns with grid columns only */}
      <div className="flex" style={{ marginLeft: '2rem' }}>
        {gridFrets.map(f => (
          <div key={f} className="w-10 text-center text-xs text-gray-400">{f}</div>
        ))}
      </div>

      {strings.map(s => {
        const openDot = showNut ? dots.find(d => d.stringIndex === s && d.fret === 0) : undefined;

        return (
          <div key={s} className="flex items-center" style={{ height: '2.25rem' }}>
            {/* String label or open-string dot */}
            <div
              className="w-8 flex items-center justify-center flex-shrink-0"
              style={{ cursor: openDot && onFretClick ? 'pointer' : 'default' }}
              onClick={() => openDot && onFretClick?.(s, 0)}
            >
              {openDot ? (
                <Dot dot={openDot} />
              ) : (
                <span className="text-xs text-gray-500 font-mono">{STRING_LABELS[s]}</span>
              )}
            </div>

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

            {/* Fretted grid cells */}
            {gridFrets.map(f => {
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
                  <div
                    className="absolute inset-x-0"
                    style={{ top: '50%', height: '1px', background: '#9ca3af' }}
                  />
                  {dotHere ? (
                    <Dot
                      dot={dotHere}
                      onClick={dotHere.type === 'candidate' && onFretClick
                        ? () => onFretClick(s, f)
                        : undefined}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Position dot markers */}
      <div className="flex" style={{ marginLeft: '2rem', marginTop: '5px' }}>
        {gridFrets.map(f => (
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

      {!showNut && (
        <div className="text-xs text-gray-400 text-center mt-1" style={{ marginLeft: '2rem' }}>
          fret {startFret}
        </div>
      )}
    </div>
  );
}
