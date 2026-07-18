import { createRequire } from 'node:module'
import type { SolverAvailability, SolverMetadata, SudokuSolverAdapter } from '../types.js'
import { consumeFlat, normalizeFlatGrid } from '../problems/sudoku.js'

const require = createRequire(import.meta.url)

abstract class OptionalCommonJsSolver<TModule> implements SudokuSolverAdapter<string> {
  abstract readonly metadata: SolverMetadata
  readonly semantics = ['end-to-end'] as const
  protected module?: TModule
  protected loadError?: string

  abstract readonly packageName: string
  abstract solveWith(module: TModule, puzzle: string): unknown

  availability(): SolverAvailability {
    try {
      this.module = require(this.packageName) as TModule
      return { available: true }
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : String(error)
      return { available: false, reason: this.loadError }
    }
  }

  prepare(puzzle: string): string {
    return puzzle
  }

  solveEndToEnd(puzzle: string): unknown {
    if (!this.module) throw new Error(this.loadError ?? `${this.packageName} was not loaded`)
    return this.solveWith(this.module, puzzle)
  }

  solvePrepared(): unknown {
    throw new Error(`${this.metadata.name} does not expose a prepared-input benchmark`)
  }

  normalize(result: unknown): readonly number[] | null {
    return normalizeFlatGrid(result)
  }

  consume(result: unknown): number {
    return consumeFlat(result)
  }
}

function legacyMetadata(
  id: string,
  name: string,
  version: string,
  license: string,
  source?: string
): SolverMetadata {
  return {
    id,
    name,
    version,
    source,
    license,
    runtime: 'javascript',
    optional: true
  }
}

interface DancingLinksAlgorithmModule {
  solve(puzzle: string): number[][][]
}

export class LegacyDancingLinksAlgorithmSolver extends OptionalCommonJsSolver<DancingLinksAlgorithmModule> {
  readonly packageName = 'dancing-links-algorithm'
  readonly metadata = legacyMetadata(
    'legacy-dancing-links-algorithm',
    'dancing-links-algorithm (all-solutions API)',
    '1.0.1',
    'ISC',
    'https://www.npmjs.com/package/dancing-links-algorithm'
  )

  solveWith(module: DancingLinksAlgorithmModule, puzzle: string): unknown {
    const solutions = module.solve(puzzle.replaceAll('.', '0'))
    return solutions[0] ?? null
  }
}

type MattflowModule = (puzzle: string, options?: Record<string, unknown>) => string | number[]

export class LegacyMattflowSolver extends OptionalCommonJsSolver<MattflowModule> {
  readonly packageName = '@mattflow/sudoku-solver'
  readonly metadata = legacyMetadata(
    'legacy-mattflow',
    '@mattflow/sudoku-solver',
    '2.2.0',
    'MIT',
    'https://github.com/mattflow/sudoku-solver'
  )

  solveWith(module: MattflowModule, puzzle: string): unknown {
    return module(puzzle.replaceAll('.', '0'), { hintCheck: false })
  }
}

interface SudokuSolverJsInstance {
  solve(puzzle: string, options?: Record<string, unknown>): string | number[]
}

type SudokuSolverJsConstructor = new () => SudokuSolverJsInstance

export class LegacySudokuSolverJs extends OptionalCommonJsSolver<SudokuSolverJsConstructor> {
  readonly packageName = 'sudoku-solver-js'
  readonly metadata = legacyMetadata(
    'legacy-sudoku-solver-js',
    'sudoku-solver-js',
    '0.1.4',
    'MIT',
    'https://github.com/SamirHodzic/sudoku-solver-js'
  )
  private solver?: SudokuSolverJsInstance

  override availability(): SolverAvailability {
    const result = super.availability()
    if (result.available && this.module) this.solver = new this.module()
    return result
  }

  solveWith(_module: SudokuSolverJsConstructor, puzzle: string): unknown {
    if (!this.solver) throw new Error('sudoku-solver-js constructor was not initialized')
    return this.solver.solve(puzzle)
  }
}

interface SudokuSolverGrid {
  readonly cells: readonly { readonly value: number | null }[]
}

interface SudokuSolverModule {
  Grid: new (puzzle: string) => SudokuSolverGrid
  Solver: new () => { solve(grid: SudokuSolverGrid): SudokuSolverGrid | null }
}

export class LegacySudokuSolver extends OptionalCommonJsSolver<SudokuSolverModule> {
  readonly packageName = 'sudoku_solver'
  readonly metadata = legacyMetadata(
    'legacy-sudoku-solver',
    'sudoku_solver',
    '1.0.1',
    'MIT',
    'https://github.com/Charles-BARDIN/sudoku-solver'
  )

  solveWith(module: SudokuSolverModule, puzzle: string): unknown {
    const solved = new module.Solver().solve(new module.Grid(puzzle))
    return solved?.cells.map(cell => cell.value ?? 0) ?? null
  }
}
