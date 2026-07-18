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
- `npm run benchmark:wasm` runs the separately labelled steady-state Wasm comparison.
- `npm run benchmark:corpus:verify` regenerates and verifies the representative measured and warmup
  corpora without changing the checked-in data.
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
- Run same-machine, same-runtime benchmarks before and after solver-path changes. Direct comparisons
  must solve the same complete corpus with first-solution semantics; validate only the disjoint
  warmup corpus before timing and validate captured measured outputs after timing.
- Give each ranked pass fresh exact puzzle strings and fresh prepared objects outside timing so
  exact-input memoization and input mutation cannot benefit from benchmark repetition.
- Prepared comparisons may exclude natural input conversion, but not puzzle-specific solver setup.
  Keep exact-puzzle compilation unranked and alternative runtimes in separately labelled groups.
- Keep the library, executable, declarations, README examples, and benchmark adapters consistent.
- Use Conventional Commits and make breaking changes explicit.

See [DEVELOPMENT.md](./DEVELOPMENT.md) for the complete workflow and
[PERFORMANCE.md](./PERFORMANCE.md) for benchmark rules.
