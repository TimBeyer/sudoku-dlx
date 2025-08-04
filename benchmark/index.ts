import Benchmark from 'benchmark'

import {
  solveString,
  solveCells,
  parseStringFormat,
  printBoard
} from '../index.js'
import { times } from '../lib/index.js'

import klsudoku from 'klsudoku'
import dancingLinksAlgoritm from 'dancing-links-algorithm'
import sudoku_solver from 'sudoku_solver'
import SudokuSolverJs from 'sudoku-solver-js'

const SHOW_PROGRESS =
  process.env['SHOW_PROGRESS'] && process.env['SHOW_PROGRESS'] !== '0'

async function runBenchmark(name: string, sudokuString: string) {
  const GRID_SIZE = 9
  const sudokuStringWithZeros = sudokuString.replace(/\./g, '0')
  const cells = parseStringFormat(sudokuString)
  const sudokuSolverJsSolver = new SudokuSolverJs()

  // Optional C/C++ native dependencies - only import if available
  let sudokuC: any = null
  try {
    sudokuC = await import('sudoku-c')
  } catch (error) {
    console.warn('sudoku-c not available - skipping C benchmarks')
  }

  const simpleArrayCells = times(GRID_SIZE * GRID_SIZE, 0)
  for (const cell of cells) {
    const index = cell.row * GRID_SIZE + cell.col
    simpleArrayCells[index] = cell.number
  }

  console.log(`Benchmark: ${name} \n`)
  console.log(printBoard(cells))
  console.log('\n')

  const suite = new Benchmark.Suite()

  suite
    .add('sudoku-dlx from string (JS)', function () {
      solveString(sudokuString)
    })
    .add('sudoku-dlx from cells (JS)', function () {
      solveCells(cells)
    })

  // Test each solver individually to avoid hangs
  console.log('Testing klsudoku...')
  try {
    klsudoku.solve(sudokuString)
    suite.add('klsudoku from string (C++)', function () {
      klsudoku.solve(sudokuString)
    })
    console.log('klsudoku added to benchmark')
  } catch (error) {
    console.warn('klsudoku failed:', error)
  }

  console.log('Testing dancing-links-algorithm...')
  try {
    dancingLinksAlgoritm.solve(sudokuStringWithZeros)
    suite.add('dancing-links-algorithm from string (JS)', function () {
      dancingLinksAlgoritm.solve(sudokuStringWithZeros)
    })
    console.log('dancing-links-algorithm added to benchmark')
  } catch (error) {
    console.warn('dancing-links-algorithm failed:', error)
  }

  console.log('Testing sudoku-solver-js...')
  try {
    sudokuSolverJsSolver.solve(sudokuString)
    suite.add('sudoku-solver-js from string (JS)', function () {
      sudokuSolverJsSolver.solve(sudokuString)
    })
    console.log('sudoku-solver-js added to benchmark')
  } catch (error) {
    console.warn('sudoku-solver-js failed:', error)
  }

  console.log('Testing sudoku_solver...')
  try {
    let grid = new sudoku_solver.Grid(sudokuString)
    let solver = new sudoku_solver.Solver()
    solver.solve(grid)
    suite.add('sudoku_solver from string (JS)', function () {
      let grid = new sudoku_solver.Grid(sudokuString)
      let solver = new sudoku_solver.Solver()
      solver.solve(grid)
    })
    console.log('sudoku_solver added to benchmark')
  } catch (error) {
    console.warn('sudoku_solver failed:', error)
  }

  // Only add C solver if available
  if (sudokuC) {
    try {
      sudokuC.solve([...simpleArrayCells])
      suite.add('sudoku-c from array (C)', function () {
        // This solver mutates the output
        // so need the cloning overhead sadly
        sudokuC.solve([...simpleArrayCells])
      })
      console.log('sudoku-c added to benchmark')
    } catch (error) {
      console.warn('sudoku-c failed:', error)
    }
  }

  console.log('Starting benchmark suite...')
  return new Promise((resolve) => {
    suite
      .on('cycle', function (event: any) {
        if (SHOW_PROGRESS) {
          console.log(String(event.target))
        }
      })
      .on('complete', function (this: any) {
        const results = this.map((res: any) => {
          return res
        })
          .sort((a: any, b: any) => {
            return b.hz - a.hz
          })
          .map((r: any) => String(r))
          .join('\n')

        console.log(results)
        console.log('\nFastest is ' + this.filter('fastest').map('name') + '\n\n')
        resolve(undefined)
      })
      .run({ async: true })
  })
}

async function main() {
  await runBenchmark(
    'A solution to the sudoku (simple)',
    '.....12..1..7...45...43.7...9...63...5.8.7.2...62...9...3.19...97...4..6..25.....'
  )
  // Commented out second benchmark to avoid timeout issues in CI
  // await runBenchmark(
  //   'A solution to the sudoku (hard)',
  //   '..............3.85..1.2.......5.7.....4...1...9.......5......73..2.1........4...9'
  // )
}

main().catch(console.error)  
