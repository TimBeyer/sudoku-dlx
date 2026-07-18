import {
  compileCells,
  compileString,
  parseStringFormat,
  solveCells,
  solveString,
  type CompiledSudoku,
  type SudokuCell
} from '../../index.js'
import type { SolverMetadata, SudokuSolverAdapter } from '../types.js'
import { consumeFlat, normalizeInternalSolutions } from '../problems/sudoku.js'

const source = 'workspace'

function metadata(id: string, name: string): SolverMetadata {
  return {
    id,
    name,
    version: source,
    source: 'https://github.com/TimBeyer/sudoku-dlx',
    license: 'MIT',
    runtime: 'javascript',
    optional: false
  }
}

abstract class InternalAdapter<TPrepared> implements SudokuSolverAdapter<TPrepared> {
  abstract readonly metadata: SolverMetadata
  abstract readonly semantics: readonly ('end-to-end' | 'prepared')[]
  abstract prepare(puzzle: string): TPrepared
  abstract solvePrepared(prepared: TPrepared): unknown
  solveEndToEnd?(_puzzle: string): unknown

  normalize(result: unknown): readonly number[] | null {
    return normalizeInternalSolutions(result)
  }

  consume(result: unknown): number {
    return consumeFlat(result)
  }
}

export class InternalStringSolver extends InternalAdapter<string> {
  readonly metadata = metadata('internal-string', 'sudoku-dlx solveString')
  readonly semantics = ['end-to-end'] as const

  prepare(puzzle: string): string {
    return puzzle
  }

  solveEndToEnd(puzzle: string): SudokuCell[][] {
    return solveString(puzzle)
  }

  solvePrepared(puzzle: string): SudokuCell[][] {
    return solveString(puzzle)
  }
}

export class InternalCellsSolver extends InternalAdapter<SudokuCell[]> {
  readonly metadata = metadata('internal-cells', 'sudoku-dlx solveCells')
  readonly semantics = ['end-to-end', 'prepared'] as const

  prepare(puzzle: string): SudokuCell[] {
    return parseStringFormat(puzzle)
  }

  solveEndToEnd(puzzle: string): SudokuCell[][] {
    return solveCells(parseStringFormat(puzzle))
  }

  solvePrepared(cells: SudokuCell[]): SudokuCell[][] {
    return solveCells(cells)
  }
}

export class InternalCompiledStringSolver extends InternalAdapter<CompiledSudoku> {
  readonly metadata = metadata('internal-compiled-string', 'sudoku-dlx compiled-string solve')
  readonly semantics = ['prepared'] as const

  prepare(puzzle: string): CompiledSudoku {
    return compileString(puzzle)
  }

  solvePrepared(compiled: CompiledSudoku): SudokuCell[][] {
    return compiled.solve()
  }
}

export class InternalCompiledCellsSolver extends InternalAdapter<CompiledSudoku> {
  readonly metadata = metadata('internal-compiled-cells', 'sudoku-dlx compiled-cells solve')
  readonly semantics = ['prepared'] as const

  prepare(puzzle: string): CompiledSudoku {
    return compileCells(parseStringFormat(puzzle))
  }

  solvePrepared(compiled: CompiledSudoku): SudokuCell[][] {
    return compiled.solve()
  }
}
