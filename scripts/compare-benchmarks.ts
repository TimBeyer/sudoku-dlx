#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BenchmarkEnvironment, BenchmarkReport, BenchmarkSection } from '../benchmark/types.js'

interface ComparableResult {
  readonly solverId: string
  readonly name: string
  readonly opsPerSec: number
  readonly margin: number
}

interface LegacyComparableSection {
  readonly caseId: string
  readonly benchmarkName: string
  readonly semantics: string
  readonly results: readonly ComparableResult[]
}

interface LegacyComparisonReport {
  readonly schemaVersion: 1
  readonly group: string
  readonly environment: BenchmarkEnvironment
  readonly sections: readonly LegacyComparableSection[]
}

export type ComparisonReport = LegacyComparisonReport | BenchmarkReport

interface FlatResult extends ComparableResult {
  readonly key: string
  readonly benchmarkName: string
  readonly semantics: string
}

interface Comparison {
  readonly baseline: FlatResult
  readonly candidate: FlatResult
  readonly percentChange: number
}

export function parseBenchmarkReport(
  contents: string,
  filename = 'benchmark report'
): ComparisonReport {
  const value: unknown = JSON.parse(contents)
  if (!isBenchmarkReport(value)) {
    throw new Error(`${filename} is not a supported sudoku-dlx benchmark report`)
  }
  return value
}

