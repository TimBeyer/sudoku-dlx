import { createHash } from 'node:crypto'
import { Bench } from 'tinybench'
import { cases, getCase } from './config/cases.js'
import { datasets, getDataset } from './config/datasets.js'
import { getGroup, groups } from './config/groups.js'
import { getSolverFactory } from './config/solvers.js'
import { collectEnvironment } from './environment.js'
import { validateSolution } from './problems/sudoku.js'
import type {
  BenchmarkCase,
  BenchmarkOptions,
  BenchmarkReport,
  BenchmarkResult,
  BenchmarkSection,
  DatasetDefinition,
  SkippedBenchmark,
  SolverMetadata,
  SudokuSolverAdapter
} from './types.js'

let resultSink = 0
const DIGIT_PERMUTATION_COUNT = 362_880
const DIGIT_PERMUTATION_MULTIPLIER = 104_729
const DIGIT_PERMUTATION_OFFSET = 271_828
const PUZZLE_PERMUTATION_STRIDE = 5_003

export async function runBenchmarkGroup(options: BenchmarkOptions): Promise<BenchmarkReport> {
  const group = getGroup(options.group)
  if (!group) throw new Error(`Unknown benchmark group '${options.group}'`)

  if (!options.quiet) {
    console.log(`Running ${group.name}: ${group.description}`)
    console.log(
      'Each timed operation solves one complete corpus pass. Warmup uses disjoint puzzles, and the last measured pass is validated after timing.\n'
    )
  }

  const sections: BenchmarkSection[] = []
  const skipped: SkippedBenchmark[] = []
  const usedDatasets = new Map<string, DatasetDefinition>()
  const usedSolvers = new Map<string, SolverMetadata>()

  const matrixEntries = Object.entries(group.matrix)
  for (let caseIndex = 0; caseIndex < matrixEntries.length; caseIndex++) {
    const [caseId, solverIds] = matrixEntries[caseIndex]
    const benchmarkCase = getCase(caseId)
    if (!benchmarkCase) throw new Error(`Group references unknown case '${caseId}'`)

    const dataset = getDataset(benchmarkCase.datasetId)
    if (!dataset) throw new Error(`Case references unknown dataset '${benchmarkCase.datasetId}'`)
    assertNonEmptyDataset(dataset)

    const warmupDataset = resolveWarmupDataset(benchmarkCase, dataset)
    assertNonEmptyDataset(warmupDataset)
    assertDisjointDatasets(dataset, warmupDataset)

    usedDatasets.set(dataset.id, dataset)
    usedDatasets.set(warmupDataset.id, warmupDataset)

    const section = await runCase(
      benchmarkCase,
      dataset,
      warmupDataset,
      rotate(solverIds, caseIndex),
      options,
      usedSolvers,
      skipped
    )
    sections.push(section)
  }

  // Keep timed return values observably consumed without putting correctness
  // validation inside the measured operation.
  if (resultSink === Number.MIN_SAFE_INTEGER && !options.quiet) console.log(resultSink)

  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    group: group.name,
    environment: collectEnvironment(),
    configuration: {
      timeMs: options.timeMs,
      warmupMs: options.warmupMs,
      order: 'sequential-case-rotated',
      taskIsolation: 'one-solver-per-benchmark-instance',
      timedOperation: 'complete-corpus-pass',
      rate: 'total-puzzles-per-total-elapsed-time',
      warmup: 'explicit-or-derived-disjoint-corpus',
      validation: 'warmup-before-and-last-timed-pass-after',
      rankedInputSchedule: 'fresh-deterministic-digit-isomorph-v1-per-pass'
    },
    datasets: [...usedDatasets.values()].map(datasetMetadata),
    solvers: [...usedSolvers.values()],
    sections,
    skipped
  }
}

