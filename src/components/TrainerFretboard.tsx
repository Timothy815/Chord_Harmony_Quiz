import React, { useEffect, useRef } from 'react';
import { GUITAR_TUNING, midiToNoteString } from '../lib/musicTheory';
import { ScaleBoxCell, cellKey } from '../lib/scalePositions';

interface TrainerFretboardProps {
  cells: ScaleBoxCell[];
  startFret: number;
  endFret: number;
  filledKeys: Set<string>;
  missedKey: string | null;
  onCellClick: (cell: ScaleBoxCell) => void;
  registerCellElement: (key: string, element: HTMLDivElement | null) => void;
}

export function TrainerFretboard({
  cells,
  startFret,
  endFret,
  filledKeys,
  missedKey,
  onCellClick,
  registerCellElement,
}: TrainerFretboardProps) {
  const cellsByKey = new Map(cells.map((cell) => [cellKey(cell.stringIndex, cell.fret), cell]));
  const fretCount = endFret - startFret + 1;
  const frets = Array.from({ length: fretCount }, (_, index) => startFret + index);
  const registeredKeys = useRef<Set<string>>(new Set());
  const markers = [3, 5, 7, 9, 12, 15, 17];

  useEffect(() => {
    return () => {
      registeredKeys.current.forEach((key) => registerCellElement(key, null));
    };
  }, [registerCellElement]);

  const setCellRef = (key: string, hasCell: boolean, el: HTMLDivElement | null) => {
    if (hasCell && el) {
      registeredKeys.current.add(key);
      registerCellElement(key, el);
    } else if (registeredKeys.current.has(key)) {
      registeredKeys.current.delete(key);
      registerCellElement(key, null);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto overflow-x-auto pb-6 custom-scrollbar">
      <div className="relative flex bg-amber-900 rounded-sm p-1 shadow-xl" style={{ minWidth: `${fretCount * 80}px` }}>
        <div className="flex-1 relative flex flex-col justify-between h-64 select-none bg-[#3e2723]">
          <div className="absolute inset-0 pointer-events-none flex">
            {frets.map((fret) => (
              <div key={fret} className="flex-1 h-full flex items-center justify-center relative border-r border-black/40">
                {markers.includes(fret) && (
                  <div
                    className="absolute w-5 h-5 rounded-full bg-white/20 shadow-inner z-0"
                    style={{ top: fret === 12 ? '20%' : '50%', transform: 'translateY(-50%)' }}
                  />
                )}
                {fret === 12 && (
                  <div
                    className="absolute w-5 h-5 rounded-full bg-white/20 shadow-inner z-0"
                    style={{ top: '80%', transform: 'translateY(-50%)' }}
                  />
                )}
              </div>
            ))}
          </div>
          {GUITAR_TUNING.map((stringBaseMidi, stringIndex) => (
            <div key={stringIndex} className="relative flex-1 flex items-center border-b border-black/30">
              <div
                className="absolute w-full h-[2px] bg-gradient-to-b from-gray-300 to-gray-500 shadow-sm z-10 pointer-events-none"
                style={{
                  top: '50%',
                  transform: 'translateY(-50%)',
                  height: `${Math.max(1, (stringIndex + 1) * 0.5)}px`,
                }}
              />
              {frets.map((fret) => {
                const key = cellKey(stringIndex, fret);
                const cell = cellsByKey.get(key);
                const isFilled = filledKeys.has(key);
                const isMissed = missedKey === key;
                const midi = stringBaseMidi + fret;
                const noteInfo = midiToNoteString(midi);

                return (
                  <div
                    key={fret}
                    ref={(el) => {
                      setCellRef(key, Boolean(cell), el);
                    }}
                    className="flex-1 h-full flex items-center justify-center relative z-20"
                  >
                    {cell && (
                      <div
                        onClick={() => onCellClick(cell)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer transition-colors border-2 ${
                          isFilled
                            ? 'bg-green-600 text-white border-green-300'
                            : isMissed
                              ? 'bg-red-600 text-white border-red-300'
                              : 'bg-black/40 text-white/70 border-white/20 hover:border-indigo-400'
                        }`}
                        title={isFilled
                          ? `String ${6 - stringIndex}, fret ${fret} (${noteInfo.note})`
                          : `String ${6 - stringIndex}, fret ${fret}`}
                      >
                        {isFilled ? noteInfo.note : ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex mt-4 pl-1" style={{ minWidth: `${fretCount * 80}px` }}>
        {frets.map((fret) => (
          <div key={fret} className="flex-1 text-center text-xs font-bold text-indigo-600">
            {fret}
          </div>
        ))}
      </div>
    </div>
  );
}
