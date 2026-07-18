import { expect } from 'chai'
import { calculateCorpusThroughput, createIsomorphicCorpus } from '../../benchmark/runner.js'
import {
  REPRESENTATIVE_CORPUS,
  REPRESENTATIVE_WARMUP_CORPUS
} from '../../benchmark/datasets/representative.js'
import type { BenchmarkReport, BenchmarkSection } from '../../benchmark/types.js'
import {
  generateComparisonMarkdown,
  type ComparisonReport
} from '../../scripts/compare-benchmarks.js'
import { generateBenchmarkMarkdown } from '../../scripts/update-benchmark-docs.js'

const ENVIRONMENT = {
  runtime: 'node',
  runtimeVersion: '24.0.0',
  nodeVersion: '24.0.0',
  os: 'test',
  architecture: 'x64',
  cpu: 'test cpu',
  logicalCpus: 1
} as const

const PUBLISHING_ENVIRONMENT = {
  ...ENVIRONMENT,
  gitSha: 'benchmark-commit',
  gitDirty: false,
  lockfileSha256: 'benchmark-lockfile'
} as const

function section(
  comparison: BenchmarkSection['comparison'],
  tier: BenchmarkSection['tier']
): BenchmarkSection {
  return {
    caseId: `${tier}-case`,
    benchmarkName: `${tier} benchmark`,
    datasetId: 'representative-64',
    warmupDatasetId: 'representative-warmup-8',
    semantics: tier === 'end-to-end' ? 'end-to-end' : 'prepared',
    tier,
    comparison,
    puzzleCount: 64,
    warmupPuzzleCount: 8,
    timedOperation: 'complete-corpus-pass',
    inputSchedule:
      comparison === 'ranked'
        ? 'fresh-deterministic-digit-isomorph-v1-per-pass'
        : 'fixed-corpus-replay',
    executionOrder: ['internal-string'],
    results: [
      {
        solverId: 'internal-string',
        name: 'sudoku-dlx solveString',
        opsPerSec: 20,
        margin: 1,
        runs: 5,
        totalPuzzles: 320,
        elapsedMs: 16_000,
        unit: 'puzzles/sec'
      }
    ]
  }
}

function report(sections: readonly BenchmarkSection[]): BenchmarkReport {
  return {
    schemaVersion: 2,
    generatedAt: '2026-07-18T00:00:00.000Z',
    group: 'test',
    environment: ENVIRONMENT,
    configuration: {
      timeMs: 500,
      warmupMs: 100,
      order: 'sequential-case-rotated',
      taskIsolation: 'one-solver-per-benchmark-instance',
      timedOperation: 'complete-corpus-pass',
      rate: 'total-puzzles-per-total-elapsed-time',
      warmup: 'explicit-or-derived-disjoint-corpus',
      validation: 'warmup-before-and-last-timed-pass-after',
      rankedInputSchedule: 'fresh-deterministic-digit-isomorph-v1-per-pass'
    },
    datasets: [
      {
        id: 'representative-64',
        name: 'measured',
        description: 'test',
        source: 'test',
        license: 'MIT',
        sha256: 'measured-sha'
      },
      {
        id: 'representative-warmup-8',
        name: 'warmup',
        description: 'test',
        source: 'test',
        license: 'MIT',
        sha256: 'warmup-sha'
      }
    ],
    solvers: [],
    sections,
    skipped: []
  }
}

function publishingReport(
  group: 'competitive' | 'wasm',
  sections: readonly BenchmarkSection[]
): BenchmarkReport {
  const sharedSolver = {
    id: 'internal-string',
    name: 'sudoku-dlx solveString',
    version: 'workspace',
    license: 'MIT',
    runtime: 'javascript',
    optional: false
  } as const
  return {
    ...report(sections),
    group,
    environment: PUBLISHING_ENVIRONMENT,
    solvers:
      group === 'wasm'
        ? [
            sharedSolver,
            {
              id: 'pyroth-sodo-wasm',
              name: '@pyroth/sodo (Wasm)',
              version: '0.2.1',
              license: 'MIT',
              runtime: 'wasm',
              optional: false
            }
          ]
        : [sharedSolver]
  }
}

function wasmSection(): BenchmarkSection {
  const value = section('ranked', 'end-to-end')
  return {
    ...value,
    executionOrder: ['internal-string', 'pyroth-sodo-wasm'],
    results: [
      {
        ...value.results[0],
        solverId: 'internal-string',
        name: 'sudoku-dlx solveString',
        opsPerSec: 60_000
      },
      {
        ...value.results[0],
        solverId: 'pyroth-sodo-wasm',
        name: '@pyroth/sodo (Wasm)',
        opsPerSec: 1_400
      }
    ]
  }
}

