import type { SolverFactory } from '../types.js'
import {
  InternalCellsSolver,
  InternalCompiledCellsSolver,
  InternalCompiledStringSolver,
  InternalStringSolver
} from '../solvers/InternalSolvers.js'
import { AlgorithmTsSudokuSolver, FastSudokuSolver } from '../solvers/MaintainedSolvers.js'
import {
  HackettyamSudokuToolsSolver,
  OpenzelokuSolver,
  PyrothSodoWasmSolver,
  ReeteshSudokuEngineSolver,
  SudokuProSolver,
  SudokuBlitzSolver
} from '../solvers/ModernCompetitors.js'
import {
  LegacyDancingLinksAlgorithmSolver,
  LegacyMattflowSolver,
  LegacySudokuSolver,
  LegacySudokuSolverJs
} from '../solvers/LegacySolvers.js'

export const solvers = {
  'internal-string': () => new InternalStringSolver(),
  'internal-cells': () => new InternalCellsSolver(),
  'internal-compiled-string': () => new InternalCompiledStringSolver(),
  'internal-compiled-cells': () => new InternalCompiledCellsSolver(),
  'fast-sudoku-solver': () => new FastSudokuSolver(),
  'algorithm-ts-sudoku': () => new AlgorithmTsSudokuSolver(),
  sudokublitz: () => new SudokuBlitzSolver(),
  'reetesh-sudoku-engine': () => new ReeteshSudokuEngineSolver(),
  openzeloku: () => new OpenzelokuSolver(),
  'sudoku-pro': () => new SudokuProSolver(),
  'hackettyam-sudoku-tools': () => new HackettyamSudokuToolsSolver(),
  'pyroth-sodo-wasm': () => new PyrothSodoWasmSolver(),
  'legacy-dancing-links-algorithm': () => new LegacyDancingLinksAlgorithmSolver(),
  'legacy-mattflow': () => new LegacyMattflowSolver(),
  'legacy-sudoku-solver-js': () => new LegacySudokuSolverJs(),
  'legacy-sudoku-solver': () => new LegacySudokuSolver()
} as const satisfies Record<string, SolverFactory>

export type SolverId = keyof typeof solvers

export const internalEndToEndSolvers = ['internal-string', 'internal-cells'] as const
export const internalPreparedSolvers = ['internal-cells'] as const
export const internalCompiledSolvers = [
  'internal-compiled-string',
  'internal-compiled-cells'
] as const
export const maintainedSolvers = [
  'fast-sudoku-solver',
  'algorithm-ts-sudoku',
  'sudokublitz',
  'reetesh-sudoku-engine',
  'openzeloku',
  'sudoku-pro',
  'hackettyam-sudoku-tools',
  'pyroth-sodo-wasm'
] as const
export const maintainedPreparedSolvers = [
  'fast-sudoku-solver',
  'algorithm-ts-sudoku',
  'reetesh-sudoku-engine',
  'openzeloku',
  'sudoku-pro',
  'hackettyam-sudoku-tools'
] as const
export const legacySolvers = [
  'legacy-dancing-links-algorithm',
  'legacy-mattflow',
  'legacy-sudoku-solver-js',
  'legacy-sudoku-solver'
] as const
export function getSolverFactory(id: string): SolverFactory | undefined {
  return solvers[id as SolverId]
}
