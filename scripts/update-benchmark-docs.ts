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
  readonly wasmInputFile?: string
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
    const competitiveReport = this.options.inputFile
      ? (JSON.parse(await readFile(this.options.inputFile, 'utf8')) as BenchmarkReport)
      : await this.runBenchmark('competitive')
    const wasmReport = this.options.wasmInputFile
      ? (JSON.parse(await readFile(this.options.wasmInputFile, 'utf8')) as BenchmarkReport)
      : this.options.inputFile
        ? undefined
        : await this.runBenchmark('wasm')
    assertReport(competitiveReport, 'competitive')
    if (wasmReport) assertReport(wasmReport, 'wasm')

    const markdown = generateBenchmarkMarkdown(competitiveReport, wasmReport)
    if (this.options.dryRun) {
      process.stdout.write(markdown)
      return
    }

    const readmePath = join(this.projectRoot, 'README.md')
    const readme = await readFile(readmePath, 'utf8')
    await writeFile(readmePath, replaceBenchmarkSection(readme, markdown))
    this.log(`Updated ${readmePath}`)
  }

  private async runBenchmark(group: 'competitive' | 'wasm'): Promise<BenchmarkReport> {
    this.log(
      group === 'competitive'
        ? 'Running maintained competitive benchmarks'
        : 'Running the separate WebAssembly benchmark group'
    )
    const benchmarkPath = join(this.projectRoot, 'built', 'dev', 'benchmark', 'index.js')
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [benchmarkPath, `--${group}`, '--json', '--quiet'],
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

export function generateBenchmarkMarkdown(
  report: BenchmarkReport,
  wasmReport?: BenchmarkReport
): string {
  if (wasmReport) assertCompatiblePublishingReports(report, wasmReport)

  let markdown = `## Benchmarks\n\n`
  markdown +=
    "Ranked tables compare the same ordinary first-solution workload. Each timed sample processes one complete corpus pass, and throughput is total puzzles divided by total elapsed time. End-to-end cases include public input conversion and puzzle-specific setup; prepared cases exclude only conversion to each library's natural input representation. Ranked passes receive fresh deterministic digit-isomorphic strings and fresh prepared objects outside timing, preventing exact-result caches or input mutation from benefiting from harness repetition. Warmup uses a disjoint corpus, and measured outputs are validated after timing.\n\n"

  for (const section of report.sections) {
    if (section.results.length === 0) continue
    markdown += renderSection(section)
  }

  if (wasmReport) {
    markdown += renderWasmReport(wasmReport)
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
  markdown += `- JavaScript and capability solvers: ${report.solvers.map(solver => `${solver.name} ${solver.version} (${solver.license})`).join('; ')}\n`
  markdown += `- Competitive sections generated: ${report.generatedAt}\n`
  if (wasmReport) {
    markdown += `- WebAssembly section solvers: ${wasmReport.solvers.map(solver => `${solver.name} ${solver.version} (${solver.license})`).join('; ')}\n`
    markdown += `- WebAssembly section generated: ${wasmReport.generatedAt}\n`
  }
  markdown += '\n'
  markdown += wasmReport
    ? 'Compiled replay is an unranked sudoku-dlx capability for repeatedly solving identical givens. WebAssembly is shown in its separately labelled steady-state section; native addons, native executables, legacy all-solution APIs, and third-party corpora remain in other separately labelled groups.\n'
    : 'Compiled replay is an unranked sudoku-dlx capability for repeatedly solving identical givens. WebAssembly, native addons, native executables, legacy all-solution APIs, and third-party corpora are kept in separately labelled groups.\n'
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

function renderWasmReport(report: BenchmarkReport): string {
  const sections = report.sections.filter(section => section.results.length > 0)
  let markdown = '### Alternative runtime — WebAssembly steady state\n\n'
  markdown +=
    'This separate runtime comparison uses the same solve-once corpus and fresh-input schedule as the JavaScript end-to-end tier. One-time WebAssembly initialization is excluded, while per-call string marshalling and solving are timed. It describes an already-loaded library and is not a cold-start result; its ranking is intentionally kept out of the JavaScript table above.\n\n'

  for (const [index, section] of sections.entries()) {
    if (sections.length > 1) markdown += `#### ${section.benchmarkName}\n\n`
    markdown += sectionContract(section)
    markdown += renderRankedTable(section, 'Relative in section')
    if (index < sections.length - 1) markdown += '\n'
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

export function assertCompatiblePublishingReports(
  competitiveReport: BenchmarkReport,
  wasmReport: BenchmarkReport
): void {
  assertReport(competitiveReport, 'competitive')
  assertReport(wasmReport, 'wasm')

  assertPresentProvenance(competitiveReport, 'competitive')
  assertPresentProvenance(wasmReport, 'WebAssembly')

  const environmentKeys = [
    'runtime',
    'runtimeVersion',
    'nodeVersion',
    'v8Version',
    'os',
    'architecture',
    'cpu',
    'logicalCpus',
    'gitSha',
    'gitDirty',
    'lockfileSha256'
  ] as const
  for (const key of environmentKeys) {
    if (competitiveReport.environment[key] !== wasmReport.environment[key]) {
      const label =
        key === 'gitSha'
          ? 'repository Git revision'
          : key === 'lockfileSha256'
            ? 'dependency lockfile SHA-256'
            : `benchmark environment field '${key}'`
      throw new Error(`Cannot combine reports with a different ${label}`)
    }
  }

  if (!sameValue(competitiveReport.configuration, wasmReport.configuration)) {
    throw new Error('Cannot combine reports with different benchmark timing contracts')
  }

  if (wasmReport.sections.length === 0) {
    throw new Error('WebAssembly report contains no benchmark sections')
  }
  const wasmSolversById = new Map(wasmReport.solvers.map(solver => [solver.id, solver]))
  const sharedSolvers = wasmReport.solvers.filter(
    wasmSolver =>
      wasmSolver.runtime === 'javascript' &&
      competitiveReport.solvers.some(competitiveSolver => competitiveSolver.id === wasmSolver.id)
  )
  if (sharedSolvers.length === 0) {
    throw new Error('WebAssembly report has no shared JavaScript baseline from the competitive run')
  }
  const sharedSolverIds = new Set(sharedSolvers.map(solver => solver.id))
  const wasmSolverIds = new Set(
    wasmReport.solvers.filter(solver => solver.runtime === 'wasm').map(solver => solver.id)
  )
  if (wasmSolverIds.size === 0) {
    throw new Error('WebAssembly report contains no WebAssembly solver')
  }

  for (const wasmSection of wasmReport.sections) {
    if (wasmSection.comparison !== 'ranked' || wasmSection.tier !== 'end-to-end') {
      throw new Error('The WebAssembly publication group must contain ranked end-to-end sections')
    }
    if (wasmSection.results.some(result => !wasmSolversById.has(result.solverId))) {
      throw new Error(
        `WebAssembly section '${wasmSection.caseId}' contains an unknown solver result`
      )
    }
    if (!wasmSection.results.some(result => sharedSolverIds.has(result.solverId))) {
      throw new Error(`WebAssembly section '${wasmSection.caseId}' is missing its shared baseline`)
    }
    if (!wasmSection.results.some(result => wasmSolverIds.has(result.solverId))) {
      throw new Error(`WebAssembly section '${wasmSection.caseId}' has no WebAssembly result`)
    }
    const competitiveSection = competitiveReport.sections.find(
      section => section.caseId === wasmSection.caseId
    )
    if (!competitiveSection) {
      throw new Error(`Competitive report is missing corpus case '${wasmSection.caseId}'`)
    }
    if (!competitiveSection.results.some(result => sharedSolverIds.has(result.solverId))) {
      throw new Error(
        `Competitive corpus case '${wasmSection.caseId}' is missing the shared JavaScript baseline`
      )
    }
    assertSameSectionContract(competitiveSection, wasmSection)

    for (const datasetId of [wasmSection.datasetId, wasmSection.warmupDatasetId]) {
      const competitiveDataset = competitiveReport.datasets.find(
        dataset => dataset.id === datasetId
      )
      const wasmDataset = wasmReport.datasets.find(dataset => dataset.id === datasetId)
      if (!competitiveDataset || !wasmDataset) {
        throw new Error(`Cannot verify benchmark dataset '${datasetId}'`)
      }
      if (competitiveDataset.sha256 !== wasmDataset.sha256) {
        throw new Error(
          `Cannot combine reports with a different dataset SHA-256 for '${datasetId}'`
        )
      }
    }
  }

  for (const sharedSolver of sharedSolvers) {
    const competitiveSolver = competitiveReport.solvers.find(
      solver => solver.id === sharedSolver.id
    )
    if (!sameValue(competitiveSolver, sharedSolver)) {
      throw new Error(`Shared solver metadata differs for '${sharedSolver.id}'`)
    }
  }
}

function assertPresentProvenance(report: BenchmarkReport, label: string): void {
  if (!report.environment.gitSha) {
    throw new Error(`${label} report is missing its repository Git revision`)
  }
  if (report.environment.gitDirty === undefined) {
    throw new Error(`${label} report is missing its repository dirty-state provenance`)
  }
  if (!report.environment.lockfileSha256) {
    throw new Error(`${label} report is missing its dependency lockfile SHA-256`)
  }
}

function assertSameSectionContract(
  competitiveSection: BenchmarkSection,
  wasmSection: BenchmarkSection
): void {
  const keys = [
    'caseId',
    'benchmarkName',
    'datasetId',
    'warmupDatasetId',
    'semantics',
    'tier',
    'comparison',
    'puzzleCount',
    'warmupPuzzleCount',
    'timedOperation',
    'inputSchedule'
  ] as const
  for (const key of keys) {
    if (competitiveSection[key] !== wasmSection[key]) {
      throw new Error(
        `Cannot combine reports with a different corpus contract field '${key}' for '${wasmSection.caseId}'`
      )
    }
  }
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
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
    wasmInputFile: args.find(argument => argument.startsWith('--wasm-input='))?.slice(13),
    benchmarkTimeoutMs: 300_000,
    help: args.includes('--help') || args.includes('-h')
  }
}

function showUsage(): void {
  console.log(`Usage: update-benchmark-docs [options]

  --input=<report.json>       Render an existing competitive schema-v2 report
  --wasm-input=<report.json>  Add a separately rendered WebAssembly schema-v2 report
  --dry-run                   Print the generated benchmark section without editing README.md
  --quiet                     Suppress progress logs
  --help                      Show this help`)
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
