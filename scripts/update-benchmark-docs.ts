#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import type { BenchmarkReport, BenchmarkResult, BenchmarkSection } from '../benchmark/types.js'

const execFileAsync = promisify(execFile)

export interface UpdateOptions {
  readonly quiet: boolean
  readonly dryRun: boolean
  readonly inputFile?: string
  readonly benchmarkTimeoutMs: number
}

interface ProcessedResult extends BenchmarkResult {
  readonly relativePerformance: number
  readonly fastest: boolean
}

export class BenchmarkDocUpdater {
  private readonly options: UpdateOptions
  private readonly projectRoot: string

  constructor(options: Partial<UpdateOptions> = {}) {
    this.options = {
      quiet: false,
      dryRun: false,
      benchmarkTimeoutMs: 300_000,
      ...options
    }
    this.projectRoot = findProjectRoot(dirname(fileURLToPath(import.meta.url)))
  }

  async update(): Promise<void> {
    const report = this.options.inputFile
      ? (JSON.parse(await readFile(this.options.inputFile, 'utf8')) as BenchmarkReport)
      : await this.runBenchmark()
    assertReport(report, 'competitive')

    const markdown = generateBenchmarkMarkdown(report)
    if (this.options.dryRun) {
      process.stdout.write(markdown)
      return
    }

    const readmePath = join(this.projectRoot, 'README.md')
    const readme = await readFile(readmePath, 'utf8')
    await writeFile(readmePath, replaceBenchmarkSection(readme, markdown))
    this.log(`Updated ${readmePath}`)
  }

  private async runBenchmark(): Promise<BenchmarkReport> {
    this.log('Running maintained competitive benchmarks')
    const benchmarkPath = join(this.projectRoot, 'built', 'dev', 'benchmark', 'index.js')
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [benchmarkPath, '--competitive', '--json', '--quiet'],
      {
        cwd: this.projectRoot,
        timeout: this.options.benchmarkTimeoutMs,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024
      }
    )
    if (stderr.trim()) this.log(stderr.trim())
    return JSON.parse(stdout) as BenchmarkReport
  }

  private log(message: string): void {
    if (!this.options.quiet) console.log(`[benchmark-docs] ${message}`)
  }
}

export function generateBenchmarkMarkdown(report: BenchmarkReport): string {
  let markdown = `## Benchmarks\n\n`
  markdown +=
    "Ranked tables compare the same ordinary first-solution workload regardless of whether an npm package is implemented in JavaScript or WebAssembly. Module loading and one-time runtime initialization happen before timing; per-call marshalling, public input conversion, puzzle-specific setup, and solving remain timed. Each timed sample processes one complete corpus pass, and throughput is total puzzles divided by total elapsed time. Prepared cases exclude only conversion to each library's natural input representation. Ranked passes receive fresh deterministic digit-isomorphic strings and fresh prepared objects outside timing, preventing exact-result caches or input mutation from benefiting from harness repetition. Warmup uses a disjoint corpus, and measured outputs are validated after timing.\n\n"

  for (const section of report.sections) {
    if (section.results.length === 0) continue
    markdown += renderSection(section)
  }

  markdown += '### Reproduction metadata\n\n'
  markdown += `- Runtime: ${report.environment.runtime} ${report.environment.runtimeVersion} (Node ${report.environment.nodeVersion})\n`
  markdown += `- CPU: ${report.environment.cpu}; ${report.environment.logicalCpus} logical CPUs\n`
  markdown += `- Platform: ${report.environment.os}, ${report.environment.architecture}\n`
  if (report.environment.gitSha) {
    markdown += `- Repository state: \`${report.environment.gitSha}\`${report.environment.gitDirty ? ' with uncommitted benchmark changes' : ' (clean)'}\n`
  }
  if (report.environment.lockfileSha256) {
    markdown += `- Lockfile SHA-256: \`${report.environment.lockfileSha256}\`\n`
  }
  markdown += `- Tinybench minima: ${report.configuration.warmupMs} ms warmup and ${report.configuration.timeMs} ms measurement per task; iteration minima may run longer\n`
  markdown += `- Measurement: ${report.configuration.timedOperation}; rate: ${report.configuration.rate}\n`
  markdown += `- Ranked input schedule: ${report.configuration.rankedInputSchedule}\n`
  markdown += `- Validation: ${report.configuration.validation}\n`
  markdown += `- Solvers: ${report.solvers.map(solver => `${solver.name} ${solver.version} (${solver.license}, ${solver.runtime})`).join('; ')}\n`
  markdown += `- Generated: ${report.generatedAt}\n`
  markdown += '\n'
  markdown +=
    'Compiled replay is an unranked sudoku-dlx capability for repeatedly solving identical givens. Legacy all-solution APIs remain in their own best-effort group.\n'
  return markdown
}

