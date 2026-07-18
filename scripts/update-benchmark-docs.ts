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
    assertReport(report)

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
  markdown += `Benchmarks solve one puzzle per operation, rotate deterministic corpora, and validate every solver result before timing. End-to-end cases include public input conversion; prepared cases move conversion or fixed-puzzle compilation outside the timed operation.\n\n`

  for (const section of report.sections) {
    if (section.results.length === 0) continue
    const results = processResults(section)
    markdown += `### ${section.benchmarkName}\n\n`
    markdown += `Dataset: \`${section.datasetId}\` (${section.puzzleCount} puzzle${section.puzzleCount === 1 ? '' : 's'}); semantics: \`${section.semantics}\`.\n\n`
    markdown += '| Solver | Puzzles/sec | Relative | Margin |\n'
    markdown += '|---|---:|---:|---:|\n'
    for (const result of results) {
      const relative = result.fastest
        ? '**1.00× fastest**'
        : `${result.relativePerformance.toFixed(2)}×`
      markdown += `| ${escapeCell(result.name)} | ${result.opsPerSec.toLocaleString('en-US', { maximumFractionDigits: 2 })} | ${relative} | ±${result.margin.toFixed(2)}% |\n`
    }
    markdown += '\n'
  }

  markdown += '### Reproduction metadata\n\n'
  markdown += `- Runtime: ${report.environment.runtime} ${report.environment.runtimeVersion} (Node ${report.environment.nodeVersion})\n`
  markdown += `- CPU: ${report.environment.cpu}; ${report.environment.logicalCpus} logical CPUs\n`
  markdown += `- Platform: ${report.environment.os}, ${report.environment.architecture}\n`
  if (report.environment.gitSha)
    markdown += `- Repository commit: \`${report.environment.gitSha}\`\n`
  if (report.environment.lockfileSha256) {
    markdown += `- Lockfile SHA-256: \`${report.environment.lockfileSha256}\`\n`
  }
  markdown += `- Timing: ${report.configuration.warmupMs} ms warmup and ${report.configuration.timeMs} ms measurement per task\n`
  markdown += `- Solvers: ${report.solvers.map(solver => `${solver.name} ${solver.version} (${solver.license})`).join('; ')}\n`
  markdown += `- Generated: ${report.generatedAt}\n\n`
  markdown +=
    'Large native and third-party corpora are opt-in and are not mixed into these in-process JavaScript tables.\n'
  return markdown
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

function assertReport(report: BenchmarkReport): void {
  if (report.schemaVersion !== 1 || !Array.isArray(report.sections)) {
    throw new Error('Expected a sudoku-dlx benchmark schema v1 report')
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

  --input=<report.json>  Render an existing schema-v1 report instead of running benchmarks
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
