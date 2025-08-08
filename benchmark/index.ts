import Benchmark from 'benchmark'

import { solveString, solveCells, parseStringFormat, printBoard } from '../index.js'
import { times } from '../lib/index.js'

import klsudoku from 'klsudoku'
import dancingLinksAlgoritm from 'dancing-links-algorithm'
// import sudokuSolver from "@mattflow/sudoku-solver";
import sudoku_solver from 'sudoku_solver'
import SudokuSolverJs from 'sudoku-solver-js'

const SHOW_PROGRESS = process.env['SHOW_PROGRESS'] && process.env['SHOW_PROGRESS'] !== '0'

interface SudokuTestCase {
  name: string
  puzzle: string
  description?: string
}

const TEST_CASES: SudokuTestCase[] = [
  {
    name: 'simple',
    puzzle: '.....12..1..7...45...43.7...9...63...5.8.7.2...62...9...3.19...97...4..6..25.....',
    description: 'A solution to the sudoku (simple)'
  },
  {
    name: 'hard',
    puzzle: '..............3.85..1.2.......5.7.....4...1...9.......5......73..2.1........4...9',
    description: 'A solution to the sudoku (hard)'
  }
]

function createSolver(name: string, puzzle: string) {
  const GRID_SIZE = 9
  const sudokuStringWithZeros = puzzle.replace(/\./g, '0')
  const cells = parseStringFormat(puzzle)
  const sudokuSolverJsSolver = new SudokuSolverJs()

  const solvers = {
    'sudoku-dlx from string (JS)': () => solveString(puzzle),
    'sudoku-dlx from cells (JS)': () => solveCells(cells),
    'klsudoku from string (C++)': () => klsudoku.solve(puzzle),
    'dancing-links-algorithm from string (JS)': () =>
      dancingLinksAlgoritm.solve(sudokuStringWithZeros),
    'sudoku-solver-js from string (JS)': () => sudokuSolverJsSolver.solve(puzzle),
    'sudoku_solver from string (JS)': () => {
      const grid = new sudoku_solver.Grid(puzzle)
      const solver = new sudoku_solver.Solver()
      solver.solve(grid)
    }
  }

  return solvers
}

function runBenchmark(testCase: SudokuTestCase) {
  const { name, puzzle, description } = testCase
  const cells = parseStringFormat(puzzle)
  const solvers = createSolver(name, puzzle)

  console.log(`Benchmark: ${description || name} \n`)
  console.log(printBoard(cells))
  console.log('\n')

  const suite = new Benchmark.Suite()

  // Add all solvers to the benchmark suite
  Object.entries(solvers).forEach(([solverName, solverFn]) => {
    suite.add(solverName, solverFn)
  })

  suite
    .on('cycle', (event: any) => {
      if (SHOW_PROGRESS) {
        console.log(String(event.target))
      }
    })
    .on('complete', function () {
      const results = Array.from(this)
        .sort((a: any, b: any) => b.hz - a.hz)
        .map((r: any) => String(r))
        .join('\n')

      console.log(results)
      console.log('\nFastest is ' + this.filter('fastest').map('name') + '\n\n')
    })
    .run()
}

function main() {
  console.log('Running Sudoku Solver Benchmarks\n')
  console.log(`Node.js version: ${process.version}`)
  console.log(`Platform: ${process.platform} ${process.arch}`)
  console.log(`Show progress: ${SHOW_PROGRESS ? 'enabled' : 'disabled'}\n`)

  // Run all test cases
  for (const testCase of TEST_CASES) {
    runBenchmark(testCase)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
