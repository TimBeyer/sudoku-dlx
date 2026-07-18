import type { SudokuCell } from '../../index.js'

export function parseOneBasedFlat(puzzle: string, blank = 0): number[] {
  if (puzzle.length !== 81 || !/^[.1-9]{81}$/.test(puzzle)) {
    throw new Error('Sudoku benchmark inputs must contain exactly 81 dots or digits 1-9')
  }

  return [...puzzle].map(value => (value === '.' ? blank : value.charCodeAt(0) - 48))
}

export function parseOneBasedMatrix(puzzle: string, blank = -1): number[][] {
  const flat = parseOneBasedFlat(puzzle, blank)
  return Array.from({ length: 9 }, (_, row) => flat.slice(row * 9, row * 9 + 9))
}

export function parseZeroBasedFlat(puzzle: string): number[] {
  return parseOneBasedFlat(puzzle, 0).map(value => (value === 0 ? -1 : value - 1))
}

export function normalizeInternalSolutions(result: unknown): readonly number[] | null {
  if (!Array.isArray(result) || result.length === 0 || !Array.isArray(result[0])) return null

  const cells = result[0] as unknown[]
  if (cells.length !== 81) return null

  const solution = new Array<number>(81)
  for (const value of cells) {
    if (!isSudokuCell(value)) return null
    solution[value.row * 9 + value.col] = value.number
  }
  return solution
}

export function normalizeFlatGrid(result: unknown): readonly number[] | null {
  if (typeof result === 'string') {
    if (!/^\d{81}$/.test(result)) return null
    return [...result].map(value => value.charCodeAt(0) - 48)
  }

  if (!Array.isArray(result)) return null

  if (result.length === 9 && result.every(row => Array.isArray(row))) {
    const flattened = (result as unknown[][]).flat()
    return flattened.every(value => typeof value === 'number') ? (flattened as number[]) : null
  }

  if (result.length === 81 && result.every(value => typeof value === 'number')) {
    return result as number[]
  }

  return null
}

export function validateSolution(puzzle: string, solution: readonly number[] | null): void {
  if (!solution || solution.length !== 81) {
    throw new Error('solver did not return an 81-cell solution')
  }

  const givens = parseOneBasedFlat(puzzle)
  for (let index = 0; index < 81; index++) {
    const value = solution[index]
    if (!Number.isInteger(value) || value < 1 || value > 9) {
      throw new Error(`solution contains invalid value ${String(value)} at cell ${index}`)
    }
    if (givens[index] !== 0 && givens[index] !== value) {
      throw new Error(`solution changed given at cell ${index}`)
    }
  }

  for (let row = 0; row < 9; row++) {
    assertUnit(
      Array.from({ length: 9 }, (_, col) => solution[row * 9 + col]),
      `row ${row}`
    )
  }
  for (let col = 0; col < 9; col++) {
    assertUnit(
      Array.from({ length: 9 }, (_, row) => solution[row * 9 + col]),
      `column ${col}`
    )
  }
  for (let box = 0; box < 9; box++) {
    const firstRow = Math.floor(box / 3) * 3
    const firstCol = (box % 3) * 3
    const values: number[] = []
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        values.push(solution[(firstRow + row) * 9 + firstCol + col])
      }
    }
    assertUnit(values, `box ${box}`)
  }
}

export function consumeFlat(result: unknown): number {
  if (typeof result === 'string') return result.charCodeAt(0) || 0
  if (!Array.isArray(result) || result.length === 0) return 0

  const first = result[0]
  if (typeof first === 'number') return first
  if (typeof first === 'string') return first.charCodeAt(0) || 0
  if (Array.isArray(first)) return consumeFlat(first)
  if (isSudokuCell(first)) return first.number
  return 0
}

function isSudokuCell(value: unknown): value is SudokuCell {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<SudokuCell>
  return (
    typeof candidate.number === 'number' &&
    typeof candidate.row === 'number' &&
    typeof candidate.col === 'number'
  )
}

function assertUnit(values: readonly number[], label: string): void {
  if (new Set(values).size !== 9) throw new Error(`solution has duplicate digits in ${label}`)
}
