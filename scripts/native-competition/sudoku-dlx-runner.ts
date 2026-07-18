#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { solveString, type SudokuCell } from '../../index.js'

function solutionString(cells: readonly SudokuCell[]): string {
  if (cells.length !== 81) throw new Error('sudoku-dlx did not return 81 cells')

  const values = new Array<string>(81)
  for (const cell of cells) values[cell.row * 9 + cell.col] = String(cell.number)
  if (values.some(value => value === undefined)) {
    throw new Error('sudoku-dlx returned an incomplete solution')
  }
  return values.join('')
}

export async function runBatch(inputPath: string, outputPath: string): Promise<void> {
  const contents = await readFile(inputPath, 'utf8')
  const puzzles = contents.split('\n').filter(line => line.length > 0)
  if (puzzles.length === 0) throw new Error('corpus contains no puzzles')

  const solutions = new Array<string>(puzzles.length)
  for (let index = 0; index < puzzles.length; index++) {
    const puzzle = puzzles[index]
    if (!/^[.1-9]{81}$/.test(puzzle)) {
      throw new Error(`non-canonical puzzle at line ${index + 1}`)
    }
    const solution = solveString(puzzle)[0]
    if (!solution) throw new Error(`no solution returned for puzzle ${index + 1}`)
    solutions[index] = solutionString(solution)
  }

  await writeFile(outputPath, `${solutions.join('\n')}\n`)
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  if (args.length !== 2) {
    throw new Error('usage: sudoku-dlx-batch-runner <canonical-corpus> <solutions>')
  }
  await runBatch(resolve(args[0]), resolve(args[1]))
}

const executedDirectly =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (executedDirectly) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
