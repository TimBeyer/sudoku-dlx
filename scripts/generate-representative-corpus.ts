import assert from 'node:assert/strict'
import {
  REPRESENTATIVE_CORPUS_CASES,
  REPRESENTATIVE_WARMUP_CASES
} from '../benchmark/datasets/representative.js'
import { solveString, type SudokuCell } from '../index.js'

const SIZE = 9
const CELL_COUNT = SIZE * SIZE
const ALL_DIGITS = (1 << SIZE) - 1
const EMPTY = 0
const SEED = 0x5d0c0d5

const MEASURED_CLUE_TARGETS = [25, 27, 29, 31, 33, 35, 37, 40] as const
const MEASURED_PUZZLES_PER_TARGET = 8
const WARMUP_CLUE_TARGETS = [26, 30, 34, 38, 25, 29, 33, 39] as const

type SearchTier = 'low' | 'moderate' | 'high' | 'very-high'

interface GeneratedPuzzle {
  puzzle: string
  clues: number
  searchNodes: number
  searchTier?: SearchTier
}

interface GeneratedCorpus {
  measured: GeneratedPuzzle[]
  warmup: GeneratedPuzzle[]
}

interface Random {
  nextInt(upperBound: number): number
}

function createRandom(seed: number): Random {
  let state = seed >>> 0

  return {
    nextInt(upperBound: number): number {
      assert(upperBound > 0)
      state = (state + 0x6d2b79f5) >>> 0
      let value = state
      value = Math.imul(value ^ (value >>> 15), value | 1)
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
      value = (value ^ (value >>> 14)) >>> 0
      return Math.floor((value / 0x1_0000_0000) * upperBound)
    }
  }
}

function shuffle<T>(values: T[], random: Random): void {
  for (let index = values.length - 1; index > 0; index--) {
    const other = random.nextInt(index + 1)
    ;[values[index], values[other]] = [values[other], values[index]]
  }
}

function boxIndex(cell: number): number {
  const row = Math.floor(cell / SIZE)
  const column = cell % SIZE
  return Math.floor(row / 3) * 3 + Math.floor(column / 3)
}

function candidateMask(
  cell: number,
  rowMasks: readonly number[],
  columnMasks: readonly number[],
  boxMasks: readonly number[]
): number {
  const row = Math.floor(cell / SIZE)
  const column = cell % SIZE
  return ALL_DIGITS & ~(rowMasks[row] | columnMasks[column] | boxMasks[boxIndex(cell)])
}

function bitCount(value: number): number {
  let count = 0
  while (value !== 0) {
    value &= value - 1
    count++
  }
  return count
}

function digitsFromMask(mask: number): number[] {
  const digits: number[] = []
  for (let digit = 1; digit <= SIZE; digit++) {
    if ((mask & (1 << (digit - 1))) !== 0) digits.push(digit)
  }
  return digits
}

function generateSolution(random: Random): number[] {
  const cells = new Array<number>(CELL_COUNT).fill(EMPTY)
  const rowMasks = new Array<number>(SIZE).fill(0)
  const columnMasks = new Array<number>(SIZE).fill(0)
  const boxMasks = new Array<number>(SIZE).fill(0)

  function fill(): boolean {
    let selectedCell = -1
    let selectedMask = 0
    let selectedCount = SIZE + 1

    for (let cell = 0; cell < CELL_COUNT; cell++) {
      if (cells[cell] !== EMPTY) continue
      const mask = candidateMask(cell, rowMasks, columnMasks, boxMasks)
      const count = bitCount(mask)
      if (count === 0) return false
      if (count < selectedCount) {
        selectedCell = cell
        selectedMask = mask
        selectedCount = count
      }
    }

    if (selectedCell < 0) return true

    const digits = digitsFromMask(selectedMask)
    shuffle(digits, random)

    const row = Math.floor(selectedCell / SIZE)
    const column = selectedCell % SIZE
    const box = boxIndex(selectedCell)

    for (const digit of digits) {
      const bit = 1 << (digit - 1)
      cells[selectedCell] = digit
      rowMasks[row] |= bit
      columnMasks[column] |= bit
      boxMasks[box] |= bit

      if (fill()) return true

      cells[selectedCell] = EMPTY
      rowMasks[row] &= ~bit
      columnMasks[column] &= ~bit
      boxMasks[box] &= ~bit
    }

    return false
  }

  assert(fill(), 'Failed to generate a complete grid')
  return cells
}

