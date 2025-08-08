// Type declarations for benchmark dependencies
declare module 'klsudoku' {
  const klsudoku: {
    solve: (sudoku: string) => any
  }
  export = klsudoku
}

declare module 'dancing-links-algorithm' {
  const dancingLinksAlgoritm: {
    solve: (sudoku: string) => any
  }
  export = dancingLinksAlgoritm
}

declare module 'sudoku_solver' {
  const sudoku_solver: {
    Grid: new (sudoku: string) => any
    Solver: new () => { solve: (grid: any) => any }
  }
  export = sudoku_solver
}

declare module 'sudoku-solver-js' {
  class SudokuSolverJs {
    solve(sudoku: string): any
  }
  export = SudokuSolverJs
}