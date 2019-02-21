import { SudokuCell, generateConstraints, parseStringFormat } from './lib'
import { findRaw } from 'dancing-links'

const FIELD_SIZE = 9

export function solveString (sudoku: string, all = false): SudokuCell[][] {
  const totalConstraints = (FIELD_SIZE * FIELD_SIZE) * 4
  const cells = parseStringFormat(sudoku, FIELD_SIZE)
  const constraints = generateConstraints(cells, FIELD_SIZE)

  const result = findRaw({
    numPrimary: totalConstraints,
    numSecondary: 0,
    numSolutions: all ? Infinity : 1,
    rows: constraints
  })

  return result.map((r) => r.map((s) => s.data))
}

export function solveCells (sudoku: SudokuCell[], all = false): SudokuCell[][] {
  const totalConstraints = (FIELD_SIZE * FIELD_SIZE) * 4
  const constraints = generateConstraints(sudoku, FIELD_SIZE)

  const result = findRaw({
    numPrimary: totalConstraints,
    numSecondary: 0,
    numSolutions: all ? Infinity : 1,
    rows: constraints
  })

  return result.map((r) => r.map((s) => s.data))
}

export { SudokuCell, parseStringFormat, generateConstraints, printBoard } from './lib/index'
