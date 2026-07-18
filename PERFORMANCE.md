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

The benchmark suite has four explicit reporting lanes:

1. **End-to-end npm packages:** an ordinary independent string-form puzzle enters each library's
   normal solve-once path and one solution is returned. JavaScript and Wasm implementations share
   this lane because their public workload is identical. Parsing, per-call marshalling, and
   puzzle-specific setup are timed.
2. **Prepared npm packages:** callers already hold each library's natural parsed representation.
   Only representation conversion is excluded; puzzle-specific solver topology and search-state
   construction remain timed.
3. **Sudoku-dlx performance modes:** fixed-puzzle compilation is reported as an unranked capability.
   It is never used to claim a win over a library without an equivalent exact-puzzle concept.
4. **Legacy diagnostics:** packages whose public APIs enumerate all solutions or otherwise differ
   from the normal first-solution contract stay unranked.

Direct comparison is based on the real-world outcome and timing boundary, not identical source-code
shape. A solver may use any algorithm, general-purpose precomputation, reusable process state, or
code restructuring that applies to arbitrary incoming puzzles. The following are allowed outside a
directly compared timed region:

- module loading and ordinary runtime initialization;
- immutable, puzzle-independent tables such as the 729 standard Sudoku candidate rows;
- conversion to a library's natural input representation in the prepared tier;
- one-time module and Wasm initialization that applies to arbitrary future puzzles.

The following are not allowed in a direct comparison:

- compiling topology for the exact givens before timing;
- memoizing an exact puzzle's result or recognizing the benchmark corpus;
- reusing a mutated or already-solved input;
- comparing first-solution work with uniqueness checks or all-solution enumeration;
- comparing per-puzzle rates computed from different mixtures of easy and hard inputs.

Each timed sample solves one complete corpus pass. Throughput is total puzzles solved divided by
total elapsed time, so every solver receives the same difficulty mix. Ranked passes use a new,
deterministic digit-isomorphic form of every puzzle and prepared cases receive fresh parsed objects;
the relabelling and permitted representation conversion happen in the harness outside the timed
region. This prevents an exact-result cache or mutated input from benefiting when Tinybench repeats
the workload. Warmup uses a disjoint corpus, and measurement outputs are validated after timing
against the exact transformed givens, rows, columns, and boxes. Direct tables use first-solution
semantics throughout.

The ranked in-process corpus contains 64 independently generated, unique-solution puzzles with
25–40 givens and a spread across four corpus-relative search-cost bands. It does not inflate its
size with transformations of a few fixtures. Eight separately generated puzzles form the warmup
corpus. Both base sets are deterministic, disjoint, and checked by
`npm run benchmark:corpus:verify`; per-pass digit relabelling is only an anti-cache schedule and is
not counted as additional corpus diversity.

Schema-versioned JSON captures the runtime and version, Node version, CPU, architecture, operating
system, repository commit, lockfile SHA-256, timing configuration, dataset, semantics, and solver
metadata. Keep that metadata with any quoted result. Revision comparisons report a direction only
when the two reported confidence intervals do not overlap; overlapping intervals remain neutral
even when the point estimates cross a fixed percentage threshold.

## Hot-path guidelines

- Keep the module-level numeric candidate-row cache internal and immutable by convention.
- Filter the cache into a packed reference array and submit it with one `addRows()` call.
- Avoid intermediate objects, callback-heavy transformations, and binary exact-cover matrices.
- Keep parsing and presentation outside core-only measurements, but include them in end-to-end
  cases.
- Use a solver template only for repeated solves of identical givens. Compiling clones row topology
  so `SolverTemplate` cannot mutate the shared candidate cache.
- Keep compiled replay results in the unranked performance-mode tier. If compilation is evaluated
  for a normal one-shot workload, include compilation in the timed operation.
- Run unit tests and adapter correctness validation before trusting throughput results.

## Reproducible comparisons

```sh
npm run benchmark:corpus:verify
npm run benchmark
npm run benchmark:json -- baseline.json
npm run compare-benchmarks -- baseline.json candidate.json
npm run benchmark:competitive
```

Development builds place the benchmark harness under `built/dev/`; production package output
remains isolated under `built/lib/` and `built/typings/`.

Release benchmark tables are generated on the same Namespace runner profile used by the sibling
[`dancing-links`](https://github.com/TimBeyer/dancing-links) project. GitHub-hosted CPU measurements
are useful as diagnostics but are not published as competitive results. Every competitor is an
exact-pinned npm development dependency installed by the normal `npm ci`; the suite does not clone
or compile standalone third-party solver repositories. Implementation language is report metadata,
not a separate fairness tier: one-time module initialization is outside timing for every package,
while each public solve call and its marshalling remain timed.
