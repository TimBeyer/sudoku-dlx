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

export async function runBenchmarkGroup(options: BenchmarkOptions): Promise<BenchmarkReport> {
  const group = getGroup(options.group)
  if (!group) throw new Error(`Unknown benchmark group '${options.group}'`)

  if (!options.quiet) {
    console.log(`Running ${group.name}: ${group.description}`)
    console.log('Every adapter is validated against every selected puzzle before timing.\n')
  }

  const sections: BenchmarkSection[] = []
  const skipped: SkippedBenchmark[] = []
  const usedDatasets = new Map<string, DatasetDefinition>()
  const usedSolvers = new Map<string, SolverMetadata>()

  for (const [caseId, solverIds] of Object.entries(group.matrix)) {
    const benchmarkCase = getCase(caseId)
    if (!benchmarkCase) throw new Error(`Group references unknown case '${caseId}'`)

    const dataset = getDataset(benchmarkCase.datasetId)
    if (!dataset) throw new Error(`Case references unknown dataset '${benchmarkCase.datasetId}'`)
    usedDatasets.set(dataset.id, dataset)

    const section = await runCase(benchmarkCase, dataset, solverIds, options, usedSolvers, skipped)
    sections.push(section)
  }

  // Keep the timed return values observably consumed without adding full validation
  // overhead to every benchmark iteration.
  if (resultSink === Number.MIN_SAFE_INTEGER && !options.quiet) console.log(resultSink)

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    group: group.name,
    environment: collectEnvironment(),
    configuration: {
      timeMs: options.timeMs,
      warmupMs: options.warmupMs,
      order: 'deterministic-round-robin',
      validation: 'all-puzzles-before-timing'
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
  solverIds: readonly string[],
  options: BenchmarkOptions,
  usedSolvers: Map<string, SolverMetadata>,
  skipped: SkippedBenchmark[]
): Promise<BenchmarkSection> {
  if (!options.quiet) {
    console.log(
      `${benchmarkCase.name} (${dataset.puzzles.length} puzzle${dataset.puzzles.length === 1 ? '' : 's'})`
    )
  }

  const bench = new Bench({
    throws: true,
    time: options.timeMs,
    warmup: true,
    warmupTime: options.warmupMs,
    iterations: 64,
    warmupIterations: 16
  })
  const taskSolverIds = new Map<string, string>()

  for (const solverId of solverIds) {
    const factory = getSolverFactory(solverId)
    if (!factory) throw new Error(`Group references unknown solver '${solverId}'`)

    const adapter = factory()
    usedSolvers.set(adapter.metadata.id, adapter.metadata)

    const unavailableReason = await availabilityReason(adapter, benchmarkCase)
    if (unavailableReason) {
      skipOrThrow(adapter, benchmarkCase, unavailableReason, options, skipped)
      continue
    }

    try {
      const prepared = dataset.puzzles.map(puzzle => adapter.prepare(puzzle))
      validateAdapter(adapter, benchmarkCase, dataset, prepared)

      let cursor = 0
      const taskName = adapter.metadata.name
      taskSolverIds.set(taskName, adapter.metadata.id)
      bench.add(taskName, () => {
        const index = cursor
        cursor = (cursor + 1) % dataset.puzzles.length
        const result =
          benchmarkCase.semantics === 'end-to-end'
            ? adapter.solveEndToEnd!(dataset.puzzles[index])
            : adapter.solvePrepared!(prepared[index])
        resultSink = (resultSink ^ adapter.consume(result)) | 0
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      skipOrThrow(adapter, benchmarkCase, reason, options, skipped)
    }
  }

  if (bench.tasks.length === 0) {
    throw new Error(`No compatible solvers were available for '${benchmarkCase.id}'`)
  }

  if (!options.quiet) {
    bench.addEventListener('cycle', event => {
      const task = event.task
      if (task.result.state !== 'completed') return
      const throughput = task.result.throughput
      console.log(
        `  ${task.name}: ${throughput.mean.toLocaleString('en-US', { maximumFractionDigits: 2 })} puzzles/sec ±${throughput.rme.toFixed(2)}%`
      )
    })
  }

  await bench.run()

  const incomplete = bench.tasks.filter(task => task.result.state !== 'completed')
  if (incomplete.length > 0) {
    throw new Error(
      `Benchmark tasks did not complete: ${incomplete.map(task => task.name).join(', ')}`
    )
  }

  const results: BenchmarkResult[] = bench.tasks.map(task => {
    if (task.result.state !== 'completed') {
      throw new Error(`Missing completed result for '${task.name}'`)
    }
    const throughput = task.result.throughput
    return {
      solverId: taskSolverIds.get(task.name) ?? task.name,
      name: task.name,
      opsPerSec: throughput.mean,
      margin: throughput.rme,
      runs: throughput.samplesCount,
      unit: 'puzzles/sec'
    }
  })

  if (!options.quiet) console.log()

  return {
    caseId: benchmarkCase.id,
    benchmarkName: benchmarkCase.name,
    datasetId: dataset.id,
    semantics: benchmarkCase.semantics,
    puzzleCount: dataset.puzzles.length,
    results
  }
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

function validateAdapter(
  adapter: SudokuSolverAdapter,
  benchmarkCase: BenchmarkCase,
  dataset: DatasetDefinition,
  prepared: readonly unknown[]
): void {
  for (let index = 0; index < dataset.puzzles.length; index++) {
    const result =
      benchmarkCase.semantics === 'end-to-end'
        ? adapter.solveEndToEnd!(dataset.puzzles[index])
        : adapter.solvePrepared!(prepared[index])
    validateSolution(dataset.puzzles[index], adapter.normalize(result))
  }
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
