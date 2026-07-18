import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { Board as SudokuBlitzBoard, solve as solveSudokuBlitz } from 'sudokublitz'
import {
  solve as solveWithReetesh,
  stringToBoard,
  type Board as ReeteshBoard
} from '@reetesh/sudoku-engine'
import { solve as solveWithOpenzeloku, stringToGrid, type Grid as OpenzelokuGrid } from 'openzeloku'
import type { SolverAvailability, SolverMetadata, SudokuSolverAdapter } from '../types.js'
import { consumeFlat, normalizeFlatGrid, parseOneBasedMatrix } from '../problems/sudoku.js'

type SudokuGrid = number[][]

interface SudokuProModule {
  solveSudoku(grid: SudokuGrid): boolean
}

interface HackettyamSolveResult {
  readonly board: SudokuGrid | null
  readonly error?: string
}

interface HackettyamSudokuToolsModule {
  solvePuzzle(board: SudokuGrid): HackettyamSolveResult
}

const benchmarkRequire = createRequire(import.meta.url)
const sudokuPro = benchmarkRequire('sudoku-pro') as SudokuProModule

// @hackettyam/sudoku-tools 1.1.0 publishes documented import and require
// conditions, but its ESM files contain extensionless directory imports that
// Node rejects. Exercise the published public CommonJS condition unchanged;
// loading remains outside every timed operation, just like ordinary module
// initialization for the other adapters.
const hackettyamSudokuTools = benchmarkRequire(
  '@hackettyam/sudoku-tools'
) as HackettyamSudokuToolsModule

interface SudokuBlitzResult {
  readonly solution: string | null
}

interface ReeteshResult {
  readonly solved: boolean
  readonly board: ReeteshBoard
}

export class SudokuProSolver implements SudokuSolverAdapter<SudokuGrid> {
  readonly metadata: SolverMetadata = {
    id: 'sudoku-pro',
    name: 'sudoku-pro',
    version: '1.0.15',
    source: 'https://github.com/concurdev/sudoku-pro',
    sourceCommit: '7b24d53dba4399eeeee25b52d8aa2e3cb73dee2c',
    license: 'MIT',
    runtime: 'javascript',
    optional: false
  }
  readonly semantics = ['end-to-end', 'prepared'] as const

  prepare(puzzle: string): SudokuGrid {
    return parseOneBasedMatrix(puzzle, 0)
  }

  solveEndToEnd(puzzle: string): SudokuGrid | null {
    return this.solvePrepared(this.prepare(puzzle))
  }

  solvePrepared(grid: SudokuGrid): SudokuGrid | null {
    // The public API is an in-place, first-solution backtracker. Ranked passes
    // supply a fresh prepared grid for every puzzle, so no solved input is ever
    // reused while callers receive the package's normal no-copy behavior.
    return sudokuPro.solveSudoku(grid) ? grid : null
  }

  normalize(result: unknown): readonly number[] | null {
    return normalizeFlatGrid(result)
  }

  consume(result: unknown): number {
    return consumeFlat(result)
  }
}

export class HackettyamSudokuToolsSolver implements SudokuSolverAdapter<SudokuGrid> {
  readonly metadata: SolverMetadata = {
    id: 'hackettyam-sudoku-tools',
    name: '@hackettyam/sudoku-tools',
    version: '1.1.0',
    source: 'https://github.com/hackettyam/sudoku-tools',
    sourceCommit: '7e0cb5053316d8fe5fdd5679ed8d5b2754e70f29',
    license: 'MIT',
    runtime: 'javascript',
    optional: false
  }
  readonly semantics = ['end-to-end', 'prepared'] as const

  prepare(puzzle: string): SudokuGrid {
    return parseOneBasedMatrix(puzzle, 0)
  }

  solveEndToEnd(puzzle: string): HackettyamSolveResult {
    return this.solvePrepared(this.prepare(puzzle))
  }

  solvePrepared(grid: SudokuGrid): HackettyamSolveResult {
    // Source audit: solvePuzzle validates and clones this natural board shape
    // before starting its first-solution search. Both operations are solver
    // work and intentionally remain inside the prepared timing boundary.
    return hackettyamSudokuTools.solvePuzzle(grid)
  }

  normalize(result: unknown): readonly number[] | null {
    return normalizeFlatGrid(this.solution(result))
  }

  consume(result: unknown): number {
    return consumeFlat(this.solution(result))
  }

  private solution(result: unknown): SudokuGrid | null {
    if (!result || typeof result !== 'object' || !('board' in result)) return null
    return Array.isArray(result.board) ? (result.board as SudokuGrid) : null
  }
}

type SodoModule = typeof import('@pyroth/sodo')

let sodoModulePromise: Promise<SodoModule> | undefined

async function loadSodo(): Promise<SodoModule> {
  sodoModulePromise ??= (async () => {
    const module = await import('@pyroth/sodo')
    const moduleUrl = import.meta.resolve('@pyroth/sodo')
    const wasmBytes = await readFile(new URL('sodo_wasm_bg.wasm', moduleUrl))
    await module.default({ module_or_path: wasmBytes })
    return module
  })()
  return sodoModulePromise
}

