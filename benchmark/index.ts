import * as Benchmark from 'benchmark'

import { solveString, solveCells, parseStringFormat, printBoard } from '../index'
import { times } from '../lib';

import * as sudokuC from 'sudoku-c'
import * as klsudoku from 'klsudoku'
import * as dancingLinksAlgoritm from 'dancing-links-algorithm'
import * as sudokuSolver from '@mattflow/sudoku-solver'
import * as sudoku_solver from 'sudoku_solver'
import * as SudokuSolverJs from 'sudoku-solver-js'

const SHOW_PROGRESS = process.env['SHOW_PROGRESS'] && process.env['SHOW_PROGRESS'] !== "0"

function runBenchmark (name: string, sudokuString: string) {
  const GRID_SIZE = 9
  const sudokuStringWithZeros = sudokuString.replace(/\./g, '0')
  const cells = parseStringFormat(sudokuString)
  const sudokuSolverJsSolver = new SudokuSolverJs()

  const simpleArrayCells = times(GRID_SIZE * GRID_SIZE, 0)
  for (const cell of cells) {
    const index = cell.row * GRID_SIZE + cell.col
    simpleArrayCells[index] = cell.number
  }

  console.log(`Benchmark: ${name} \n`)
  console.log(printBoard(cells))
  console.log('\n')

  const suite = new Benchmark.Suite()

  suite.add('sudoku-dlx from string (JS)', function () {
    solveString(sudokuString)
  })
  .add('sudoku-dlx from cells (JS)', function () {
    solveCells(cells)
  })
  .add('klsudoku from string (C++)', function () {
    klsudoku.solve(sudokuString)
  })
  .add('dancing-links-algorithm from string (JS)', function () {
    dancingLinksAlgoritm.solve(sudokuStringWithZeros)
  })
  .add('@mattflow/sudoku-solver from string (JS)', function () {
    sudokuSolver(sudokuStringWithZeros)
  })
  .add('sudoku-solver-js from string (JS)', function () {
    sudokuSolverJsSolver.solve(sudokuString)
  })
  .add('sudoku_solver from string (JS)', function () {
    let grid = new sudoku_solver.Grid(sudokuString)
    // Creates a Solver
    let solver = new sudoku_solver.Solver()
    solver.solve(grid)
  })
  .add('sudoku-c from array (C)', function () {
    // This solver mutates the output
    // so need the cloning overhead sadly
    sudokuC.solve([...simpleArrayCells])
  })
  .on('cycle', function (event) {
    if (SHOW_PROGRESS) {
      console.log(String(event.target))
    }
  })
  .on('complete', function () {
    const results = this.map((res) => {
      return res
    }).sort((a, b) => {
      return b.hz - a.hz
    }).map((r) => String(r)).join('\n')

    console.log(results)
    console.log('\nFastest is ' + this.filter('fastest').map('name') + '\n\n')
  }).run()
}

runBenchmark('A solution to the sudoku (simple)', '.....12..1..7...45...43.7...9...63...5.8.7.2...62...9...3.19...97...4..6..25.....')  
runBenchmark('A solution to the sudoku (hard)', '..............3.85..1.2.......5.7.....4...1...9.......5......73..2.1........4...9')  
