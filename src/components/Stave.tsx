import React from 'react';
import { midiToNoteString } from '../lib/musicTheory';

interface StaveProps {
  activeNotes?: number[];
  width?: number;
  height?: number;
}

export function Stave({ activeNotes = [], width = 300, height = 240 }: StaveProps) {
  // Grand Staff: Top is Treble Clef, Bottom is Bass Clef
  // Middle C (60) separates them and determines rendering staff

  const getMidiYPos = (midi: number) => {
    // diationic step mapping within a C Major octaves
    const diatonicSteps = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
    const octave = Math.floor(midi / 12) - 1;
    const noteClass = midi % 12;
    const absoluteDiatonic = (octave - 4) * 7 + diatonicSteps[noteClass];
    
    // Notes middle C and above render on treble, below on bass
    const isTreble = midi >= 60;
    
    // Treble C4 (absoluteDiatonic 0) rests at Y = 90
    // Bass C4 (absoluteDiatonic 0) rests at Y = 120
    const y = isTreble 
      ? 90 - absoluteDiatonic * 5 
      : 120 - absoluteDiatonic * 5;
      
    return { y, isTreble };
  };

  const getLedgerLines = (y: number, isTreble: boolean) => {
    const lines = [];
    if (isTreble) {
      if (y <= 30) for (let l = 30; l >= Math.floor(y/10)*10; l-=10) lines.push(l);
      if (y >= 90) for (let l = 90; l <= Math.floor(y/10)*10; l+=10) lines.push(l);
    } else {
      if (y <= 120) for (let l = 120; l >= Math.floor(y/10)*10; l-=10) lines.push(l);
      if (y >= 180) for (let l = 180; l <= Math.floor(y/10)*10; l+=10) lines.push(l);
    }
    return lines;
  };

  const sortedNotes = [...activeNotes].sort((a, b) => a - b);
  const calculatedWidth = Math.max(width, 100 + sortedNotes.length * 40);

  return (
    <div className="flex justify-center my-6">
      <div className="bg-white rounded p-4 shadow-sm border border-gray-200 overflow-x-auto w-full custom-scrollbar">
        <svg width={calculatedWidth} height={height} className="stroke-gray-800 select-none">
          <g transform="translate(20, 20)">
            {/* Grand Staff Connecting Bracket */}
            <path d="M 0 40 C -15 40, -15 105, -20 105 C -15 105, -15 170, 0 170" fill="none" stroke="black" strokeWidth="2" />
            <line x1="0" y1="40" x2="0" y2="170" stroke="black" strokeWidth="1.5" />
            
            {/* Treble staff - 5 lines (Y: 40, 50, 60, 70, 80) */}
            {[40, 50, 60, 70, 80].map(y => (
              <line key={`t-${y}`} x1="0" y1={y} x2={calculatedWidth} y2={y} strokeWidth="1.5" stroke="#333" />
            ))}
            
            {/* Bass staff - 5 lines (Y: 130, 140, 150, 160, 170) */}
            {[130, 140, 150, 160, 170].map(y => (
              <line key={`b-${y}`} x1="0" y1={y} x2={calculatedWidth} y2={y} strokeWidth="1.5" stroke="#333" />
            ))}
            
            {/* Clef symbols */}
            <text x="8" y="80" fontSize="64" fontFamily="serif" fill="black" stroke="none">𝄞</text>
            <text x="12" y="162" fontSize="56" fontFamily="serif" fill="black" stroke="none">𝄢</text>

            {/* Notes */}
            {sortedNotes.map((midi, i) => {
              const { y, isTreble } = getMidiYPos(midi);
              if (y < -50 || y > 300) return null;
              
              const noteInfo = midiToNoteString(midi);
              const isSharp = noteInfo.note.includes('#');
              const xPos = 80 + i * 40;

              // Stem follows standard rules: flipped depending on position relative to middle staff line
              const stemUp = isTreble ? y > 60 : y > 150;

              return (
                <g key={`${midi}-${i}`} transform={`translate(${xPos}, ${y})`}>
                  {/* Ledger lines */}
                  {getLedgerLines(y, isTreble).map(ly => (
                    <line key={`ledger-${ly}`} x1="-14" y1={ly - y} x2="14" y2={ly - y} stroke="black" strokeWidth="2" />
                  ))}
                  
                  {/* Note head */}
                  <ellipse cx="0" cy="0" rx="7" ry="5" fill="black" transform="rotate(-15)" />
                  
                  {/* Stem */}
                  {stemUp ? (
                    <line x1="6" y1="-30" x2="6" y2="0" stroke="black" strokeWidth="1.5" />
                  ) : (
                    <line x1="-6" y1="0" x2="-6" y2="30" stroke="black" strokeWidth="1.5" />
                  )}

                  {/* Sharp accidental */}
                  {isSharp && (
                    <text x="-22" y="5" fontSize="18" fontFamily="sans-serif" fill="black" stroke="none" fontWeight="bold">♯</text>
                  )}

                  {/* Clarifying label below stave for learners */}
                  <text x="0" y={isTreble ? (stemUp ? 45 : 45) : (stemUp ? 45 : 45)} fill="#6B7280" stroke="none" fontSize="10" textAnchor="middle" fontFamily="sans-serif" transform={`translate(0, ${isTreble ? 100 - y : 190 - y})`}>
                     {noteInfo.note}{noteInfo.octave}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
