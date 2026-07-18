import type { ConstraintRow } from 'dancing-links'

export interface SudokuCell {
  number: number
  row: number
  col: number
}

const STANDARD_SIZE = 9
const MAX_STRING_SIZE = 9

function validateSize(size: number): number {
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new RangeError(`Sudoku size must be a positive integer; received ${String(size)}`)
  }

  const blockSize = Math.sqrt(size)
  if (!Number.isInteger(blockSize)) {
    throw new RangeError(`Sudoku size must be a perfect square; received ${size}`)
  }

  return blockSize
}

function buildCandidateRows(size: number): ConstraintRow<number>[] {
  const blockSize = validateSize(size)
  const constraintBlockSize = size * size
  const rows: ConstraintRow<number>[] = []

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const cellIndex = row * size + col
      const candidateOffset = cellIndex * size
      const block = Math.floor(row / blockSize) * blockSize + Math.floor(col / blockSize)

      for (let numberIndex = 0; numberIndex < size; numberIndex++) {
        const numberOffset = numberIndex * size
        rows[rows.length] = {
          data: candidateOffset + numberIndex,
          coveredColumns: [
            cellIndex,
            constraintBlockSize + numberOffset + row,
            constraintBlockSize * 2 + numberOffset + col,
            constraintBlockSize * 3 + numberOffset + block
          ]
        }
      }
    }
  }

  return rows
}

// The standard encoder is immutable by convention and never leaves this module.
// Solves only allocate a packed array of references to the applicable rows.
const STANDARD_CANDIDATE_ROWS = buildCandidateRows(STANDARD_SIZE)

function filterCandidateRows(
  grid: Uint32Array,
  size: number,
  candidateRows: ConstraintRow<number>[]
): ConstraintRow<number>[] {
  const constraints: ConstraintRow<number>[] = []

  for (let cellIndex = 0; cellIndex < grid.length; cellIndex++) {
    const candidateOffset = cellIndex * size
    const given = grid[cellIndex]

    if (given !== 0) {
      constraints[constraints.length] = candidateRows[candidateOffset + given - 1]
      continue
    }

    for (let numberIndex = 0; numberIndex < size; numberIndex++) {
      constraints[constraints.length] = candidateRows[candidateOffset + numberIndex]
    }
  }

  return constraints
}

function candidateRowsForSize(size: number): ConstraintRow<number>[] {
  return size === STANDARD_SIZE ? STANDARD_CANDIDATE_ROWS : buildCandidateRows(size)
}

function assertStringSizeSupported(size: number): void {
  if (size > MAX_STRING_SIZE) {
    throw new RangeError(
      `Sudoku string format supports sizes up to ${MAX_STRING_SIZE}; received ${size}`
    )
  }
}

function parseStringGrid(dotFormat: string, size: number): Uint32Array {
  validateSize(size)
  assertStringSizeSupported(size)

  if (typeof dotFormat !== 'string') {
    throw new TypeError('Sudoku must be provided as a string')
  }

  const expectedLength = size * size
  if (dotFormat.length !== expectedLength) {
    throw new RangeError(
      `Sudoku string must contain exactly ${expectedLength} cells for size ${size}; received ${dotFormat.length}`
    )
  }

  const grid = new Uint32Array(expectedLength)

  for (let index = 0; index < expectedLength; index++) {
    const charCode = dotFormat.charCodeAt(index)
    if (charCode === 46 || charCode === 48) {
      continue
    }

    const number = charCode - 48
    if (number < 1 || number > size) {
      throw new RangeError(
        `Invalid Sudoku character "${dotFormat[index]}" at index ${index}; expected ".", "0", or a digit from 1 to ${size}`
      )
    }

    grid[index] = number
  }

  return grid
}

function cellsGrid(inputs: SudokuCell[], size: number): Uint32Array {
  validateSize(size)

  if (!Array.isArray(inputs)) {
    throw new TypeError('Sudoku cells must be provided as an array')
  }

  const grid = new Uint32Array(size * size)

  for (let index = 0; index < inputs.length; index++) {
    const input = inputs[index]
    if (input === null || typeof input !== 'object') {
      throw new TypeError(`Sudoku cell at index ${index} must be an object`)
    }

    const { row, col, number } = input
    if (!Number.isInteger(row) || row < 0 || row >= size) {
      throw new RangeError(
        `Sudoku cell row at index ${index} must be an integer from 0 to ${size - 1}; received ${String(row)}`
      )
    }
    if (!Number.isInteger(col) || col < 0 || col >= size) {
      throw new RangeError(
        `Sudoku cell column at index ${index} must be an integer from 0 to ${size - 1}; received ${String(col)}`
      )
    }
    if (!Number.isInteger(number) || number < 1 || number > size) {
      throw new RangeError(
        `Sudoku cell number at index ${index} must be an integer from 1 to ${size}; received ${String(number)}`
      )
    }

    const cellIndex = row * size + col
    if (grid[cellIndex] !== 0) {
      throw new Error(`Duplicate Sudoku cell at row ${row}, column ${col}`)
    }

    grid[cellIndex] = number
  }

  return grid
}

