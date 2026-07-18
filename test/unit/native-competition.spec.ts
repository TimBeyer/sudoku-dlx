import { expect } from 'chai'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { TDOKU } from '../../benchmark/competition/manifest.js'
import {
  getNativeBuildSpecification,
  serializeNativeBuildReceipt,
  sha256File,
  verifyNativeBuildReceipt,
  type NativeBuildReceipt
} from '../../scripts/native-competition/build-receipt.js'

describe('native competition build receipts', function () {
  let temporaryDirectory: string
  let projectRoot: string
  let cacheDirectory: string
  let adapterPath: string
  let binaryPath: string
  let receiptPath: string

  beforeEach(async function () {
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'sudoku-dlx-native-receipt-'))
    projectRoot = resolve(temporaryDirectory, 'project')
    cacheDirectory = resolve(temporaryDirectory, 'cache')

    const specification = getNativeBuildSpecification(TDOKU.id)
    adapterPath = resolve(projectRoot, specification.adapterPath)
    binaryPath = resolve(cacheDirectory, 'bin', specification.binaryName)
    receiptPath = resolve(cacheDirectory, 'receipts', `${TDOKU.id}.json`)
    await mkdir(dirname(adapterPath), { recursive: true })
    await mkdir(dirname(binaryPath), { recursive: true })
    await mkdir(dirname(receiptPath), { recursive: true })
    await writeFile(adapterPath, 'adapter-v1\n')
    await writeFile(binaryPath, 'binary-v1\n')
    await writeReceipt()
  })

  afterEach(async function () {
    await rm(temporaryDirectory, { recursive: true, force: true })
  })

  it('accepts a receipt tied to the manifest, adapter, build declaration, and binary', async function () {
    const verified = await verifyNativeBuildReceipt({
      cacheDirectory,
      projectRoot,
      sourcePin: TDOKU
    })

    expect(verified.receipt.source.commit).to.equal(TDOKU.commit)
    expect(verified.receipt.adapter.sha256).to.equal(await sha256File(adapterPath))
    expect(verified.receipt.binary.sha256).to.equal(await sha256File(binaryPath))
    expect(verified.sha256).to.match(/^[a-f0-9]{64}$/)
  })

  it('rejects a binary changed after setup', async function () {
    await writeFile(binaryPath, 'binary-v2\n')

    await expectFailure(
      verifyNativeBuildReceipt({ cacheDirectory, projectRoot, sourcePin: TDOKU }),
      'binary SHA-256 does not match'
    )
  })

  it('rejects an adapter changed after setup', async function () {
    await writeFile(adapterPath, 'adapter-v2\n')

    await expectFailure(
      verifyNativeBuildReceipt({ cacheDirectory, projectRoot, sourcePin: TDOKU }),
      'adapter SHA-256 does not match'
    )
  })

  it('rejects a receipt for a different manifest commit', async function () {
    await expectFailure(
      verifyNativeBuildReceipt({
        cacheDirectory,
        projectRoot,
        sourcePin: { ...TDOKU, commit: '0'.repeat(40) }
      }),
      'source commit does not match'
    )
  })

  async function writeReceipt(): Promise<void> {
    const specification = getNativeBuildSpecification(TDOKU.id)
    const receipt: NativeBuildReceipt = {
      schemaVersion: 1,
      source: { id: 'tdoku', origin: TDOKU.repository, commit: TDOKU.commit },
      adapter: {
        path: specification.adapterPath,
        sha256: await sha256File(adapterPath)
      },
      tools: specification.tools.map(tool => ({
        role: tool.role,
        command: tool.command,
        path: resolve(temporaryDirectory, 'tools', tool.command),
        version: `${tool.command} test version`
      })),
      build: { profile: specification.profile, steps: specification.steps },
      binary: {
        path: `bin/${specification.binaryName}`,
        sha256: await sha256File(binaryPath)
      }
    }
    await writeFile(receiptPath, serializeNativeBuildReceipt(receipt))
  }
})

async function expectFailure(promise: Promise<unknown>, expectedMessage: string): Promise<void> {
  try {
    await promise
  } catch (error) {
    expect(error).to.be.instanceOf(Error)
    expect((error as Error).message).to.include(expectedMessage)
    return
  }
  throw new Error(`Expected failure containing '${expectedMessage}'`)
}
