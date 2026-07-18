import type {
  BenchmarkCase,
  BenchmarkComparison,
  BenchmarkSemantics,
  BenchmarkTier
} from '../types.js'

interface CaseOptions {
  readonly datasetId: string
  readonly warmupDatasetId?: string
  readonly semantics: BenchmarkSemantics
  readonly tier: BenchmarkTier
  readonly comparison: BenchmarkComparison
}

function benchmarkCase(id: string, name: string, options: CaseOptions): BenchmarkCase {
  return { id, name, ...options }
}

const representative = {
  datasetId: 'representative-64',
  warmupDatasetId: 'representative-warmup-8'
} as const

export const cases = {
  'representative-end-to-end': benchmarkCase(
    'representative-end-to-end',
    'Representative corpus — string to first solution',
    {
      ...representative,
      semantics: 'end-to-end',
      tier: 'end-to-end',
      comparison: 'ranked'
    }
  ),
  'representative-prepared': benchmarkCase(
    'representative-prepared',
    'Representative corpus — parsed input to first solution',
    {
      ...representative,
      semantics: 'prepared',
      tier: 'prepared-input',
      comparison: 'ranked'
    }
  ),
  'representative-compiled-replay': benchmarkCase(
    'representative-compiled-replay',
    'Compiled fixed-puzzle replay — sudoku-dlx capability',
    {
      ...representative,
      semantics: 'prepared',
      tier: 'compiled-replay',
      comparison: 'capability-only'
    }
  ),

  // These small fixtures remain useful as local diagnostics, but are deliberately
  // not headline comparisons: repeatedly sampling one or two puzzle shapes is not
  // representative of an ordinary solve-once workload.
  'easy-end-to-end': benchmarkCase('easy-end-to-end', 'Easy fixed puzzle — end-to-end diagnostic', {
    datasetId: 'easy',
    semantics: 'end-to-end',
    tier: 'end-to-end',
    comparison: 'diagnostic-only'
  }),
  'hard-end-to-end': benchmarkCase('hard-end-to-end', 'Hard fixed puzzle — end-to-end diagnostic', {
    datasetId: 'hard',
    semantics: 'end-to-end',
    tier: 'end-to-end',
    comparison: 'diagnostic-only'
  }),
  'rotating-end-to-end': benchmarkCase(
    'rotating-end-to-end',
    'Small transformed corpus — end-to-end diagnostic',
    {
      datasetId: 'rotating',
      semantics: 'end-to-end',
      tier: 'end-to-end',
      comparison: 'diagnostic-only'
    }
  ),
  'easy-prepared': benchmarkCase('easy-prepared', 'Easy fixed puzzle — prepared diagnostic', {
    datasetId: 'easy',
    semantics: 'prepared',
    tier: 'prepared-input',
    comparison: 'diagnostic-only'
  }),
  'hard-prepared': benchmarkCase('hard-prepared', 'Hard fixed puzzle — prepared diagnostic', {
    datasetId: 'hard',
    semantics: 'prepared',
    tier: 'prepared-input',
    comparison: 'diagnostic-only'
  }),
  'rotating-prepared': benchmarkCase(
    'rotating-prepared',
    'Small transformed corpus — prepared diagnostic',
    {
      datasetId: 'rotating',
      semantics: 'prepared',
      tier: 'prepared-input',
      comparison: 'diagnostic-only'
    }
  )
} as const satisfies Record<string, BenchmarkCase>

export type CaseId = keyof typeof cases

export function getCase(id: string): BenchmarkCase | undefined {
  return cases[id as CaseId]
}
