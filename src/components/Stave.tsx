import React from 'react';
import { midiToNoteString } from '../lib/musicTheory';

interface StaveProps {
  activeNotes?: number[];
  width?: number;
  height?: number;
}

export function Stave({ activeNotes = [], width = 300, height = 120 }: StaveProps) {
  // SVG based very simple treble clef staff
  // Middle C (60) is below staff
  // Treble clef bottom line is E4 (64)
  // Treble clef top line is F5 (77)

  // Map midi numbers to y-coordinates on the staff
  // Standard lines y-coords (5 lines): 20, 40, 60, 80, 100
  // Line interval is 20, so half-step space is 10
  
  // Note mapping (Treble clef)
  // F5 (77) -> 20
  // E5 (76) -> 30
  // D5 (74) -> 40
  // C5 (72) -> 50
  // B4 (71) -> 60
  // A4 (69) -> 70
  // G4 (67) -> 80
  // F4 (65) -> 90
  // E4 (64) -> 100
  // D4 (62) -> 110
  // C4 (60) -> 120

  const getMidiYPos = (midi: number) => {
    // This is an approximate mapping prioritizing natural notes
    // We compute the number of white keys from C4 (60)
    const baseMidi = 60; // C4
    if (midi < 50 || midi > 84) return -100; // Out of range for simple treble
    
    // diatonic step from C4
    const diatonicSteps = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
    
    const octave = Math.floor(midi / 12) - 1;
    const noteClass = midi % 12;
    
    const absoluteDiatonic = (octave - 4) * 7 + diatonicSteps[noteClass];
    
    // C4 is at y=120, each diatonic step moves up by 10 (subtract 10 from y)
    return 120 - absoluteDiatonic * 10;
  };

  const getLedgerLines = (y: number) => {
    const lines = [];
    if (y >= 120) {
      for (let l = 120; l <= y; l += 20) lines.push(l);
    }
    if (y <= 0) {
      for (let l = 0; l >= y; l -= 20) lines.push(l);
    }
    return lines;
  };

  return (
    <div className="flex justify-center my-6">
      <div className="bg-white rounded p-4 shadow-sm border border-gray-200 overflow-x-auto">
        <svg width={width} height={height + 40} className="stroke-gray-800">
          <g transform="translate(0, 20)">
            {/* 5 lines of the staff */}
            {[20, 40, 60, 80, 100].map(y => (
              <line key={y} x1="0" y1={y} x2={width} y2={y} strokeWidth="1.5" />
            ))}
            
            {/* Treble clef symbol approximation */}
            <text x="10" y="85" fontSize="60" fontFamily="serif" fill="black" stroke="none">𝄞</text>

            {/* Notes */}
            {activeNotes.map((midi, i) => {
              const y = getMidiYPos(midi);
              if (y < -50) return null;
              
              const isSharp = midiToNoteString(midi).note.includes('#');
              const xPos = 80 + i * 40;

              return (
                <g key={`${midi}-${i}`} transform={`translate(${xPos}, ${y})`}>
                  {/* Ledger lines */}
                  {getLedgerLines(y).map(ly => (
                    <line key={ly} x1="-15" y1={ly - y} x2="15" y2={ly - y} stroke="black" strokeWidth="2" />
                  ))}
                  
                  {/* Note head */}
                  <ellipse cx="0" cy="0" rx="7" ry="5" fill="black" transform="rotate(-20)" />
                  
                  {/* Stem (simplified, up for lower notes, down for higher) */}
                  {y > 60 ? (
                    <line x1="6" y1="-25" x2="6" y2="0" stroke="black" strokeWidth="1.5" />
                  ) : (
                    <line x1="-6" y1="0" x2="-6" y2="25" stroke="black" strokeWidth="1.5" />
                  )}

                  {/* Sharp accidental */}
                  {isSharp && (
                    <text x="-20" y="5" fontSize="16" fontFamily="sans-serif" fill="black" stroke="none">♯</text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
