import React, { useState } from 'react';
import { getMidiFromNoteStrAndOctave, CHORDS } from '../lib/musicTheory';
import { ActiveChordContext } from './TheoryReference';

interface CircleOfFifthsProps {
  onNotesSelected: (midis: number[], chordContext?: ActiveChordContext) => void;
}

export function CircleOfFifths({ onNotesSelected }: CircleOfFifthsProps) {
  // Ordered by fifths clockwise
  const circleMajor = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];
  const circleMinor = ['A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F', 'C', 'G', 'D'];
  
  const [selectedKey, setSelectedKey] = useState<{ note: string, type: string } | null>(null);

  const handleSelect = (note: string, type: 'Major' | 'Minor') => {
    setSelectedKey({ note, type });
    const scaleDef = (CHORDS as any)[type];
    const midis = scaleDef.intervals.map((interval: number) => getMidiFromNoteStrAndOctave(note, 4) + interval);
    onNotesSelected(midis, { rootNote: note, type, intervals: scaleDef.intervals, hideLabel: false });
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col items-center">
      <h2 className="text-xl font-bold tracking-tight text-gray-900 mb-6 w-full text-left">Circle of Fifths</h2>
      
      <div className="relative w-80 h-80 rounded-full from-indigo-50 to-white bg-gradient-to-br border shadow-inner flex items-center justify-center">
        {circleMajor.map((note, index) => {
          const angle = (index * 30 - 90) * (Math.PI / 180);
          
          // Position for Major (outer ring)
          const outerRadius = 135;
          const outerX = 160 + outerRadius * Math.cos(angle);
          const outerY = 160 + outerRadius * Math.sin(angle);
          
          // Position for Minor (inner ring)
          const innerRadius = 85;
          const innerX = 160 + innerRadius * Math.cos(angle);
          const innerY = 160 + innerRadius * Math.sin(angle);

          const isMajorSelected = selectedKey?.note === note && selectedKey?.type === 'Major';
          const isMinorSelected = selectedKey?.note === circleMinor[index] && selectedKey?.type === 'Minor';

          let majorLabel = '';
          let minorLabel = '';
          let isRelated = false;

          if (selectedKey) {
            const isMajor = selectedKey.type === 'Major';
            let selIndex = isMajor ? circleMajor.indexOf(selectedKey.note) : circleMinor.indexOf(selectedKey.note);
            
            const diff = (index - selIndex + 12) % 12;
            if (isMajor) {
                if (diff === 0) { majorLabel = 'I'; minorLabel = 'vi'; isRelated = true; }
                else if (diff === 1) { majorLabel = 'V'; minorLabel = 'iii'; isRelated = true; }
                else if (diff === 11) { majorLabel = 'IV'; minorLabel = 'ii'; isRelated = true; }
            } else {
                if (diff === 0) { majorLabel = 'III'; minorLabel = 'i'; isRelated = true; }
                else if (diff === 1) { majorLabel = 'VII'; minorLabel = 'v'; isRelated = true; }
                else if (diff === 11) { majorLabel = 'VI'; minorLabel = 'iv'; isRelated = true; }
            }
          }

          return (
            <React.Fragment key={index}>
              {/* Slices representation using absolute positioned buttons */}
              <div 
                className="absolute"
                style={{ left: outerX, top: outerY }}
              >
                <button
                  onClick={() => handleSelect(note, 'Major')}
                  className={`absolute w-12 h-12 -ml-6 -mt-6 rounded-full flex items-center justify-center font-bold text-sm transition-all focus:outline-none z-10 ${
                    isMajorSelected 
                      ? 'bg-indigo-600 text-white shadow-md scale-110' 
                      : isRelated
                        ? 'bg-indigo-100 text-indigo-900 border-2 border-indigo-300 shadow-sm'
                        : 'bg-white text-indigo-900 border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 shadow-sm hover:scale-105'
                  }`}
                  title={`${note} Major`}
                >
                  {note}
                </button>
                {majorLabel && (
                   <div className="absolute -top-7 -right-7 w-6 h-6 bg-indigo-800 text-white rounded-full flex items-center justify-center text-[10px] font-bold z-20 shadow-sm pointer-events-none">
                     {majorLabel}
                   </div>
                )}
              </div>
              
              <div
                className="absolute"
                style={{ left: innerX, top: innerY }}
              >
                <button
                  onClick={() => handleSelect(circleMinor[index], 'Minor')}
                  className={`absolute w-10 h-10 -ml-5 -mt-5 rounded-full flex items-center justify-center font-medium text-xs transition-all focus:outline-none z-10 ${
                    isMinorSelected 
                      ? 'bg-amber-500 text-white shadow-md scale-110' 
                      : isRelated
                        ? 'bg-amber-100 text-amber-900 border-2 border-amber-300 shadow-sm'
                        : 'bg-gray-50 text-gray-700 border border-gray-200 hover:border-amber-400 hover:bg-amber-50 shadow-sm hover:scale-105'
                  }`}
                  title={`${circleMinor[index]} Minor`}
                >
                  {circleMinor[index]}m
                </button>
                {minorLabel && (
                   <div className="absolute -top-5 -right-5 w-5 h-5 bg-amber-600 text-white rounded-full flex items-center justify-center text-[9px] font-bold z-20 shadow-sm pointer-events-none">
                     {minorLabel}
                   </div>
                )}
              </div>
            </React.Fragment>
          );
        })}
        {/* Center decorative element */}
        <div className="absolute w-24 h-24 rounded-full border-2 border-indigo-100 bg-white flex items-center justify-center text-indigo-200 opacity-50 z-0 pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
        </div>
      </div>
      
      <p className="text-sm text-gray-500 mt-8 text-center max-w-md">
        Click on the outer ring for Major chords, or the inner ring for relative Minor chords. Moving clockwise shifts up by a fifth (7 semitones). Clicking a key will highlight its adjacent IV and V chords, as well as its relative minor/major chords.
      </p>
    </div>
  );
}
