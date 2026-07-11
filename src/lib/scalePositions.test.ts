import assert from 'node:assert/strict';
import test from 'node:test';
import { GUITAR_TUNING } from './musicTheory';
import {
  CAGED_ANCHORS,
  generateScaleBox,
  getCagedFretRange,
} from './scalePositions';

test('CAGED shapes use the same C fret ranges as Guitar_Master', () => {
  const ranges = Object.fromEntries(CAGED_ANCHORS.map((shape) => {
    const { startFret, endFret } = getCagedFretRange(0, shape);
    return [shape.name, [startFret, endFret]];
  }));

  assert.deepEqual(ranges, {
    'C-Shape': [0, 4],
    'A-Shape': [3, 7],
    'G-Shape': [5, 9],
    'E-Shape': [7, 11],
    'D-Shape': [10, 14],
  });
});

test('C minor pentatonic C-shape matches the reference diagram', () => {
  const cells = generateScaleBox(0, [0, 3, 5, 7, 10], CAGED_ANCHORS[0]);
  const coordinates = cells.map(({ stringIndex, fret }) => `${stringIndex}:${fret}`);

  assert.deepEqual(coordinates, [
    '0:1', '0:3',
    '1:1', '1:4',
    '2:0', '2:3',
    '3:1', '3:3',
    '4:1', '4:3',
    '5:1', '5:3',
  ]);
});

test('every shape transposes and contains only requested tones', () => {
  const expectedStartsByShape = {
    'C-Shape': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    'A-Shape': [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2],
    'G-Shape': [5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4],
    'E-Shape': [7, 8, 9, 10, 0, 0, 1, 2, 3, 4, 5, 6],
    'D-Shape': [10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  } as const;
  const pentatonicSteps = [
    [0, 2, 4, 7, 9],
    [0, 3, 5, 7, 10],
  ];

  for (let root = 0; root < 12; root++) {
    for (const shape of CAGED_ANCHORS) {
      const range = getCagedFretRange(root, shape);
      const expectedStart = expectedStartsByShape[shape.name][root];
      assert.deepEqual(range, {
        startFret: expectedStart,
        endFret: expectedStart + 4,
      }, `${shape.name} has the wrong range for root ${root}`);

      for (const steps of pentatonicSteps) {
        const tones = steps.map((step) => (root + step) % 12);
        const cells = generateScaleBox(root, tones, shape);
        const expectedCells = GUITAR_TUNING.flatMap((baseMidi, stringIndex) =>
          Array.from({ length: 5 }, (_, offset) => {
            const fret = expectedStart + offset;
            return { stringIndex, fret, pitchClass: (baseMidi + fret) % 12 };
          }).filter((cell) => tones.includes(cell.pitchClass)),
        );

        assert.deepEqual(cells, expectedCells, `${shape.name} has wrong notes for root ${root}`);
        assert.ok(cells.some((cell) => cell.pitchClass === root),
          `${shape.name} is missing the root for key ${root}`);
      }
    }
  }
});
