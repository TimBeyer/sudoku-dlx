import type { BenchmarkGroup } from '../types.js'
import {
  internalCompiledSolvers,
  internalEndToEndSolvers,
  internalPreparedSolvers,
  legacySolvers,
  maintainedPreparedSolvers,
  maintainedSolvers
} from './solvers.js'

const modernEndToEnd = [...internalEndToEndSolvers, ...maintainedSolvers] as const
const modernPrepared = [...internalPreparedSolvers, ...maintainedPreparedSolvers] as const

export const groups = {
  internal: {
    name: 'internal',
    description: 'Representative public API regressions plus unranked compiled replay.',
    matrix: {
      'representative-end-to-end': internalEndToEndSolvers,
      'representative-prepared': internalPreparedSolvers,
      'representative-compiled-replay': internalCompiledSolvers
    }
  },
  competitive: {
    name: 'competitive',
    description:
      'Direct, solve-once comparisons against maintained npm solvers plus an unranked sudoku-dlx capability section.',
    matrix: {
      'representative-end-to-end': modernEndToEnd,
      'representative-prepared': modernPrepared,
      'representative-compiled-replay': internalCompiledSolvers
    }
  },
  legacy: {
    name: 'legacy',
    description: 'Unranked best-effort observations for optional historical JavaScript packages.',
    matrix: {
      'easy-end-to-end': ['internal-string', ...legacySolvers]
    }
  },
  comprehensive: {
    name: 'comprehensive',
    description:
      'Maintained direct comparisons, unranked compiled replay, and separate historical diagnostics.',
    matrix: {
      'representative-end-to-end': modernEndToEnd,
      'representative-prepared': modernPrepared,
      'representative-compiled-replay': internalCompiledSolvers,
      'easy-end-to-end': ['internal-string', ...legacySolvers]
    }
  }
} as const satisfies Record<string, BenchmarkGroup>

export type GroupId = keyof typeof groups

export function getGroup(id: string): BenchmarkGroup | undefined {
  return groups[id as GroupId]
}