/** @internal Create packed numeric rows for the standard solver hot path. */
export function createNumericConstraintsFromString(sudoku: string): ConstraintRow<number>[] {
  return filterCandidateRows(
    parseStringGrid(sudoku, STANDARD_SIZE),
    STANDARD_SIZE,
    STANDARD_CANDIDATE_ROWS
  )
}

/** @internal Create packed numeric rows for the standard solver hot path. */
export function createNumericConstraintsFromCells(sudoku: SudokuCell[]): ConstraintRow<number>[] {
  return filterCandidateRows(
    cellsGrid(sudoku, STANDARD_SIZE),
    STANDARD_SIZE,
    STANDARD_CANDIDATE_ROWS
  )
}

/** @internal Decode a cached standard candidate into a fresh caller-owned object. */
export function decodeStandardCandidate(candidateId: number): SudokuCell {
  const numberIndex = candidateId % STANDARD_SIZE
  const cellIndex = (candidateId - numberIndex) / STANDARD_SIZE

  return {
    number: numberIndex + 1,
    row: Math.floor(cellIndex / STANDARD_SIZE),
    col: cellIndex % STANDARD_SIZE
  }
}

function decodeCandidate(candidateId: number, size: number): SudokuCell {
  const numberIndex = candidateId % size
  const cellIndex = (candidateId - numberIndex) / size

  return {
    number: numberIndex + 1,
    row: Math.floor(cellIndex / size),
    col: cellIndex % size
  }
}

export function times<T>(n: number, fn: ((index: number) => T) | T): T[] {
  const returnValue: T[] = []

  for (let i = 0; i < n; i++) {
    returnValue.push(typeof fn === 'function' ? (fn as (index: number) => T)(i) : fn)
  }

  return returnValue
}

export function generateConstraints(
  inputs: SudokuCell[] = [],
  size = STANDARD_SIZE
): ConstraintRow<SudokuCell>[] {
  const grid = cellsGrid(inputs, size)
  const numericConstraints = filterCandidateRows(grid, size, candidateRowsForSize(size))
  const constraints: ConstraintRow<SudokuCell>[] = []

  for (let index = 0; index < numericConstraints.length; index++) {
    const constraint = numericConstraints[index]
    constraints[constraints.length] = {
      coveredColumns: constraint.coveredColumns.slice(),
      data: decodeCandidate(constraint.data, size)
    }
  }

  return constraints
}

const boxStyles = {
  top: '─',
  topLeft: '╭',
  topMid: '┬',
  topRight: '╮',
  bottom: '─',
  bottomRight: '╯',
  bottomMid: '┴',
  bottomLeft: '╰',
  left: '│',
  leftMid: '├',
  mid: '─',
  midMid: '┼',
  right: '│',
  rightMid: '┤',
  middle: '│'
}

function horizontalBorder(
  size: number,
  blockSize: number,
  cellWidth: number,
  line: string,
  separator: string
): string {
  let border = ''

  for (let col = 0; col < size; col++) {
    if (col > 0 && col % blockSize === 0) {
      border += separator
    }
    border += line.repeat(cellWidth)
  }

  return border
}

export function printBoard(inputs: SudokuCell[], size = STANDARD_SIZE): string {
  const blockSize = validateSize(size)
  const cellWidth = String(size).length
  const grid = cellsGrid(inputs, size)
  const topBorder = horizontalBorder(size, blockSize, cellWidth, boxStyles.top, boxStyles.topMid)
  let board = `${boxStyles.topLeft}${topBorder}${boxStyles.topRight}\n`

  for (let row = 0; row < size; row++) {
    if (row > 0 && row % blockSize === 0) {
      const midBorder = horizontalBorder(
        size,
        blockSize,
        cellWidth,
        boxStyles.mid,
        boxStyles.midMid
      )
      board += `${boxStyles.leftMid}${midBorder}${boxStyles.rightMid}\n`
    }

    board += boxStyles.left
    for (let col = 0; col < size; col++) {
      if (col > 0 && col % blockSize === 0) {
        board += boxStyles.middle
      }

      const number = grid[row * size + col]
      board += (number === 0 ? '.' : String(number)).padStart(cellWidth)
    }
    board += `${boxStyles.right}\n`
  }

  const bottomBorder = horizontalBorder(
    size,
    blockSize,
    cellWidth,
    boxStyles.bottom,
    boxStyles.bottomMid
  )
  return `${board}${boxStyles.bottomLeft}${bottomBorder}${boxStyles.bottomRight}`
}

export function parseStringFormat(dotFormat: string, size = STANDARD_SIZE): SudokuCell[] {
  const grid = parseStringGrid(dotFormat, size)
  const inputs: SudokuCell[] = []

  for (let cellIndex = 0; cellIndex < grid.length; cellIndex++) {
    const number = grid[cellIndex]
    if (number === 0) {
      continue
    }

    inputs[inputs.length] = {
      row: Math.floor(cellIndex / size),
      col: cellIndex % size,
      number
    }
  }

  return inputs
}
