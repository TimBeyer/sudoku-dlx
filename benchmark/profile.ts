import {
  compileCells,
  compileString,
  parseStringFormat,
  solveCells,
  solveString
} from '../index.js'
import { HARD_PUZZLE, SMALL_ROTATING_CORPUS } from './datasets/smoke.js'

type ProfileMode = 'compiled-string' | 'compiled-cells' | 'string' | 'cells'

const args = process.argv.slice(2)
const mode = parseMode(args.find(argument => argument.startsWith('--mode='))?.slice(7))
const iterations = parseIterations(
  args.find(argument => argument.startsWith('--iterations='))?.slice(13) ??
    process.env['SUDOKU_PROFILE_ITERATIONS']
)

let checksum = 0

if (mode === 'compiled-string') {
  const compiled = compileString(HARD_PUZZLE)
  for (let index = 0; index < iterations; index++) {
    checksum ^= compiled.solve()[0]?.[0]?.number ?? 0
  }
} else if (mode === 'compiled-cells') {
  const compiled = compileCells(parseStringFormat(HARD_PUZZLE))
  for (let index = 0; index < iterations; index++) {
    checksum ^= compiled.solve()[0]?.[0]?.number ?? 0
  }
} else if (mode === 'cells') {
  for (let index = 0; index < iterations; index++) {
    const puzzle = SMALL_ROTATING_CORPUS[index % SMALL_ROTATING_CORPUS.length]
    checksum ^= solveCells(parseStringFormat(puzzle))[0]?.[0]?.number ?? 0
  }
} else {
  for (let index = 0; index < iterations; index++) {
    checksum ^=
      solveString(SMALL_ROTATING_CORPUS[index % SMALL_ROTATING_CORPUS.length])[0]?.[0]?.number ?? 0
  }
}

console.log(
  `Profile workload complete: mode=${mode}, iterations=${iterations}, checksum=${checksum}`
)

function parseMode(value: string | undefined): ProfileMode {
  if (!value) return 'compiled-string'
  if (['compiled-string', 'compiled-cells', 'string', 'cells'].includes(value)) {
    return value as ProfileMode
  }
  throw new Error(`Unknown profile mode '${value}'`)
}

function parseIterations(value: string | undefined): number {
  if (!value) return 20_000
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('--iterations must be a positive integer')
  }
  return parsed
}
