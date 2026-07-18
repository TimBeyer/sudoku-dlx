#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { arch, cpus, platform, release } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import {
  AUTORESEARCH_SUDOKU,
  NATIVE_COMPETITION_PINS,
  type NativeSourcePin
} from '../benchmark/competition/manifest.js'
import { EASY_PUZZLE } from '../benchmark/datasets/smoke.js'
import {
  getNativeBuildSpecification,
  verifyNativeBuildReceipt,
  type VerifiedNativeBuildReceipt
} from './native-competition/build-receipt.js'
import {
  stageCanonicalCorpus,
  validateSolutionFile,
  type CanonicalCorpus
} from './native-competition/corpus.js'

const execFileAsync = promisify(execFile)
const SOLVER_IDS = ['sudoku-dlx', 'autoresearch-sudoku', 'tdoku', 'schoku'] as const
type NativeSolverId = (typeof SOLVER_IDS)[number]

interface RunOptions {
  readonly cacheDirectory: string
  readonly dataset: string
  readonly solvers: readonly NativeSolverId[]
  readonly warmupRuns: number
  readonly measuredRuns: number
  readonly sampleSize?: number
  readonly smoke: boolean
  readonly json: boolean
}

interface SolverCommand {
  readonly id: NativeSolverId
  readonly label: string
  readonly buildProfile: string
  readonly command: string
  readonly prefixArgs: readonly string[]
  readonly sourcePin?: NativeSourcePin
  readonly buildReceipt?: VerifiedNativeBuildReceipt
}

interface NativeRunSample {
  readonly round: number
  readonly elapsedMs: number
  readonly puzzlesPerSecond: number
  readonly solutionsValidated: number
}

interface NativeRunResult {
  readonly solver: NativeSolverId
  readonly label: string
  readonly buildProfile: string
  readonly command: readonly string[]
  readonly buildReceiptSha256?: string
  readonly samples: readonly NativeRunSample[]
  readonly totalPuzzles: number
  readonly totalElapsedMs: number
  readonly puzzlesPerSecond: number
  readonly medianElapsedMs: number
  readonly minimumPuzzlesPerSecond: number
  readonly maximumPuzzlesPerSecond: number
}

interface CompletedCorpusPass {
  readonly solver: SolverCommand
  readonly outputPath: string
  readonly sample: NativeRunSample
}

interface NativeRunReport {
  readonly schemaVersion: 2
  readonly generatedAt: string
  readonly mode: 'native-full-process-corpus-pass'
  readonly smoke: boolean
  readonly boundary: {
    readonly directlyComparable: true
    readonly semantics: 'first-solution'
    readonly solverThreads: 1
    readonly processModel: 'one-fresh-process-per-corpus-pass'
    readonly corpusOrder: 'identical-source-order'
    readonly timed: readonly ['process-startup', 'corpus-read', 'solve', 'solution-write']
    readonly outsideTiming: readonly [
      'source-build',
      'corpus-canonicalization',
      'solution-validation'
    ]
    readonly validation: 'every-output-solution-against-givens-and-sudoku-rules'
    readonly rankingStatistic: 'total-puzzles-per-total-elapsed-time'
  }
  readonly corpus: {
    readonly source: string
    readonly canonicalPath: string
    readonly canonicalSha256: string
    readonly puzzles: number
    readonly skippedSourceLines: number
    readonly sampleLimit?: number
  }
  readonly warmupRunsPerSolver: number
  readonly measuredRunsPerSolver: number
  readonly environment: {
    readonly os: string
    readonly architecture: string
    readonly cpu: string
    readonly logicalCpus: number
    readonly node: string
  }
  readonly sourcePins: readonly { id: string; commit: string; license: string }[]
  readonly verifiedBuildReceipts: readonly VerifiedNativeBuildReceipt[]
  readonly sudokuDlxSource: {
    readonly commit: string
    readonly dirty: boolean
  }
  readonly results: readonly NativeRunResult[]
}

