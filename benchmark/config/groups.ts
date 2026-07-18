import type { BenchmarkGroup } from '../types.js'
import {
  internalEndToEndSolvers,
  internalPreparedSolvers,
  legacySolvers,
  maintainedSolvers,
  nativeAddonSolvers,
  nativePreparedSolvers
} from './solvers.js'

const modernEndToEnd = [...internalEndToEndSolvers, ...maintainedSolvers] as const
const modernPrepared = [...internalPreparedSolvers, ...maintainedSolvers] as const

export const groups = {
  internal: {
    name: 'internal',
    description: 'Public and compiled sudoku-dlx regression benchmarks.',
    matrix: {
      'easy-end-to-end': internalEndToEndSolvers,
      'hard-end-to-end': internalEndToEndSolvers,
      'rotating-end-to-end': internalEndToEndSolvers,
      'easy-prepared': internalPreparedSolvers,
      'hard-prepared': internalPreparedSolvers,
      'rotating-prepared': internalPreparedSolvers
    }
  },
  competitive: {
    name: 'competitive',
    description: 'sudoku-dlx against maintained JavaScript Sudoku solvers.',
    matrix: {
      'easy-end-to-end': modernEndToEnd,
      'hard-end-to-end': modernEndToEnd,
      'rotating-end-to-end': modernEndToEnd,
      'easy-prepared': modernPrepared,
      'hard-prepared': modernPrepared,
      'rotating-prepared': modernPrepared
    }
  },
  legacy: {
    name: 'legacy',
    description: 'Best-effort comparison with optional historical pure-JavaScript packages.',
    matrix: {
      'easy-end-to-end': ['internal-string', ...legacySolvers]
    }
  },
  comprehensive: {
    name: 'comprehensive',
    description: 'All maintained paths plus compatible legacy solvers.',
    matrix: {
      'easy-end-to-end': [...modernEndToEnd, ...legacySolvers],
      'hard-end-to-end': modernEndToEnd,
      'rotating-end-to-end': modernEndToEnd,
      'easy-prepared': modernPrepared,
      'hard-prepared': modernPrepared,
      'rotating-prepared': modernPrepared
    }
  },
  native: {
    name: 'native',
    description: 'Optional historical Node native addons installed under benchmark/native.',
    matrix: {
      'easy-end-to-end': ['internal-string', ...nativeAddonSolvers],
      'hard-end-to-end': ['internal-string', ...nativeAddonSolvers],
      'rotating-end-to-end': ['internal-string', ...nativeAddonSolvers],
      'rotating-prepared': ['internal-compiled-string', ...nativePreparedSolvers]
    }
  }
} as const satisfies Record<string, BenchmarkGroup>

export type GroupId = keyof typeof groups

export function getGroup(id: string): BenchmarkGroup | undefined {
  return groups[id as GroupId]
}
