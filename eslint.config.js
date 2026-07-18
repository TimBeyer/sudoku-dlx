import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import eslintConfigPrettier from 'eslint-config-prettier'
import globals from 'globals'

const typescriptRules = {
  ...tseslint.configs.recommended.rules,
  'no-undef': 'off',
  '@typescript-eslint/no-unused-vars': 'error',
  '@typescript-eslint/no-explicit-any': 'off'
}

export default [
  {
    ignores: ['built/**', 'coverage/**', 'node_modules/**']
  },
  js.configs.recommended,
  {
    files: ['index.ts', 'lib/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json'
      },
      globals: globals.node
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: typescriptRules
  },
  {
    files: ['benchmark/**/*.ts', 'scripts/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.dev.json'
      },
      globals: globals.node
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: typescriptRules
  },
  {
    files: ['test/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.mocha,
        ...globals.node
      }
    }
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node
    }
  },
  eslintConfigPrettier
]
