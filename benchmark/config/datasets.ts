import { createHash } from 'node:crypto'
import type { DatasetDefinition } from '../types.js'
import { EASY_PUZZLE, HARD_PUZZLE, SMALL_ROTATING_CORPUS } from '../datasets/smoke.js'

function defineDataset(definition: Omit<DatasetDefinition, 'sha256'>): DatasetDefinition {
  return {
    ...definition,
    sha256: createHash('sha256').update(definition.puzzles.join('\n')).digest('hex')
  }
}

export const datasets = {
  easy: defineDataset({
    id: 'easy',
    name: 'Easy fixed puzzle',
    description: 'The original repository easy benchmark fixture.',
    source: 'sudoku-dlx repository fixture',
    license: 'MIT',
    puzzles: [EASY_PUZZLE]
  }),
  hard: defineDataset({
    id: 'hard',
    name: 'Hard fixed puzzle',
    description: 'The original repository hard benchmark fixture.',
    source: 'sudoku-dlx repository fixture',
    license: 'MIT',
    puzzles: [HARD_PUZZLE]
  }),
  rotating: defineDataset({
    id: 'rotating',
    name: 'Small deterministic rotating corpus',
    description:
      'Eight easy and hard fixtures generated with Sudoku-preserving digit and board transformations.',
    source: 'sudoku-dlx repository fixtures; deterministic local transformations',
    license: 'MIT',
    puzzles: SMALL_ROTATING_CORPUS
  })
} as const satisfies Record<string, DatasetDefinition>

export type DatasetId = keyof typeof datasets

export function getDataset(id: string): DatasetDefinition | undefined {
  return datasets[id as DatasetId]
}