async function runCase(
  benchmarkCase: BenchmarkCase,
  dataset: DatasetDefinition,
  warmupDataset: DatasetDefinition,
  solverIds: readonly string[],
  options: BenchmarkOptions,
  usedSolvers: Map<string, SolverMetadata>,
  skipped: SkippedBenchmark[]
): Promise<BenchmarkSection> {
  if (!options.quiet) {
    const comparison = benchmarkCase.comparison === 'ranked' ? 'ranked' : 'unranked'
    console.log(
      `${benchmarkCase.name} (${dataset.puzzles.length} measured, ${warmupDataset.puzzles.length} warmup; ${comparison})`
    )
  }

  const results: BenchmarkResult[] = []
  const executionOrder: string[] = []

  // Each adapter gets its own Tinybench instance. A runtime failure in an optional
  // third-party adapter therefore cannot discard results from the other solvers.
  for (const solverId of solverIds) {
    const factory = getSolverFactory(solverId)
    if (!factory) throw new Error(`Group references unknown solver '${solverId}'`)

    const adapter = factory()
    executionOrder.push(adapter.metadata.id)
    usedSolvers.set(adapter.metadata.id, adapter.metadata)

    try {
      const unavailableReason = await availabilityReason(adapter, benchmarkCase)
      if (unavailableReason) throw new Error(unavailableReason)

      const result = await benchmarkAdapter(adapter, benchmarkCase, dataset, warmupDataset, options)
      results.push(result)

      if (!options.quiet) {
        console.log(
          `  ${result.name}: ${result.opsPerSec.toLocaleString('en-US', { maximumFractionDigits: 2 })} puzzles/sec ±${result.margin.toFixed(2)}%`
        )
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      skipOrThrow(adapter, benchmarkCase, reason, options, skipped)
    }
  }

  if (results.length === 0) {
    throw new Error(`No compatible solvers were available for '${benchmarkCase.id}'`)
  }

  if (!options.quiet) console.log()

  return {
    caseId: benchmarkCase.id,
    benchmarkName: benchmarkCase.name,
    datasetId: dataset.id,
    warmupDatasetId: warmupDataset.id,
    semantics: benchmarkCase.semantics,
    tier: benchmarkCase.tier,
    comparison: benchmarkCase.comparison,
    puzzleCount: dataset.puzzles.length,
    warmupPuzzleCount: warmupDataset.puzzles.length,
    timedOperation: 'complete-corpus-pass',
    inputSchedule:
      benchmarkCase.comparison === 'ranked'
        ? 'fresh-deterministic-digit-isomorph-v1-per-pass'
        : 'fixed-corpus-replay',
    executionOrder,
    results
  }
}

async function benchmarkAdapter(
  adapter: SudokuSolverAdapter,
  benchmarkCase: BenchmarkCase,
  dataset: DatasetDefinition,
  warmupDataset: DatasetDefinition,
  options: BenchmarkOptions
): Promise<BenchmarkResult> {
  const fixedMeasuredPrepared =
    benchmarkCase.comparison === 'ranked'
      ? []
      : prepareDataset(adapter, benchmarkCase, dataset.puzzles)
  const fixedWarmupPrepared = prepareDataset(adapter, benchmarkCase, warmupDataset.puzzles)

  // Correctness checks intentionally use only the disjoint warmup corpus before
  // timing. This avoids priming a solver that memoizes exact puzzle results.
  validateAdapter(adapter, benchmarkCase, warmupDataset.puzzles, fixedWarmupPrepared)

  let measuredResults = new Array<unknown>(dataset.puzzles.length)
  let activePuzzles = warmupDataset.puzzles
  let activePrepared = fixedWarmupPrepared
  let activeResults = new Array<unknown>(warmupDataset.puzzles.length)
  let lastMeasuredPuzzles: readonly string[] = dataset.puzzles
  let warmupPass = 0
  let measuredPass = 0

  const bench = new Bench({
    throws: true,
    time: options.timeMs,
    warmup: true,
    warmupTime: options.warmupMs,
    iterations: 8,
    warmupIterations: 2,
    setup: (_task, mode) => {
      if (benchmarkCase.comparison === 'ranked') return

      const warmingUp = mode === 'warmup'
      activePuzzles = warmingUp ? warmupDataset.puzzles : dataset.puzzles
      activePrepared = warmingUp ? fixedWarmupPrepared : fixedMeasuredPrepared
      activeResults = new Array<unknown>(activePuzzles.length)
      if (!warmingUp) measuredResults = activeResults
    }
  })

  bench.add(
    adapter.metadata.name,
    () => {
      for (let index = 0; index < activePuzzles.length; index++) {
        const result =
          benchmarkCase.semantics === 'end-to-end'
            ? adapter.solveEndToEnd!(activePuzzles[index])
            : adapter.solvePrepared!(activePrepared[index])
        activeResults[index] = result
        resultSink = (resultSink ^ adapter.consume(result)) | 0
      }
    },
    {
      // Tinybench excludes beforeEach hooks from the latency sample. Ranked
      // workloads therefore receive fresh exact inputs (and fresh parsed
      // objects in the prepared tier) without charging any solver for the
      // harness's anti-cache relabelling.
      beforeEach: mode => {
        if (benchmarkCase.comparison !== 'ranked') return

        const warmingUp = mode === 'warmup'
        const basePuzzles = warmingUp ? warmupDataset.puzzles : dataset.puzzles
        const pass = warmingUp ? warmupPass++ : measuredPass++
        activePuzzles = createIsomorphicCorpus(basePuzzles, pass)
        activePrepared = prepareDataset(adapter, benchmarkCase, activePuzzles)
        activeResults = new Array<unknown>(activePuzzles.length)
        if (!warmingUp) {
          lastMeasuredPuzzles = activePuzzles
          measuredResults = activeResults
        }
      }
    }
  )

  await bench.run()

  const task = bench.tasks[0]
  if (!task || task.result.state !== 'completed') {
    const detail = task?.result.state === 'errored' ? `: ${task.result.error.message}` : ''
    throw new Error(`Benchmark task did not complete${detail}`)
  }

  // Validate the actual objects produced by the final measured corpus pass. No
  // additional solver call is made here, so a stateful or stale-result adapter is
  // checked without adding validation cost to the timed region.
  validateCapturedResults(adapter, lastMeasuredPuzzles, measuredResults)

  const runs = task.result.latency.samplesCount
  const elapsedMs = task.result.totalTime
  const totalPuzzles = runs * dataset.puzzles.length
  const opsPerSec = calculateCorpusThroughput(dataset.puzzles.length, runs, elapsedMs)

  return {
    solverId: adapter.metadata.id,
    name: adapter.metadata.name,
    opsPerSec,
    margin: task.result.latency.rme,
    runs,
    totalPuzzles,
    elapsedMs,
    unit: 'puzzles/sec'
  }
}

/**
 * Calculates aggregate corpus throughput without averaging reciprocal per-puzzle
 * latencies. Each run is one complete pass over `puzzleCount` puzzles.
 */
export function calculateCorpusThroughput(
  puzzleCount: number,
  runs: number,
  elapsedMs: number
): number {
  if (!Number.isInteger(puzzleCount) || puzzleCount <= 0) {
    throw new Error('puzzleCount must be a positive integer')
  }
  if (!Number.isInteger(runs) || runs <= 0) {
    throw new Error('runs must be a positive integer')
  }
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    throw new Error('elapsedMs must be positive and finite')
  }
  return (puzzleCount * runs * 1000) / elapsedMs
}

