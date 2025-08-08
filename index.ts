import {
  SudokuCell,
  generateConstraints,
  parseStringFormat,
} from "./lib/index.js";
import { DancingLinks } from "dancing-links";

const FIELD_SIZE = 9;

export function solveString(sudoku: string, all = false): SudokuCell[][] {
  const totalConstraints = FIELD_SIZE * FIELD_SIZE * 4;
  const cells = parseStringFormat(sudoku, FIELD_SIZE);
  const constraints = generateConstraints(cells, FIELD_SIZE);

  const dlx = new DancingLinks<SudokuCell>();
  const solver = dlx.createSolver({ columns: totalConstraints });

  // Add constraints to solver
  for (const constraint of constraints) {
    solver.addSparseConstraint(constraint.data, constraint.coveredColumns);
  }

  // Find solutions
  const solutions = all ? solver.findAll() : solver.find(1);
  
  return solutions.map(solution => solution.map(result => result.data));
}

export function solveCells(sudoku: SudokuCell[], all = false): SudokuCell[][] {
  const totalConstraints = FIELD_SIZE * FIELD_SIZE * 4;
  const constraints = generateConstraints(sudoku, FIELD_SIZE);

  const dlx = new DancingLinks<SudokuCell>();
  const solver = dlx.createSolver({ columns: totalConstraints });

  // Add constraints to solver
  for (const constraint of constraints) {
    solver.addSparseConstraint(constraint.data, constraint.coveredColumns);
  }

  // Find solutions
  const solutions = all ? solver.findAll() : solver.find(1);
  
  return solutions.map(solution => solution.map(result => result.data));
}

export {
  SudokuCell,
  parseStringFormat,
  generateConstraints,
  printBoard,
} from "./lib/index.js";
