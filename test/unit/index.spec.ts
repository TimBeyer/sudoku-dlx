import { expect } from 'chai'
import {
  compileCells,
  compileString,
  generateConstraints,
  parseStringFormat,
  printBoard,
  solveCells,
  solveString,
  type SudokuCell
} from '../../index.js'
import { createNumericConstraintsFromString } from '../../lib/index.js'

const PUZZLE = '.....12..1..7...45...43.7...9...63...5.8.7.2...62...9...3.19...97...4..6..25.....'
const SOLUTION = '745981263138762945629435718297156384354897621816243597583619472971324856462578139'
const TWO_SOLUTION_PUZZLE =
  '7459.126.1387629456294.571.297156384354897621816243597583619472971324856462578139'
const TWO_SOLUTIONS = [
  SOLUTION,
  '745931268138762945629485713297156384354897621816243597583619472971324856462578139'
].sort()
const UNSATISFIABLE =
  '445981263138762945629435718297156384354897621816243597583619472971324856462578139'

const EXPECTED_BOARD = [
  '╭───┬───┬───╮',
  '│745│981│263│',
  '│138│762│945│',
  '│629│435│718│',
  '├───┼───┼───┤',
  '│297│156│384│',
  '│354│897│621│',
  '│816│243│597│',
  '├───┼───┼───┤',
  '│583│619│472│',
  '│971│324│856│',
  '│462│578│139│',
  '╰───┴───┴───╯'
].join('\n')

function solutionString(cells: SudokuCell[]): string {
  const values = new Array<string>(81).fill('0')

  for (const cell of cells) {
    values[cell.row * 9 + cell.col] = String(cell.number)
  }

  return values.join('')
}

function normalizedSolutions(solutions: SudokuCell[][]): string[] {
  const normalized = new Array<string>(solutions.length)

  for (let index = 0; index < solutions.length; index++) {
    normalized[index] = solutionString(solutions[index])
  }

  return normalized.sort()
}

describe('sudoku solving', function () {
  it('finds and formats the solution from a string', function () {
    const solutions = solveString(PUZZLE)

    expect(solutions).to.have.length(1)
    expect(solutionString(solutions[0])).to.equal(SOLUTION)
    expect(printBoard(solutions[0])).to.equal(EXPECTED_BOARD)
  })

  it('finds the same solution from parsed cells', function () {
    const cells = parseStringFormat(PUZZLE)
    const fromString = solveString(PUZZLE)
    const fromCells = solveCells(cells)

    expect(normalizedSolutions(fromCells)).to.deep.equal(normalizedSolutions(fromString))
  })

  it('returns one solution by default and all solutions on request', function () {
    const oneSolution = solveString(TWO_SOLUTION_PUZZLE)
    const allSolutions = solveString(TWO_SOLUTION_PUZZLE, true)

    expect(oneSolution).to.have.length(1)
    expect(TWO_SOLUTIONS).to.include(solutionString(oneSolution[0]))
    expect(normalizedSolutions(allSolutions)).to.deep.equal(TWO_SOLUTIONS)
  })

  it('returns no solutions for structurally valid but inconsistent clues', function () {
    expect(solveString(UNSATISFIABLE)).to.deep.equal([])
    expect(solveCells(parseStringFormat(UNSATISFIABLE))).to.deep.equal([])
  })

  it('does not leak solver or result state between calls', function () {
    const first = solveString(PUZZLE)
    first[0][0].number = 0

    expect(solutionString(solveString(PUZZLE)[0])).to.equal(SOLUTION)
    expect(normalizedSolutions(solveString(TWO_SOLUTION_PUZZLE, true))).to.deep.equal(TWO_SOLUTIONS)
    expect(solutionString(solveString(PUZZLE)[0])).to.equal(SOLUTION)
  })
})

describe('compiled sudoku solving', function () {
  it('does not transfer ownership of the shared candidate cache to a template', function () {
    const cachedRow = createNumericConstraintsFromString(PUZZLE)[0]
    const cachedColumns = cachedRow.coveredColumns

    compileString(PUZZLE)

    const rowAfterCompile = createNumericConstraintsFromString(PUZZLE)[0]
    expect(rowAfterCompile).to.equal(cachedRow)
    expect(rowAfterCompile.coveredColumns).to.equal(cachedColumns)
  })

  it('reuses a compiled string puzzle and returns fresh cell objects', function () {
    const compiled = compileString(PUZZLE)
    const first = compiled.solve()
    const firstCell = first[0][0]
    firstCell.number = 0

    const second = compiled.solve()
    expect(solutionString(second[0])).to.equal(SOLUTION)
    expect(second[0][0]).to.not.equal(firstCell)
  })

  it('compiles cell input and can enumerate every solution repeatedly', function () {
    const inputs = parseStringFormat(TWO_SOLUTION_PUZZLE)
    const compiled = compileCells(inputs)
    inputs[0].number = 0

    expect(normalizedSolutions(compiled.solve(true))).to.deep.equal(TWO_SOLUTIONS)
    expect(normalizedSolutions(compiled.solve(true))).to.deep.equal(TWO_SOLUTIONS)
  })

  it('preserves an unsatisfiable fixed puzzle', function () {
    const compiled = compileString(UNSATISFIABLE)

    expect(compiled.solve()).to.deep.equal([])
    expect(compiled.solve(true)).to.deep.equal([])
  })
})

