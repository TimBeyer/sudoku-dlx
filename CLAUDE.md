# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a high-performance sudoku solver using the [dancing-links](https://github.com/TimBeyer/dancing-links) library to implement Knuth's Dancing Links algorithm for solving exact cover problems. The project focuses on fast sudoku constraint generation and solving with competitive performance against other JavaScript sudoku solvers.

## Development Commands

- `npm run build` - Build TypeScript to JavaScript for production (uses tsconfig.release.json)
- `npm run build-dev` - Build for development (uses tsconfig.dev.json)
- `npm run test` - Run unit tests (alias for test-unit)
- `npm run test-watch` - Run tests in watch mode
- `npm run test-unit` - Run unit tests with Mocha and ts-node
- `npm run lint` - Run ESLint checks
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run coverage` - Generate test coverage report with nyc
- `npm run benchmark` - Run performance benchmarks against other sudoku solvers

## Core Architecture

### Main Entry Points

- `index.ts` - Public API exports (solveString, solveCells, utility functions)
- `lib/index.ts` - Core sudoku constraint generation and board utilities
- `bin/sudoku-solve` - CLI executable for solving sudoku from command line

### Key Functions

- `solveString()` - Solve sudoku from dot-notation string format
- `solveCells()` - Solve sudoku from SudokuCell array format
- `generateConstraints()` - Convert sudoku cells to Dancing Links constraint matrix
- `parseStringFormat()` - Parse dot-notation strings into SudokuCell arrays
- `printBoard()` - Format solved sudoku for display with box drawing characters

### Constraint Generation Logic

The core algorithm in `generateConstraints()` creates exact cover constraints for sudoku rules:

1. **Cell constraints** - Each cell must contain exactly one number
2. **Row constraints** - Each number appears exactly once per row
3. **Column constraints** - Each number appears exactly once per column
4. **Block constraints** - Each number appears exactly once per 3x3 block

Each possible number placement becomes a constraint row covering the appropriate constraint columns.

## Code Quality Standards

### Code comments

Make sure to leave relevant and detailed comments on complex parts of the codebase.

#### Comment Guidelines

**DO** write detailed comments for:

- Complex algorithms with multiple steps
- Non-obvious business logic or domain-specific rules
- Areas where refactoring considerations are documented
- Code that cannot be easily simplified due to technical constraints

**DON'T** write comments for:

- Self-evident code (obvious function names, simple operations)
- Historical changes or what code "used to do"
- Anything that can be understood from reading the code itself

When you write complex code, you MUST write documentation explaining the why, not the what.

### Performance-Critical Code Guidelines

**DO** use for performance-critical code:

- `for...of` loops over `.forEach()`
- Manual loops over `.map()` and `.reduce()` for data transformation
- Low-level iteration patterns in hot paths

**DON'T** use for performance-critical code:

- Array utility methods (`.map`, `.reduce`, `.forEach`) - provably slower than loops
- Functional programming patterns that create intermediate arrays
- Method chaining that allocates temporary objects

### Testing Guidelines

**DO** in tests:

- Test functionality and behavior
- Focus on input/output verification
- Test edge cases and error conditions

**DON'T** in tests:

- Test method existence with `.to.have.property` - TypeScript ensures this
- Test implementation details
- Duplicate type checking that TypeScript already provides

### Problem-Solving Approach

**ALWAYS plan together first for complex problems before implementing.**

When to **PLAN TOGETHER** (not implement immediately):

- Questions like "Can we think of a better way..."
- "Maybe we can build something better..."
- "Is it a good interface to..."
- Architecture or design discussions
- Performance optimization strategies
- API design questions
- Complex problem exploration

When to **IMPLEMENT DIRECTLY**:

- "Can you fix the type issue"
- "Add this specific feature"
- "Run the tests"
- Clear, specific implementation requests
- Bug fixes with known solutions

**Always use judgment**: If unsure whether to plan or implement, err on the side of planning and discussion first. Implementation can always come after we've explored the problem space together.

### Refactoring Philosophy

**BREAK APIs PROPERLY - No Legacy Compatibility Unless Explicitly Requested**

When refactoring or renaming:

- **DO** make clean breaks and update everything consistently
- **DO** rename options, functions, and variables everywhere they're used
- **DO** update all documentation, scripts, and references in one go
- **DON'T** keep legacy compatibility layers or deprecated options
- **DON'T** maintain backward compatibility unless explicitly asked

The codebase should be internally consistent. If you rename something, rename it everywhere. If you break an API, break it completely and update all consumers. Half-measures create technical debt and confusion.

## Commit Guidelines

- **ALWAYS run `npm run format` before committing** - Code must be properly formatted
- Commit frequently, ensure tests pass before committing, always ensure that ALL TS types pass
- Always do work in branches and create one if we're not in a branch already. Commit frequently.

### Pre-Commit Checklist

Before every commit, ALWAYS run:

1. `npm run format` - Format code with Prettier
2. `npm run lint` - Check for linting issues
3. `npm run test` - Ensure all tests pass
4. `npm run build` - Verify TypeScript compilation

## Commit Convention

Must follow Conventional Commits specification:

- `feat:` - New features (minor version bump)
- `fix:` - Bug fixes (patch version bump)
- `perf:` - Performance improvements
- `test:` - Test additions/changes
- `docs:` - Documentation changes
- `ci:` - CI/build changes (no release)
- `build:` - Build system changes (no release)

## Project Structure

- `lib/` - Core sudoku logic and constraint generation
- `benchmark/` - Performance testing against other sudoku solvers
- `test/unit/` - Unit test suite
- `bin/` - CLI executable scripts
- `built/` - Compiled JavaScript output
- TypeScript configuration supports both development and production builds

## Performance Requirements

Performance is important - this solver competes against other JavaScript sudoku implementations. Always consider the performance impact of changes, especially in constraint generation and core solving logic.

## CLI Usage

The project includes a CLI executable:

```bash
# Global install
npm install -g sudoku-dlx
sudoku-solve .....12..1..7...45...43.7...9...63...5.8.7.2...62...9...3.19...97...4..6..25.....

# Or with npx
npx sudoku-dlx sudoku-solve .....12..1..7...45...43.7...9...63...5.8.7.2...62...9...3.19...97...4..6..25.....
```
