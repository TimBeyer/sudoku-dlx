import { expect } from 'chai'
import { solveString, solveCells, printBoard } from '../../index'

describe('sudoku', function () {
    it('finds the solution with a string', function () {

      const result = solveString('.....12..1..7...45...43.7...9...63...5.8.7.2...62...9...3.19...97...4..6..25.....')
      const board = printBoard(result[0])

      const expected = [
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

      expect(board).to.eql(expected)
    })

  it('finds the solution with cells', function () {

    const result = solveCells([
      {
        "row": 0,
        "col": 5,
        "number": 1
      },
      {
        "row": 0,
        "col": 6,
        "number": 2
      },
      {
        "row": 1,
        "col": 0,
        "number": 1
      },
      {
        "row": 1,
        "col": 3,
        "number": 7
      },
      {
        "row": 1,
        "col": 7,
        "number": 4
      },
      {
        "row": 1,
        "col": 8,
        "number": 5
      },
      {
        "row": 2,
        "col": 3,
        "number": 4
      },
      {
        "row": 2,
        "col": 4,
        "number": 3
      },
      {
        "row": 2,
        "col": 6,
        "number": 7
      },
      {
        "row": 3,
        "col": 1,
        "number": 9
      },
      {
        "row": 3,
        "col": 5,
        "number": 6
      },
      {
        "row": 3,
        "col": 6,
        "number": 3
      },
      {
        "row": 4,
        "col": 1,
        "number": 5
      },
      {
        "row": 4,
        "col": 3,
        "number": 8
      },
      {
        "row": 4,
        "col": 5,
        "number": 7
      },
      {
        "row": 4,
        "col": 7,
        "number": 2
      },
      {
        "row": 5,
        "col": 2,
        "number": 6
      },
      {
        "row": 5,
        "col": 3,
        "number": 2
      },
      {
        "row": 5,
        "col": 7,
        "number": 9
      },
      {
        "row": 6,
        "col": 2,
        "number": 3
      },
      {
        "row": 6,
        "col": 4,
        "number": 1
      },
      {
        "row": 6,
        "col": 5,
        "number": 9
      },
      {
        "row": 7,
        "col": 0,
        "number": 9
      },
      {
        "row": 7,
        "col": 1,
        "number": 7
      },
      {
        "row": 7,
        "col": 5,
        "number": 4
      },
      {
        "row": 7,
        "col": 8,
        "number": 6
      },
      {
        "row": 8,
        "col": 2,
        "number": 2
      },
      {
        "row": 8,
        "col": 3,
        "number": 5
      }
    ])
    const board = printBoard(result[0])

    const expected = [
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

    expect(board).to.eql(expected)
  })
})
