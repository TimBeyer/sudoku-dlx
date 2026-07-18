import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { getGroup } from './config/groups.js'
import { getAvailableGroups, runBenchmarkGroup } from './runner.js'
import type { BenchmarkOptions, BenchmarkReport } from './types.js'

export { calculateCorpusThroughput, createIsomorphicCorpus } from './runner.js'

export type {
  BenchmarkEnvironment,
  BenchmarkComparison,
  BenchmarkInputSchedule,
  BenchmarkOptions,
  BenchmarkReport,
  BenchmarkResult,
  BenchmarkSection,
  BenchmarkSemantics,
  BenchmarkTier,
  DatasetDefinition,
  SolverMetadata
} from './types.js'

interface ParsedOptions extends BenchmarkOptions {
  readonly help: boolean
}

function parseArgs(args = process.argv.slice(2)): ParsedOptions {
  const namedGroup = valueAfterPrefix(args, '--group=')
  const selectedFlag = getAvailableGroups().find(group => args.includes(`--${group}`))
  const group = namedGroup ?? selectedFlag ?? 'internal'
  const jsonFlag = args.find(argument => argument === '--json' || argument.startsWith('--json='))
  const positionalJsonFile =
    jsonFlag === '--json' ? args.find(argument => !argument.startsWith('-')) : undefined

  return {
    group,
    jsonOutput: jsonFlag !== undefined,
    jsonFile: jsonFlag?.startsWith('--json=')
      ? jsonFlag.slice('--json='.length)
      : positionalJsonFile,
    quiet: args.includes('--quiet'),
    timeMs: positiveNumber(valueAfterPrefix(args, '--time='), 500, '--time'),
    warmupMs: positiveNumber(valueAfterPrefix(args, '--warmup='), 100, '--warmup'),
    help: args.includes('--help') || args.includes('-h')
  }
}

function valueAfterPrefix(args: readonly string[], prefix: string): string | undefined {
  return args.find(argument => argument.startsWith(prefix))?.slice(prefix.length)
}

function positiveNumber(value: string | undefined, fallback: number, flag: string): number {
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${flag} must be positive`)
  return parsed
}

function showUsage(): void {
  console.log(`Usage: node built/dev/benchmark/index.js [group] [options]

Groups:
${getAvailableGroups()
  .map(group => `  --${group.padEnd(13)} ${getGroup(group)?.description ?? ''}`)
  .join('\n')}

Options:
  --group=<name>      Select a group without its convenience flag
  --json[=<file>]     Write the schema-versioned report as JSON
  --quiet             Suppress progress output (JSON remains on stdout)
  --time=<ms>         Measurement time per task (default: 500)
  --warmup=<ms>       Warmup time per task (default: 100)
  --help              Show this help

Every timed operation solves one complete measured corpus. Ranked end-to-end cases
measure string-to-first-solution; ranked prepared cases move only input parsing out
of timing. Exact-puzzle compilation is reported separately and is never ranked
against solvers without the same capability.`)
}

function outputReport(report: BenchmarkReport, options: BenchmarkOptions): void {
  if (!options.jsonOutput) return
  const json = `${JSON.stringify(report, null, 2)}\n`
  if (options.jsonFile) {
    writeFileSync(options.jsonFile, json)
    if (!options.quiet) console.log(`Benchmark report written to ${options.jsonFile}`)
  } else {
    process.stdout.write(json)
  }
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(args)
  if (options.help) {
    showUsage()
    return
  }

  const report = await runBenchmarkGroup(options)
  outputReport(report, options)
}

const executedDirectly =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (executedDirectly) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
