# Repo Instructions

## Testing

Any feature addition requires thorough testing.
Use Test-Driven Development (TDD) to guide implementation wherever applicable.
All new code should be accompanied by appropriate unit tests.

## Performance

Performance is important for this sudoku solver, as it competes against other JavaScript implementations.
If you modify sudoku solving logic or constraint generation, consider running benchmarks to ensure no performance regression.

## Sudoku Domain Knowledge

- This project solves sudoku by converting them to exact cover problems
- The constraint generation creates 4 types of constraints: cell, row, column, and block
- Each possible number placement becomes a constraint row covering appropriate columns
- Uses the dancing-links library for the actual solving algorithm

## Commit Style

All commits in this repository MUST follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification.

- If you change repository setup, CI flows, or similar meta-configuration, use the `build:` or `ci:` prefix
- For sudoku algorithm improvements, use `feat:` or `perf:`
- For bug fixes in solving logic, use `fix:`

**Examples:**

- `feat: add support for 16x16 sudoku puzzles`
- `fix: resolve incorrect constraint generation for edge cases`
- `perf: optimize constraint matrix creation`
- `ci: update workflow for test coverage`
- `build: update dependencies`
- `docs: update solving algorithm documentation`