async function availabilityReason(
  adapter: SudokuSolverAdapter,
  benchmarkCase: BenchmarkCase
): Promise<string | undefined> {
  if (!adapter.semantics.includes(benchmarkCase.semantics)) {
    return `does not support ${benchmarkCase.semantics} semantics`
  }

  const initialized = await adapter.initialize?.()
  if (initialized && !initialized.available) {
    return initialized.reason ?? 'package initialization failed'
  }

  const availability = adapter.availability?.()
  return availability && !availability.available
    ? (availability.reason ?? 'package is unavailable')
    : undefined
}

function prepareDataset(
  adapter: SudokuSolverAdapter,
  benchmarkCase: BenchmarkCase,
  puzzles: readonly string[]
): readonly unknown[] {
  return benchmarkCase.semantics === 'prepared'
    ? puzzles.map(puzzle => adapter.prepare(puzzle))
    : []
}

function validateAdapter(
  adapter: SudokuSolverAdapter,
  benchmarkCase: BenchmarkCase,
  puzzles: readonly string[],
  prepared: readonly unknown[]
): void {
  for (let index = 0; index < puzzles.length; index++) {
    const result =
      benchmarkCase.semantics === 'end-to-end'
        ? adapter.solveEndToEnd!(puzzles[index])
        : adapter.solvePrepared!(prepared[index])
    validateSolution(puzzles[index], adapter.normalize(result))
  }
}

function validateCapturedResults(
  adapter: SudokuSolverAdapter,
  puzzles: readonly string[],
  results: readonly unknown[]
): void {
  for (let index = 0; index < puzzles.length; index++) {
    validateSolution(puzzles[index], adapter.normalize(results[index]))
  }
}

/**
 * Returns a digit-isomorphic corpus for one solve-once pass. The representative
 * corpus contains at least eight distinct clue digits per puzzle, so every
 * factoradic permutation yields a different exact input for all supported
 * benchmark durations. Callers must not wrap the schedule: repeating exact
 * strings would make result memoization look like solver throughput.
 */
export function createIsomorphicCorpus(
  puzzles: readonly string[],
  passIndex: number
): readonly string[] {
  if (!Number.isInteger(passIndex) || passIndex < 0 || passIndex >= DIGIT_PERMUTATION_COUNT) {
    throw new Error(
      `ranked benchmark pass must be an integer from 0 to ${DIGIT_PERMUTATION_COUNT - 1}`
    )
  }

  return puzzles.map((puzzle, puzzleIndex) => {
    // The affine map is a bijection because the multiplier is coprime to 9!.
    // Offsetting each puzzle by a separate stride spreads digit orderings over
    // every corpus pass instead of making the entire pass share one ordering.
    const permutationRank =
      ((passIndex + puzzleIndex * PUZZLE_PERMUTATION_STRIDE) * DIGIT_PERMUTATION_MULTIPLIER +
        DIGIT_PERMUTATION_OFFSET) %
      DIGIT_PERMUTATION_COUNT
    const permutation = unrankDigitPermutation(permutationRank)
    return [...puzzle]
      .map(value => (value === '.' ? value : String(permutation[Number(value)])))
      .join('')
  })
}

