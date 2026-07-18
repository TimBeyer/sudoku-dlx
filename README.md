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

Benchmarks solve one puzzle per operation, rotate deterministic corpora, and validate every solver result before timing. End-to-end cases include public input conversion; prepared cases move conversion or fixed-puzzle compilation outside the timed operation.

### Easy puzzle — end-to-end public API

Dataset: `easy` (1 puzzle); semantics: `end-to-end`.

| Solver                 | Puzzles/sec |          Relative | Margin |
| ---------------------- | ----------: | ----------------: | -----: |
| sudoku-dlx solveString |   45,503.76 | **1.00× fastest** | ±0.16% |
| sudoku-dlx solveCells  |    44,234.8 |             0.97× | ±0.12% |
| @algorithm.ts/sudoku   |   20,969.94 |             0.46× | ±0.09% |
| fast-sudoku-solver     |   11,075.34 |             0.24× | ±0.21% |

### Hard puzzle — end-to-end public API

Dataset: `hard` (1 puzzle); semantics: `end-to-end`.

| Solver                 | Puzzles/sec |          Relative | Margin |
| ---------------------- | ----------: | ----------------: | -----: |
| sudoku-dlx solveString |   37,999.85 | **1.00× fastest** | ±0.11% |
| sudoku-dlx solveCells  |   36,903.51 |             0.97× | ±0.12% |
| @algorithm.ts/sudoku   |   20,568.42 |             0.54× | ±0.07% |
| fast-sudoku-solver     |        10.8 |             0.00× | ±0.59% |

### Easy + hard rotating corpus — end-to-end public API

Dataset: `rotating` (8 puzzles); semantics: `end-to-end`.

| Solver                 | Puzzles/sec |          Relative |  Margin |
| ---------------------- | ----------: | ----------------: | ------: |
| sudoku-dlx solveString |   39,075.62 | **1.00× fastest** |  ±0.16% |
| sudoku-dlx solveCells  |   37,696.18 |             0.96× |  ±0.18% |
| @algorithm.ts/sudoku   |   20,941.59 |             0.54× |  ±0.09% |
| fast-sudoku-solver     |    4,460.66 |             0.11× | ±25.06% |

### Easy fixed puzzle — prepared input

Dataset: `easy` (1 puzzle); semantics: `prepared`.

| Solver                           | Puzzles/sec |          Relative | Margin |
| -------------------------------- | ----------: | ----------------: | -----: |
| sudoku-dlx compileString + solve |   96,457.58 | **1.00× fastest** | ±0.09% |
| sudoku-dlx compileCells + solve  |    96,205.3 |             1.00× | ±0.09% |
| sudoku-dlx solveCells            |   43,314.55 |             0.45× | ±0.11% |
| @algorithm.ts/sudoku             |   21,557.38 |             0.22× | ±0.08% |
| fast-sudoku-solver               |   10,766.83 |             0.11× | ±0.14% |

### Hard fixed puzzle — prepared input

Dataset: `hard` (1 puzzle); semantics: `prepared`.

| Solver                           | Puzzles/sec |          Relative | Margin |
| -------------------------------- | ----------: | ----------------: | -----: |
| sudoku-dlx compileCells + solve  |   81,626.02 | **1.00× fastest** | ±0.10% |
| sudoku-dlx compileString + solve |    80,070.9 |             0.98× | ±0.11% |
| sudoku-dlx solveCells            |   36,814.77 |             0.45× | ±0.11% |
| @algorithm.ts/sudoku             |   20,990.99 |             0.26× | ±0.06% |
| fast-sudoku-solver               |          11 |             0.00× | ±0.65% |

### Easy + hard rotating corpus — prepared input

Dataset: `rotating` (8 puzzles); semantics: `prepared`.

| Solver                           | Puzzles/sec |          Relative |  Margin |
| -------------------------------- | ----------: | ----------------: | ------: |
| sudoku-dlx compileString + solve |   81,091.29 | **1.00× fastest** |  ±0.14% |
| sudoku-dlx compileCells + solve  |   80,491.03 |             0.99× |  ±0.15% |
| sudoku-dlx solveCells            |   37,673.15 |             0.46× |  ±0.17% |
| @algorithm.ts/sudoku             |   21,211.75 |             0.26× |  ±0.11% |
| fast-sudoku-solver               |    5,051.19 |             0.06× | ±25.39% |

### Reproduction metadata

- Runtime: node v24.18.0 (Node 24.18.0)
- CPU: AMD EPYC; 4 logical CPUs
- Platform: linux 7.1.3, x64
- Repository commit: `f5c84478b18b66f4bdb6eab762a4136bb9a7c889`
- Lockfile SHA-256: `1d7359304abc544cdbe626a8c08f0fe314890f7b0ef7159d8b93077ca38ecccf`
- Timing: 100 ms warmup and 500 ms measurement per task
- Solvers: sudoku-dlx solveString workspace (MIT); sudoku-dlx solveCells workspace (MIT); fast-sudoku-solver 3.0.3 (MIT); @algorithm.ts/sudoku 4.0.4 (MIT); sudoku-dlx compileString + solve workspace (MIT); sudoku-dlx compileCells + solve workspace (MIT)
- Generated: 2026-07-18T16:29:38.020Z

Large native and third-party corpora are opt-in and are not mixed into these in-process JavaScript tables.

## License

[MIT](./LICENSE)