function initializeMasks(cells: readonly number[]): {
  rowMasks: number[]
  columnMasks: number[]
  boxMasks: number[]
} | null {
  const rowMasks = new Array<number>(SIZE).fill(0)
  const columnMasks = new Array<number>(SIZE).fill(0)
  const boxMasks = new Array<number>(SIZE).fill(0)

  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const digit = cells[cell]
    if (digit === EMPTY) continue
    const bit = 1 << (digit - 1)
    const row = Math.floor(cell / SIZE)
    const column = cell % SIZE
    const box = boxIndex(cell)
    if (
      (rowMasks[row] & bit) !== 0 ||
      (columnMasks[column] & bit) !== 0 ||
      (boxMasks[box] & bit) !== 0
    ) {
      return null
    }
    rowMasks[row] |= bit
    columnMasks[column] |= bit
    boxMasks[box] |= bit
  }

  return { rowMasks, columnMasks, boxMasks }
}

function selectEmptyCell(
  cells: readonly number[],
  rowMasks: readonly number[],
  columnMasks: readonly number[],
  boxMasks: readonly number[]
): { cell: number; mask: number } {
  let selectedCell = -1
  let selectedMask = 0
  let selectedCount = SIZE + 1

  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (cells[cell] !== EMPTY) continue
    const mask = candidateMask(cell, rowMasks, columnMasks, boxMasks)
    const count = bitCount(mask)
    if (count < selectedCount) {
      selectedCell = cell
      selectedMask = mask
      selectedCount = count
      if (count <= 1) break
    }
  }

  return { cell: selectedCell, mask: selectedMask }
}

function countSolutions(cells: number[], limit: number): number {
  const masks = initializeMasks(cells)
  if (masks === null) return 0
  const { rowMasks, columnMasks, boxMasks } = masks

  function search(): number {
    const selected = selectEmptyCell(cells, rowMasks, columnMasks, boxMasks)
    if (selected.cell < 0) return 1
    if (selected.mask === 0) return 0

    const row = Math.floor(selected.cell / SIZE)
    const column = selected.cell % SIZE
    const box = boxIndex(selected.cell)
    let solutions = 0
    let remaining = selected.mask

    while (remaining !== 0 && solutions < limit) {
      const bit = remaining & -remaining
      remaining &= remaining - 1
      cells[selected.cell] = Math.log2(bit) + 1
      rowMasks[row] |= bit
      columnMasks[column] |= bit
      boxMasks[box] |= bit

      solutions += search()

      cells[selected.cell] = EMPTY
      rowMasks[row] &= ~bit
      columnMasks[column] &= ~bit
      boxMasks[box] &= ~bit
    }

    return solutions
  }

  return search()
}

function measureSearchNodes(source: readonly number[]): number {
  const cells = [...source]
  const masks = initializeMasks(cells)
  assert(masks !== null)
  const { rowMasks, columnMasks, boxMasks } = masks
  let searchNodes = 0

  function search(): boolean {
    searchNodes++
    const selected = selectEmptyCell(cells, rowMasks, columnMasks, boxMasks)
    if (selected.cell < 0) return true
    if (selected.mask === 0) return false

    const row = Math.floor(selected.cell / SIZE)
    const column = selected.cell % SIZE
    const box = boxIndex(selected.cell)
    let remaining = selected.mask

    while (remaining !== 0) {
      const bit = remaining & -remaining
      remaining &= remaining - 1
      cells[selected.cell] = Math.log2(bit) + 1
      rowMasks[row] |= bit
      columnMasks[column] |= bit
      boxMasks[box] |= bit

      if (search()) return true

      cells[selected.cell] = EMPTY
      rowMasks[row] &= ~bit
      columnMasks[column] &= ~bit
      boxMasks[box] &= ~bit
    }

    return false
  }

  assert(search(), 'Generated puzzle must be solvable')
  return searchNodes
}

function puzzleString(cells: readonly number[]): string {
  return cells.map(value => (value === EMPTY ? '.' : String(value))).join('')
}

function solutionString(solution: readonly SudokuCell[]): string {
  const values = new Array<string>(CELL_COUNT).fill('.')
  for (const cell of solution) values[cell.row * SIZE + cell.col] = String(cell.number)
  return values.join('')
}

function generatePuzzle(random: Random, clueTarget: number): GeneratedPuzzle {
  for (;;) {
    const solution = generateSolution(random)
    const puzzle = [...solution]
    const removalOrder = Array.from({ length: CELL_COUNT }, (_, index) => index)
    shuffle(removalOrder, random)
    let clues = CELL_COUNT

    for (const cell of removalOrder) {
      if (clues === clueTarget) break
      const digit = puzzle[cell]
      puzzle[cell] = EMPTY
      if (countSolutions(puzzle, 2) === 1) {
        clues--
      } else {
        puzzle[cell] = digit
      }
    }

    if (clues !== clueTarget) continue

    return {
      puzzle: puzzleString(puzzle),
      clues,
      searchNodes: measureSearchNodes(puzzle)
    }
  }
}

