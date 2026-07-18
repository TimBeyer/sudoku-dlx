import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { normalizeFlatGrid, validateSolution } from '../../benchmark/problems/sudoku.js'

export interface CanonicalCorpus {
  readonly path: string
  readonly puzzles: readonly string[]
  readonly sha256: string
  readonly skippedLines: number
}

export async function stageCanonicalCorpus(
  sourcePath: string,
  destinationPath: string,
  sampleSize?: number
): Promise<CanonicalCorpus> {
  const source = await readFile(sourcePath, 'utf8')
  const puzzles: string[] = []
  const uniquePuzzles = new Set<string>()
  let skippedLines = 0

  const sourceLines = source.split(/\r?\n/)
  for (let sourceLine = 0; sourceLine < sourceLines.length; sourceLine++) {
    const rawLine = sourceLines[sourceLine]
    const line = rawLine.trim()
    if (line.length === 0) continue

    const puzzle = line.slice(0, 81)
    if (puzzle.length !== 81 || !/^[.0-9]{81}$/.test(puzzle)) {
      skippedLines++
      continue
    }

    const canonicalPuzzle = puzzle.replaceAll('0', '.')
    if (uniquePuzzles.has(canonicalPuzzle)) {
      throw new Error(`Dataset repeats a canonical puzzle at source line ${sourceLine + 1}`)
    }
    uniquePuzzles.add(canonicalPuzzle)
    puzzles.push(canonicalPuzzle)
    if (sampleSize !== undefined && puzzles.length === sampleSize) break
  }

  if (puzzles.length === 0) throw new Error(`Dataset contains no 81-cell puzzles: ${sourcePath}`)
  if (sampleSize !== undefined && puzzles.length < sampleSize) {
    throw new Error(
      `Dataset contains only ${puzzles.length} puzzles; --size requested ${sampleSize}`
    )
  }

  const canonicalContents = `${puzzles.join('\n')}\n`
  await writeFile(destinationPath, canonicalContents)
  return {
    path: destinationPath,
    puzzles,
    sha256: createHash('sha256').update(canonicalContents).digest('hex'),
    skippedLines
  }
}

export async function validateSolutionFile(
  solver: string,
  outputPath: string,
  puzzles: readonly string[]
): Promise<void> {
  const output = await readFile(outputPath, 'utf8')
  const solutions = output.endsWith('\n') ? output.slice(0, -1).split('\n') : output.split('\n')

  if (solutions.length !== puzzles.length) {
    throw new Error(
      `${solver} wrote ${solutions.length} solutions for a ${puzzles.length}-puzzle corpus`
    )
  }

  for (let index = 0; index < puzzles.length; index++) {
    const solution = solutions[index]
    if (!/^[1-9]{81}$/.test(solution)) {
      throw new Error(`${solver} wrote an invalid solution record at line ${index + 1}`)
    }
    try {
      validateSolution(puzzles[index], normalizeFlatGrid(solution))
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error)
      throw new Error(`${solver} returned an invalid solution at line ${index + 1}: ${details}`, {
        cause: error
      })
    }
  }
}
