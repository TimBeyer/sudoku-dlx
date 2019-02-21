# sudoku-dlx [![codecov](https://codecov.io/gh/TimBeyer/sudoku-dlx/branch/master/graph/badge.svg)](https://codecov.io/gh/TimBeyer/sudoku-dlx)

## About

This module uses [dancing-links](https://github.com/TimBeyer/node-dlx) to efficiently solve Sudoku puzzles.  
It is [one of the fastest](#benchmarks) sudoku solver implementations in plain JS.

## Usage

### As a library
```ts
import { solveString, printBoard } from 'sudoku-dlx'

const result = solveString('.....12..1..7...45...43.7...9...63...5.8.7.2...62...9...3.19...97...4..6..25.....')

// If multiple solutions exist, you can pass `true` as the second parameter to `solveString`
// The return value will always be an array of solutions, even if only one was found
console.log(printBoard(result[0]))

// ╭───┬───┬───╮
// │745│981│263│
// │138│762│945│
// │629│435│718│
// ├───┼───┼───┤
// │297│156│384│
// │354│897│621│
// │816│243│597│
// ├───┼───┼───┤
// │583│619│472│
// │971│324│856│
// │462│578│139│
// ╰───┴───┴───╯

```

### As an executable

#### Using npx
```shell
$ npx -p sudoku-dlx sudoku-solve .....12..1..7...45...43.7...9...63...5.8.7.2...62...9...3.19...97...4..6..25.....
npx: installed 2 in 0.903s
╭───┬───┬───╮
│745│981│263│
│138│762│945│
│629│435│718│
├───┼───┼───┤
│297│156│384│
│354│897│621│
│816│243│597│
├───┼───┼───┤
│583│619│472│
│971│324│856│
│462│578│139│
╰───┴───┴───╯
```

#### Global install
```shell
$ npm install -g sudoku-dlx
$ sudoku-solve ..............3.85..1.2.......5.7.....4...1...9.......5......73..2.1........4...9

╭───┬───┬───╮
│987│654│321│
│246│173│985│
│351│928│746│
├───┼───┼───┤
│128│537│694│
│634│892│157│
│795│461│832│
├───┼───┼───┤
│519│286│473│
│472│319│568│
│863│745│219│
╰───┴───┴───╯
```

## Benchmarks

The benchmarks were done against several sudoku solvers that I discovered on npm.
You can run them with `npm run benchmark`.
The benchmarks may take a while to run.  
In order to see the results as they come in, use `SHOW_PROGRESS=1 npm run benchmark`.

```
Benchmark: A solution to the sudoku (simple)

╭───┬───┬───╮
│...│..1│2..│
│1..│7..│.45│
│...│43.│7..│
├───┼───┼───┤
│.9.│..6│3..│
│.5.│8.7│.2.│
│..6│2..│.9.│
├───┼───┼───┤
│..3│.19│...│
│97.│..4│..6│
│..2│5..│...│
╰───┴───┴───╯


klsudoku from string (C++) x 30,969 ops/sec ±1.11% (92 runs sampled)
sudoku-dlx from cells (JS) x 5,250 ops/sec ±1.33% (90 runs sampled)
sudoku-dlx from string (JS) x 5,038 ops/sec ±4.03% (90 runs sampled)
sudoku-c from array (C) x 3,033 ops/sec ±0.90% (89 runs sampled)
@mattflow/sudoku-solver from string (JS) x 1,712 ops/sec ±0.79% (92 runs sampled)
sudoku_solver from string (JS) x 1,634 ops/sec ±1.01% (91 runs sampled)
sudoku-solver-js from string (JS) x 1,079 ops/sec ±1.36% (89 runs sampled)
dancing-links-algorithm from string (JS) x 427 ops/sec ±0.63% (89 runs sampled)

Fastest is klsudoku from string (C++)


Benchmark: A solution to the sudoku (hard)

╭───┬───┬───╮
│...│...│...│
│...│..3│.85│
│..1│.2.│...│
├───┼───┼───┤
│...│5.7│...│
│..4│...│1..│
│.9.│...│...│
├───┼───┼───┤
│5..│...│.73│
│..2│.1.│...│
│...│.4.│..9│
╰───┴───┴───╯


klsudoku from string (C++) x 27,486 ops/sec ±0.96% (89 runs sampled)
sudoku-dlx from cells (JS) x 4,930 ops/sec ±0.60% (91 runs sampled)
sudoku-dlx from string (JS) x 4,612 ops/sec ±2.67% (87 runs sampled)
dancing-links-algorithm from string (JS) x 388 ops/sec ±1.40% (86 runs sampled)
sudoku_solver from string (JS) x 0.81 ops/sec ±1.72% (7 runs sampled)
sudoku-c from array (C) x 0.12 ops/sec ±1.18% (5 runs sampled)
@mattflow/sudoku-solver from string (JS) x 0.07 ops/sec ±1.01% (5 runs sampled)
sudoku-solver-js from string (JS) x 0.05 ops/sec ±0.52% (5 runs sampled)

Fastest is klsudoku from string (C++)
```
