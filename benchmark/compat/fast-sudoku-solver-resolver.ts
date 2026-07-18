import type { ResolveHook } from 'node:module'

/** Compatibility for fast-sudoku-solver 3.0.3's extensionless ESM imports. */
export const resolve: ResolveHook = async (specifier, context, nextResolve) => {
  try {
    return await nextResolve(specifier, context)
  } catch (error) {
    const insidePinnedPackage = context.parentURL?.includes(
      '/node_modules/fast-sudoku-solver/dist/'
    )
    const relativeWithoutExtension =
      specifier.startsWith('.') &&
      !specifier.substring(specifier.lastIndexOf('/') + 1).includes('.')
    if (!insidePinnedPackage || !relativeWithoutExtension || !isModuleNotFound(error)) throw error
    return nextResolve(`${specifier}.js`, context)
  }
}

function isModuleNotFound(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === 'ERR_MODULE_NOT_FOUND'
  )
}
