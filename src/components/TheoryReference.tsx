import React, { useState } from 'react';
import { CHORDS, SCALES, MODES, buildChord, buildScale, getMidiFromNoteStrAndOctave, NOTES, getNoteIndex } from '../lib/musicTheory';
import { generateVoicings, FretVal } from '../lib/guitarVoicings';

export interface ActiveChordContext {
  rootNote: string;
  type: string;
  intervals: number[];
  isScale?: boolean;
  hideLabel?: boolean;
}

interface TheoryReferenceProps {
  onNotesSelected: (midis: number[], chordContext?: ActiveChordContext) => void;
  onVoicingSelected?: (voicing: FretVal[]) => void;
}

export function TheoryReference({ onNotesSelected, onVoicingSelected }: TheoryReferenceProps) {
  const [rootNote, setRootNote] = useState('C');
  const [octave, setOctave] = useState(4);
  const [view, setView] = useState<'chords' | 'scales' | 'modes'>('chords');

  const handlePlayChord = (name: string, intervals: number[]) => {
    const midis = intervals.map(interval => getMidiFromNoteStrAndOctave(rootNote, octave) + interval);
    onNotesSelected(midis, { rootNote, type: name, intervals });
  };

  const handlePlayScale = (name: string, intervals: number[]) => {
    const midis = intervals.map(interval => getMidiFromNoteStrAndOctave(rootNote, octave) + interval);
    // Use isScale flag to know not to try algorithmic voicing generation for scales
    onNotesSelected(midis, { rootNote, type: name, intervals, isScale: true });
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
        <h2 className="text-xl font-bold tracking-tight text-gray-900 mb-4 sm:mb-0">Theory Reference</h2>
        <div className="flex gap-2">
          <select 
            value={rootNote} 
            onChange={(e) => setRootNote(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm bg-white"
          >
            {NOTES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <select 
            value={octave} 
            onChange={(e) => setOctave(Number(e.target.value))}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm bg-white"
          >
            {[2, 3, 4, 5].map(o => <option key={o} value={o}>Octave {o}</option>)}
          </select>
        </div>
      </div>

      <div className="flex border-b border-gray-200 mb-6">
        <button 
          className={`px-4 py-2 font-medium text-sm ${view === 'chords' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setView('chords')}
        >
          Chords
        </button>
        <button 
          className={`px-4 py-2 font-medium text-sm ${view === 'scales' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setView('scales')}
        >
          Scales
        </button>
        <button 
          className={`px-4 py-2 font-medium text-sm ${view === 'modes' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setView('modes')}
        >
          Modes
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {view === 'chords' && Object.entries(CHORDS).map(([name, data]) => (
          <div key={name} className="border border-gray-200 p-4 rounded hover:border-indigo-300 transition-colors cursor-pointer" onClick={() => handlePlayChord(name, data.intervals)}>
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-gray-900">{name}</h3>
              <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{rootNote}{data.abbr}</span>
            </div>
            <p className="text-sm font-mono text-gray-500 mb-2">Intervals: {data.intervals.join(', ')}</p>
            <div className="flex gap-1 flex-wrap mb-3">
              {buildChord(rootNote, data).map(n => (
                <span key={n} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded">{n}</span>
              ))}
            </div>

            {onVoicingSelected && (
              <div className="pt-3 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 mb-1.5 uppercase font-semibold tracking-wider">Common Shapes</p>
                <div className="flex flex-wrap gap-1.5">
                  {generateVoicings(rootNote, name).map(v => (
                    <button 
                      key={v.name}
                      onClick={(e) => { e.stopPropagation(); onVoicingSelected(v.frets); }}
                      className="text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200 px-2 py-1 rounded hover:bg-amber-100 transition-colors"
                    >
                      {v.name}
                    </button>
                  ))}
                  {generateVoicings(rootNote, name).length === 0 && (
                    <span className="text-[10px] text-gray-400">Auto-Voiced Available</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {view === 'scales' && Object.entries(SCALES).map(([name, data]) => (
          <div key={name} className="border border-gray-200 p-4 rounded hover:border-indigo-300 transition-colors cursor-pointer" onClick={() => handlePlayScale(name, data.steps)}>
            <h3 className="font-semibold text-gray-900 mb-1">{name}</h3>
            <p className="text-xs font-mono text-indigo-500 mb-2">{data.pattern}</p>
            <div className="flex gap-1 flex-wrap">
              {buildScale(rootNote, data).map(n => (
                <span key={n} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">{n}</span>
              ))}
            </div>
          </div>
        ))}

        {view === 'modes' && Object.entries(MODES).map(([name, data]) => (
          <div key={name} className="border border-gray-200 p-4 rounded hover:border-indigo-300 transition-colors cursor-pointer" onClick={() => handlePlayScale(name, data.intervals)}>
            <div className="flex justify-between items-start mb-1">
              <h3 className="font-semibold text-gray-900">{name}</h3>
            </div>
             <p className="text-xs text-gray-500 mb-2">{data.hint}</p>
            <div className="flex gap-1 flex-wrap">
              {buildScale(rootNote, { steps: data.intervals }).map(n => (
                <span key={n} className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded">{n}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
