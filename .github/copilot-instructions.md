# Repository instructions

## Quality gates

- Use Node.js 22.13 or newer.
- Run `npm run check` and, when Bun is available, `npm run test:bun` before committing.
- Add behavioral tests for every functional change.
- Use Conventional Commits; repository-only changes use `build:` or `ci:`.

## Performance

Sudoku solving performance is a core feature. Preserve the prebuilt numeric `ConstraintRow` cache,
submit filtered rows with one `addRows()` call, and avoid allocations in hot loops. Run
`npm run benchmark` before and after application-logic changes and report material differences.

## Scope

Keep the public library, CLI, tests, documentation, and benchmark adapters consistent. Prefer clean
API changes over compatibility shims unless backward compatibility is explicitly required.
