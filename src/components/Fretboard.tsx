import React, { useRef, useEffect } from 'react';
import { GUITAR_TUNING, midiToNoteString } from '../lib/musicTheory';
import { playNote, noteToFreq } from '../lib/audio';
import { FretVal } from '../lib/guitarVoicings';

interface FretboardProps {
  activeNotes?: number[];
  voicing?: FretVal[] | null;
  onChangeVoicing?: (voicing: FretVal[]) => void;
  startFret?: number;
  endFret?: number;
}

export function Fretboard({ 
  activeNotes = [], 
  voicing = null, 
  onChangeVoicing, 
  startFret = 1, 
  endFret = 18 
}: FretboardProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to ensure startFret is visible
  useEffect(() => {
    if (scrollRef.current && startFret > 1) {
      const fretWidth = 60; // approximate width of a fret column
      scrollRef.current.scrollTo({ left: (startFret - 1) * fretWidth, behavior: 'smooth' });
    } else if (scrollRef.current && startFret === 1) {
      scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }, [startFret, endFret]);

  const handleClickFret = (stringIndex: number, midi: number, fretIndex: number) => {
    const newVoicing = voicing ? [...voicing] : ['x', 'x', 'x', 'x', 'x', 'x'];
    
    // Toggle logic: if clicking already active fret, mute the string
    if (newVoicing[stringIndex] === fretIndex) {
      newVoicing[stringIndex] = 'x';
    } else {
      newVoicing[stringIndex] = fretIndex;
    }
    
    if (onChangeVoicing) {
      onChangeVoicing(newVoicing as FretVal[]);
    }
    
    playNote(noteToFreq(midi), 'triangle', 0.5);
  };

  const handleNutClick = (stringIndex: number, midi: number) => {
    const newVoicing = voicing ? [...voicing] : ['x', 'x', 'x', 'x', 'x', 'x'];
    const currentVal = newVoicing[stringIndex];
    if (currentVal === 'x') newVoicing[stringIndex] = 0;
    else if (currentVal === 0) newVoicing[stringIndex] = 'x';
    else newVoicing[stringIndex] = 0;
    
    if (onChangeVoicing) {
      onChangeVoicing(newVoicing as FretVal[]);
    }

    if (newVoicing[stringIndex] === 0) {
      playNote(noteToFreq(midi), 'triangle', 0.5);
    }
  };

  const markers = [3, 5, 7, 9, 12, 15, 17];
  
  // Total frets to render (we render from 1 to 18 always, but visually dim those outside window)
  const TOTAL_FRETS = 18;

  const isFretInWindow = (f: number) => {
    // If we're looking at the whole board, everything is in window
    if (endFret - startFret >= 15) return true;
    return f >= startFret && f <= endFret;
  };

  return (
    <div className="w-full max-w-5xl mx-auto overflow-x-auto pb-4 custom-scrollbar" ref={scrollRef}>
      <div className="relative flex bg-amber-900 rounded-sm p-1 ml-4 shadow-xl" style={{ minWidth: `${TOTAL_FRETS * 55 + 60}px`}}>
        
        {/* Nut / Open Strings */}
        <div className="w-12 h-48 flex flex-col justify-between border-r-4 border-gray-200 bg-[#5c4033] mr-1 select-none z-30">
          {GUITAR_TUNING.map((stringBaseMidi, stringIndex) => {
            const val = voicing ? voicing[stringIndex] : null;
            const isOpenActive = val === 0 || (!voicing && activeNotes.includes(stringBaseMidi));
            const isMuted = val === 'x';
            
            return (
              <div 
                key={stringIndex} 
                className="flex-1 flex items-center justify-center border-b border-black/20 cursor-pointer hover:bg-white/20 transition-colors"
                onClick={() => handleNutClick(stringIndex, stringBaseMidi)}
                title={`String ${6 - stringIndex} (Open: ${midiToNoteString(stringBaseMidi).note}). Click to toggle Open/Mute.`}
              >
                {isMuted && <span className="text-red-300 text-xs font-bold leading-none select-none drop-shadow-md">X</span>}
                {isOpenActive && <div className="w-3 h-3 rounded-full bg-white/10 border-2 border-indigo-200 shadow-[0_0_8px_rgba(255,255,255,0.4)]"></div>}
                {!isMuted && !isOpenActive && <div className="w-2 h-2 rounded-full border border-white/20 opacity-0 group-hover:opacity-100"></div>}
              </div>
            );
          })}
        </div>

        {/* Fretboard Grid */}
        <div className="flex-1 relative flex flex-col justify-between h-48 select-none bg-[#3e2723]">
          {/* Fret background markers and dimming overlays */}
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex">
            {Array.from({ length: TOTAL_FRETS }).map((_, i) => {
              const f = i + 1;
              const inWindow = isFretInWindow(f);
              return (
                <div key={f} className={`flex-1 h-full flex items-center justify-center relative border-r border-black/40 transition-colors duration-500 ${!inWindow ? 'bg-black/40' : ''}`}>
                  {markers.includes(f) && (
                    <div className={`absolute w-5 h-5 rounded-full shadow-inner z-0 ${inWindow ? 'bg-white/20' : 'bg-white/5'}`}
                         style={{ top: f === 12 ? '20%' : '50%', transform: 'translateY(-50%)' }} />
                  )}
                  {f === 12 && (
                    <div className={`absolute w-5 h-5 rounded-full shadow-inner z-0 ${inWindow ? 'bg-white/20' : 'bg-white/5'}`}
                         style={{ top: '80%', transform: 'translateY(-50%)' }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Strings and Notes */}
          {GUITAR_TUNING.map((stringBaseMidi, stringIndex) => (
            <div key={stringIndex} className="relative flex-1 flex items-center border-b border-black/30 group">
              {/* String line */}
              <div className="absolute w-full h-[2px] bg-gradient-to-b from-gray-300 to-gray-500 shadow-sm z-10 pointer-events-none" 
                   style={{ height: `${Math.max(1, (6 - stringIndex) * 0.5)}px` }} />
              
              {/* Note nodes on frets */}
              {Array.from({ length: TOTAL_FRETS }).map((_, i) => {
                const fretIndex = i + 1;
                const midi = stringBaseMidi + fretIndex;
                const noteInfo = midiToNoteString(midi);
                
                let isActive = false;
                if (voicing) isActive = voicing[stringIndex] === fretIndex;
                else isActive = activeNotes.includes(midi);
                
                const inWindow = isFretInWindow(fretIndex);
                
                return (
                  <div 
                    key={fretIndex}
                    className={`flex-1 h-full flex items-center justify-center relative cursor-pointer z-20 ${inWindow ? 'hover:bg-white/20' : 'hover:bg-white/10'}`}
                    onClick={() => handleClickFret(stringIndex, midi, fretIndex)}
                  >
                    {isActive ? (
                      <div className={`w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold z-30 shadow-md ring-2 absolute ${inWindow ? 'bg-indigo-600 ring-indigo-200' : 'bg-indigo-800/80 ring-indigo-500/50'}`}>
                        {noteInfo.note}
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center text-xs font-bold z-30 opacity-0 group-hover:opacity-100 transition-opacity absolute pointer-events-none border border-white/20">
                        {noteInfo.note}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      
      {/* Fret numbers below mapping to the fretboard grid columns */}
      <div className="flex ml-4 mt-2" style={{ minWidth: `${TOTAL_FRETS * 55 + 60}px`}}>
        <div className="w-12 mr-1 text-center text-xs text-gray-500 font-medium">Nut</div>
        <div className="flex-1 flex">
          {Array.from({ length: TOTAL_FRETS }).map((_, i) => {
             const f = i + 1;
             const inWindow = isFretInWindow(f);
             return (
               <div key={i} className={`flex-1 text-center text-xs font-bold transition-colors ${inWindow && (endFret - startFret < 15) ? 'text-indigo-600' : 'text-gray-400'}`}>
                 {f}
               </div>
             );
          })}
        </div>
      </div>
    </div>
  );
}
