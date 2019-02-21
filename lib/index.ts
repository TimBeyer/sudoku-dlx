import { Row } from 'dancing-links'

export interface SudokuCell {
  number: number
  row: number
  col: number
}

export function times<T> (n: number, fn: ((index: number) => T) | T): T[] {
  const returnValue: T[] = []

  for (let i = 0; i < n; i++) {
    returnValue.push(fn instanceof Function ? fn(i) : fn)
  }

  return returnValue
}

export function generateConstraints (inputs: SudokuCell[] = [], size = 9): Row<SudokuCell>[] {
  const blockSize = Math.sqrt(size)
  const constraintBlockSize = size * size

  const constraints: Row<SudokuCell>[] = []

  const inputsByCoords = new Map()

  for (const input of inputs) {
    inputsByCoords.set(`${input.col}|${input.row}`, input)
  }

  for (let currentRow = 0; currentRow < size; currentRow++) {
    for (let currentCol = 0; currentCol < size; currentCol++) {
      const matchingInput = inputsByCoords.get(`${currentCol}|${currentRow}`)

      for (let currentNumber = 0; currentNumber < size; currentNumber++) {
        if (matchingInput) {
          // Internally we index with zero, but numbers start at 1
          if (matchingInput.number !== currentNumber + 1) {
            // If we have an input for this row/col we need to skip all other options
            continue
          }
        }

        const numberOffset = (currentNumber * size)
        const rowColNumber = size * currentRow + currentCol
        const rowColIndex = rowColNumber

        const rowIndex = constraintBlockSize + numberOffset + currentRow
        const colIndex = constraintBlockSize + constraintBlockSize + numberOffset + currentCol

        const blockRow = Math.floor(currentRow / blockSize)
        const blockCol = Math.floor(currentCol / blockSize)

        const blockNumber = blockSize * blockRow + blockCol

        const blockIndex = constraintBlockSize + constraintBlockSize + constraintBlockSize + (numberOffset + blockNumber)

        constraints.push({
          coveredColumns: [rowColIndex, rowIndex, colIndex, blockIndex],
          data: {
            number: currentNumber + 1,
            row: currentRow,
            col: currentCol
          }
        })
      }
    }
  }

  return constraints
}

const boxStyles = {
  'top': '─',
  'topLeft': '╭',
  'topMid': '┬',
  'topRight': '╮',
  'bottom': '─',
  'bottomRight': '╯',
  'bottomMid': '┴',
  'bottomLeft': '╰',
  'left': '│',
  'leftMid': '├',
  'mid': '─',
  'midMid': '┼',
  'right': '│',
  'rightMid': '┤',
  'middle': '│'
}

export function printBoard (inputs: SudokuCell[], size = 9): string {
  const blocks = Math.sqrt(size)
  const rows: string[][] = times(size, () => times(size, '.'))

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const field = inputs.find((input) => input.col === x && input.row === y)
      rows[y][x] = String((field && field.number) || '.')
    }
  }

  const topBorder = times(size + (blocks - 1), (i) => i > 0 && (i + 1) % (blocks + 1) === 0 ? boxStyles.topMid : boxStyles.top).join('')
  let board = `${boxStyles.topLeft}${topBorder}${boxStyles.topRight}\n`

  for (let y = 0; y < size; y++) {

    if (y > 0 && y % blocks === 0) {
      const midBorder = times(size + (blocks - 1), (i) => i > 0 && (i + 1) % (blocks + 1) === 0 ? boxStyles.midMid : boxStyles.mid).join('')
      board += `${boxStyles.leftMid}${midBorder}${boxStyles.rightMid}\n`
    }

    board += boxStyles.left

    for (let x = 0; x < size; x++) {
      if (x > 0 && x % blocks === 0) {
        board += boxStyles.middle
      }
      const content = rows[y][x]
      board += content
    }

    board += `${boxStyles.right}\n`
  }

  const bottomBorder = times(size + (blocks - 1), (i) => i > 0 && (i + 1) % (blocks + 1) === 0 ? boxStyles.bottomMid : boxStyles.bottom).join('')
  board += `${boxStyles.bottomLeft}${bottomBorder}${boxStyles.bottomRight}`

  return board
}

export function parseStringFormat (dotFormat: string, size = 9): SudokuCell[] {
  const inputs: SudokuCell[] = []

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const index = size * row + col
      const cell = dotFormat[index]
      if (cell !== '.' && cell !== '0') {
        inputs.push({
          row: row,
          col: col,
          number: Number(cell)
        })
      }
    }
  }

  return inputs
}
