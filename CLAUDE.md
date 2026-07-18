# sudoku-dlx repository guide

## Project

`sudoku-dlx` is an ESM TypeScript library and CLI for solving classic 9×9 Sudoku puzzles with the
[`dancing-links`](https://github.com/TimBeyer/dancing-links) exact-cover implementation. The public
entry point is `index.ts`; parsing, validation, display, and constraint generation live under
`lib/`; and `bin/sudoku-solve` is the published executable.

Production output is isolated under `built/lib/` and `built/typings/`. Tests, benchmarks, and
repository scripts compile beneath `built/dev/` and are not published.

## Commands

- `npm run build` builds published ESM and declarations.
- `npm run build:dev` builds development-only tests, benchmarks, and scripts.
- `npm test` runs the Mocha unit suite through `tsx`.
- `npm run test:bun` runs the library tests on Bun.
- `npm run cover` generates local c8 text and LCOV coverage without an external service.
- `npm run lint` checks source, tests, scripts, and benchmarks.
- `npm run format` applies Prettier.
- `npm run benchmark` runs internal regression cases.
- `npm run benchmark:competitive` runs maintained external solver comparisons.
- `npm run check` performs the standard pre-commit verification.

## Engineering rules

- Use Node.js 22.13 or newer and ESM imports with `.js` specifiers in TypeScript source.
- Preserve the module-level prebuilt numeric `ConstraintRow` cache. Filter it into packed row
  references and send the batch through `addRows()` on the solver hot path.
- Do not expose cached rows or allow `SolverTemplate` compilation to mutate them; compiled puzzles
  must own cloned row topology.
- Preserve the distinction between first-solution and all-solutions behavior and return fresh,
  caller-owned cells.
- Add behavioral tests for invalid, unsatisfiable, ambiguous, repeated, and mutation-prone inputs.
- Run same-machine, same-runtime benchmarks before and after solver-path changes. Validate adapters
  before timing and do not compare incompatible prepared and end-to-end boundaries.
- Keep the library, executable, declarations, README examples, and benchmark adapters consistent.
- Use Conventional Commits and make breaking changes explicit.

See [DEVELOPMENT.md](./DEVELOPMENT.md) for the complete workflow and
[PERFORMANCE.md](./PERFORMANCE.md) for benchmark rules.
