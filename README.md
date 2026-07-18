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

The benchmark harness reports honest corpus throughput: every timed sample solves one complete pass
over the same 64 independently generated puzzle structures, and puzzles per second is calculated
from total work divided by total elapsed time. Each ranked pass uses fresh exact strings and fresh
prepared objects outside timing, so an exact-result cache or input mutation cannot benefit from the
harness loop. Warmup puzzles are disjoint from measured puzzles, and measured solutions are
validated after timing.

Direct rankings distinguish end-to-end calls, where public input conversion and puzzle-specific
setup are timed, from prepared calls, where only conversion to each library's natural input shape is
excluded. Sudoku-dlx's exact-puzzle compilation mode is shown separately as an unranked capability;
it is useful when identical givens are solved repeatedly, but it is not contrasted with ordinary
one-shot solver APIs.

```sh
npm run benchmark                 # sudoku-dlx regression paths
npm run benchmark:competitive     # maintained npm solvers
npm run benchmark:comprehensive   # ranked maintained, capability, and legacy sections
npm run benchmark:corpus:verify   # reproduce and verify both checked-in corpora
npm run benchmark:json -- run.json
```

Historical pure-JavaScript packages are a best-effort `legacy` group:

```sh
npm run benchmark:legacy
```

Every competitor is an exact-pinned npm development dependency installed by the normal `npm ci`.
Packages compete through the same public solve-once contract whether their implementation is
JavaScript or WebAssembly. The benchmark suite does not clone third-party repositories or maintain
C, C++, or Rust runner programs.

For comparisons that mean anything, use the same machine, runtime, lockfile, warmup, measurement
duration, and dataset. Schema-versioned JSON includes runtime, CPU, platform, commit, lockfile hash,
timing configuration, dataset semantics, and solver versions. `npm run compare-benchmarks` compares
two such reports and keeps the assessment neutral when their reported confidence intervals overlap.
The published competitive table runs on a controlled runner profile; ordinary GitHub-hosted CPU
measurements are not presented as release performance.

## Benchmarks

Ranked tables compare the same ordinary first-solution workload regardless of whether an npm package is implemented in JavaScript or WebAssembly. Module loading and one-time runtime initialization happen before timing; per-call marshalling, public input conversion, puzzle-specific setup, and solving remain timed. Each timed sample processes one complete corpus pass, and throughput is total puzzles divided by total elapsed time. Prepared cases exclude only conversion to each library's natural input representation. Ranked passes receive fresh deterministic digit-isomorphic strings and fresh prepared objects outside timing, preventing exact-result caches or input mutation from benefiting from harness repetition. Warmup uses a disjoint corpus, and measured outputs are validated after timing.

### Representative corpus — string to first solution

Dataset: `representative-64` (64 puzzles per pass); warmup: `representative-warmup-8` (8 puzzles); tier: `end-to-end`; input schedule: `fresh-deterministic-digit-isomorph-v1-per-pass`.

Direct comparison: every solver receives the same independent puzzles and performs the same first-solution work.

| Solver                     | Puzzles/sec |          Relative |  Margin |
| -------------------------- | ----------: | ----------------: | ------: |
| sudoku-dlx solveString     |   65,680.69 | **1.00× fastest** |  ±0.19% |
| sudoku-dlx solveCells      |    63,841.4 |             0.97× |  ±0.22% |
| SudokuBlitz                |   60,953.29 |             0.93× |  ±0.31% |
| @reetesh/sudoku-engine     |   29,635.17 |             0.45× |  ±0.42% |
| @algorithm.ts/sudoku       |   15,856.21 |             0.24× |  ±0.11% |
| fast-sudoku-solver         |    8,108.48 |             0.12× |  ±1.42% |
| openzeloku                 |    3,541.36 |             0.05× |  ±1.96% |
| sudoku-pro                 |    2,726.37 |             0.04× |  ±4.84% |
| @pyroth/sodo (WebAssembly) |    1,372.96 |             0.02× |  ±1.23% |
| @hackettyam/sudoku-tools   |       98.35 |            <0.01× | ±12.38% |

