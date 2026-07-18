import { DancingLinks, type ConstraintRow, type Result } from 'dancing-links'
import {
  createNumericConstraintsFromCells,
  createNumericConstraintsFromString,
  decodeStandardCandidate,
  type SudokuCell
} from './lib/index.js'

const FIELD_SIZE = 9
const TOTAL_CONSTRAINTS = FIELD_SIZE * FIELD_SIZE * 4
const dancingLinks = new DancingLinks<number>()

export interface CompiledSudoku {
  solve(all?: boolean): SudokuCell[][]
}

function extractSolutions(results: Result<number>[][]): SudokuCell[][] {
  const solutions = new Array<SudokuCell[]>(results.length)

  for (let solutionIndex = 0; solutionIndex < results.length; solutionIndex++) {
    const result = results[solutionIndex]
    const solution = new Array<SudokuCell>(result.length)

    for (let resultIndex = 0; resultIndex < result.length; resultIndex++) {
      solution[resultIndex] = decodeStandardCandidate(result[resultIndex].data)
    }

    solutions[solutionIndex] = solution
  }

  return solutions
}

function solveConstraints(constraints: ConstraintRow<number>[], all: boolean): SudokuCell[][] {
  const solver = dancingLinks.createSolver({ columns: TOTAL_CONSTRAINTS })
  solver.addRows(constraints)

  return extractSolutions(all ? solver.findAll() : solver.findOne())
}

function compileConstraints(constraints: ConstraintRow<number>[]): CompiledSudoku {
  const template = dancingLinks.createSolverTemplate({ columns: TOTAL_CONSTRAINTS })
  const ownedConstraints = new Array<ConstraintRow<number>>(constraints.length)

  // SolverTemplate snapshots row topology by replacing each row's column array.
  // Detach the row objects from the module-level candidate cache before handing
  // them over. The template itself copies each coveredColumns array, so keeping
  // that reference here avoids making the same copy twice.
  for (let index = 0; index < constraints.length; index++) {
    const constraint = constraints[index]
    ownedConstraints[index] = {
      data: constraint.data,
      coveredColumns: constraint.coveredColumns
    }
  }

  template.addRows(ownedConstraints)

  // Creating the solver eagerly snapshots and compiles the fixed matrix. Each
  // subsequent search clones only the mutable link buffers.
  const solver = template.createSolver()

  return {
    solve(all = false): SudokuCell[][] {
      return extractSolutions(all ? solver.findAll() : solver.findOne())
    }
  }
}

export function solveString(sudoku: string, all = false): SudokuCell[][] {
  return solveConstraints(createNumericConstraintsFromString(sudoku), all)
}

export function solveCells(sudoku: SudokuCell[], all = false): SudokuCell[][] {
  return solveConstraints(createNumericConstraintsFromCells(sudoku), all)
}

export function compileString(sudoku: string): CompiledSudoku {
  return compileConstraints(createNumericConstraintsFromString(sudoku))
}

export function compileCells(sudoku: SudokuCell[]): CompiledSudoku {
  return compileConstraints(createNumericConstraintsFromCells(sudoku))
}

export { generateConstraints, parseStringFormat, printBoard } from './lib/index.js'
export type { SudokuCell } from './lib/index.js'
