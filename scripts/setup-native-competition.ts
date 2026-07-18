#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { arch, platform } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import {
  NATIVE_COMPETITION_PINS,
  SCHOKU,
  TDOKU,
  TDOKU_DATA,
  type NativeSourcePin
} from '../benchmark/competition/manifest.js'
import { EASY_PUZZLE } from '../benchmark/datasets/smoke.js'

const execFileAsync = promisify(execFile)

interface SetupOptions {
  readonly cacheDirectory: string
  readonly fetchData: boolean
  readonly checkoutOnly: boolean
  readonly skipSchoku: boolean
}

export async function setupNativeCompetition(options: SetupOptions): Promise<void> {
  assertSafeCacheDirectory(options.cacheDirectory)
  await mkdir(options.cacheDirectory, { recursive: true })

  console.log('Pinned native sources:')
  for (const source of NATIVE_COMPETITION_PINS) {
    console.log(`  ${source.id}: ${source.commit} (${source.license})`)
  }

  const tdokuDirectory = resolve(options.cacheDirectory, 'tdoku')
  await ensureCheckout(TDOKU, tdokuDirectory)

  let schokuDirectory: string | undefined
  if (!options.skipSchoku) {
    schokuDirectory = resolve(options.cacheDirectory, 'schoku')
    await ensureCheckout(SCHOKU, schokuDirectory)
  }

  if (options.fetchData) await fetchTdokuData(tdokuDirectory)
  if (options.checkoutOnly) {
    console.log('Checkout complete; build and smoke checks were skipped by request.')
    return
  }

  await buildTdoku(tdokuDirectory)
  await smokeTdoku(tdokuDirectory, options.cacheDirectory)

  if (schokuDirectory) {
    assertSchokuPlatform()
    await buildSchoku(schokuDirectory)
    await smokeSchoku(schokuDirectory, options.cacheDirectory)
  }

  console.log(`Native competition setup complete in ${options.cacheDirectory}`)
}

async function ensureCheckout(source: NativeSourcePin, directory: string): Promise<void> {
  if (!existsSync(directory)) {
    await mkdir(dirname(directory), { recursive: true })
    await run('git', ['clone', '--filter=blob:none', '--no-checkout', source.repository, directory])
  } else if (!existsSync(resolve(directory, '.git'))) {
    throw new Error(`Refusing to reuse non-Git directory: ${directory}`)
  }

  await run('git', ['fetch', '--depth=1', 'origin', source.commit], directory)
  await run('git', ['checkout', '--detach', source.commit], directory)
  const { stdout } = await run('git', ['rev-parse', 'HEAD'], directory)
  if (stdout.trim() !== source.commit) {
    throw new Error(`${source.id} checkout verification failed: expected ${source.commit}`)
  }
}

async function buildTdoku(directory: string): Promise<void> {
  console.log('Building pinned Tdoku benchmark runner')
  await run('./BUILD.sh', ['run_benchmark', '-DOPT=3'], directory)
}

async function buildSchoku(directory: string): Promise<void> {
  console.log('Building pinned Schoku speed branch')
  await run('make', [], resolve(directory, 'src'))
}

async function smokeTdoku(directory: string, cacheDirectory: string): Promise<void> {
  const puzzleFile = resolve(cacheDirectory, 'smoke-puzzles.txt')
  await writeFile(puzzleFile, `${EASY_PUZZLE}\n`)
  console.log('Smoke-checking Tdoku with validation enabled')
  await run(resolve(directory, 'build/run_benchmark'), [
    '-f',
    '-e',
    '1',
    '-n',
    '1',
    '-r1',
    '-t',
    '1',
    '-w',
    '1',
    '-v1',
    '-s',
    'tdoku',
    puzzleFile
  ])
}

async function smokeSchoku(directory: string, cacheDirectory: string): Promise<void> {
  const puzzleFile = resolve(cacheDirectory, 'smoke-puzzles.txt')
  const solutionFile = resolve(cacheDirectory, 'smoke-schoku-solutions.txt')
  console.log('Smoke-checking single-threaded Schoku with validation enabled')
  await run(resolve(directory, 'src/schoku'), ['-rO', '-t1', '-v', '-y', puzzleFile, solutionFile])
}

