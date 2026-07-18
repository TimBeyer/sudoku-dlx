# Optional Node native addons

This private package isolates historical Node native addons from the published
`sudoku-dlx` dependency graph. Install them with:

```sh
npm ci --prefix benchmark/native
```

Both dependencies are optional because their old `node-gyp` build systems may
not support current Node versions or non-Node runtimes. The `native` benchmark
group records an explicit skip reason when either addon cannot be loaded. A
failure in an internal sudoku-dlx adapter is never converted into a skip.

This directory is unrelated to the opt-in Tdoku/Schoku batch competition; see
`benchmark/competition/README.md` for that separately licensed workflow.