export async function runNativeCompetition(options: RunOptions): Promise<NativeRunReport> {
  if (!options.smoke && !existsSync(options.dataset)) {
    throw new Error(`Dataset not found: ${options.dataset}`)
  }

  const runDirectory = resolve(
    options.cacheDirectory,
    'results',
    new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
  )
  await mkdir(runDirectory, { recursive: true })

  const sourcePath = options.smoke ? await writeSmokeCorpus(runDirectory) : resolve(options.dataset)
  const corpus = await stageCanonicalCorpus(
    sourcePath,
    resolve(runDirectory, 'canonical-corpus.txt'),
    options.smoke ? undefined : options.sampleSize
  )
  const commands = await Promise.all(
    options.solvers.map(solver => resolveSolverCommand(solver, options.cacheDirectory))
  )
  const measuredSamples = new Map<NativeSolverId, NativeRunSample[]>(
    commands.map(command => [command.id, []])
  )

  for (let round = 0; round < options.warmupRuns; round++) {
    const completed: CompletedCorpusPass[] = []
    for (const command of rotated(commands, round)) {
      completed.push(await executeCorpusPass(command, corpus, runDirectory, 'warmup', round))
    }
    await validateCompletedPasses(completed, corpus)
  }

  for (let round = 0; round < options.measuredRuns; round++) {
    const orderOffset = options.warmupRuns + round
    const completed: CompletedCorpusPass[] = []
    for (const command of rotated(commands, orderOffset)) {
      completed.push(await executeCorpusPass(command, corpus, runDirectory, 'measured', round))
    }
    await validateCompletedPasses(completed, corpus)
    for (const pass of completed) {
      measuredSamples.get(pass.solver.id)?.push(pass.sample)
    }
  }

  const results = commands.map(command =>
    summarize(command, measuredSamples.get(command.id) ?? [], corpus.puzzles.length)
  )
  const selectedPins = new Set(
    commands.flatMap(command => (command.sourcePin ? [command.sourcePin.id] : []))
  )
  const sudokuDlxSource = await inspectCurrentWorktree()

  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    mode: 'native-full-process-corpus-pass',
    smoke: options.smoke,
    boundary: {
      directlyComparable: true,
      semantics: 'first-solution',
      solverThreads: 1,
      processModel: 'one-fresh-process-per-corpus-pass',
      corpusOrder: 'identical-source-order',
      timed: ['process-startup', 'corpus-read', 'solve', 'solution-write'],
      outsideTiming: ['source-build', 'corpus-canonicalization', 'solution-validation'],
      validation: 'every-output-solution-against-givens-and-sudoku-rules',
      rankingStatistic: 'total-puzzles-per-total-elapsed-time'
    },
    corpus: {
      source: sourcePath,
      canonicalPath: corpus.path,
      canonicalSha256: corpus.sha256,
      puzzles: corpus.puzzles.length,
      skippedSourceLines: corpus.skippedLines,
      ...(options.sampleSize === undefined || options.smoke
        ? {}
        : { sampleLimit: options.sampleSize })
    },
    warmupRunsPerSolver: options.warmupRuns,
    measuredRunsPerSolver: options.measuredRuns,
    environment: {
      os: `${platform()} ${release()}`,
      architecture: arch(),
      cpu: cpus()[0]?.model ?? 'unknown',
      logicalCpus: cpus().length,
      node: process.version
    },
    sourcePins: NATIVE_COMPETITION_PINS.filter(source => selectedPins.has(source.id)).map(
      source => ({ id: source.id, commit: source.commit, license: source.license })
    ),
    verifiedBuildReceipts: commands.flatMap(command =>
      command.buildReceipt ? [command.buildReceipt] : []
    ),
    sudokuDlxSource,
    results
  }
}

async function inspectCurrentWorktree(): Promise<{ commit: string; dirty: boolean }> {
  try {
    const projectRoot = resolveProjectRoot()
    const [{ stdout: commit }, { stdout: status }] = await Promise.all([
      execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }),
      execFileAsync('git', ['status', '--porcelain=v1'], { cwd: projectRoot, encoding: 'utf8' })
    ])
    return { commit: commit.trim(), dirty: status.trim().length > 0 }
  } catch {
    return { commit: 'unavailable', dirty: true }
  }
}

async function writeSmokeCorpus(runDirectory: string): Promise<string> {
  const path = resolve(runDirectory, 'smoke-source.txt')
  await writeFile(path, `${EASY_PUZZLE}\n`)
  return path
}

async function resolveSolverCommand(
  id: NativeSolverId,
  cacheDirectory: string
): Promise<SolverCommand> {
  switch (id) {
    case 'sudoku-dlx': {
      const runner = resolve(
        dirname(fileURLToPath(import.meta.url)),
        'native-competition/sudoku-dlx-runner.js'
      )
      if (!existsSync(runner)) throw new Error(`Built sudoku-dlx batch runner not found: ${runner}`)
      return {
        id,
        label: 'sudoku-dlx (current worktree)',
        buildProfile: 'project development build on the reported Node.js runtime',
        command: process.execPath,
        prefixArgs: [runner]
      }
    }
    case 'autoresearch-sudoku':
      return checkedExternalCommand(id, 'autoresearch-sudoku', cacheDirectory, AUTORESEARCH_SUDOKU)
    case 'tdoku':
      return checkedExternalCommand(id, 'Tdoku', cacheDirectory, pinFor(id))
    case 'schoku':
      if (platform() !== 'linux' || arch() !== 'x64') {
        throw new Error('Schoku requires Linux/x86-64; omit it from --solver on this platform')
      }
      return checkedExternalCommand(
        id,
        'Schoku (single-threaded library API)',
        cacheDirectory,
        pinFor(id)
      )
  }
}