export function generateComparisonMarkdown(
  baseline: ComparisonReport,
  candidate: ComparisonReport
): string {
  let markdown = '## Benchmark comparison\n\n'
  markdown += environmentSummary(baseline.environment, candidate.environment)

  if (baseline.schemaVersion !== candidate.schemaVersion) {
    markdown += `Benchmark contracts differ (baseline schema v${baseline.schemaVersion}, candidate schema v${candidate.schemaVersion}), so their rates are intentionally not compared. Schema v2 measures complete corpus passes as total puzzles divided by total elapsed time; schema v1 rates must not be used as its baseline.\n`
    return markdown
  }

  if (!sameEnvironment(baseline.environment, candidate.environment)) {
    markdown +=
      'Rates are intentionally not compared across different hardware, operating systems, architectures, runtimes, or runtime versions. Re-run both revisions in the same environment.\n'
    return markdown
  }

  if (baseline.schemaVersion === 2 && candidate.schemaVersion === 2) {
    const differences = benchmarkContractDifferences(baseline, candidate)
    if (differences.length > 0) {
      markdown +=
        'Benchmark contracts differ, so their rates are intentionally not compared. Re-establish a baseline with the same corpus and measurement contract.\n\n'
      markdown += differences.map(difference => `- ${difference}`).join('\n')
      markdown += '\n'
      return markdown
    }
  }

  const baselineResults = flatten(baseline.sections)
  const candidateResults = flatten(candidate.sections)
  const comparisons: Comparison[] = []

  for (const current of candidateResults) {
    const previous = baselineResults.find(result => result.key === current.key)
    if (!previous) continue
    comparisons.push({
      baseline: previous,
      candidate: current,
      percentChange: ((current.opsPerSec - previous.opsPerSec) / previous.opsPerSec) * 100
    })
  }

  if (comparisons.length === 0) {
    markdown += 'No matching case/solver pairs were found.\n'
    return markdown
  }

  const byCase = groupByBenchmark(comparisons)
  for (const [benchmarkName, entries] of byCase) {
    markdown += `### ${escapeCell(benchmarkName)}\n\n`
    markdown +=
      '| Solver | Baseline (puzzles/sec) | Candidate (puzzles/sec) | Change | Assessment |\n'
    markdown += '|---|---:|---:|---:|---|\n'
    for (const entry of entries.sort((left, right) =>
      left.candidate.name.localeCompare(right.candidate.name)
    )) {
      const sign = entry.percentChange >= 0 ? '+' : ''
      markdown += `| ${escapeCell(entry.candidate.name)} | ${formatRate(entry.baseline)} | ${formatRate(entry.candidate)} | ${sign}${entry.percentChange.toFixed(2)}% | ${assessment(entry)} |\n`
    }
    markdown += '\n'
  }

  const matched = new Set(comparisons.map(comparison => comparison.candidate.key))
  const baselineOnly = baselineResults.filter(result => !matched.has(result.key))
  const candidateOnly = candidateResults.filter(result => !matched.has(result.key))
  if (baselineOnly.length > 0 || candidateOnly.length > 0) {
    markdown += '### Unmatched results\n\n'
    if (baselineOnly.length > 0) {
      markdown += `Baseline only: ${baselineOnly.map(result => `\`${result.key}\``).join(', ')}.\n\n`
    }
    if (candidateOnly.length > 0) {
      markdown += `Candidate only: ${candidateOnly.map(result => `\`${result.key}\``).join(', ')}.\n\n`
    }
  }

  markdown += `Generated ${new Date().toISOString()}. Both reports use schema v${candidate.schemaVersion} and therefore share the same measurement contract.\n`
  return markdown
}

function groupByBenchmark(comparisons: readonly Comparison[]): Map<string, Comparison[]> {
  const grouped = new Map<string, Comparison[]>()
  for (const comparison of comparisons) {
    const name = comparison.candidate.benchmarkName
    const entries = grouped.get(name) ?? []
    entries.push(comparison)
    grouped.set(name, entries)
  }
  return grouped
}

function flatten(sections: readonly (LegacyComparableSection | BenchmarkSection)[]): FlatResult[] {
  return sections.flatMap(section =>
    section.results.map(result => ({
      ...result,
      key: `${section.caseId}|${result.solverId}`,
      benchmarkName: section.benchmarkName,
      semantics: section.semantics
    }))
  )
}

function environmentSummary(
  baseline: BenchmarkEnvironment,
  candidate: BenchmarkEnvironment
): string {
  let markdown = sameEnvironment(baseline, candidate)
    ? 'Environment match: yes.\n\n'
    : '⚠️ Environment mismatch; performance deltas may not be attributable to the code change.\n\n'
  markdown += `- Baseline: ${escapeCell(baseline.cpu)}, ${baseline.runtime} ${baseline.runtimeVersion}, ${baseline.os}\n`
  markdown += `- Candidate: ${escapeCell(candidate.cpu)}, ${candidate.runtime} ${candidate.runtimeVersion}, ${candidate.os}\n\n`
  return markdown
}

function sameEnvironment(baseline: BenchmarkEnvironment, candidate: BenchmarkEnvironment): boolean {
  return (
    baseline.cpu === candidate.cpu &&
    baseline.logicalCpus === candidate.logicalCpus &&
    baseline.os === candidate.os &&
    baseline.architecture === candidate.architecture &&
    baseline.runtime === candidate.runtime &&
    baseline.runtimeVersion === candidate.runtimeVersion &&
    baseline.nodeVersion === candidate.nodeVersion &&
    baseline.v8Version === candidate.v8Version
  )
}

function benchmarkContractDifferences(
  baseline: BenchmarkReport,
  candidate: BenchmarkReport
): readonly string[] {
  const differences: string[] = []
  if (baseline.group !== candidate.group) {
    differences.push(`group changed from \`${baseline.group}\` to \`${candidate.group}\``)
  }

  const configurationKeys = [
    'timeMs',
    'warmupMs',
    'order',
    'taskIsolation',
    'timedOperation',
    'rate',
    'warmup',
    'validation',
    'rankedInputSchedule'
  ] as const
  for (const key of configurationKeys) {
    if (baseline.configuration[key] !== candidate.configuration[key]) {
      differences.push(
        `configuration \`${key}\` changed from \`${baseline.configuration[key]}\` to \`${candidate.configuration[key]}\``
      )
    }
  }

  const baselineSections = new Map(baseline.sections.map(section => [section.caseId, section]))
  const baselineDatasets = new Map(baseline.datasets.map(dataset => [dataset.id, dataset.sha256]))
  const candidateDatasets = new Map(candidate.datasets.map(dataset => [dataset.id, dataset.sha256]))

  for (const current of candidate.sections) {
    const previous = baselineSections.get(current.caseId)
    if (!previous) continue

    const sectionKeys = [
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
    for (const key of sectionKeys) {
      if (previous[key] !== current[key]) {
        differences.push(
          `case \`${current.caseId}\` changed \`${key}\` from \`${previous[key]}\` to \`${current[key]}\``
        )
      }
    }
    if (previous.executionOrder.join('\u0000') !== current.executionOrder.join('\u0000')) {
      differences.push(`case \`${current.caseId}\` changed solver execution order`)
    }

    for (const datasetId of [current.datasetId, current.warmupDatasetId]) {
      const previousHash = baselineDatasets.get(datasetId)
      const currentHash = candidateDatasets.get(datasetId)
      if (!previousHash || !currentHash) {
        differences.push(
          `case \`${current.caseId}\` is missing metadata for dataset \`${datasetId}\``
        )
      } else if (previousHash !== currentHash) {
        differences.push(`dataset \`${datasetId}\` SHA-256 changed`)
      }
    }
  }

  return [...new Set(differences)]
}

