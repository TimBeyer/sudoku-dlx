import type { SolverFactory } from '../types.js'
import {
  InternalCellsSolver,
  InternalCompiledCellsSolver,
  InternalCompiledStringSolver,
  InternalStringSolver
} from '../solvers/InternalSolvers.js'
import { AlgorithmTsSudokuSolver, FastSudokuSolver } from '../solvers/MaintainedSolvers.js'
import {
  LegacyDancingLinksAlgorithmSolver,
  LegacyMattflowSolver,
  LegacySudokuSolver,
  LegacySudokuSolverJs
} from '../solvers/LegacySolvers.js'
import { KlSudokuSolver, SudokuCSolver } from '../solvers/NativeAddonSolvers.js'

export const solvers = {
  'internal-string': () => new InternalStringSolver(),
  'internal-cells': () => new InternalCellsSolver(),
  'internal-compiled-string': () => new InternalCompiledStringSolver(),
  'internal-compiled-cells': () => new InternalCompiledCellsSolver(),
  'fast-sudoku-solver': () => new FastSudokuSolver(),
  'algorithm-ts-sudoku': () => new AlgorithmTsSudokuSolver(),
  'legacy-dancing-links-algorithm': () => new LegacyDancingLinksAlgorithmSolver(),
  'legacy-mattflow': () => new LegacyMattflowSolver(),
  'legacy-sudoku-solver-js': () => new LegacySudokuSolverJs(),
  'legacy-sudoku-solver': () => new LegacySudokuSolver(),
  'native-klsudoku': () => new KlSudokuSolver(),
  'native-sudoku-c': () => new SudokuCSolver()
} as const satisfies Record<string, SolverFactory>

export type SolverId = keyof typeof solvers

export const internalEndToEndSolvers = ['internal-string', 'internal-cells'] as const
export const internalPreparedSolvers = [
  'internal-cells',
  'internal-compiled-string',
  'internal-compiled-cells'
] as const
export const maintainedSolvers = ['fast-sudoku-solver', 'algorithm-ts-sudoku'] as const
export const legacySolvers = [
  'legacy-dancing-links-algorithm',
  'legacy-mattflow',
  'legacy-sudoku-solver-js',
  'legacy-sudoku-solver'
] as const
export const nativeAddonSolvers = ['native-klsudoku', 'native-sudoku-c'] as const
export const nativePreparedSolvers = ['native-sudoku-c'] as const

export function getSolverFactory(id: string): SolverFactory | undefined {
  return solvers[id as SolverId]
}