function renderSection(section: BenchmarkSection): string {
  let markdown = `### ${section.benchmarkName}\n\n`
  markdown += sectionContract(section)

  if (section.comparison === 'ranked') {
    markdown +=
      'Direct comparison: every solver receives the same independent puzzles and performs the same first-solution work.\n\n'
    markdown += renderRankedTable(section)
  } else {
    markdown += `${unrankedExplanation(section)}\n\n`
    markdown += '| Mode | Puzzles/sec | Margin |\n'
    markdown += '|---|---:|---:|\n'
    for (const result of section.results) {
      markdown += `| ${escapeCell(result.name)} | ${formatRate(result.opsPerSec)} | ±${result.margin.toFixed(2)}% |\n`
    }
  }
  return `${markdown}\n`
}

function sectionContract(section: BenchmarkSection): string {
  return `Dataset: \`${section.datasetId}\` (${section.puzzleCount} puzzles per pass); warmup: \`${section.warmupDatasetId}\` (${section.warmupPuzzleCount} puzzles); tier: \`${section.tier}\`; input schedule: \`${section.inputSchedule}\`.\n\n`
}

function renderRankedTable(section: BenchmarkSection, relativeHeading = 'Relative'): string {
  let markdown = `| Solver | Puzzles/sec | ${relativeHeading} | Margin |\n`
  markdown += '|---|---:|---:|---:|\n'
  for (const result of processResults(section)) {
    const relative = result.fastest
      ? '**1.00× fastest**'
      : result.relativePerformance < 0.01
        ? '<0.01×'
        : `${result.relativePerformance.toFixed(2)}×`
    markdown += `| ${escapeCell(result.name)} | ${formatRate(result.opsPerSec)} | ${relative} | ±${result.margin.toFixed(2)}% |\n`
  }
  return markdown
}

function unrankedExplanation(section: BenchmarkSection): string {
  if (section.comparison === 'capability-only') {
    return 'Capability only: exact-puzzle compilation happened before timing. These absolute rates describe repeated solving of already-compiled givens and are intentionally not contrasted with ordinary one-shot solver APIs.'
  }
  return 'Diagnostic only: this fixture is useful for local regression investigation, but it is not representative and is not used for competitive claims.'
}

function formatRate(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function processResults(section: BenchmarkSection): ProcessedResult[] {
  const fastest = Math.max(...section.results.map(result => result.opsPerSec))
  return section.results
    .map(result => ({
      ...result,
      relativePerformance: result.opsPerSec / fastest,
      fastest: result.opsPerSec === fastest
    }))
    .sort((left, right) => right.opsPerSec - left.opsPerSec)
}

function replaceBenchmarkSection(readme: string, markdown: string): string {
  const marker = '## Benchmarks'
  const start = readme.indexOf(marker)
  if (start === -1) return `${readme.trimEnd()}\n\n${markdown}`

  const nextHeading = readme.indexOf('\n## ', start + marker.length)
  if (nextHeading === -1) return `${readme.slice(0, start)}${markdown}`
  return `${readme.slice(0, start)}${markdown}\n${readme.slice(nextHeading + 1)}`
}

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ')
}

function assertReport(report: BenchmarkReport, expectedGroup?: string): void {
  if (report.schemaVersion !== 2 || !Array.isArray(report.sections)) {
    throw new Error('Expected a sudoku-dlx benchmark schema v2 report')
  }
  if (expectedGroup && report.group !== expectedGroup) {
    throw new Error(`Expected benchmark group '${expectedGroup}', received '${report.group}'`)
  }
}

function findProjectRoot(start: string): string {
  let directory = resolve(start)
  for (let depth = 0; depth < 5; depth++) {
    if (existsSync(join(directory, 'package.json'))) return directory
    const parent = dirname(directory)
    if (parent === directory) break
    directory = parent
  }
  throw new Error(`Could not locate project root above ${start}`)
}

function parseOptions(args = process.argv.slice(2)): UpdateOptions & { help: boolean } {
  return {
    quiet: args.includes('--quiet'),
    dryRun: args.includes('--dry-run'),
    inputFile: args.find(argument => argument.startsWith('--input='))?.slice(8),
    benchmarkTimeoutMs: 300_000,
    help: args.includes('--help') || args.includes('-h')
  }
}

function showUsage(): void {
  console.log(`Usage: update-benchmark-docs [options]

  --input=<report.json>  Render an existing competitive schema-v2 report
  --dry-run              Print the generated benchmark section without editing README.md
  --quiet                Suppress progress logs
  --help                 Show this help`)
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const options = parseOptions(args)
  if (options.help) {
    showUsage()
    return
  }
  await new BenchmarkDocUpdater(options).update()
}

const executedDirectly =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (executedDirectly) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