function formatRate(result: Pick<FlatResult, 'opsPerSec' | 'margin'>): string {
  return `${result.opsPerSec.toLocaleString('en-US', { maximumFractionDigits: 2 })} ±${result.margin.toFixed(2)}%`
}

function assessment(comparison: Comparison): string {
  if (confidenceIntervalsOverlap(comparison.baseline, comparison.candidate)) {
    return '➡️ within measured uncertainty'
  }
  if (comparison.percentChange >= 10) return '🚀 significant improvement'
  if (comparison.percentChange > 0) return '✅ improvement'
  if (comparison.percentChange > -10) return '⚠️ regression'
  return '🔴 significant regression'
}

function confidenceIntervalsOverlap(
  baseline: Pick<FlatResult, 'opsPerSec' | 'margin'>,
  candidate: Pick<FlatResult, 'opsPerSec' | 'margin'>
): boolean {
  const baselineInterval = throughputConfidenceInterval(baseline)
  const candidateInterval = throughputConfidenceInterval(candidate)
  return (
    baselineInterval.low <= candidateInterval.high && candidateInterval.low <= baselineInterval.high
  )
}

function throughputConfidenceInterval(result: Pick<FlatResult, 'opsPerSec' | 'margin'>): {
  readonly low: number
  readonly high: number
} {
  // Tinybench reports the relative margin of error for latency. Throughput is
  // its reciprocal, so invert the latency interval instead of applying that
  // percentage symmetrically to the rate.
  const relativeMargin = Math.max(0, result.margin) / 100
  return {
    low: result.opsPerSec / (1 + relativeMargin),
    high: relativeMargin >= 1 ? Number.POSITIVE_INFINITY : result.opsPerSec / (1 - relativeMargin)
  }
}

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ')
}

function isBenchmarkReport(value: unknown): value is ComparisonReport {
  if (!value || typeof value !== 'object') return false
  const report = value as {
    schemaVersion?: unknown
    group?: unknown
    sections?: unknown
    environment?: unknown
  }
  return (
    (report.schemaVersion === 1 || report.schemaVersion === 2) &&
    typeof report.group === 'string' &&
    Array.isArray(report.sections) &&
    report.sections.length > 0 &&
    report.sections.every(
      section => Array.isArray(section.results) && section.results.length > 0
    ) &&
    !!report.environment &&
    typeof report.environment === 'object'
  )
}

export function main(args = process.argv.slice(2)): void {
  if (args.length !== 2) {
    throw new Error('Usage: compare-benchmarks <baseline.json> <candidate.json>')
  }
  const [baselineFilename, candidateFilename] = args
  const baseline = parseBenchmarkReport(readFileSync(baselineFilename, 'utf8'), baselineFilename)
  const candidate = parseBenchmarkReport(readFileSync(candidateFilename, 'utf8'), candidateFilename)
  process.stdout.write(generateComparisonMarkdown(baseline, candidate))
}

const executedDirectly =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (executedDirectly) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
