# Performance

Sudoku solving speed is a primary feature of this project. The standard 9×9 path prebuilds all 729
numeric `ConstraintRow` candidates once. Each solve parses givens into a compact grid, packs
references to the applicable rows, and submits the complete batch through `Solver.addRows()` before
requesting one or all solutions. This avoids rebuilding candidate objects, binary matrices, and
per-row solver calls on the hot path.

## Measurement

Use `npm run benchmark` for regression work. Record the runtime, architecture, benchmark cases,
lockfile, and before-and-after results. Compare runs on the same machine and avoid drawing
conclusions from small changes on variable shared hardware.

The benchmark suite separates:

- public string input, including parsing and solver setup;
- public cell input, including validation and solver setup;
- compiled fixed-puzzle solving with compilation outside the timed operation;
- maintained JavaScript competitors;
- best-effort legacy JavaScript packages and historical Node native addons;
- separately executed, pinned native batch solvers and external corpora.

Preparation outside a timed region is identified as `prepared`; public `end-to-end` cases include
input conversion. Every adapter must return a valid solution before it is measured. Solvers that
mutate inputs receive equivalent fresh input on every iteration, and corpus cases rotate puzzles in
deterministic order.

Schema-versioned JSON captures the runtime and version, Node version, CPU, architecture, operating
system, repository commit, lockfile SHA-256, timing configuration, dataset, semantics, and solver
metadata. Keep that metadata with any quoted result.

## Hot-path guidelines

- Keep the module-level numeric candidate-row cache internal and immutable by convention.
- Filter the cache into a packed reference array and submit it with one `addRows()` call.
- Avoid intermediate objects, callback-heavy transformations, and binary exact-cover matrices.
- Keep parsing and presentation outside core-only measurements, but include them in end-to-end
  cases.
- Use a solver template only for repeated solves of identical givens. Compiling clones row topology
  so `SolverTemplate` cannot mutate the shared candidate cache.
- Run unit tests and adapter correctness validation before trusting throughput results.

## Reproducible comparisons

```sh
npm run benchmark
npm run benchmark:json -- baseline.json
npm run compare-benchmarks -- baseline.json candidate.json
```

Development builds place the benchmark harness under `built/dev/`; production package output
remains isolated under `built/lib/` and `built/typings/`.

Release benchmark tables are generated on the same Namespace runner profile used by the sibling
[`dancing-links`](https://github.com/TimBeyer/dancing-links) project. GitHub-hosted CPU measurements
are useful as diagnostics but are not published as competitive results. Native batch solvers and
third-party corpora remain opt-in and are reported separately because their timing boundaries and
licenses differ from the in-process JavaScript suite.
