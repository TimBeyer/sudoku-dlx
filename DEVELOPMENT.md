# Development

## Requirements

- Node.js 22.13 or newer; Node.js 24 LTS is the default development runtime.
- npm 11 or newer.
- Bun is optional and is exercised by CI as an additional library runtime.

Install the locked dependency graph with:

```sh
npm ci
```

## Repository layout

- `index.ts` is the public library entry point.
- `lib/` contains parsing, display, validation, and exact-cover candidate generation.
- `test/` contains the Mocha/Chai unit suite, loaded directly from TypeScript through `tsx`.
- `benchmark/` contains datasets, solver adapters, and the Tinybench runner.
- `scripts/` contains report comparison, corpus verification, and benchmark-doc generation tools.
- `bin/sudoku-solve` is the published CLI.

Production builds write ESM to `built/lib/` and declarations to `built/typings/`. Development builds
write tests, benchmarks, and scripts beneath `built/dev/`, keeping unpublished tooling separate
from package output.

## Common commands

```sh
npm run build                  # Build the published library and declarations
npm run build:dev              # Build tests, benchmarks, and scripts under built/dev
npm test                       # Run unit tests through Mocha and tsx
npm run test:watch             # Run unit tests in watch mode
npm run test:bun               # Run unit tests on Bun
npm run cover                  # Generate c8 text and LCOV coverage
npm run lint                   # Lint source, tests, scripts, and benchmarks
npm run format                 # Format supported repository files
npm run format:check           # Check formatting without writing
npm run check                  # Format check, lint, unit tests, and production build
npm run benchmark              # Run internal regression benchmarks
npm run benchmark:json -- report.json
npm run benchmark:competitive  # Compare with maintained npm solvers
npm run benchmark:legacy       # Run best-effort historical JavaScript adapters
npm run benchmark:comprehensive
npm run benchmark:corpus:verify
npm run compare-benchmarks -- baseline.json candidate.json
npm run profile                # Capture a V8 CPU profile
npm run pack:check             # Inspect the npm package contents without publishing
npm run check:package          # Smoke-test the ESM export, CLI, and npm packlist
```

Before committing, run `npm run check`. Changes to solver logic also require before-and-after
internal benchmark reports from the same machine.

## Solver changes

The production 9×9 path uses module-level prebuilt numeric `ConstraintRow` candidates. Solves pack
references to the rows allowed by the givens and add the complete set with `addRows()`. Keep public
results caller-owned, do not expose or mutate the shared row cache, and preserve the distinction
between first-solution and all-solutions searches.

Compiled puzzles own a cloned row topology because `SolverTemplate` snapshots rows. Use compilation
only for repeated solves with identical givens; changing givens requires a new compile or a one-shot
solve. Add behavioral tests for invalid, unsatisfiable, ambiguous, repeated, and mutation-prone
inputs when changing this code.

## Benchmark policy

PR benchmarks compare the branch with its merge base on the same Namespace runner across supported
Node.js and Bun runtimes. They run only the internal regression group so dependency or competitor
behavior cannot hide a product regression.

Competitive results are generated on a controlled Namespace runner during release preparation.
Direct rankings cover npm packages that solve ordinary independent puzzles with the same
first-solution outcome and timing boundary, regardless of implementation language. Prepared
comparisons may exclude conversion to a library's natural input representation, but not
puzzle-specific topology or search-state construction. Fixed-puzzle compilation remains an
unranked sudoku-dlx capability. See [PERFORMANCE.md](./PERFORMANCE.md) for the complete allowed-cache
and timing contract.

Every measurement sample processes a complete corpus pass, and throughput is computed from total
puzzles divided by total elapsed time. Ranked passes deterministically relabel puzzle digits and use
fresh prepared objects outside timing so exact-input caches and mutation cannot benefit from the
harness loop. Adapter setup, input conversion, prepared work, runtime classification, dataset
provenance, and supported solve modes must be explicit so comparisons remain reproducible and
honest. JSON reports carry the runtime, hardware, commit, lockfile hash, timing configuration,
dataset semantics, and solver versions needed to reproduce a run.

Legacy packages are optional and may be skipped with an explicit reason. Every third-party solver
is an exact-pinned npm development dependency, so the installed implementation cannot drift away
from the version recorded by its adapter and benchmark report; update the dependency, adapter
metadata, and lockfile together. The benchmark suite does not clone or build standalone third-party
solver repositories.

## Dependency maintenance

Commitlint intentionally remains on the latest 20.x line. `@release-it/conventional-changelog` 11
dynamically uses `conventional-commits-parser` 6 and `conventional-commits-filter` 5, while
Commitlint 21's Git client requires parser 7 and filter 6. Keep the currently explicit 6/5 topology
unless those peer requirements converge; it is verified with `npm ls --all` and `npm audit`.
TypeScript is likewise pinned to the latest 6.0.x release because `@typescript-eslint` 8.64
currently declares support below TypeScript 6.1.

## Commits and releases

Use [Conventional Commits](https://www.conventionalcommits.org/). Use `build:` or `ci:` for changes
that should not publish a library release. Breaking public API or runtime changes use `!` or a
`BREAKING CHANGE` footer.

Releases are automated with `release-it`. The release workflow validates the repository, refreshes
benchmark documentation on controlled hardware, and publishes to npm through trusted OIDC
publishing. It does not use a long-lived npm token.
