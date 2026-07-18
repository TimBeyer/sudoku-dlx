import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { arch, cpus, platform, release } from 'node:os'
import { resolve } from 'node:path'
import type { BenchmarkEnvironment } from './types.js'

export function collectEnvironment(projectRoot = process.cwd()): BenchmarkEnvironment {
  const bunVersion = process.versions.bun
  return {
    runtime: bunVersion ? 'bun' : 'node',
    runtimeVersion: bunVersion ?? process.version,
    nodeVersion: process.versions.node,
    v8Version: process.versions.v8,
    os: `${platform()} ${release()}`,
    architecture: arch(),
    cpu: cpus()[0]?.model ?? 'unknown',
    logicalCpus: cpus().length,
    gitSha: readGitSha(projectRoot),
    lockfileSha256: hashFile(resolve(projectRoot, 'package-lock.json'))
  }
}

function readGitSha(projectRoot: string): string | undefined {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
  } catch {
    return undefined
  }
}

function hashFile(filename: string): string | undefined {
  if (!existsSync(filename)) return undefined
  return createHash('sha256').update(readFileSync(filename)).digest('hex')
}
