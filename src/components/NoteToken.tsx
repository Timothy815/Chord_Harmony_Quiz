import React, { useRef } from 'react';
import { motion, PanInfo } from 'motion/react';

interface NoteTokenProps {
  pitchClass: number;
  label: string;
  selected: boolean;
  onTap: (pitchClass: number) => void;
  onDragEnd: (pitchClass: number, point: { x: number; y: number }) => void;
}

const DRAG_THRESHOLD = 6;

function viewportPoint(
  event: MouseEvent | TouchEvent | PointerEvent,
  pagePoint: { x: number; y: number },
): { x: number; y: number } {
  if ('changedTouches' in event && event.changedTouches.length > 0) {
    const touch = event.changedTouches[0];
    return { x: touch.clientX, y: touch.clientY };
  }
  if ('clientX' in event) {
    return { x: event.clientX, y: event.clientY };
  }

  return { x: pagePoint.x - window.scrollX, y: pagePoint.y - window.scrollY };
}

export function NoteToken({
  pitchClass,
  label,
  selected,
  onTap,
  onDragEnd,
}: NoteTokenProps) {
  const draggedRef = useRef(false);

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.15}
      dragSnapToOrigin
      whileDrag={{ scale: 1.15, zIndex: 50 }}
      whileTap={{ scale: 0.95 }}
      onDragStart={() => {
        draggedRef.current = false;
      }}
      onDrag={(_event, info: PanInfo) => {
        if (Math.abs(info.offset.x) > DRAG_THRESHOLD || Math.abs(info.offset.y) > DRAG_THRESHOLD) {
          draggedRef.current = true;
        }
      }}
      onDragEnd={(event, info: PanInfo) => {
        if (draggedRef.current) {
          onDragEnd(pitchClass, viewportPoint(event, info.point));
        }
      }}
      onClick={() => {
        if (!draggedRef.current) onTap(pitchClass);
      }}
      className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold cursor-grab active:cursor-grabbing select-none shadow-md ring-2 transition-colors ${
        selected
          ? 'bg-indigo-600 text-white ring-indigo-300'
          : 'bg-white text-indigo-900 ring-indigo-200 hover:ring-indigo-400'
      }`}
      style={{ touchAction: 'none' }}
    >
      {label}
    </motion.div>
  );
}
