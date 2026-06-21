import React from 'react';
import { playNote, noteToFreq } from '../lib/audio';
import { PIANO_KEYS } from '../lib/musicTheory';

interface PianoProps {
  activeNotes?: number[]; // midi note numbers
  onNoteClick?: (midi: number) => void;
  playOnHover?: boolean;
}

export function Piano({ activeNotes = [], onNoteClick, playOnHover = false }: PianoProps) {
  const handleClick = (midi: number) => {
    playNote(noteToFreq(midi), 'sine', 0.5);
    if (onNoteClick) onNoteClick(midi);
  };

  return (
    <div className="relative flex justify-center mt-4 mb-8">
      <div className="flex border-t border-l border-b border-gray-900 rounded bg-white shadow-xl max-w-full overflow-x-auto select-none">
        {PIANO_KEYS.map((key, i) => {
          if (key.isBlack) return null; // We render white keys then float black keys on top relative to white
          
          const isActive = activeNotes.includes(key.midi);

          return (
            <div 
              key={key.midi} 
              className={`relative border-r border-gray-900 w-12 h-40 cursor-pointer flex items-end justify-center pb-2 transition-colors duration-100 ${isActive ? 'bg-indigo-300' : 'bg-white hover:bg-gray-100 active:bg-gray-200'}`}
              onClick={() => handleClick(key.midi)}
              onMouseDown={() => handleClick(key.midi)}
            >
              <span className="text-xs font-semibold text-gray-400 pointer-events-none">{key.note}{key.octave}</span>
              {/* Check if next key is black and render it inside white key relative */}
              {PIANO_KEYS[i + 1] && PIANO_KEYS[i + 1].isBlack && (
                <div 
                  className={`absolute top-0 -right-4 w-8 h-24 z-10 border border-gray-900 rounded-b cursor-pointer transition-colors duration-100 ${activeNotes.includes(PIANO_KEYS[i + 1].midi) ? 'bg-indigo-500' : 'bg-gray-900 hover:bg-gray-800'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClick(PIANO_KEYS[i + 1].midi);
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleClick(PIANO_KEYS[i + 1].midi);
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
