import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { access, mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { delimiter, isAbsolute, relative, resolve } from 'node:path'
import { promisify } from 'node:util'
import type { NativeSourcePin } from '../../benchmark/competition/manifest.js'

const execFileAsync = promisify(execFile)

export type ExternalNativeSolverId = 'autoresearch-sudoku' | 'tdoku' | 'schoku'

export interface NativeBuildStep {
  readonly tool: string
  readonly arguments: readonly string[]
  readonly environment?: Readonly<Record<string, string>>
}

export interface NativeBuildSpecification {
  readonly id: ExternalNativeSolverId
  readonly binaryName: string
  readonly adapterPath: string
  readonly profile: string
  readonly tools: readonly {
    readonly role: 'compiler' | 'build-system'
    readonly command: string
    readonly versionArguments: readonly string[]
  }[]
  /** Exact commands with cache-specific paths replaced by stable placeholders. */
  readonly steps: readonly NativeBuildStep[]
}

export interface NativeBuildReceipt {
  readonly schemaVersion: 1
  readonly source: {
    readonly id: ExternalNativeSolverId
    readonly origin: string
    readonly commit: string
  }
  readonly adapter: {
    readonly path: string
    readonly sha256: string
  }
  readonly tools: readonly {
    readonly role: 'compiler' | 'build-system'
    readonly command: string
    readonly path: string
    readonly version: string
  }[]
  readonly build: {
    readonly profile: string
    readonly steps: readonly NativeBuildStep[]
  }
  readonly binary: {
    readonly path: string
    readonly sha256: string
  }
}

export interface VerifiedNativeBuildReceipt {
  readonly path: string
  readonly sha256: string
  readonly receipt: NativeBuildReceipt
}

export interface BuildPaths {
  readonly source: string
  readonly build: string
  readonly adapter: string
  readonly binary: string
}

const TDOKU_PROFILE = 'upstream tdoku_static with -O3 and -march=native'
const AUTORESEARCH_PROFILE =
  'rustc opt-level=3, fat LTO, one codegen unit, panic=abort, target-cpu=native'
const SCHOKU_PROFILE = 'g++ -O3 with AVX2, BMI/BMI2, LZCNT, and upstream LIB_ONLY API'

export const NATIVE_BUILD_SPECIFICATIONS = {
  tdoku: {
    id: 'tdoku',
    binaryName: 'tdoku-batch',
    adapterPath: 'scripts/native-competition/batch-runner.cc',
    profile: TDOKU_PROFILE,
    tools: [
      { role: 'build-system', command: 'cmake', versionArguments: ['--version'] },
      { role: 'compiler', command: 'c++', versionArguments: ['--version'] }
    ],
    steps: [
      {
        tool: 'cmake',
        arguments: ['-S', '<source>', '-B', '<build>', '-DOPT=O3'],
        // The build receipt records `c++`; force the fresh CMake build to use
        // that same compiler instead of inheriting an unrelated CXX override.
        environment: { CXX: 'c++' }
      },
      {
        tool: 'cmake',
        arguments: ['--build', '<build>', '--target', 'tdoku_static', '--config', 'Release']
      },
      {
        tool: 'c++',
        arguments: [
          '-std=c++17',
          '-O3',
          '-DSOLVER_ENTRY=TdokuSolverDpllTriadSimd',
          '<adapter>',
          '<build>/libtdoku_static.a',
          '-o',
          '<binary>'
        ]
      }
    ]
  },
  'autoresearch-sudoku': {
    id: 'autoresearch-sudoku',
    binaryName: 'autoresearch-sudoku-batch',
    adapterPath: 'scripts/native-competition/batch-runner.rs',
    profile: AUTORESEARCH_PROFILE,
    tools: [{ role: 'compiler', command: 'rustc', versionArguments: ['--version'] }],
    steps: [
      {
        tool: 'rustc',
        arguments: [
          '--edition=2021',
          '-C',
          'opt-level=3',
          '-C',
          'lto=fat',
          '-C',
          'codegen-units=1',
          '-C',
          'panic=abort',
          '-C',
          'target-cpu=native',
          '<adapter>',
          '-o',
          '<binary>'
        ],
        environment: { AUTORESEARCH_SOLVER_SOURCE: '<source>/src/solver.rs' }
      }
    ]
  },
  schoku: {
    id: 'schoku',
    binaryName: 'schoku-batch',
    adapterPath: 'scripts/native-competition/batch-runner.cc',
    profile: SCHOKU_PROFILE,
    tools: [{ role: 'compiler', command: 'g++', versionArguments: ['--version'] }],
    steps: [
      {
        tool: 'g++',
        arguments: [
          '-std=gnu++17',
          '-O3',
          '-DNDEBUG',
          '-DLIB_ONLY',
          '-mavx2',
          '-mbmi',
          '-mbmi2',
          '-mlzcnt',
          '-fopenmp',
          '-pthread',
          '-c',
          '<source>/src/schoku.cpp',
          '-o',
          '<build>/schoku-lib.o'
        ]
      },
      {
        tool: 'g++',
        arguments: [
          '-std=gnu++17',
          '-O3',
          '-mavx2',
          '-mbmi',
          '-mbmi2',
          '-mlzcnt',
          '-DSOLVER_ENTRY=OtherSolverSchoku',
          '<adapter>',
          '<build>/schoku-lib.o',
          '-fopenmp',
          '-pthread',
          '-o',
          '<binary>'
        ]
      }
    ]
  }
} as const satisfies Record<ExternalNativeSolverId, NativeBuildSpecification>

export function getNativeBuildSpecification(id: string): NativeBuildSpecification {
  if (!(id in NATIVE_BUILD_SPECIFICATIONS)) {
    throw new Error(`No native build specification declared for ${id}`)
  }
  return NATIVE_BUILD_SPECIFICATIONS[id as ExternalNativeSolverId]
}

export function materializeBuildStep(step: NativeBuildStep, paths: BuildPaths): NativeBuildStep {
  return {
    tool: step.tool,
    arguments: step.arguments.map(argument => materialize(argument, paths)),
    ...(step.environment
      ? {
          environment: Object.fromEntries(
            Object.entries(step.environment).map(([name, value]) => [
              name,
              materialize(value, paths)
            ])
          )
        }
      : {})
  }
}

export async function writeNativeBuildReceipt(options: {
  readonly cacheDirectory: string
  readonly projectRoot: string
  readonly sourcePin: NativeSourcePin
  readonly sourceOrigin: string
  readonly binaryPath: string
}): Promise<VerifiedNativeBuildReceipt> {
  const specification = getNativeBuildSpecification(options.sourcePin.id)
  const binaryRelativePath = `bin/${specification.binaryName}`
  const expectedBinaryPath = resolve(options.cacheDirectory, binaryRelativePath)
  if (resolve(options.binaryPath) !== expectedBinaryPath) {
    throw new Error(
      `${specification.id} binary path does not match its build specification: ${options.binaryPath}`
    )
  }

  const receipt: NativeBuildReceipt = {
    schemaVersion: 1,
    source: {
      id: specification.id,
      origin: options.sourceOrigin,
      commit: options.sourcePin.commit
    },
    adapter: {
      path: specification.adapterPath,
      sha256: await sha256File(resolve(options.projectRoot, specification.adapterPath))
    },
    tools: await Promise.all(
      specification.tools.map(async tool => {
        const path = await resolveExecutable(tool.command)
        const { stdout, stderr } = await execFileAsync(path, [...tool.versionArguments], {
          encoding: 'utf8'
        })
        const version = [stdout, stderr]
          .map(output => output.trim())
          .filter(Boolean)
          .join('\n')
        if (!version) throw new Error(`${tool.command} did not report a version`)
        return { role: tool.role, command: tool.command, path, version }
      })
    ),
    build: {
      profile: specification.profile,
      steps: specification.steps
    },
    binary: {
      path: binaryRelativePath,
      sha256: await sha256File(expectedBinaryPath)
    }
  }

  const path = nativeBuildReceiptPath(options.cacheDirectory, specification.id)
  await mkdir(resolve(options.cacheDirectory, 'receipts'), { recursive: true })
  const serialized = serializeNativeBuildReceipt(receipt)
  await writeFile(path, serialized)
  return {
    path: relative(options.cacheDirectory, path),
    sha256: sha256(serialized),
    receipt
  }
}

export async function verifyNativeBuildReceipt(options: {
  readonly cacheDirectory: string
  readonly projectRoot: string
  readonly sourcePin: NativeSourcePin
}): Promise<VerifiedNativeBuildReceipt> {
  const specification = getNativeBuildSpecification(options.sourcePin.id)
  const path = nativeBuildReceiptPath(options.cacheDirectory, specification.id)
  let serialized: string
  try {
    serialized = await readFile(path, 'utf8')
  } catch (error) {
    throw new Error(`${specification.id} build receipt is unavailable; rerun setup`, {
      cause: error
    })
  }

  let value: unknown
  try {
    value = JSON.parse(serialized)
  } catch (error) {
    throw new Error(`${specification.id} build receipt is not valid JSON; rerun setup`, {
      cause: error
    })
  }
  const receipt = parseNativeBuildReceipt(value, specification.id)

  assertEqual(receipt.source.id, specification.id, specification.id, 'source id')
  assertEqual(receipt.source.commit, options.sourcePin.commit, specification.id, 'source commit')
  if (
    normalizeRepository(receipt.source.origin) !== normalizeRepository(options.sourcePin.repository)
  ) {
    throw new Error(`${specification.id} build receipt source origin does not match the manifest`)
  }
  assertEqual(receipt.adapter.path, specification.adapterPath, specification.id, 'adapter path')
  assertEqual(receipt.build.profile, specification.profile, specification.id, 'build profile')
  assertJsonEqual(receipt.build.steps, specification.steps, specification.id, 'build steps')

  const expectedTools = specification.tools.map(tool => ({
    role: tool.role,
    command: tool.command
  }))
  const actualTools = receipt.tools.map(tool => ({ role: tool.role, command: tool.command }))
  assertJsonEqual(actualTools, expectedTools, specification.id, 'build tools')
  for (const tool of receipt.tools) {
    if (!isAbsolute(tool.path) || tool.version.length === 0) {
      throw new Error(`${specification.id} build receipt has incomplete ${tool.command} provenance`)
    }
  }

  const adapterSha256 = await sha256File(resolve(options.projectRoot, specification.adapterPath))
  assertEqual(receipt.adapter.sha256, adapterSha256, specification.id, 'adapter SHA-256')

  const expectedBinaryRelativePath = `bin/${specification.binaryName}`
  assertEqual(receipt.binary.path, expectedBinaryRelativePath, specification.id, 'binary path')
  const binarySha256 = await sha256File(resolve(options.cacheDirectory, receipt.binary.path))
  assertEqual(receipt.binary.sha256, binarySha256, specification.id, 'binary SHA-256')

  return {
    path: relative(options.cacheDirectory, path),
    sha256: sha256(serialized),
    receipt
  }
}

export function serializeNativeBuildReceipt(receipt: NativeBuildReceipt): string {
  return `${JSON.stringify(receipt, null, 2)}\n`
}

export async function sha256File(path: string): Promise<string> {
  try {
    return sha256(await readFile(path))
  } catch (error) {
    throw new Error(`Could not hash required native benchmark file: ${path}`, { cause: error })
  }
}

function nativeBuildReceiptPath(cacheDirectory: string, id: ExternalNativeSolverId): string {
  return resolve(cacheDirectory, 'receipts', `${id}.json`)
}

function materialize(value: string, paths: BuildPaths): string {
  return value
    .replaceAll('<source>', paths.source)
    .replaceAll('<build>', paths.build)
    .replaceAll('<adapter>', paths.adapter)
    .replaceAll('<binary>', paths.binary)
}

async function resolveExecutable(command: string): Promise<string> {
  const pathEntries = (process.env.PATH ?? '').split(delimiter).filter(Boolean)
  for (const entry of pathEntries) {
    const candidate = resolve(entry, command)
    try {
      await access(candidate, constants.X_OK)
      return await realpath(candidate)
    } catch {
      // Continue to the next PATH entry.
    }
  }
  throw new Error(`Could not resolve build tool '${command}' on PATH`)
}

function parseNativeBuildReceipt(value: unknown, id: string): NativeBuildReceipt {
  if (!value || typeof value !== 'object') throw invalidReceipt(id)
  const receipt = value as Partial<NativeBuildReceipt>
  if (
    receipt.schemaVersion !== 1 ||
    !receipt.source ||
    typeof receipt.source.id !== 'string' ||
    typeof receipt.source.origin !== 'string' ||
    typeof receipt.source.commit !== 'string' ||
    !receipt.adapter ||
    typeof receipt.adapter.path !== 'string' ||
    !isSha256(receipt.adapter.sha256) ||
    !Array.isArray(receipt.tools) ||
    !receipt.tools.every(
      tool =>
        !!tool &&
        (tool.role === 'compiler' || tool.role === 'build-system') &&
        typeof tool.command === 'string' &&
        typeof tool.path === 'string' &&
        typeof tool.version === 'string'
    ) ||
    !receipt.build ||
    typeof receipt.build.profile !== 'string' ||
    !Array.isArray(receipt.build.steps) ||
    !receipt.binary ||
    typeof receipt.binary.path !== 'string' ||
    !isSha256(receipt.binary.sha256)
  ) {
    throw invalidReceipt(id)
  }
  return receipt as NativeBuildReceipt
}

function invalidReceipt(id: string): Error {
  return new Error(`${id} build receipt has an unsupported shape; rerun setup`)
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
}

function normalizeRepository(repository: string): string {
  return repository.replace(/\/$/, '').replace(/\.git$/, '')
}

function assertEqual(actual: string, expected: string, id: string, label: string): void {
  if (actual !== expected) {
    throw new Error(`${id} build receipt ${label} does not match; rerun setup`)
  }
}

function assertJsonEqual(actual: unknown, expected: unknown, id: string, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${id} build receipt ${label} do not match; rerun setup`)
  }
}

function sha256(contents: Uint8Array | string): string {
  return createHash('sha256').update(contents).digest('hex')
}