async function fetchTdokuData(tdokuDirectory: string): Promise<void> {
  const archive = resolve(tdokuDirectory, 'data.zip')
  if (existsSync(archive)) {
    const existingHash = sha256(await readFile(archive))
    if (existingHash !== TDOKU_DATA.sha256) {
      throw new Error(`Existing ${archive} does not match the pinned dataset checksum`)
    }
  } else {
    console.log(`Downloading pinned Tdoku datasets from ${TDOKU_DATA.url}`)
    const response = await fetch(TDOKU_DATA.url)
    if (!response.ok) throw new Error(`Dataset download failed: HTTP ${response.status}`)
    const contents = Buffer.from(await response.arrayBuffer())
    const downloadedHash = sha256(contents)
    if (downloadedHash !== TDOKU_DATA.sha256) {
      throw new Error(`Dataset checksum mismatch: received ${downloadedHash}`)
    }
    await writeFile(archive, contents)
  }

  if (!existsSync(resolve(tdokuDirectory, 'data/puzzles2_17_clue'))) {
    console.log('Extracting checksum-verified Tdoku datasets')
    await run('unzip', ['-oq', archive, '-d', tdokuDirectory])
  }
}

function sha256(contents: Uint8Array): string {
  return createHash('sha256').update(contents).digest('hex')
}

function assertSchokuPlatform(): void {
  if (platform() !== 'linux' || arch() !== 'x64') {
    throw new Error(
      'Schoku fc64877 requires Linux/x86-64 plus OpenMP, AVX2, BMI/BMI2, and LZCNT; rerun with --skip-schoku to set up Tdoku only'
    )
  }
}

function assertSafeCacheDirectory(directory: string): void {
  const resolved = resolve(directory)
  const projectRoot = resolveProjectRoot()
  if (resolved === '/' || resolved === projectRoot || resolved === resolve(projectRoot, '..')) {
    throw new Error(`Refusing unsafe native benchmark cache path: ${resolved}`)
  }
}

async function run(
  command: string,
  args: readonly string[],
  cwd?: string
): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync(command, [...args], {
      cwd,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024
    })
    if (result.stdout.trim()) console.log(result.stdout.trim())
    if (result.stderr.trim()) console.error(result.stderr.trim())
    return result
  } catch (error) {
    const details = commandErrorDetails(error)
    throw new Error(`Command failed: ${command} ${args.join(' ')}${details}`, { cause: error })
  }
}

function commandErrorDetails(error: unknown): string {
  if (!error || typeof error !== 'object') return `\n${String(error)}`
  const candidate = error as { message?: string; stdout?: string; stderr?: string }
  return [candidate.message, candidate.stdout, candidate.stderr]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map(value => `\n${value.trim()}`)
    .join('')
}

function resolveProjectRoot(): string {
  let directory = dirname(fileURLToPath(import.meta.url))
  for (let depth = 0; depth < 5; depth++) {
    if (existsSync(resolve(directory, 'package.json'))) return directory
    const parent = dirname(directory)
    if (parent === directory) break
    directory = parent
  }
  throw new Error('Could not locate the sudoku-dlx project root')
}

function parseOptions(args = process.argv.slice(2)): SetupOptions & { help: boolean } {
  const projectRoot = resolveProjectRoot()
  const cacheArgument = args.find(argument => argument.startsWith('--cache='))?.slice(8)
  return {
    cacheDirectory: resolve(projectRoot, cacheArgument ?? '.benchmark-cache/sudoku-native'),
    fetchData: args.includes('--data'),
    checkoutOnly: args.includes('--checkout-only'),
    skipSchoku: args.includes('--skip-schoku'),
    help: args.includes('--help') || args.includes('-h')
  }
}

function showUsage(): void {
  console.log(`Usage: setup-native-competition [options]

  --data             Download, checksum, and extract the pinned Tdoku corpus
  --checkout-only    Verify source pins without building or smoke-testing
  --skip-schoku      Set up only the BSD-licensed Tdoku checkout
  --cache=<path>     Cache location (default: .benchmark-cache/sudoku-native)
  --help             Show this help`)
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const options = parseOptions(args)
  if (options.help) {
    showUsage()
    return
  }
  await setupNativeCompetition(options)
}

const executedDirectly =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (executedDirectly) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
