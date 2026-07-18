#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { arch, cpus, platform, release } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { SCHOKU, TDOKU } from '../benchmark/competition/manifest.js'

const execFileAsync = promisify(execFile)

type NativeSolverSelection = 'tdoku' | 'schoku' | 'both'

interface RunOptions {
  readonly cacheDirectory: string
  readonly dataset: string
  readonly solver: NativeSolverSelection
  readonly warmupSeconds: number
  readonly testSeconds: number
  readonly sampleSize?: number
  readonly json: boolean
}

interface NativeRunResult {
  readonly solver: string
  readonly command: readonly string[]
  readonly elapsedMs: number
  readonly stdout: string
  readonly stderr: string
}

interface NativeRunReport {
  readonly schemaVersion: 1
  readonly generatedAt: string
  readonly mode: 'native-batch-throughput'
  readonly dataset: string
  readonly environment: {
    readonly os: string
    readonly architecture: string
    readonly cpu: string
    readonly logicalCpus: number
  }
  readonly sourcePins: readonly { id: string; commit: string; license: string }[]
  readonly results: readonly NativeRunResult[]
}

export async function runNativeCompetition(options: RunOptions): Promise<NativeRunReport> {
  if (!existsSync(options.dataset)) throw new Error(`Dataset not found: ${options.dataset}`)

  const results: NativeRunResult[] = []
  if (options.solver === 'tdoku' || options.solver === 'both') {
    results.push(await runTdoku(options))
  }
  if (options.solver === 'schoku' || options.solver === 'both') {
    results.push(await runSchoku(options))
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: 'native-batch-throughput',
    dataset: options.dataset,
    environment: {
      os: `${platform()} ${release()}`,
      architecture: arch(),
      cpu: cpus()[0]?.model ?? 'unknown',
      logicalCpus: cpus().length
    },
    sourcePins: [TDOKU, SCHOKU].map(source => ({
      id: source.id,
      commit: source.commit,
      license: source.license
    })),
    results
  }
}

async function runTdoku(options: RunOptions): Promise<NativeRunResult> {
  const binary = resolve(options.cacheDirectory, 'tdoku/build/run_benchmark')
  if (!existsSync(binary)) throw new Error(`Tdoku benchmark binary not found: ${binary}`)
  const args = [
    '-f',
    '-e',
    '1',
    '-r1',
    '-w',
    String(options.warmupSeconds),
    '-t',
    String(options.testSeconds),
    '-v1',
    '-s',
    'tdoku'
  ]
  if (options.sampleSize !== undefined) args.push('-n', String(options.sampleSize))
  args.push(options.dataset)
  return runCaptured('tdoku', binary, args)
}

async function runSchoku(options: RunOptions): Promise<NativeRunResult> {
  if (platform() !== 'linux' || arch() !== 'x64') {
    throw new Error('Schoku benchmarking requires Linux/x86-64 with its documented CPU features')
  }
  const binary = resolve(options.cacheDirectory, 'schoku/src/schoku')
  if (!existsSync(binary)) throw new Error(`Schoku binary not found: ${binary}`)
  const resultsDirectory = resolve(options.cacheDirectory, 'results')
  await mkdir(resultsDirectory, { recursive: true })
  const solutionFile = resolve(resultsDirectory, 'schoku-solutions.txt')
  return runCaptured('schoku-single-thread', binary, [
    '-rO',
    '-t1',
    '-v',
    '-y',
    options.dataset,
    solutionFile
  ])
}

async function runCaptured(
  solver: string,
  binary: string,
  args: readonly string[]
): Promise<NativeRunResult> {
  const started = performance.now()
  try {
    const { stdout, stderr } = await execFileAsync(binary, [...args], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024
    })
    return {
      solver,
      command: [binary, ...args],
      elapsedMs: performance.now() - started,
      stdout,
      stderr
    }
  } catch (error) {
    throw new Error(`${solver} failed${commandErrorDetails(error)}`, { cause: error })
  }
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
  const cacheArgument = args.find(argument => argument.startsWith('--cache='))?.slice(8)
  const cacheDirectory = resolve(projectRoot, cacheArgument ?? '.benchmark-cache/sudoku-native')
  const datasetArgument = args.find(argument => argument.startsWith('--dataset='))?.slice(10)
  const solverArgument = args.find(argument => argument.startsWith('--solver='))?.slice(9) ?? 'both'
  if (!['tdoku', 'schoku', 'both'].includes(solverArgument)) {
    throw new Error(`Unknown native solver selection '${solverArgument}'`)
  }

  return {
    cacheDirectory,
    dataset: resolve(
      projectRoot,
      datasetArgument ?? resolve(cacheDirectory, 'tdoku/data/puzzles2_17_clue')
    ),
    solver: solverArgument as NativeSolverSelection,
    warmupSeconds: positiveInteger(argumentValue(args, '--warmup='), 2, '--warmup'),
    testSeconds: positiveInteger(argumentValue(args, '--time='), 8, '--time'),
    sampleSize: optionalPositiveInteger(argumentValue(args, '--size='), '--size'),
    json: args.includes('--json'),
    help: args.includes('--help') || args.includes('-h')
  }
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
  --solver=tdoku|schoku|both
  --warmup=<seconds>      Tdoku warmup duration (default: 2)
  --time=<seconds>        Tdoku measurement duration (default: 8)
  --size=<count>          Optional Tdoku sample limit
  --cache=<path>          Native cache (default: .benchmark-cache/sudoku-native)
  --json                  Emit a structured envelope containing upstream output
  --help                  Show this help

Schoku is always pinned to one thread and first-solution mode. Its standalone
timing output remains separate from Tdoku because their CLI timing boundaries differ.`)
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const options = parseOptions(args)
  if (options.help) {
    showUsage()
    return
  }

  const report = await runNativeCompetition(options)
  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  } else {
    for (const result of report.results) {
      console.log(`\n=== ${result.solver} (${result.elapsedMs.toFixed(1)} ms wall time) ===`)
      process.stdout.write(result.stdout)
      if (result.stderr) process.stderr.write(result.stderr)
    }
  }
}

const executedDirectly =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (executedDirectly) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