function assignSearchTiers(measured: GeneratedPuzzle[]): void {
  const ordered = measured
    .map((entry, index) => ({ index, searchNodes: entry.searchNodes }))
    .sort((left, right) => left.searchNodes - right.searchNodes || left.index - right.index)
  const labels: SearchTier[] = ['low', 'moderate', 'high', 'very-high']

  for (let rank = 0; rank < ordered.length; rank++) {
    measured[ordered[rank].index].searchTier =
      labels[Math.floor((rank * labels.length) / ordered.length)]
  }
}

function generateCorpus(): GeneratedCorpus {
  const random = createRandom(SEED)
  const measured: GeneratedPuzzle[] = []
  const warmup: GeneratedPuzzle[] = []

  for (const clues of MEASURED_CLUE_TARGETS) {
    for (let index = 0; index < MEASURED_PUZZLES_PER_TARGET; index++) {
      measured.push(generatePuzzle(random, clues))
    }
  }

  for (const clues of WARMUP_CLUE_TARGETS) warmup.push(generatePuzzle(random, clues))
  assignSearchTiers(measured)

  return { measured, warmup }
}

function validateWithSudokuDlx(corpus: GeneratedCorpus): void {
  const entries = [...corpus.measured, ...corpus.warmup]
  const puzzles = new Set<string>()
  const solutions = new Set<string>()
  const measuredClueMasks = new Set(
    corpus.measured.map(entry => entry.puzzle.replace(/[1-9]/g, 'x'))
  )

  assert.equal(corpus.measured.length, 64)
  assert.equal(corpus.warmup.length, 8)
  assert.equal(
    measuredClueMasks.size,
    corpus.measured.length,
    'Measured clue masks must be distinct for the ranked anti-cache schedule'
  )
  for (const entry of corpus.measured) {
    assert(
      new Set(entry.puzzle.replaceAll('.', '')).size >= 8,
      'Measured puzzles must contain at least eight clue digits for 9! exact-input variants'
    )
  }
  for (const entry of corpus.warmup) {
    assert(
      !measuredClueMasks.has(entry.puzzle.replace(/[1-9]/g, 'x')),
      'Warmup clue masks must be disjoint from measured masks'
    )
  }

  for (const entry of entries) {
    assert.match(entry.puzzle, /^[.1-9]{81}$/)
    assert.equal([...entry.puzzle].filter(value => value !== '.').length, entry.clues)
    assert(!puzzles.has(entry.puzzle), 'Every generated puzzle must be distinct')
    puzzles.add(entry.puzzle)

    const found = solveString(entry.puzzle, true)
    assert.equal(found.length, 1, `Expected exactly one sudoku-dlx solution for ${entry.puzzle}`)
    const solved = solutionString(found[0])
    for (let cell = 0; cell < CELL_COUNT; cell++) {
      assert(entry.puzzle[cell] === '.' || entry.puzzle[cell] === solved[cell])
    }
    assert(!solutions.has(solved), 'Every puzzle must originate from a distinct complete grid')
    solutions.add(solved)
  }
}

function formatEntries(entries: readonly GeneratedPuzzle[]): string {
  return entries
    .map(entry => {
      const searchTier = entry.searchTier === undefined ? '' : `, searchTier: '${entry.searchTier}'`
      return `  { puzzle: '${entry.puzzle}', clues: ${entry.clues}, searchNodes: ${entry.searchNodes}${searchTier} }`
    })
    .join(',\n')
}

const corpus = generateCorpus()
validateWithSudokuDlx(corpus)

if (process.argv.includes('--verify')) {
  assert.deepEqual(corpus.measured, REPRESENTATIVE_CORPUS_CASES)
  assert.deepEqual(corpus.warmup, REPRESENTATIVE_WARMUP_CASES)

  const clueCounts = Object.fromEntries(
    MEASURED_CLUE_TARGETS.map(clues => [
      clues,
      corpus.measured.filter(entry => entry.clues === clues).length
    ])
  )
  const searchTiers = Object.fromEntries(
    (['low', 'moderate', 'high', 'very-high'] as const).map(searchTier => [
      searchTier,
      corpus.measured.filter(entry => entry.searchTier === searchTier).length
    ])
  )

  console.log(
    JSON.stringify(
      {
        seed: `0x${SEED.toString(16)}`,
        measured: corpus.measured.length,
        warmup: corpus.warmup.length,
        clueCounts,
        searchTiers,
        searchNodes: {
          minimum: Math.min(...corpus.measured.map(entry => entry.searchNodes)),
          maximum: Math.max(...corpus.measured.map(entry => entry.searchNodes))
        }
      },
      null,
      2
    )
  )
} else {
  console.log(`// Seed: 0x${SEED.toString(16)}`)
  console.log('export const REPRESENTATIVE_CORPUS_CASES = [')
  console.log(formatEntries(corpus.measured))
  console.log('] as const')
  console.log()
  console.log('export const REPRESENTATIVE_WARMUP_CASES = [')
  console.log(formatEntries(corpus.warmup))
  console.log('] as const')
}
