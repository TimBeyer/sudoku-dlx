export type BenchmarkSemantics = 'end-to-end' | 'prepared'

export interface DatasetDefinition {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly source: string
  readonly license: string
  readonly sha256: string
  readonly puzzles: readonly string[]
}

export interface SolverMetadata {
  readonly id: string
  readonly name: string
  readonly version: string
  readonly source?: string
  readonly sourceCommit?: string
  readonly license: string
  readonly runtime: 'javascript' | 'native-addon'
  readonly optional: boolean
}

export interface SolverAvailability {
  readonly available: boolean
  readonly reason?: string
}

export interface SudokuSolverAdapter<TPrepared = unknown> {
  readonly metadata: SolverMetadata
  readonly semantics: readonly BenchmarkSemantics[]
  initialize?(): Promise<SolverAvailability | void>
  availability?(): SolverAvailability
  prepare(puzzle: string): TPrepared
  solveEndToEnd?(puzzle: string): unknown
  solvePrepared?(prepared: TPrepared): unknown
  normalize(result: unknown): readonly number[] | null
  consume(result: unknown): number
}

export type SolverFactory = () => SudokuSolverAdapter<any>

export interface BenchmarkCase {
  readonly id: string
  readonly name: string
  readonly datasetId: string
  readonly semantics: BenchmarkSemantics
}

export interface BenchmarkGroup {
  readonly name: string
  readonly description: string
  readonly matrix: Readonly<Record<string, readonly string[]>>
}

export interface BenchmarkOptions {
  readonly group: string
  readonly jsonOutput: boolean
  readonly jsonFile?: string
  readonly quiet: boolean
  readonly timeMs: number
  readonly warmupMs: number
}

export interface BenchmarkResult {
  readonly solverId: string
  readonly name: string
  readonly opsPerSec: number
  readonly margin: number
  readonly runs: number
  readonly unit: 'puzzles/sec'
}

export interface BenchmarkSection {
  readonly caseId: string
  readonly benchmarkName: string
  readonly datasetId: string
  readonly semantics: BenchmarkSemantics
  readonly puzzleCount: number
  readonly results: readonly BenchmarkResult[]
}

export interface SkippedBenchmark {
  readonly caseId: string
  readonly solverId: string
  readonly reason: string
}

export interface BenchmarkEnvironment {
  readonly runtime: 'node' | 'bun'
  readonly runtimeVersion: string
  readonly nodeVersion: string
  readonly v8Version?: string
  readonly os: string
  readonly architecture: string
  readonly cpu: string
  readonly logicalCpus: number
  readonly gitSha?: string
  readonly lockfileSha256?: string
}

export interface BenchmarkReport {
  readonly schemaVersion: 1
  readonly generatedAt: string
  readonly group: string
  readonly environment: BenchmarkEnvironment
  readonly configuration: {
    readonly timeMs: number
    readonly warmupMs: number
    readonly order: 'deterministic-round-robin'
    readonly validation: 'all-puzzles-before-timing'
  }
  readonly datasets: readonly Omit<DatasetDefinition, 'puzzles'>[]
  readonly solvers: readonly SolverMetadata[]
  readonly sections: readonly BenchmarkSection[]
  readonly skipped: readonly SkippedBenchmark[]
}