async function checkedExternalCommand(
  id: NativeSolverId,
  label: string,
  cacheDirectory: string,
  sourcePin: NativeSourcePin
): Promise<SolverCommand> {
  const specification = getNativeBuildSpecification(id)
  const binary = resolve(cacheDirectory, 'bin', specification.binaryName)
  if (!existsSync(binary)) {
    throw new Error(`${label} common-boundary binary not found: ${binary}; run setup first`)
  }
  const buildReceipt = await verifyNativeBuildReceipt({
    cacheDirectory,
    projectRoot: resolveProjectRoot(),
    sourcePin
  })
  return {
    id,
    label,
    buildProfile: specification.profile,
    command: binary,
    prefixArgs: [],
    sourcePin,
    buildReceipt
  }
}

function pinFor(id: NativeSolverId): NativeSourcePin {
  const pin = NATIVE_COMPETITION_PINS.find(source => source.id === id)
  if (!pin) throw new Error(`No source pin declared for ${id}`)
  return pin
}

async function executeCorpusPass(
  solver: SolverCommand,
  corpus: CanonicalCorpus,
  runDirectory: string,
  phase: 'warmup' | 'measured',
  round: number
): Promise<CompletedCorpusPass> {
  const outputPath = resolve(runDirectory, `${phase}-${round + 1}-${solver.id}-solutions.txt`)
  const args = [...solver.prefixArgs, corpus.path, outputPath]
  const started = performance.now()
  try {
    await execFileAsync(solver.command, args, {
      encoding: 'utf8',
      env: {
        ...process.env,
        OMP_NUM_THREADS: '1',
        RAYON_NUM_THREADS: '1',
        UV_THREADPOOL_SIZE: '1'
      },
      maxBuffer: 64 * 1024 * 1024
    })
  } catch (error) {
    throw new Error(
      `${solver.label} failed during ${phase} round ${round + 1}${commandErrorDetails(error)}`,
      {
        cause: error
      }
    )
  }
  const elapsedMs = performance.now() - started

  return {
    solver,
    outputPath,
    sample: {
      round: round + 1,
      elapsedMs,
      puzzlesPerSecond: (corpus.puzzles.length * 1000) / elapsedMs,
      solutionsValidated: corpus.puzzles.length
    }
  }
}

async function validateCompletedPasses(
  passes: readonly CompletedCorpusPass[],
  corpus: CanonicalCorpus
): Promise<void> {
  for (const pass of passes) {
    await validateSolutionFile(pass.solver.label, pass.outputPath, corpus.puzzles)
  }
}

function rotated<T>(values: readonly T[], offset: number): readonly T[] {
  if (values.length < 2) return values
  const start = offset % values.length
  return [...values.slice(start), ...values.slice(0, start)]
}

function summarize(
  solver: SolverCommand,
  samples: readonly NativeRunSample[],
  puzzleCount: number
): NativeRunResult {
  if (samples.length === 0) throw new Error(`${solver.label} has no measured samples`)
  const elapsed = samples.map(sample => sample.elapsedMs)
  const rates = samples.map(sample => sample.puzzlesPerSecond)
  const totalPuzzles = puzzleCount * samples.length
  const totalElapsedMs = elapsed.reduce((total, value) => total + value, 0)
  const medianElapsedMs = median(elapsed)
  return {
    solver: solver.id,
    label: solver.label,
    buildProfile: solver.buildProfile,
    command: [solver.command, ...solver.prefixArgs, '<canonical-corpus>', '<solutions>'],
    ...(solver.buildReceipt ? { buildReceiptSha256: solver.buildReceipt.sha256 } : {}),
    samples,
    totalPuzzles,
    totalElapsedMs,
    puzzlesPerSecond: (totalPuzzles * 1000) / totalElapsedMs,
    medianElapsedMs,
    minimumPuzzlesPerSecond: Math.min(...rates),
    maximumPuzzlesPerSecond: Math.max(...rates)
  }
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

function commandErrorDetails(error: unknown): string {
  if (!error || typeof error !== 'object') return `: ${String(error)}`
  const candidate = error as { message?: string; stdout?: string; stderr?: string }
  return [candidate.message, candidate.stdout, candidate.stderr]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map(value => `\n${value.trim()}`)
    .join('')
}

function parseOptions(args = process.argv.slice(2)): RunOptions & { help: boolean } {
  const projectRoot = resolveProjectRoot()
  const cacheArgument = argumentValue(args, '--cache=')
  const cacheDirectory = resolve(projectRoot, cacheArgument ?? '.benchmark-cache/sudoku-native')
  const datasetArgument = argumentValue(args, '--dataset=')
  const smoke = args.includes('--smoke')

  if (
    argumentValue(args, '--time=') !== undefined ||
    argumentValue(args, '--warmup=') !== undefined
  ) {
    throw new Error(
      'Use corpus-pass counts --runs and --warmup-runs; internal timer durations are not comparable'
    )
  }

  return {
    cacheDirectory,
    dataset: resolve(
      projectRoot,
      datasetArgument ?? resolve(cacheDirectory, 'tdoku/data/puzzles2_17_clue')
    ),
    solvers: parseSolvers(argumentValue(args, '--solver=')),
    warmupRuns: nonNegativeInteger(argumentValue(args, '--warmup-runs='), 1, '--warmup-runs'),
    measuredRuns: positiveInteger(argumentValue(args, '--runs='), 5, '--runs'),
    sampleSize: optionalPositiveInteger(argumentValue(args, '--size='), '--size'),
    smoke,
    json: args.includes('--json'),
    help: args.includes('--help') || args.includes('-h')
  }
}

function parseSolvers(value: string | undefined): readonly NativeSolverId[] {
  if (value === undefined) return ['sudoku-dlx', 'autoresearch-sudoku', 'tdoku']
  if (value === 'all') return SOLVER_IDS

  const requested = [...new Set(value.split(',').filter(Boolean))]
  if (requested.length === 0) throw new Error('--solver requires at least one solver')
  for (const solver of requested) {
    if (!(SOLVER_IDS as readonly string[]).includes(solver)) {
      throw new Error(`Unknown native solver '${solver}'`)
    }
  }
  return requested as NativeSolverId[]
}

function argumentValue(args: readonly string[], prefix: string): string | undefined {
  return args.find(argument => argument.startsWith(prefix))?.slice(prefix.length)
}

function positiveInteger(value: string | undefined, fallback: number, label: string): number {
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be positive`)
  return parsed
}

function nonNegativeInteger(value: string | undefined, fallback: number, label: string): number {
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${label} must be non-negative`)
  return parsed
}

