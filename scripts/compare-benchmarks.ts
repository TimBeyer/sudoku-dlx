#!/usr/bin/env node

import { readFileSync } from 'fs'

interface BenchmarkResult {
  benchmarkName: string
  results: Array<{
    name: string
    opsPerSec: number
    margin: number
    runs: number
    deprecated: boolean
  }>
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
        console.log(`**${testCase.benchmarkName}**`)
        console.log()
        console.log('| Solver | Ops/sec | Margin of Error |')
        console.log('|--------|---------|-----------------|')
        
        // Find fastest solver
        const fastestOpsPerSec = Math.max(...testCase.results.map(r => r.opsPerSec))
        
        for (const result of testCase.results) {
          const isFastest = Math.abs(result.opsPerSec - fastestOpsPerSec) < 0.1
          const name = isFastest ? `**${result.name}** 🏆` : result.name
          console.log(`| ${name} | ${formatNumber(result.opsPerSec)} | ±${result.margin.toFixed(2)}% |`)
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
      const baselineTestCase = baselineData.find(b => b.benchmarkName === prTestCase.benchmarkName)
      
      console.log(`**${prTestCase.benchmarkName}**`)
      console.log()

      if (!baselineTestCase) {
        console.log('_New test case in PR_')
        console.log()
        console.log('| Solver | Ops/sec | Margin of Error |')
        console.log('|--------|---------|-----------------|')
        
        // Find fastest solver
        const fastestOpsPerSec = Math.max(...prTestCase.results.map(r => r.opsPerSec))
        
        for (const result of prTestCase.results) {
          const isFastest = Math.abs(result.opsPerSec - fastestOpsPerSec) < 0.1
          const name = isFastest ? `**${result.name}** 🏆` : result.name
          console.log(`| ${name} | ${formatNumber(result.opsPerSec)} | ±${result.margin.toFixed(2)}% |`)
        }
        console.log()
        continue
      }

      // Create comparison table
      console.log('| Solver | Baseline | PR | Change | Performance |')
      console.log('|--------|----------|----|---------|-----------| ')

      // Find fastest in each set
      const fastestPrOpsPerSec = Math.max(...prTestCase.results.map(r => r.opsPerSec))
      
      for (const prResult of prTestCase.results) {
        const baselineResult = baselineTestCase.results.find(b => b.name === prResult.name)
        
        if (!baselineResult) {
          console.log(`| ${prResult.name} | - | ${formatNumber(prResult.opsPerSec)} ops/sec | New | 🆕 |`)
          continue
        }

        const change = ((prResult.opsPerSec - baselineResult.opsPerSec) / baselineResult.opsPerSec) * 100
        const emoji = getPerformanceEmoji(change)
        const isFastest = Math.abs(prResult.opsPerSec - fastestPrOpsPerSec) < 0.1
        const name = isFastest ? `**${prResult.name}** 🏆` : prResult.name

        console.log(`| ${name} | ${formatNumber(baselineResult.opsPerSec)} | ${formatNumber(prResult.opsPerSec)} | ${formatPercentage(change)} | ${emoji} |`)
      }

      // Check for removed solvers
      for (const baselineResult of baselineTestCase.results) {
        const prResult = prTestCase.results.find(p => p.name === baselineResult.name)
        if (!prResult) {
          console.log(`| ${baselineResult.name} | ${formatNumber(baselineResult.opsPerSec)} ops/sec | - | Removed | ❌ |`)
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
      const baselineTestCase = baselineData.find(b => b.benchmarkName === prTestCase.benchmarkName)
      if (!baselineTestCase) continue

      for (const prResult of prTestCase.results) {
        const baselineResult = baselineTestCase.results.find(b => b.name === prResult.name)
        if (!baselineResult) continue

        const change = ((prResult.opsPerSec - baselineResult.opsPerSec) / baselineResult.opsPerSec) * 100
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