describe('constraint generation', function () {
  it('generates all 729 standard candidates in stable order', function () {
    const constraints = generateConstraints()

    expect(constraints).to.have.length(729)
    expect(constraints[0]).to.deep.equal({
      coveredColumns: [0, 81, 162, 243],
      data: { number: 1, row: 0, col: 0 }
    })
    expect(constraints[728]).to.deep.equal({
      coveredColumns: [80, 161, 242, 323],
      data: { number: 9, row: 8, col: 8 }
    })

    for (const constraint of constraints) {
      expect(constraint.coveredColumns).to.have.length(4)
      expect(new Set(constraint.coveredColumns).size).to.equal(4)
      for (const column of constraint.coveredColumns) {
        expect(Number.isInteger(column)).to.equal(true)
        expect(column).to.be.at.least(0)
        expect(column).to.be.lessThan(324)
      }
    }
  })

  it('retains only the matching candidate at a given position', function () {
    const constraints = generateConstraints([{ row: 0, col: 0, number: 5 }])
    const firstCellCandidates = constraints.filter(
      constraint => constraint.data.row === 0 && constraint.data.col === 0
    )

    expect(constraints).to.have.length(721)
    expect(firstCellCandidates).to.deep.equal([
      {
        coveredColumns: [0, 117, 198, 279],
        data: { number: 5, row: 0, col: 0 }
      }
    ])
  })

  it('does not expose mutable cached column arrays', function () {
    const first = generateConstraints()
    first[0].coveredColumns[0] = 323
    first[0].data.number = 9

    expect(generateConstraints()[0]).to.deep.equal({
      coveredColumns: [0, 81, 162, 243],
      data: { number: 1, row: 0, col: 0 }
    })
  })
})

describe('validation', function () {
  it('rejects strings with the wrong length', function () {
    expect(() => solveString('.'.repeat(80))).to.throw('exactly 81 cells')
    expect(() => parseStringFormat('.'.repeat(82))).to.throw('exactly 81 cells')
  })

  it('rejects invalid string characters and out-of-range digits', function () {
    expect(() => solveString(`${'.'.repeat(40)}x${'.'.repeat(40)}`)).to.throw(
      'Invalid Sudoku character "x" at index 40'
    )
    expect(() => parseStringFormat('5...............', 4)).to.throw(
      'Invalid Sudoku character "5" at index 0'
    )
  })

  it('requires a positive perfect-square size', function () {
    expect(() => generateConstraints([], 0)).to.throw('positive integer')
    expect(() => generateConstraints([], 8)).to.throw('perfect square')
    expect(() => printBoard([], 2)).to.throw('perfect square')
  })

  it('validates cell coordinates, numbers, and duplicate positions', function () {
    expect(() => solveCells([{ row: -1, col: 0, number: 1 }])).to.throw('cell row')
    expect(() => solveCells([{ row: 0, col: 9, number: 1 }])).to.throw('cell column')
    expect(() => solveCells([{ row: 0, col: 0, number: 10 }])).to.throw('cell number')
    expect(() => solveCells([{ row: 0.5, col: 0, number: 1 }])).to.throw('cell row')
    expect(() =>
      solveCells([
        { row: 0, col: 0, number: 1 },
        { row: 0, col: 0, number: 2 }
      ])
    ).to.throw('Duplicate Sudoku cell at row 0, column 0')
  })
})

describe('format parsing and printing', function () {
  it('parses dots and zeroes as empty cells', function () {
    expect(parseStringFormat('1.0.............', 4)).to.deep.equal([{ row: 0, col: 0, number: 1 }])
  })

  it('formats a partial 4x4 board', function () {
    expect(
      printBoard(
        [
          { row: 0, col: 0, number: 1 },
          { row: 3, col: 3, number: 4 }
        ],
        4
      )
    ).to.equal(
      ['╭──┬──╮', '│1.│..│', '│..│..│', '├──┼──┤', '│..│..│', '│..│.4│', '╰──┴──╯'].join('\n')
    )
  })

  it('aligns multi-digit cells on a 16x16 board', function () {
    const board = printBoard(
      [
        { row: 0, col: 0, number: 1 },
        { row: 0, col: 15, number: 16 }
      ],
      16
    )
    const lines = board.split('\n')

    expect(new Set(lines.map(line => line.length))).to.deep.equal(new Set([37]))
    expect(lines[1]).to.equal('│ 1 . . .│ . . . .│ . . . .│ . . .16│')
  })
})