function optionalPositiveInteger(value: string | undefined, label: string): number | undefined {
  return value === undefined ? undefined : positiveInteger(value, 1, label)
}

function resolveProjectRoot(): string {
  let directory = dirname(fileURLToPath(import.meta.url))
  for (let depth = 0; depth < 5; depth++) {
    if (existsSync(resolve(directory, 'package.json'))) return directory
    const parent = dirname(directory)
    if (parent === directory) break
    directory = parent
  }
  throw new Error('Could not locate the sudoku-dlx project root')
}

function showUsage(): void {
  console.log(`Usage: run-native-competition [options]

  --dataset=<file>        Puzzle corpus (default: pinned Tdoku 17-clue corpus)
  --solver=<ids>|all      Comma-separated sudoku-dlx, autoresearch-sudoku, tdoku,
                          and schoku (default: all except Schoku)
  --warmup-runs=<count>   Untimed, validated corpus passes per solver (default: 1)
  --runs=<count>          Measured, validated corpus passes per solver (default: 5)
  --size=<count>          Optional common corpus prefix size
  --smoke                 Use one committed smoke puzzle
  --cache=<path>          Native cache (default: .benchmark-cache/sudoku-native)
  --json                  Emit the structured comparison report
  --help                  Show this help

Every result uses the same full-process corpus boundary: one fresh process reads
the same canonical corpus in the same order, solves each puzzle once to its first
solution on one solver thread, and writes every solution. Startup and file I/O are
timed; build, canonicalization, and exhaustive post-run validation are not. No
upstream internal timer is ranked.`)
}

function printReport(report: NativeRunReport): void {
  console.log(
    `Common full-process boundary: ${report.corpus.puzzles.toLocaleString()} puzzles, ` +
      `${report.measuredRunsPerSolver} measured pass(es), SHA-256 ${report.corpus.canonicalSha256}`
  )
  if (report.smoke)
    console.log('Smoke mode: rates from a one-puzzle corpus are not performance claims.')

  const displayed = report.smoke
    ? report.results
    : [...report.results].sort((left, right) => right.puzzlesPerSecond - left.puzzlesPerSecond)
  for (let index = 0; index < displayed.length; index++) {
    const result = displayed[index]
    console.log(
      `${report.smoke ? ' -' : `${String(index + 1).padStart(2)}.`} ${result.label}: ` +
        `${result.puzzlesPerSecond.toFixed(1)} puzzles/s aggregate ` +
        `(${result.totalPuzzles.toLocaleString()} puzzles / ${result.totalElapsedMs.toFixed(1)} ms)`
    )
  }
  console.log(`Validated solution files: ${dirname(report.corpus.canonicalPath)}`)
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const options = parseOptions(args)
  if (options.help) {
    showUsage()
    return
  }

  const report = await runNativeCompetition(options)
  if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  else printReport(report)
}

const executedDirectly =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (executedDirectly) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
