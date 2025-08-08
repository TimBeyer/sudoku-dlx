import Benchmark from 'benchmark'

import { solveString, solveCells, parseStringFormat, printBoard } from '../index.js'

// External sudoku solvers for benchmarking
// These have no types but are only used for performance comparison
import klsudoku from 'klsudoku'
import dancingLinksAlgoritm from 'dancing-links-algorithm'
import sudoku_solver from 'sudoku_solver'
import SudokuSolverJs from 'sudoku-solver-js'

const SHOW_PROGRESS = process.env['SHOW_PROGRESS'] && process.env['SHOW_PROGRESS'] !== '0'

interface SudokuTestCase {
  name: string
  puzzle: string
  description: string
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

function createSolver(puzzle: string) {
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


// Parse command line arguments
const args = process.argv.slice(2)
const isJsonMode = args.includes('--json')
const outputFile = args.find(arg => !arg.startsWith('--'))

interface BenchmarkResult {
  benchmarkName: string
  results: Array<{
    name: string
    opsPerSec: number
    margin: number
    runs: number
    deprecated: boolean
  }>
}

const benchmarkResults: BenchmarkResult[] = []

function runBenchmark(testCase: SudokuTestCase, isJsonMode = false): Promise<void> {
  return new Promise((resolve) => {
    const { description } = testCase
    const cells = parseStringFormat(testCase.puzzle)
    const solvers = createSolver(testCase.puzzle)

    if (!isJsonMode) {
      console.log(`Benchmark: ${description} \n`)
      console.log(printBoard(cells))
      console.log('\n')
    }

    const suite = new Benchmark.Suite()

    // Add all solvers to the benchmark suite
    Object.entries(solvers).forEach(([solverName, solverFn]) => {
      suite.add(solverName, solverFn)
    })

    suite
      .on('cycle', (event: any) => {
        if (SHOW_PROGRESS && !isJsonMode) {
          console.log(String(event.target))
        }
      })
      .on('complete', function (this: any) {
        const results = Array.from(this)
          .sort((a: any, b: any) => b.hz - a.hz)
          .map((r: any) => ({
            name: r.name,
            opsPerSec: r.hz,
            margin: r.stats.rme,
            runs: r.stats.sample.length,
            deprecated: false
          }))

        const fastest = this.filter('fastest').map('name')

        if (isJsonMode) {
          benchmarkResults.push({
            benchmarkName: description,
            results
          })
        } else {
          const output = Array.from(this)
            .sort((a: any, b: any) => b.hz - a.hz)
            .map((r: any) => String(r))
            .join('\n')
          console.log(output)
          console.log('\nFastest is ' + fastest.join(',') + '\n\n')
        }

        resolve()
      })
      .run()
  })
}

async function main() {
  if (!isJsonMode) {
    console.log('Running Sudoku Solver Benchmarks\n')
    console.log(`Node.js version: ${process.version}`)
    console.log(`Platform: ${process.platform} ${process.arch}`)
    console.log(`Show progress: ${SHOW_PROGRESS ? 'enabled' : 'disabled'}\n`)
  }

  // Run all test cases
  for (const testCase of TEST_CASES) {
    await runBenchmark(testCase, isJsonMode)
  }

  if (isJsonMode) {
    const output = JSON.stringify(benchmarkResults, null, 2)
    if (outputFile) {
      const fs = await import('fs')
      fs.writeFileSync(outputFile, output)
      if (!SHOW_PROGRESS) {
        console.log(`Results written to ${outputFile}`)
      }
    } else {
      console.log(output)
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
