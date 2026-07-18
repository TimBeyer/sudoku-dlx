#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { arch, platform } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import {
  AUTORESEARCH_SUDOKU,
  NATIVE_COMPETITION_PINS,
  SCHOKU,
  TDOKU,
  TDOKU_DATA,
  type NativeSourcePin
} from '../benchmark/competition/manifest.js'
import { EASY_PUZZLE } from '../benchmark/datasets/smoke.js'
import {
  getNativeBuildSpecification,
  materializeBuildStep,
  writeNativeBuildReceipt,
  type BuildPaths,
  type NativeBuildSpecification
} from './native-competition/build-receipt.js'
import { validateSolutionFile } from './native-competition/corpus.js'

const execFileAsync = promisify(execFile)

interface SetupOptions {
  readonly cacheDirectory: string
  readonly fetchData: boolean
  readonly checkoutOnly: boolean
  readonly skipAutoresearch: boolean
  readonly skipSchoku: boolean
}

interface VerifiedCheckout {
  readonly directory: string
  readonly origin: string
}

interface BuiltExternalSolver {
  readonly sourcePin: NativeSourcePin
  readonly sourceOrigin: string
  readonly binaryPath: string
}

export async function setupNativeCompetition(options: SetupOptions): Promise<void> {
  assertSafeCacheDirectory(options.cacheDirectory)
  await mkdir(options.cacheDirectory, { recursive: true })

  console.log('Pinned native sources:')
  for (const source of NATIVE_COMPETITION_PINS) {
    console.log(`  ${source.id}: ${source.commit} (${source.license})`)
  }

  const tdokuDirectory = resolve(options.cacheDirectory, 'tdoku')
  const tdokuCheckout = await ensureCheckout(TDOKU, tdokuDirectory)

  let autoresearchCheckout: VerifiedCheckout | undefined
  if (!options.skipAutoresearch) {
    autoresearchCheckout = await ensureCheckout(
      AUTORESEARCH_SUDOKU,
      resolve(options.cacheDirectory, 'autoresearch-sudoku')
    )
  }

  let schokuCheckout: VerifiedCheckout | undefined
  if (!options.skipSchoku) {
    schokuCheckout = await ensureCheckout(SCHOKU, resolve(options.cacheDirectory, 'schoku'))
  }

  if (options.fetchData) await fetchTdokuData(tdokuDirectory)
  if (options.checkoutOnly) {
    console.log('Checkout complete; build and smoke checks were skipped by request.')
    return
  }

  const projectRoot = resolveProjectRoot()
  const binariesDirectory = resolve(options.cacheDirectory, 'bin')
  await mkdir(binariesDirectory, { recursive: true })

  const tdokuBinary = await buildTdoku(tdokuCheckout.directory, binariesDirectory, projectRoot)
  const externalBuilds: BuiltExternalSolver[] = [
    {
      sourcePin: TDOKU,
      sourceOrigin: tdokuCheckout.origin,
      binaryPath: tdokuBinary
    }
  ]
  const binaries: Array<{ id: string; command: string; args?: readonly string[] }> = [
    {
      id: 'sudoku-dlx',
      command: process.execPath,
      args: [
        resolve(dirname(fileURLToPath(import.meta.url)), 'native-competition/sudoku-dlx-runner.js')
      ]
    },
    { id: 'tdoku', command: tdokuBinary }
  ]

  if (autoresearchCheckout) {
    const binary = await buildAutoresearch(
      autoresearchCheckout.directory,
      binariesDirectory,
      projectRoot
    )
    binaries.push({ id: AUTORESEARCH_SUDOKU.id, command: binary })
    externalBuilds.push({
      sourcePin: AUTORESEARCH_SUDOKU,
      sourceOrigin: autoresearchCheckout.origin,
      binaryPath: binary
    })
  }

  if (schokuCheckout) {
    assertSchokuPlatform()
    const binary = await buildSchoku(schokuCheckout.directory, binariesDirectory, projectRoot)
    binaries.push({ id: SCHOKU.id, command: binary })
    externalBuilds.push({
      sourcePin: SCHOKU,
      sourceOrigin: schokuCheckout.origin,
      binaryPath: binary
    })
  }

  await smokeBatchRunners(binaries, options.cacheDirectory)
  for (const build of externalBuilds) {
    const verified = await writeNativeBuildReceipt({
      cacheDirectory: options.cacheDirectory,
      projectRoot,
      sourcePin: build.sourcePin,
      sourceOrigin: build.sourceOrigin,
      binaryPath: build.binaryPath
    })
    console.log(
      `Recorded ${build.sourcePin.id} build receipt ${verified.sha256} at ${verified.path}`
    )
  }

  console.log(`Native competition setup complete in ${options.cacheDirectory}`)
}

