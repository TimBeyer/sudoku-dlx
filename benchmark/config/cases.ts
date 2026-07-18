import type { BenchmarkCase } from '../types.js'

function benchmarkCase(
  id: string,
  name: string,
  datasetId: 'easy' | 'hard' | 'rotating',
  semantics: 'end-to-end' | 'prepared'
): BenchmarkCase {
  return { id, name, datasetId, semantics }
}

export const cases = {
  'easy-end-to-end': benchmarkCase(
    'easy-end-to-end',
    'Easy puzzle — end-to-end public API',
    'easy',
    'end-to-end'
  ),
  'hard-end-to-end': benchmarkCase(
    'hard-end-to-end',
    'Hard puzzle — end-to-end public API',
    'hard',
    'end-to-end'
  ),
  'rotating-end-to-end': benchmarkCase(
    'rotating-end-to-end',
    'Easy + hard rotating corpus — end-to-end public API',
    'rotating',
    'end-to-end'
  ),
  'easy-prepared': benchmarkCase(
    'easy-prepared',
    'Easy fixed puzzle — prepared input',
    'easy',
    'prepared'
  ),
  'hard-prepared': benchmarkCase(
    'hard-prepared',
    'Hard fixed puzzle — prepared input',
    'hard',
    'prepared'
  ),
  'rotating-prepared': benchmarkCase(
    'rotating-prepared',
    'Easy + hard rotating corpus — prepared input',
    'rotating',
    'prepared'
  )
} as const satisfies Record<string, BenchmarkCase>

export type CaseId = keyof typeof cases

export function getCase(id: string): BenchmarkCase | undefined {
  return cases[id as CaseId]
}