function unrankDigitPermutation(rank: number): readonly number[] {
  const available = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const permutation = new Array<number>(10).fill(0)
  let remainder = rank

  for (let sourceDigit = 1; sourceDigit <= 9; sourceDigit++) {
    const blockSize = factorial(9 - sourceDigit)
    const selected = Math.floor(remainder / blockSize)
    remainder %= blockSize
    permutation[sourceDigit] = available.splice(selected, 1)[0]
  }
  return permutation
}

function factorial(value: number): number {
  let result = 1
  for (let factor = 2; factor <= value; factor++) result *= factor
  return result
}

function skipOrThrow(
  adapter: SudokuSolverAdapter,
  benchmarkCase: BenchmarkCase,
  reason: string,
  options: BenchmarkOptions,
  skipped: SkippedBenchmark[]
): void {
  if (!adapter.metadata.optional) {
    throw new Error(
      `Required solver '${adapter.metadata.id}' failed for '${benchmarkCase.id}': ${reason}`
    )
  }

  skipped.push({ caseId: benchmarkCase.id, solverId: adapter.metadata.id, reason })
  if (!options.quiet) console.warn(`  Skipping ${adapter.metadata.name}: ${reason}`)
}

function resolveWarmupDataset(
  benchmarkCase: BenchmarkCase,
  measuredDataset: DatasetDefinition
): DatasetDefinition {
  if (!benchmarkCase.warmupDatasetId) return deriveDisjointWarmupDataset(measuredDataset)

  const warmupDataset = getDataset(benchmarkCase.warmupDatasetId)
  if (!warmupDataset) {
    throw new Error(`Case references unknown warmup dataset '${benchmarkCase.warmupDatasetId}'`)
  }
  return warmupDataset
}

function deriveDisjointWarmupDataset(dataset: DatasetDefinition): DatasetDefinition {
  const reserved = new Set(dataset.puzzles)
  const puzzles = dataset.puzzles.map(puzzle => {
    for (const shape of [identity, transpose, rotateHalfTurn]) {
      for (let offset = 1; offset <= 8; offset++) {
        const candidate = mapDigits(shape(puzzle), offset)
        if (!reserved.has(candidate)) {
          reserved.add(candidate)
          return candidate
        }
      }
    }
    throw new Error(`Could not derive a disjoint warmup puzzle for dataset '${dataset.id}'`)
  })

  return {
    id: `${dataset.id}-derived-warmup`,
    name: `${dataset.name} — derived warmup`,
    description: 'Exact-string-disjoint Sudoku-preserving variants used only for warmup.',
    source: `${dataset.source}; deterministic local transformations`,
    license: dataset.license,
    sha256: createHash('sha256').update(puzzles.join('\n')).digest('hex'),
    puzzles
  }
}

function mapDigits(puzzle: string, offset: number): string {
  return [...puzzle]
    .map(value => (value === '.' ? value : String(((Number(value) - 1 + offset) % 9) + 1)))
    .join('')
}

function identity(puzzle: string): string {
  return puzzle
}

function transpose(puzzle: string): string {
  let result = ''
  for (let row = 0; row < 9; row++) {
    for (let column = 0; column < 9; column++) {
      result += puzzle[column * 9 + row]
    }
  }
  return result
}

function rotateHalfTurn(puzzle: string): string {
  return [...puzzle].reverse().join('')
}

function assertNonEmptyDataset(dataset: DatasetDefinition): void {
  if (dataset.puzzles.length === 0) throw new Error(`Dataset '${dataset.id}' is empty`)
}

function assertDisjointDatasets(
  measuredDataset: DatasetDefinition,
  warmupDataset: DatasetDefinition
): void {
  const measured = new Set(measuredDataset.puzzles)
  const overlap = warmupDataset.puzzles.find(puzzle => measured.has(puzzle))
  if (overlap) {
    throw new Error(
      `Measured dataset '${measuredDataset.id}' overlaps warmup dataset '${warmupDataset.id}'`
    )
  }
}

function rotate<T>(values: readonly T[], offset: number): readonly T[] {
  if (values.length < 2) return [...values]
  const normalizedOffset = offset % values.length
  return [...values.slice(normalizedOffset), ...values.slice(0, normalizedOffset)]
}

function datasetMetadata(dataset: DatasetDefinition): Omit<DatasetDefinition, 'puzzles'> {
  return {
    id: dataset.id,
    name: dataset.name,
    description: dataset.description,
    source: dataset.source,
    license: dataset.license,
    sha256: dataset.sha256
  }
}

export function getAvailableGroups(): readonly string[] {
  return Object.keys(groups)
}

export function getAvailableCases(): readonly string[] {
  return Object.keys(cases)
}

export function getAvailableDatasets(): readonly string[] {
  return Object.keys(datasets)
}
