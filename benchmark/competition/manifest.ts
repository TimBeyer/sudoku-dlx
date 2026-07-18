export interface NativeSourcePin {
  readonly id: string
  readonly repository: string
  readonly commit: string
  readonly license: string
  readonly licenseUrl: string
}

export const TDOKU: NativeSourcePin = {
  id: 'tdoku',
  repository: 'https://github.com/t-dillon/tdoku.git',
  commit: 'af426180dc53aef89b82868e7b3fdfcf42165654',
  license: 'BSD-2-Clause',
  licenseUrl:
    'https://github.com/t-dillon/tdoku/blob/af426180dc53aef89b82868e7b3fdfcf42165654/LICENSE'
}

export const AUTORESEARCH_SUDOKU: NativeSourcePin = {
  id: 'autoresearch-sudoku',
  repository: 'https://github.com/Rkcr7/autoresearch-sudoku.git',
  commit: '6572d08a00a1fb6938b0cc493d22772f8f903fed',
  license: 'MIT',
  licenseUrl:
    'https://github.com/Rkcr7/autoresearch-sudoku/blob/6572d08a00a1fb6938b0cc493d22772f8f903fed/LICENSE'
}

export const SCHOKU: NativeSourcePin = {
  id: 'schoku',
  repository: 'https://github.com/Mart1nSchulz/Schoku.git',
  commit: 'fc64877e20df82663ac06911f865c746bc266166',
  license: 'GPL-3.0-or-later',
  licenseUrl:
    'https://github.com/Mart1nSchulz/Schoku/blob/fc64877e20df82663ac06911f865c746bc266166/Copying'
}

export const TDOKU_DATA = {
  url: `https://raw.githubusercontent.com/t-dillon/tdoku/${TDOKU.commit}/data.zip`,
  sha256: '9be0601c721ac4e702e3fe097576f025fcb99b216aabfe9dbea37cac43e6bc4f',
  documentation:
    'https://github.com/t-dillon/tdoku/blob/af426180dc53aef89b82868e7b3fdfcf42165654/benchmarks/README.md'
} as const

export const NATIVE_COMPETITION_PINS = [AUTORESEARCH_SUDOKU, TDOKU, SCHOKU] as const
