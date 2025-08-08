#!/usr/bin/env node

import { readFileSync } from 'fs'

interface BenchmarkResult {
  name: string
  puzzle: string
  description: string
  results: Array<{
    name: string
    hz: number
    rme: number
    samples: number
  }>
  fastest: string
  timestamp: string
}

function formatNumber(num: number): string {
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function formatPercentage(num: number): string {
  const sign = num >= 0 ? '+' : ''
  return `${sign}${num.toFixed(1)}%`
}

function getPerformanceEmoji(change: number): string {
  if (change > 10) return '🚀'
  if (change > 5) return '⬆️'
  if (change > -5) return '➡️'
  if (change > -10) return '⬇️'
  return '🐌'
}

function compareBenchmarks(baselineFile: string, prFile: string): void {
  try {
    const baselineData: BenchmarkResult[] = JSON.parse(readFileSync(baselineFile, 'utf-8'))
    const prData: BenchmarkResult[] = JSON.parse(readFileSync(prFile, 'utf-8'))

    if (baselineData.length === 0 && prData.length === 0) {
      console.log('⚠️ No benchmark data found in either file.')
      return
    }

    if (baselineData.length === 0) {
      console.log('⚠️ No baseline data found. Showing PR results only:')
      console.log()
      
      for (const testCase of prData) {
        console.log(`**${testCase.description}**`)
        console.log()
        console.log('| Solver | Ops/sec | Margin of Error |')
        console.log('|--------|---------|-----------------|')
        
        for (const result of testCase.results) {
          const isFastest = result.name === testCase.fastest
          const name = isFastest ? `**${result.name}** 🏆` : result.name
          console.log(`| ${name} | ${formatNumber(result.hz)} | ±${result.rme.toFixed(2)}% |`)
        }
        console.log()
      }
      return
    }

    if (prData.length === 0) {
      console.log('⚠️ No PR benchmark data found.')
      return
    }

    console.log('## Benchmark Comparison')
    console.log()

    // Compare each test case
    for (const prTestCase of prData) {
      const baselineTestCase = baselineData.find(b => b.name === prTestCase.name)
      
      console.log(`**${prTestCase.description}**`)
      console.log()

      if (!baselineTestCase) {
        console.log('_New test case in PR_')
        console.log()
        console.log('| Solver | Ops/sec | Margin of Error |')
        console.log('|--------|---------|-----------------|')
        
        for (const result of prTestCase.results) {
          const isFastest = result.name === prTestCase.fastest
          const name = isFastest ? `**${result.name}** 🏆` : result.name
          console.log(`| ${name} | ${formatNumber(result.hz)} | ±${result.rme.toFixed(2)}% |`)
        }
        console.log()
        continue
      }

      // Create comparison table
      console.log('| Solver | Baseline | PR | Change | Performance |')
      console.log('|--------|----------|----|---------|-----------| ')

      for (const prResult of prTestCase.results) {
        const baselineResult = baselineTestCase.results.find(b => b.name === prResult.name)
        
        if (!baselineResult) {
          console.log(`| ${prResult.name} | - | ${formatNumber(prResult.hz)} ops/sec | New | 🆕 |`)
          continue
        }

        const change = ((prResult.hz - baselineResult.hz) / baselineResult.hz) * 100
        const emoji = getPerformanceEmoji(change)
        const isFastest = prResult.name === prTestCase.fastest
        const name = isFastest ? `**${prResult.name}** 🏆` : prResult.name

        console.log(`| ${name} | ${formatNumber(baselineResult.hz)} | ${formatNumber(prResult.hz)} | ${formatPercentage(change)} | ${emoji} |`)
      }

      // Check for removed solvers
      for (const baselineResult of baselineTestCase.results) {
        const prResult = prTestCase.results.find(p => p.name === baselineResult.name)
        if (!prResult) {
          console.log(`| ${baselineResult.name} | ${formatNumber(baselineResult.hz)} ops/sec | - | Removed | ❌ |`)
        }
      }

      console.log()
    }

    // Performance summary
    console.log('### Summary')
    console.log()

    let totalComparisons = 0
    let improvements = 0
    let regressions = 0
    let totalChangeSum = 0

    for (const prTestCase of prData) {
      const baselineTestCase = baselineData.find(b => b.name === prTestCase.name)
      if (!baselineTestCase) continue

      for (const prResult of prTestCase.results) {
        const baselineResult = baselineTestCase.results.find(b => b.name === prResult.name)
        if (!baselineResult) continue

        const change = ((prResult.hz - baselineResult.hz) / baselineResult.hz) * 100
        totalComparisons++
        totalChangeSum += change

        if (change > 2) improvements++
        else if (change < -2) regressions++
      }
    }

    if (totalComparisons > 0) {
      const avgChange = totalChangeSum / totalComparisons
      console.log(`- **Total comparisons**: ${totalComparisons}`)
      console.log(`- **Improvements**: ${improvements} (>${2}% faster)`)
      console.log(`- **Regressions**: ${regressions} (>${2}% slower)`)
      console.log(`- **Average change**: ${formatPercentage(avgChange)}`)
      
      if (avgChange > 5) {
        console.log(`- **Overall**: 🚀 Significant performance improvement`)
      } else if (avgChange > 2) {
        console.log(`- **Overall**: ⬆️ Performance improvement`)
      } else if (avgChange > -2) {
        console.log(`- **Overall**: ➡️ Performance maintained`)
      } else if (avgChange > -5) {
        console.log(`- **Overall**: ⬇️ Minor performance regression`)
      } else {
        console.log(`- **Overall**: 🐌 Performance regression`)
      }
    }

  } catch (error) {
    console.error('Error comparing benchmarks:', error)
    process.exit(1)
  }
}

// Command line usage
const args = process.argv.slice(2)
if (args.length !== 2) {
  console.error('Usage: compare-benchmarks <baseline.json> <pr.json>')
  process.exit(1)
}

compareBenchmarks(args[0], args[1])