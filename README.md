# sudoku-dlx

A fast Sudoku solver for modern JavaScript runtimes, powered by
[`dancing-links`](https://github.com/TimBeyer/dancing-links) and Algorithm X.

`sudoku-dlx` is an ESM TypeScript library with a command-line interface. It supports
one-shot solves, enumeration of every solution, and compiled fixed puzzles for low-overhead
repeated solving.

## Requirements

- Node.js 22.13 or newer
- Bun is also tested as a library runtime

## Install

```sh
npm install sudoku-dlx
```

## Library API

Puzzle strings contain exactly 81 characters. Use digits `1` through `9` for givens and either
`.` or `0` for empty cells.

```ts
import { printBoard, solveString } from 'sudoku-dlx'

const puzzle = '.....12..1..7...45...43.7...9...63...5.8.7.2...62...9...3.19...97...4..6..25.....'
const [solution] = solveString(puzzle)

if (solution) {
  console.log(printBoard(solution))
}
```

Solutions are arrays of `SudokuCell` objects:

```ts
interface SudokuCell {
  number: number // 1-9
  row: number // 0-8
  col: number // 0-8
}
```

The primary APIs always return an array of solutions. An empty array means the puzzle has no
solution.

### `solveString(sudoku, all?)`

Solves an 81-character puzzle. By default the search stops after its first solution; pass `true`
to enumerate every solution.

```ts
const first = solveString(puzzle)
const every = solveString(puzzle, true)
```

### `solveCells(cells, all?)`

Solves a puzzle supplied as its zero-indexed givens.

```ts
import { solveCells, type SudokuCell } from 'sudoku-dlx'

const givens: SudokuCell[] = [
  { row: 0, col: 5, number: 1 },
  { row: 0, col: 6, number: 2 }
]

const solutions = solveCells(givens)
```

### `compileString(sudoku)` and `compileCells(cells)`

Compilation builds an immutable solver topology for one fixed puzzle. Reuse it when the same
puzzle will be solved repeatedly; one-shot calls are the appropriate path when the givens change.

```ts
import { compileString } from 'sudoku-dlx'

const compiled = compileString(puzzle)
const first = compiled.solve()
const every = compiled.solve(true)
```

The package also exports `parseStringFormat`, `printBoard`, and `generateConstraints` for input,
display, and lower-level integration.

## Command line

Run without installing globally:

```sh
npx --package sudoku-dlx sudoku-solve \
  '.....12..1..7...45...43.7...9...63...5.8.7.2...62...9...3.19...97...4..6..25.....'
```

Or install the executable globally:

```sh
npm install --global sudoku-dlx
sudoku-solve '.................................................................................'
```

The CLI prints the first solution. Invalid input and unsatisfiable puzzles return a non-zero exit
status.

## Development

Install exactly the locked dependency graph, then run the complete local check:

```sh
npm ci
npm run check
```

Useful focused commands include:

```sh
npm run build          # production ESM and declarations
npm test               # Mocha unit tests through tsx
npm run test:bun       # unit tests on Bun
npm run cover          # c8 text and LCOV coverage
npm run lint
npm run format:check
```

See [DEVELOPMENT.md](./DEVELOPMENT.md) for the full workflow and
[PERFORMANCE.md](./PERFORMANCE.md) for performance rules.

## Benchmarking

The benchmark harness validates every adapter before timing it and reports puzzles per second. It
distinguishes end-to-end calls, where public input conversion and solver setup are timed, from
prepared calls, where conversion or compilation happens outside the measured operation. Rotating
corpora use deterministic order so solvers cannot benefit from repeatedly receiving only one
puzzle.

```sh
npm run benchmark                 # sudoku-dlx regression paths
npm run benchmark:competitive     # maintained JavaScript solvers
npm run benchmark:comprehensive   # maintained plus compatible legacy solvers
npm run benchmark:json -- run.json
```

Historical pure-JavaScript packages are a best-effort `legacy` group. Historical Node native
addons are isolated from the main dependency graph and must be installed explicitly:

```sh
npm run benchmark:legacy
npm run benchmark:native:install
npm run benchmark:native
```

Tdoku and Schoku use a separate, opt-in batch-throughput workflow with pinned upstream revisions;
no third-party native source, binaries, or corpora are distributed in this package. See
[benchmark/competition/README.md](./benchmark/competition/README.md) and
[benchmark/native/README.md](./benchmark/native/README.md).

```sh
npm run benchmark:competition:setup -- --data
npm run benchmark:competition -- --solver=both
```

For comparisons that mean anything, use the same machine, runtime, lockfile, warmup, measurement
duration, and dataset. Schema-versioned JSON includes runtime, CPU, platform, commit, lockfile hash,
timing configuration, dataset semantics, and solver versions. `npm run compare-benchmarks` compares
two such reports. Published competitive tables run on the same controlled runner profile; ordinary
GitHub-hosted CPU measurements are not presented as release performance.

## Benchmarks

Release benchmark tables are generated from a validated schema-v1 report on controlled hardware.
Run `npm run update-benchmark-docs:dry-run` to preview the generated section locally.

## License

[MIT](./LICENSE)