describe('benchmark measurement contract', function () {
  it('computes corpus throughput from total work and total elapsed time', function () {
    expect(calculateCorpusThroughput(8, 5, 2_000)).to.equal(20)
  })

  it('rejects invalid corpus throughput inputs', function () {
    expect(() => calculateCorpusThroughput(0, 1, 1)).to.throw('puzzleCount')
    expect(() => calculateCorpusThroughput(1, 0, 1)).to.throw('runs')
    expect(() => calculateCorpusThroughput(1, 1, 0)).to.throw('elapsedMs')
  })

  it('keeps measured and warmup corpora independent and disjoint', function () {
    expect(REPRESENTATIVE_CORPUS).to.have.length(64)
    expect(REPRESENTATIVE_WARMUP_CORPUS).to.have.length(8)
    expect(new Set(REPRESENTATIVE_CORPUS).size).to.equal(64)
    expect(new Set(REPRESENTATIVE_WARMUP_CORPUS).size).to.equal(8)

    const measuredMasks = new Set(
      REPRESENTATIVE_CORPUS.map(puzzle => puzzle.replace(/[1-9]/g, 'x'))
    )
    expect(measuredMasks.size).to.equal(REPRESENTATIVE_CORPUS.length)
    for (const puzzle of REPRESENTATIVE_CORPUS) {
      expect(new Set(puzzle.replaceAll('.', '')).size).to.be.at.least(8)
    }

    const measured = new Set<string>(REPRESENTATIVE_CORPUS)
    for (const puzzle of REPRESENTATIVE_WARMUP_CORPUS) {
      expect(measured.has(puzzle)).to.equal(false)
      expect(measuredMasks.has(puzzle.replace(/[1-9]/g, 'x'))).to.equal(false)
    }
  })

  it('gives every ranked pass fresh exact puzzle strings without changing clue masks', function () {
    const passes = [0, 1, 2, 1_000, 362_879].map(pass =>
      createIsomorphicCorpus(REPRESENTATIVE_CORPUS, pass)
    )
    const exactInputs = new Set(passes.flat())

    expect(exactInputs.size).to.equal(passes.length * REPRESENTATIVE_CORPUS.length)
    for (let pass = 0; pass < passes.length; pass++) {
      for (let puzzle = 0; puzzle < REPRESENTATIVE_CORPUS.length; puzzle++) {
        expect(passes[pass][puzzle].replace(/[1-9]/g, 'x')).to.equal(
          REPRESENTATIVE_CORPUS[puzzle].replace(/[1-9]/g, 'x')
        )
      }
    }
    expect(() => createIsomorphicCorpus(REPRESENTATIVE_CORPUS, 362_880)).to.throw(
      'ranked benchmark pass'
    )
  })

  it('does not attach winner language to compiled replay capabilities', function () {
    const markdown = generateBenchmarkMarkdown(
      report([section('capability-only', 'compiled-replay')])
    )

    expect(markdown).to.include('Capability only')
    expect(markdown).not.to.include('fastest')
    expect(markdown).not.to.include('| Relative |')
  })

  it('renders Wasm results as a separately labelled steady-state runtime comparison', function () {
    const competitive = publishingReport('competitive', [section('ranked', 'end-to-end')])
    const wasm = publishingReport('wasm', [wasmSection()])

    const markdown = generateBenchmarkMarkdown(competitive, wasm)
    const wasmHeading = markdown.indexOf('### Alternative runtime — WebAssembly steady state')

    expect(wasmHeading).to.be.greaterThan(markdown.indexOf('end-to-end benchmark'))
    expect(markdown.slice(0, wasmHeading)).not.to.include('@pyroth/sodo (Wasm)')
    expect(markdown.slice(wasmHeading)).to.include('@pyroth/sodo (Wasm)')
    expect(markdown.slice(wasmHeading)).to.include('representative-64')
    expect(markdown.slice(wasmHeading)).to.include('fresh-deterministic-digit-isomorph-v1-per-pass')
    expect(markdown.slice(wasmHeading)).to.match(
      /one-time (Wasm|WebAssembly) initialization .*excluded/i
    )
    expect(markdown.slice(wasmHeading)).to.match(/per-call string marshalling .*timed/i)
    expect(markdown.slice(wasmHeading)).to.match(/not a cold-start/i)
  })

  it('refuses a stale Wasm report from another repository revision', function () {
    const competitive = publishingReport('competitive', [section('ranked', 'end-to-end')])
    const wasm: BenchmarkReport = {
      ...publishingReport('wasm', [wasmSection()]),
      environment: {
        ...PUBLISHING_ENVIRONMENT,
        gitSha: 'stale-commit'
      }
    }

    expect(() => generateBenchmarkMarkdown(competitive, wasm)).to.throw(
      /repository|revision|commit|git/i
    )
  })

  it('refuses a Wasm report produced from a different dependency lockfile', function () {
    const competitive = publishingReport('competitive', [section('ranked', 'end-to-end')])
    const wasm: BenchmarkReport = {
      ...publishingReport('wasm', [wasmSection()]),
      environment: {
        ...PUBLISHING_ENVIRONMENT,
        lockfileSha256: 'other-lockfile'
      }
    }

    expect(() => generateBenchmarkMarkdown(competitive, wasm)).to.throw(/lockfile/i)
  })

  it('refuses a Wasm report measured against a different corpus revision', function () {
    const competitive = publishingReport('competitive', [section('ranked', 'end-to-end')])
    const wasmBase = publishingReport('wasm', [wasmSection()])
    const wasm: BenchmarkReport = {
      ...wasmBase,
      datasets: wasmBase.datasets.map(dataset =>
        dataset.id === 'representative-64' ? { ...dataset, sha256: 'other-corpus' } : dataset
      )
    }

    expect(() => generateBenchmarkMarkdown(competitive, wasm)).to.throw(/dataset|corpus|sha/i)
  })

  it('requires the competitive and Wasm report group identities', function () {
    const competitive = publishingReport('competitive', [section('ranked', 'end-to-end')])
    const mislabeledWasm: BenchmarkReport = {
      ...publishingReport('wasm', [wasmSection()]),
      group: 'comprehensive'
    }

    expect(() => generateBenchmarkMarkdown(competitive, mislabeledWasm)).to.throw(/group|wasm/i)
  })

  it('refuses paired reports without enough provenance to prove they match', function () {
    const competitive = publishingReport('competitive', [section('ranked', 'end-to-end')])
    const wasm: BenchmarkReport = {
      ...publishingReport('wasm', [wasmSection()]),
      environment: ENVIRONMENT
    }

    expect(() => generateBenchmarkMarkdown(competitive, wasm)).to.throw(
      /provenance|repository|commit|git|lockfile/i
    )
  })

  it('refuses paired reports from different benchmark environments', function () {
    const competitive = publishingReport('competitive', [section('ranked', 'end-to-end')])
    const wasm: BenchmarkReport = {
      ...publishingReport('wasm', [wasmSection()]),
      environment: {
        ...PUBLISHING_ENVIRONMENT,
        cpu: 'other cpu'
      }
    }

    expect(() => generateBenchmarkMarkdown(competitive, wasm)).to.throw(/environment|cpu/i)
  })

  it('refuses paired reports measured with different benchmark settings', function () {
    const competitive = publishingReport('competitive', [section('ranked', 'end-to-end')])
    const wasmBase = publishingReport('wasm', [wasmSection()])
    const wasm: BenchmarkReport = {
      ...wasmBase,
      configuration: {
        ...wasmBase.configuration,
        timeMs: wasmBase.configuration.timeMs * 2
      }
    }

    expect(() => generateBenchmarkMarkdown(competitive, wasm)).to.throw(/configuration|timing/i)
  })

  it('refuses to compare rates across measurement schema versions', function () {
    const current = report([section('ranked', 'end-to-end')])
    const legacy: ComparisonReport = {
      schemaVersion: 1,
      group: 'test',
      environment: ENVIRONMENT,
      sections: current.sections
    }

    const markdown = generateComparisonMarkdown(legacy, current)
    expect(markdown).to.include('Benchmark contracts differ')
    expect(markdown).to.include('intentionally not compared')
    expect(markdown).not.to.include('Change | Assessment')
  })

  it('refuses to compare schema-v2 rates when a dataset hash changes', function () {
    const baseline = report([section('ranked', 'end-to-end')])
    const candidate: BenchmarkReport = {
      ...baseline,
      datasets: baseline.datasets.map(dataset =>
        dataset.id === 'representative-64' ? { ...dataset, sha256: 'changed' } : dataset
      )
    }

    const markdown = generateComparisonMarkdown(baseline, candidate)
    expect(markdown).to.include('Benchmark contracts differ')
    expect(markdown).to.include('SHA-256 changed')
    expect(markdown).not.to.include('Change | Assessment')
  })

  it('refuses to compare schema-v2 rates when solver execution order changes', function () {
    const baseline = report([section('ranked', 'end-to-end')])
    const candidate: BenchmarkReport = {
      ...baseline,
      sections: baseline.sections.map(value => ({
        ...value,
        executionOrder: ['other-solver', ...value.executionOrder]
      }))
    }

    const markdown = generateComparisonMarkdown(baseline, candidate)
    expect(markdown).to.include('changed solver execution order')
    expect(markdown).not.to.include('Change | Assessment')
  })

  it('does not call a change an improvement when confidence intervals overlap', function () {
    const baseline = report([section('ranked', 'end-to-end')])
    const candidate: BenchmarkReport = {
      ...baseline,
      sections: baseline.sections.map(value => ({
        ...value,
        results: value.results.map(result => ({
          ...result,
          opsPerSec: result.opsPerSec * 1.021,
          margin: 5
        }))
      }))
    }
    const noisyBaseline: BenchmarkReport = {
      ...baseline,
      sections: baseline.sections.map(value => ({
        ...value,
        results: value.results.map(result => ({ ...result, margin: 5 }))
      }))
    }

    const markdown = generateComparisonMarkdown(noisyBaseline, candidate)
    expect(markdown).to.include('within measured uncertainty')
    expect(markdown).not.to.include('✅ improvement')
  })
})
