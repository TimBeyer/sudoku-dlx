#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  BenchmarkEnvironment,
  BenchmarkReport,
  BenchmarkResult,
  BenchmarkSection
} from '../benchmark/types.js'

interface FlatResult extends BenchmarkResult {
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
): BenchmarkReport {
  const value: unknown = JSON.parse(contents)
  if (!isBenchmarkReport(value)) {
    throw new Error(`${filename} is not a sudoku-dlx benchmark schema v1 report`)
  }
  return value
}

export function generateComparisonMarkdown(
  baseline: BenchmarkReport,
  candidate: BenchmarkReport
): string {
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

  let markdown = '## Benchmark comparison\n\n'
  markdown += environmentSummary(baseline.environment, candidate.environment)

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
      markdown += `| ${escapeCell(entry.candidate.name)} | ${formatRate(entry.baseline)} | ${formatRate(entry.candidate)} | ${sign}${entry.percentChange.toFixed(2)}% | ${assessment(entry.percentChange)} |\n`
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

  markdown += `Generated ${new Date().toISOString()}. Both reports use deterministic corpus rotation and pre-timing correctness validation.\n`
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

function flatten(sections: readonly BenchmarkSection[]): FlatResult[] {
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
  const sameMachine =
    baseline.cpu === candidate.cpu &&
    baseline.os === candidate.os &&
    baseline.architecture === candidate.architecture &&
    baseline.runtime === candidate.runtime &&
    baseline.runtimeVersion === candidate.runtimeVersion

  let markdown = sameMachine
    ? 'Environment match: yes.\n\n'
    : '⚠️ Environment mismatch; performance deltas may not be attributable to the code change.\n\n'
  markdown += `- Baseline: ${escapeCell(baseline.cpu)}, ${baseline.runtime} ${baseline.runtimeVersion}, ${baseline.os}\n`
  markdown += `- Candidate: ${escapeCell(candidate.cpu)}, ${candidate.runtime} ${candidate.runtimeVersion}, ${candidate.os}\n\n`
  return markdown
}

function formatRate(result: FlatResult): string {
  return `${result.opsPerSec.toLocaleString('en-US', { maximumFractionDigits: 2 })} ±${result.margin.toFixed(2)}%`
}

function assessment(percentChange: number): string {
  if (percentChange >= 10) return '🚀 significant improvement'
  if (percentChange >= 2) return '✅ improvement'
  if (percentChange > -2) return '➡️ within noise band'
  if (percentChange > -10) return '⚠️ regression'
  return '🔴 significant regression'
}

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ')
}

function isBenchmarkReport(value: unknown): value is BenchmarkReport {
  if (!value || typeof value !== 'object') return false
  const report = value as Partial<BenchmarkReport>
  return (
    report.schemaVersion === 1 &&
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
