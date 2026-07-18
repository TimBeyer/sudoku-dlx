/** Existing repository fixtures, expanded through Sudoku-preserving transformations. */
export const EASY_PUZZLE =
  '.....12..1..7...45...43.7...9...63...5.8.7.2...62...9...3.19...97...4..6..25.....'

export const HARD_PUZZLE =
  '..............3.85..1.2.......5.7.....4...1...9.......5......73..2.1........4...9'

function mapDigits(puzzle: string, offset: number): string {
  return [...puzzle]
    .map(value => {
      if (value === '.') return value
      return String(((Number(value) - 1 + offset) % 9) + 1)
    })
    .join('')
}

function transpose(puzzle: string): string {
  let result = ''
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      result += puzzle[col * 9 + row]
    }
  }
  return result
}

function rotateHalfTurn(puzzle: string): string {
  return [...puzzle].reverse().join('')
}

function assertCanonical(puzzle: string): string {
  if (puzzle.length !== 81 || !/^[.1-9]{81}$/.test(puzzle)) {
    throw new Error(`Invalid built-in benchmark puzzle: ${puzzle}`)
  }
  return puzzle
}

export const SMALL_ROTATING_CORPUS = Object.freeze(
  [
    EASY_PUZZLE,
    HARD_PUZZLE,
    mapDigits(EASY_PUZZLE, 3),
    transpose(HARD_PUZZLE),
    rotateHalfTurn(EASY_PUZZLE),
    mapDigits(transpose(EASY_PUZZLE), 5),
    rotateHalfTurn(HARD_PUZZLE),
    mapDigits(rotateHalfTurn(HARD_PUZZLE), 7)
  ].map(assertCanonical)
)