### Representative corpus — parsed input to first solution

Dataset: `representative-64` (64 puzzles per pass); warmup: `representative-warmup-8` (8 puzzles); tier: `prepared-input`; input schedule: `fresh-deterministic-digit-isomorph-v1-per-pass`.

Direct comparison: every solver receives the same independent puzzles and performs the same first-solution work.

| Solver                   | Puzzles/sec |          Relative |  Margin |
| ------------------------ | ----------: | ----------------: | ------: |
| sudoku-dlx solveCells    |   60,603.25 | **1.00× fastest** |  ±0.13% |
| @reetesh/sudoku-engine   |   33,988.25 |             0.56× |  ±0.40% |
| @algorithm.ts/sudoku     |    16,231.5 |             0.27× |  ±0.10% |
| fast-sudoku-solver       |    7,198.92 |             0.12× |  ±1.33% |
| openzeloku               |    3,587.63 |             0.06× |  ±1.97% |
| sudoku-pro               |    2,736.56 |             0.05× |  ±4.89% |
| @hackettyam/sudoku-tools |       98.73 |            <0.01× | ±12.21% |

### Compiled fixed-puzzle replay — sudoku-dlx capability

Dataset: `representative-64` (64 puzzles per pass); warmup: `representative-warmup-8` (8 puzzles); tier: `compiled-replay`; input schedule: `fixed-corpus-replay`.

Capability only: exact-puzzle compilation happened before timing. These absolute rates describe repeated solving of already-compiled givens and are intentionally not contrasted with ordinary one-shot solver APIs.

| Mode                             | Puzzles/sec | Margin |
| -------------------------------- | ----------: | -----: |
| sudoku-dlx compiled-string solve |  112,995.04 | ±0.61% |
| sudoku-dlx compiled-cells solve  |   113,906.7 | ±0.13% |

### Reproduction metadata

- Runtime: node v25.7.0 (Node 25.7.0)
- CPU: Apple M4; 10 logical CPUs
- Platform: darwin 25.3.0, arm64
- Repository state: `db2b03ffd1a05dbe91a8185c88c634e85e91d90e` with uncommitted benchmark changes
- Lockfile SHA-256: `5e57fe42385e96d7e35f974be3c13e76d885adbe753036df997030e1331978c5`
- Tinybench minima: 250 ms warmup and 2000 ms measurement per task; iteration minima may run longer
- Measurement: complete-corpus-pass; rate: total-puzzles-per-total-elapsed-time
- Ranked input schedule: fresh-deterministic-digit-isomorph-v1-per-pass
- Validation: warmup-before-and-last-timed-pass-after
- Solvers: sudoku-dlx solveString workspace (MIT, javascript); sudoku-dlx solveCells workspace (MIT, javascript); fast-sudoku-solver 3.0.3 (MIT, javascript); @algorithm.ts/sudoku 4.0.4 (MIT, javascript); SudokuBlitz 1.0.0 (MIT, javascript); @reetesh/sudoku-engine 2.1.0 (MIT, javascript); openzeloku 0.1.0 (MIT, javascript); sudoku-pro 1.0.15 (MIT, javascript); @hackettyam/sudoku-tools 1.1.0 (MIT, javascript); @pyroth/sodo (WebAssembly) 0.2.1 (MIT, wasm); sudoku-dlx compiled-string solve workspace (MIT, javascript); sudoku-dlx compiled-cells solve workspace (MIT, javascript)
- Generated: 2026-07-18T20:42:20.283Z

Compiled replay is an unranked sudoku-dlx capability for repeatedly solving identical givens. Legacy all-solution APIs remain in their own best-effort group.

## License

[MIT](./LICENSE)