export class SudokuBlitzSolver implements SudokuSolverAdapter<SudokuBlitzBoard> {
  readonly metadata: SolverMetadata = {
    id: 'sudokublitz',
    name: 'SudokuBlitz',
    version: '1.0.0',
    source: 'https://github.com/iliyto/sudokublitz',
    sourceCommit: 'ec74e26278dc0950f65d1493a3b97d96493b89db',
    license: 'MIT',
    runtime: 'javascript',
    optional: false
  }
  // Board construction computes row/column/box masks from the exact givens. It
  // is solver setup, not mere representation conversion, so SudokuBlitz only
  // participates in the ranked end-to-end tier.
  readonly semantics = ['end-to-end'] as const

  prepare(puzzle: string): SudokuBlitzBoard {
    return new SudokuBlitzBoard(puzzle)
  }

  solveEndToEnd(puzzle: string): SudokuBlitzResult {
    return solveSudokuBlitz(new SudokuBlitzBoard(puzzle))
  }

  solvePrepared(board: SudokuBlitzBoard): SudokuBlitzResult {
    // SudokuBlitz clones the parsed board before searching.
    return solveSudokuBlitz(board)
  }

  normalize(result: unknown): readonly number[] | null {
    return normalizeFlatGrid(this.solution(result))
  }

  consume(result: unknown): number {
    return consumeFlat(this.solution(result))
  }

  private solution(result: unknown): string | null {
    if (!result || typeof result !== 'object' || !('solution' in result)) return null
    const solution = result.solution
    return typeof solution === 'string' ? solution : null
  }
}

export class ReeteshSudokuEngineSolver implements SudokuSolverAdapter<ReeteshBoard> {
  readonly metadata: SolverMetadata = {
    id: 'reetesh-sudoku-engine',
    name: '@reetesh/sudoku-engine',
    version: '2.1.0',
    source: 'https://github.com/rishureetesh/sudoku-engine',
    sourceCommit: 'a5f554f903946aeb46701584a109435baf142bab',
    license: 'MIT',
    runtime: 'javascript',
    optional: false
  }
  readonly semantics = ['end-to-end', 'prepared'] as const

  prepare(puzzle: string): ReeteshBoard {
    const board = stringToBoard(puzzle)
    if (!board) throw new Error('@reetesh/sudoku-engine rejected the benchmark puzzle')
    return board
  }

  solveEndToEnd(puzzle: string): ReeteshResult {
    return solveWithReetesh(this.prepare(puzzle))
  }

  solvePrepared(board: ReeteshBoard): ReeteshResult {
    // The public solver copies the board before constructing its search state.
    return solveWithReetesh(board)
  }

  normalize(result: unknown): readonly number[] | null {
    const solution = this.solution(result)
    return solution ? normalizeFlatGrid(solution) : null
  }

  consume(result: unknown): number {
    return consumeFlat(this.solution(result))
  }

  private solution(result: unknown): ReeteshBoard | null {
    if (!result || typeof result !== 'object' || !('solved' in result) || !('board' in result)) {
      return null
    }
    return result.solved === true && Array.isArray(result.board)
      ? (result.board as ReeteshBoard)
      : null
  }
}

export class OpenzelokuSolver implements SudokuSolverAdapter<OpenzelokuGrid> {
  readonly metadata: SolverMetadata = {
    id: 'openzeloku',
    name: 'openzeloku',
    version: '0.1.0',
    source: 'https://github.com/mr-girff/openzeloku',
    sourceCommit: 'a04d1a971b386496ee2fd082eb7922ec27260bf5',
    license: 'MIT',
    runtime: 'javascript',
    optional: false
  }
  readonly semantics = ['end-to-end', 'prepared'] as const

  prepare(puzzle: string): OpenzelokuGrid {
    return stringToGrid(puzzle, 9)
  }

  solveEndToEnd(puzzle: string): OpenzelokuGrid | null {
    return solveWithOpenzeloku(stringToGrid(puzzle, 9), 9)
  }

  solvePrepared(grid: OpenzelokuGrid): OpenzelokuGrid | null {
    // openzeloku searches a shallow copy and leaves the parsed grid untouched.
    return solveWithOpenzeloku(grid, 9)
  }

  normalize(result: unknown): readonly number[] | null {
    return normalizeFlatGrid(result)
  }

  consume(result: unknown): number {
    return consumeFlat(result)
  }
}

export class PyrothSodoWasmSolver implements SudokuSolverAdapter<string> {
  readonly metadata: SolverMetadata = {
    id: 'pyroth-sodo-wasm',
    name: '@pyroth/sodo (WebAssembly)',
    version: '0.2.1',
    source: 'https://github.com/gitctrlx/sodo',
    sourceCommit: '8391601e44d3ae7c6c6e4b8019d68435a179fc54',
    license: 'MIT',
    runtime: 'wasm',
    optional: false
  }
  readonly semantics = ['end-to-end'] as const
  private solve?: SodoModule['solve']

  async initialize(): Promise<SolverAvailability> {
    try {
      this.solve = (await loadSodo()).solve
      return { available: true }
    } catch (error) {
      return {
        available: false,
        reason: error instanceof Error ? error.message : String(error)
      }
    }
  }

  prepare(puzzle: string): string {
    return puzzle
  }

  solveEndToEnd(puzzle: string): string {
    // WASM instantiation happens once in initialize(); string marshalling remains timed.
    return this.getSolver()(puzzle, 9)
  }

  normalize(result: unknown): readonly number[] | null {
    return normalizeFlatGrid(result)
  }

  consume(result: unknown): number {
    return consumeFlat(result)
  }

  private getSolver(): SodoModule['solve'] {
    if (!this.solve) throw new Error('@pyroth/sodo was not initialized')
    return this.solve
  }
}
