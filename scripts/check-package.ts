#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

interface PublicApi {
  solveString(sudoku: string): readonly (readonly unknown[])[]
}

interface PackEntry {
  readonly files: readonly { readonly path: string }[]
}

const puzzle = '.....12..1..7...45...43.7...9...63...5.8.7.2...62...9...3.19...97...4..6..25.....'
const unsatisfiable =
  '445981263138762945629435718297156384354897621816243597583619472971324856462578139'
const projectRoot = resolve(import.meta.dirname, '..')

function assertApi(label: string, api: PublicApi): void {
  if (typeof api.solveString !== 'function') {
    throw new Error(`${label} did not expose solveString()`)
  }
  const solutions = api.solveString(puzzle)
  if (solutions.length !== 1 || solutions[0].length !== 81) {
    throw new Error(`${label} did not solve the package smoke puzzle`)
  }
}

function verifyCli(): void {
  const executable = resolve(projectRoot, 'bin/sudoku-solve')
  const solved = spawnSync(process.execPath, [executable, puzzle], {
    cwd: projectRoot,
    encoding: 'utf8'
  })
  if (solved.status !== 0 || !solved.stdout.includes('╭───┬───┬───╮')) {
    throw new Error(`Published CLI smoke failed: ${solved.stderr || solved.stdout}`)
  }

  const rejected = spawnSync(process.execPath, [executable, unsatisfiable], {
    cwd: projectRoot,
    encoding: 'utf8'
  })
  if (rejected.status === 0 || !rejected.stderr.includes('No solution found')) {
    throw new Error('Published CLI did not reject an unsatisfiable puzzle')
  }
}

function verifyPacklist(): void {
  const output = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      npm_config_cache: resolve(tmpdir(), 'sudoku-dlx-npm-pack-cache')
    }
  })
  const parsed: unknown = JSON.parse(output)
  if (!Array.isArray(parsed) || parsed.length !== 1) {
    throw new Error('npm pack did not return one package description')
  }

  const files = (parsed[0] as PackEntry).files.map(file => file.path)
  const required = [
    'bin/sudoku-solve',
    'built/lib/index.js',
    'built/typings/index.d.ts',
    'package.json'
  ]
  for (const filename of required) {
    if (!files.includes(filename)) throw new Error(`npm package is missing ${filename}`)
  }

  const forbidden = ['benchmark/', 'built/dev/', 'lib/', 'scripts/', 'test/']
  const leaked = files.find(filename => forbidden.some(prefix => filename.startsWith(prefix)))
  if (leaked) throw new Error(`Development-only file leaked into npm package: ${leaked}`)
}

async function main(): Promise<void> {
  const imported = (await import('sudoku-dlx')) as PublicApi

  assertApi('ESM import', imported)
  verifyCli()
  verifyPacklist()
  console.log('ESM package export, CLI, and npm packlist are valid.')
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
