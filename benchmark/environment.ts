import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { arch, cpus, platform, release } from 'node:os'
import { resolve } from 'node:path'
import type { BenchmarkEnvironment } from './types.js'

export function collectEnvironment(projectRoot = process.cwd()): BenchmarkEnvironment {
  const bunVersion = process.versions.bun
  const git = readGitState(projectRoot)
  return {
    runtime: bunVersion ? 'bun' : 'node',
    runtimeVersion: bunVersion ?? process.version,
    nodeVersion: process.versions.node,
    v8Version: process.versions.v8,
    os: `${platform()} ${release()}`,
    architecture: arch(),
    cpu: cpus()[0]?.model ?? 'unknown',
    logicalCpus: cpus().length,
    ...(git ? { gitSha: git.sha, gitDirty: git.dirty } : {}),
    lockfileSha256: hashFile(resolve(projectRoot, 'package-lock.json'))
  }
}

function readGitState(projectRoot: string): { sha: string; dirty: boolean } | undefined {
  try {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
    const status = execFileSync('git', ['status', '--porcelain=v1'], {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    })
    return { sha, dirty: status.trim().length > 0 }
  } catch {
    return undefined
  }
}

function hashFile(filename: string): string | undefined {
  if (!existsSync(filename)) return undefined
  return createHash('sha256').update(readFileSync(filename)).digest('hex')
}
