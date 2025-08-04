declare module 'klsudoku' {
  interface KlSudoku {
    solve(sudokuString: string): string
  }
  const klsudoku: KlSudoku
  export default klsudoku
}

declare module 'dancing-links-algorithm' {
  interface DancingLinksAlgorithm {
    solve(sudokuString: string): string
  }
  const dancingLinksAlgorithm: DancingLinksAlgorithm
  export default dancingLinksAlgorithm
}

declare module 'sudoku_solver' {
  class Grid {
    constructor(sudokuString: string)
  }
  
  class Solver {
    solve(grid: Grid): void
  }
  
  export { Grid, Solver }
}

declare module 'sudoku-solver-js' {
  class SudokuSolverJs {
    solve(sudokuString: string): string
  }
  export default SudokuSolverJs
}

declare module 'sudoku-c' {
  function solve(grid: number[]): number[]
  export { solve }
}