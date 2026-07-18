# Opt-in native Sudoku competition

The native competition is a separate, opt-in full-process corpus benchmark. It
does not mix upstream internal timers, language-runtime microbenchmarks, or
puzzle-specific compilation with the in-process JavaScript tables.

The pinned external implementations are:

- autoresearch-sudoku `6572d08a00a1fb6938b0cc493d22772f8f903fed`
  (MIT)
- Tdoku `af426180dc53aef89b82868e7b3fdfcf42165654` (BSD-2-Clause)
- Schoku `fc64877e20df82663ac06911f865c746bc266166`
  (GPL-3.0-or-later)

Sudoku-dlx from the current worktree is always available as a participant. The
setup script clones external sources into the ignored `.benchmark-cache`
directory, disables checkout hooks, verifies each origin and full commit, and
refuses modified tracked source. The small batch adapters live in this MIT
repository; external source and linked binaries remain in the cache. In
particular, Schoku stays an external checkout and executable, so GPL code is not
vendored, linked into the npm package, or redistributed with this project.

After every external binary passes the common smoke test, setup writes a
deterministic receipt under `.benchmark-cache/sudoku-native/receipts/`. Each
receipt records the source id, full commit and origin; the repository-relative
adapter and its SHA-256; every compiler/build-tool path and version; the exact
normalized build commands, flags, environment and profile; and the binary's
cache-relative path and SHA-256. Receipts contain no timestamp or temporary build
path. `--checkout-only` deliberately produces no receipt because it does not
build or validate a binary.

The competition runner refuses an external entrant before warmup or timing if
its receipt is missing, malformed, refers to a different manifest pin or build
declaration, or no longer matches the current adapter or cached binary. Run full
setup again after changing an adapter, build flags, source pin, compiler, or
binary. This prevents a stale cache artifact from being reported as the declared
source revision; it is local provenance, not a substitute for a signed upstream
release or reproducible-build attestation.

## Direct-comparison boundary

Every ranked sample has exactly the same observable contract:

1. One fresh process receives the same canonical corpus file in source order.
2. One solver thread finds the first solution to every puzzle exactly once.
3. The process writes one complete 81-digit solution line per input puzzle.
4. Wall time includes process startup, corpus reading, solving, and solution
   writing.
5. After the timer stops, the harness validates every solution against its
   givens and all row, column, and box rules.

There is never one process per puzzle. Warmup and measured passes use fresh
processes, and solver order rotates between rounds. Ranked throughput is total
puzzles across every measured pass divided by total full-process elapsed time;
per-pass timings and the median latency remain in JSON for noise diagnosis.
Exact duplicate canonical puzzles are rejected so an implementation cannot gain
from memoizing a repeated input inside the batch.

This is deliberately an end-to-end batch result. It is useful for the normal
case of solving a real collection of distinct puzzles. It is not presented as
pure solver-core latency, and upstream internal timers are neither copied nor
ranked because their setup, I/O, validation, repetition, and warmup boundaries
are different.

## Setup and execution

After installing this repository's development dependencies:

```sh
npm run benchmark:competition:setup -- --data --skip-schoku
npm run benchmark:competition -- \
  --solver=sudoku-dlx,autoresearch-sudoku,tdoku \
  --dataset=.benchmark-cache/sudoku-native/tdoku/data/puzzles2_17_clue \
  --runs=5
```

The autoresearch-sudoku adapter requires `rustc`. Tdoku requires CMake, a C++
compiler, and a CPU supported by its native SIMD implementation. Schoku
additionally requires Linux/x86-64, GCC/OpenMP, AVX2, BMI/BMI2, and LZCNT; omit
`--skip-schoku` during setup and select `--solver=all` only on a compatible
machine.

The setup uses each implementation's normal optimized native profile: Tdoku's
static target at `-O3 -march=native`, autoresearch-sudoku at Rust optimization
level 3 with fat LTO, one codegen unit, and `target-cpu=native`, and Schoku's
documented `-O3` AVX2/BMI/LZCNT library build. The JSON report records these
profiles next to each result; it also embeds every verified receipt and links
each external result to its receipt SHA-256. Sudoku-dlx records the current
development build and Node runtime.

For a quick wiring and correctness check:

```sh
npm run benchmark:competition -- \
  --smoke \
  --solver=sudoku-dlx,autoresearch-sudoku,tdoku \
  --warmup-runs=0 \
  --runs=1
```

Smoke rates are explicitly labelled as non-performance results. `--size=N` uses
the same first `N` canonical puzzles for every solver. `--json` includes every
sample, environment metadata, source pins, the canonical corpus SHA-256, timing
boundary, validation contract, and verified external-build provenance.

## Corpus provenance

The optional Tdoku data archive is downloaded from the pinned Tdoku commit and
accepted only when its SHA-256 is
`9be0601c721ac4e702e3fe097576f025fcb99b216aabfe9dbea37cac43e6bc4f`.
It is fetched rather than redistributed. Individual dataset provenance and
terms remain those documented by Tdoku.
