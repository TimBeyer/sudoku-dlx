# Opt-in native Sudoku competition

The in-process Tinybench tables intentionally compare JavaScript public APIs.
This directory describes a separate batch-throughput competition using exact,
pinned upstream sources:

- Tdoku `af426180dc53aef89b82868e7b3fdfcf42165654` (BSD-2-Clause)
- Schoku `fc64877e20df82663ac06911f865c746bc266166` (GPL-3.0-or-later)

No native source, binary, GPL code, or external puzzle corpus is vendored or
included in the npm package. `setup-native-competition` clones into the ignored
`.benchmark-cache` directory, verifies both commits, and builds upstream code in
place. Schoku remains a separate checkout and executable so its GPL license does
not become part of this MIT project.

The optional Tdoku corpus is downloaded from the pinned commit and accepted only
when its SHA-256 is
`9be0601c721ac4e702e3fe097576f025fcb99b216aabfe9dbea37cac43e6bc4f`.
Individual corpus provenance and terms remain those documented by Tdoku; the
setup script fetches rather than redistributes them.

Typical source execution after the TypeScript development build:

```sh
node built/dev/scripts/setup-native-competition.js --data
node built/dev/scripts/run-native-competition.js \
  --dataset=.benchmark-cache/sudoku-native/tdoku/data/puzzles2_17_clue \
  --solver=both
```

Schoku requires Linux/x86-64, OpenMP, AVX2, BMI/BMI2, and LZCNT. The runner pins
Schoku to one thread and uses first-solution semantics. Tdoku uses a fixed seed,
validation, randomized corpus order, and first-solution mode. Their output is
kept separate because the two upstream CLIs do not share identical timing
boundaries.