async function ensureCheckout(
  source: NativeSourcePin,
  directory: string
): Promise<VerifiedCheckout> {
  if (!existsSync(directory)) {
    await mkdir(dirname(directory), { recursive: true })
    await run('git', ['clone', '--filter=blob:none', '--no-checkout', source.repository, directory])
  } else if (!existsSync(resolve(directory, '.git'))) {
    throw new Error(`Refusing to reuse non-Git directory: ${directory}`)
  }

  const { stdout: origin } = await run('git', ['remote', 'get-url', 'origin'], directory)
  if (normalizeRepository(origin.trim()) !== normalizeRepository(source.repository)) {
    throw new Error(`${source.id} origin does not match its pinned repository: ${origin.trim()}`)
  }

  const safeGit = ['-c', 'core.hooksPath=/dev/null']
  await run('git', [...safeGit, 'fetch', '--depth=1', 'origin', source.commit], directory)
  await run('git', [...safeGit, 'checkout', '--detach', source.commit], directory)
  const { stdout } = await run('git', ['rev-parse', 'HEAD'], directory)
  if (stdout.trim() !== source.commit) {
    throw new Error(`${source.id} checkout verification failed: expected ${source.commit}`)
  }
  const { stdout: changes } = await run(
    'git',
    [...safeGit, 'status', '--porcelain=v1', '--untracked-files=no'],
    directory
  )
  if (changes.trim()) throw new Error(`${source.id} checkout contains modified tracked files`)
  return { directory, origin: origin.trim() }
}

function normalizeRepository(repository: string): string {
  return repository.replace(/\/$/, '').replace(/\.git$/, '')
}

async function buildTdoku(
  directory: string,
  binariesDirectory: string,
  projectRoot: string
): Promise<string> {
  console.log('Building pinned Tdoku with the common batch adapter')
  const specification = getNativeBuildSpecification(TDOKU.id)
  const buildsDirectory = resolve(dirname(binariesDirectory), 'builds')
  await mkdir(buildsDirectory, { recursive: true })
  const buildDirectory = await mkdtemp(resolve(buildsDirectory, 'tdoku-'))
  const binary = resolve(binariesDirectory, specification.binaryName)
  await executeBuild(
    specification,
    buildPaths(specification, projectRoot, directory, buildDirectory, binary)
  )
  return binary
}

async function buildAutoresearch(
  directory: string,
  binariesDirectory: string,
  projectRoot: string
): Promise<string> {
  console.log('Building pinned autoresearch-sudoku with the common batch adapter')
  const specification = getNativeBuildSpecification(AUTORESEARCH_SUDOKU.id)
  const binary = resolve(binariesDirectory, specification.binaryName)
  await executeBuild(
    specification,
    buildPaths(specification, projectRoot, directory, binariesDirectory, binary)
  )
  return binary
}

async function buildSchoku(
  directory: string,
  binariesDirectory: string,
  projectRoot: string
): Promise<string> {
  console.log('Building pinned Schoku library with the common single-threaded batch adapter')
  const specification = getNativeBuildSpecification(SCHOKU.id)
  const buildsDirectory = resolve(dirname(binariesDirectory), 'builds')
  await mkdir(buildsDirectory, { recursive: true })
  const buildDirectory = await mkdtemp(resolve(buildsDirectory, 'schoku-'))
  const binary = resolve(binariesDirectory, specification.binaryName)
  await executeBuild(
    specification,
    buildPaths(specification, projectRoot, directory, buildDirectory, binary)
  )
  return binary
}

function buildPaths(
  specification: NativeBuildSpecification,
  projectRoot: string,
  source: string,
  build: string,
  binary: string
): BuildPaths {
  return {
    source,
    build,
    binary,
    adapter: resolve(projectRoot, specification.adapterPath)
  }
}

async function executeBuild(
  specification: NativeBuildSpecification,
  paths: BuildPaths
): Promise<void> {
  for (const declaredStep of specification.steps) {
    const step = materializeBuildStep(declaredStep, paths)
    await run(step.tool, step.arguments, undefined, step.environment)
  }
}

async function smokeBatchRunners(
  binaries: readonly { id: string; command: string; args?: readonly string[] }[],
  cacheDirectory: string
): Promise<void> {
  const smokeDirectory = resolve(cacheDirectory, 'smoke')
  await mkdir(smokeDirectory, { recursive: true })
  const puzzleFile = resolve(smokeDirectory, 'puzzles.txt')
  await writeFile(puzzleFile, `${EASY_PUZZLE}\n`)

  for (const binary of binaries) {
    const solutionFile = resolve(smokeDirectory, `${binary.id}-solutions.txt`)
    console.log(`Smoke-checking ${binary.id} through the common validated batch boundary`)
    await run(binary.command, [...(binary.args ?? []), puzzleFile, solutionFile], undefined, {
      OMP_NUM_THREADS: '1'
    })
    await validateSolutionFile(binary.id, solutionFile, [EASY_PUZZLE])
  }
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
      'Schoku fc64877 requires Linux/x86-64 plus OpenMP, AVX2, BMI/BMI2, and LZCNT; rerun with --skip-schoku'
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
  cwd?: string,
  environment?: NodeJS.ProcessEnv
): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync(command, [...args], {
      cwd,
      env: environment === undefined ? process.env : { ...process.env, ...environment },
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
    skipAutoresearch: args.includes('--skip-autoresearch'),
    skipSchoku: args.includes('--skip-schoku'),
    help: args.includes('--help') || args.includes('-h')
  }
}

function showUsage(): void {
  console.log(`Usage: setup-native-competition [options]

  --data             Download, checksum, and extract the pinned Tdoku corpus
  --checkout-only    Verify source pins without building or smoke-testing
  --skip-autoresearch
                     Skip the Rust challenger (requires rustc)
  --skip-schoku      Skip the GPL Schoku checkout (required off Linux/x86-64)
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
