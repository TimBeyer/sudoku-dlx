import { SudokuSolver } from '@algorithm.ts/sudoku'
import type { SolverAvailability, SolverMetadata, SudokuSolverAdapter } from '../types.js'
import {
  consumeFlat,
  normalizeFlatGrid,
  parseOneBasedMatrix,
  parseZeroBasedFlat
} from '../problems/sudoku.js'

type FastResult = [solvable: boolean, solution: number[][]]
type FastSolve = (sudoku: number[][]) => FastResult

let fastSolverPromise: Promise<FastSolve> | undefined

async function loadFastSolver(): Promise<FastSolve> {
  fastSolverPromise ??= (async () => {
    // fast-sudoku-solver 3.0.3 publishes extensionless relative ESM imports.
    // Register a narrowly scoped Node resolver so the pinned upstream package is
    // exercised unchanged. Bun already resolves those imports itself.
    if (!process.versions.bun) {
      const { register } = await import('node:module')
      register(
        new URL('../compat/fast-sudoku-solver-resolver.js', import.meta.url),
        import.meta.url
      )
    }
    const module = await import('fast-sudoku-solver')
    return module.solveSudoku
  })()
  return fastSolverPromise
}

export class FastSudokuSolver implements SudokuSolverAdapter<number[][]> {
  readonly metadata: SolverMetadata = {
    id: 'fast-sudoku-solver',
    name: 'fast-sudoku-solver',
    version: '3.0.3',
    source: 'https://github.com/luth1um/sudoku-solver-typescript',
    sourceCommit: '6bb2ce27ff147193a27adc7c96f91ae81bf3f436',
    license: 'MIT',
    runtime: 'javascript',
    optional: false
  }
  readonly semantics = ['end-to-end', 'prepared'] as const
  private solve?: FastSolve

  async initialize(): Promise<SolverAvailability> {
    try {
      this.solve = await loadFastSolver()
      return { available: true }
    } catch (error) {
      return {
        available: false,
        reason: error instanceof Error ? error.message : String(error)
      }
    }
  }

  prepare(puzzle: string): number[][] {
    return parseOneBasedMatrix(puzzle)
  }

  solveEndToEnd(puzzle: string): FastResult {
    return this.getSolver()(parseOneBasedMatrix(puzzle))
  }

  solvePrepared(puzzle: number[][]): FastResult {
    return this.getSolver()(puzzle)
  }

  normalize(result: unknown): readonly number[] | null {
    if (!Array.isArray(result) || result[0] !== true) return null
    return normalizeFlatGrid(result[1])
  }

  consume(result: unknown): number {
    if (!Array.isArray(result)) return 0
    return consumeFlat(result[1])
  }

  private getSolver(): FastSolve {
    if (!this.solve) throw new Error('fast-sudoku-solver was not initialized')
    return this.solve
  }
}

export class AlgorithmTsSudokuSolver implements SudokuSolverAdapter<number[]> {
  readonly metadata: SolverMetadata = {
    id: 'algorithm-ts-sudoku',
    name: '@algorithm.ts/sudoku',
    version: '4.0.4',
    source: 'https://github.com/guanghechen/algorithm.ts/tree/main/packages/sudoku',
    sourceCommit: '7ccc7d7a4158efadaa6dc46dd5631a92699e77bf',
    license: 'MIT',
    runtime: 'javascript',
    optional: false
  }
  readonly semantics = ['end-to-end', 'prepared'] as const
  private readonly solver = new SudokuSolver({ childMatrixWidth: 3 })

  prepare(puzzle: string): number[] {
    return parseZeroBasedFlat(puzzle)
  }

  solveEndToEnd(puzzle: string): number[] | null {
    return this.solvePrepared(parseZeroBasedFlat(puzzle))
  }

  solvePrepared(puzzle: number[]): number[] | null {
    const solution = new Array<number>(81)
    return this.solver.solve(puzzle, solution) ? solution : null
  }

  normalize(result: unknown): readonly number[] | null {
    const solution = normalizeFlatGrid(result)
    return solution?.map(value => value + 1) ?? null
  }

  consume(result: unknown): number {
    return consumeFlat(result)
  }
}
