import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SolverAvailability, SolverMetadata, SudokuSolverAdapter } from '../types.js'
import { consumeFlat, normalizeFlatGrid, parseOneBasedFlat } from '../problems/sudoku.js'

const nativeRequire = createRequire(findNativePackage())

function findNativePackage(): string {
  let directory = dirname(fileURLToPath(import.meta.url))
  for (let depth = 0; depth < 7; depth++) {
    const candidate = resolve(directory, 'benchmark/native/package.json')
    if (existsSync(candidate)) return candidate
    const parent = dirname(directory)
    if (parent === directory) break
    directory = parent
  }
  return resolve(process.cwd(), 'benchmark/native/package.json')
}

abstract class OptionalNativeSolver<TModule, TPrepared> implements SudokuSolverAdapter<TPrepared> {
  abstract readonly metadata: SolverMetadata
  abstract readonly packageName: string
  abstract readonly semantics: readonly ('end-to-end' | 'prepared')[]
  protected module?: TModule
  protected loadError?: string

  abstract prepare(puzzle: string): TPrepared
  abstract solveEndToEnd(puzzle: string): unknown
  abstract solvePrepared(prepared: TPrepared): unknown

  availability(): SolverAvailability {
    try {
      this.module = nativeRequire(this.packageName) as TModule
      return { available: true }
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : String(error)
      return { available: false, reason: this.loadError }
    }
  }

  normalize(result: unknown): readonly number[] | null {
    return normalizeFlatGrid(result)
  }

  consume(result: unknown): number {
    return consumeFlat(result)
  }
}

interface KlSudokuModule {
  solve(puzzle: string): string | number[]
}

export class KlSudokuSolver extends OptionalNativeSolver<KlSudokuModule, string> {
  readonly packageName = 'klsudoku'
  readonly metadata: SolverMetadata = {
    id: 'native-klsudoku',
    name: 'klsudoku',
    version: '1.3.5',
    source: 'https://www.npmjs.com/package/klsudoku',
    license: 'ISC',
    runtime: 'native-addon',
    optional: true
  }
  readonly semantics = ['end-to-end'] as const

  prepare(puzzle: string): string {
    return puzzle
  }

  solveEndToEnd(puzzle: string): unknown {
    if (!this.module) throw new Error(this.loadError ?? 'klsudoku was not loaded')
    return this.module.solve(puzzle)
  }

  solvePrepared(puzzle: string): unknown {
    return this.solveEndToEnd(puzzle)
  }
}

interface SudokuCModule {
  solve(puzzle: number[]): number[] | void
}

export class SudokuCSolver extends OptionalNativeSolver<SudokuCModule, number[]> {
  readonly packageName = 'sudoku-c'
  readonly metadata: SolverMetadata = {
    id: 'native-sudoku-c',
    name: 'sudoku-c',
    version: '1.0.0',
    source: 'https://www.npmjs.com/package/sudoku-c',
    license: 'MIT',
    runtime: 'native-addon',
    optional: true
  }
  readonly semantics = ['end-to-end', 'prepared'] as const

  prepare(puzzle: string): number[] {
    return parseOneBasedFlat(puzzle)
  }

  solveEndToEnd(puzzle: string): unknown {
    return this.run(parseOneBasedFlat(puzzle))
  }

  solvePrepared(puzzle: number[]): unknown {
    return this.run(puzzle)
  }

  private run(puzzle: number[]): number[] {
    if (!this.module) throw new Error(this.loadError ?? 'sudoku-c was not loaded')
    const mutablePuzzle = [...puzzle]
    const result = this.module.solve(mutablePuzzle)
    return Array.isArray(result) ? result : mutablePuzzle
  }
}
