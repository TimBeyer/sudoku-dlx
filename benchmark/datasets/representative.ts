/**
 * Deterministic, repository-owned benchmark corpus.
 *
 * Provenance: every complete grid was independently constructed by the seeded
 * randomized backtracker in `scripts/generate-representative-corpus.ts`; puzzles
 * were then produced by independently shuffled clue removal. No third-party
 * puzzle collection or competitor generator is used, and these are not board or
 * digit transformations of the repository's smoke fixtures.
 *
 * Every committed puzzle has valid givens and exactly one solution, revalidated
 * with sudoku-dlx by the generator. `searchTier` is a corpus-relative quartile of
 * deterministic MRV first-solution search nodes, not a claim about human-solving
 * difficulty. The measured and warmup grids, puzzles, and solutions are disjoint.
 *
 * Generated with seed 0x5d0c0d5 and distributed under this repository's MIT
 * license. Reproduce and validate with:
 * `node --import=tsx scripts/generate-representative-corpus.ts --verify`.
 */

// One puzzle per line keeps corpus review and checksum diffs practical.
// prettier-ignore
export const REPRESENTATIVE_CORPUS_CASES = [
  { puzzle: '236...8..9....2..3..7....4....41.2.8.9.....7....3...5.4.1.76...6.....7.....18....', clues: 25, searchNodes: 145, searchTier: 'very-high' },
  { puzzle: '.....7..6.3...8.1..8.6..4.7...76..3..2.....7..93.1...4..2........439...2..98.....', clues: 25, searchNodes: 57, searchTier: 'high' },
  { puzzle: '4.5....7......6..8..1.......8..4.....7.5..84..3.61.7.....124.69.......5.6.9.5....', clues: 25, searchNodes: 57, searchTier: 'high' },
  { puzzle: '8...1........267.....4.9..612......9.6....85..5.9...1.2..56.1.7...1...9.7........', clues: 25, searchNodes: 57, searchTier: 'high' },
  { puzzle: '....6..2...2.1.6.7.....4.5...7....152.57...........7.91.......35.34...9.4...29...', clues: 25, searchNodes: 711, searchTier: 'very-high' },
  { puzzle: '5.....3..3.7156.........1.9..9.3..2..4......8..6..45...8...1...6.1.23.......45...', clues: 25, searchNodes: 736, searchTier: 'very-high' },
  { puzzle: '....728.9.....9....6.154.....5.18.6268...5.9..9.......5.......3.4....2..7.2......', clues: 25, searchNodes: 107, searchTier: 'very-high' },
  { puzzle: '...6..5.8.....8.7.2...45...8..5..6..5.6.2..49.93........2...3..71....8..3...1....', clues: 25, searchNodes: 79, searchTier: 'high' },
  { puzzle: '..3.25...95.7...2..47.1.......97.....1..4.2.....6..93.3.1........42...5..7.1.46..', clues: 27, searchNodes: 84, searchTier: 'high' },
  { puzzle: '75...4.8..8....24...1........6....94..418..32..54.3..6....671.3..32.9............', clues: 27, searchNodes: 73, searchTier: 'high' },
  { puzzle: '..3.465.....2.19...15.....6..9..3..5.5..1.4..3.....29.7..5...........18..46..8.5.', clues: 27, searchNodes: 326, searchTier: 'very-high' },
  { puzzle: '....6.3.9..3..2...6..14....9..6.7...2.1.3......7.91.484.2......8.92..4.6......1..', clues: 27, searchNodes: 60, searchTier: 'high' },
  { puzzle: '..3.9.84.6...789......3..........7.11..8..62.8...5......7..6....46..5..9..8.1..56', clues: 27, searchNodes: 77, searchTier: 'high' },
  { puzzle: '..83......2.9413...36..59..5.24.8..7..9.1..2............1572.9...........5.1....4', clues: 27, searchNodes: 291, searchTier: 'very-high' },
  { puzzle: '..753...4.9.........2.4.31..2.1.39....9.......8.....35.362..741.....1.6....4...8.', clues: 27, searchNodes: 205, searchTier: 'very-high' },
  { puzzle: '2....8..43......9.6..25............7.8.....69...9.713..5...2...8.356...1..6.7.5.8', clues: 27, searchNodes: 323, searchTier: 'very-high' },
  { puzzle: '..2.6...9..52...7.96.3....8.....8..44.81....3.5...4...82.4...3..9..8.1...1.5.2.8.', clues: 29, searchNodes: 56, searchTier: 'high' },
  { puzzle: '......73.1927..6...5..98.1..3.26.1......7.....81..3...5...8.4.7.78....9.92..5....', clues: 29, searchNodes: 53, searchTier: 'high' },
  { puzzle: '37.5.9.4.......2.3...8.....862...4.1.5.6437.......8..9....92.......5...429..845..', clues: 29, searchNodes: 117, searchTier: 'very-high' },
  { puzzle: '......9.5.....7.1828..19..47...8.2.6.3.9......2.....5..57..18.31..6..59....7.4...', clues: 29, searchNodes: 53, searchTier: 'high' },
  { puzzle: '.......8165....42.1..9.2......72...3....6....2.7.5.69.74.6.82.....4..9...6..93.7.', clues: 29, searchNodes: 153, searchTier: 'very-high' },
  { puzzle: '...2......8.3.915.2.6...49.614.........184.7.3........5..41.82.8....3.1...1..23..', clues: 29, searchNodes: 111, searchTier: 'very-high' },
  { puzzle: '6..........79...48.9.8.63...4..7351..7......65....987..5...412...4.91....3.2.....', clues: 29, searchNodes: 121, searchTier: 'very-high' },
  { puzzle: '.4.267.........4.62....57.9.3..5.....67..28....43.....7.....9....852613.6....3.8.', clues: 29, searchNodes: 144, searchTier: 'very-high' },
  { puzzle: '419235..86........275..8........73.6.94....57.....4..29.3...7.1..79...6.54.....8.', clues: 31, searchNodes: 264, searchTier: 'very-high' },
  { puzzle: '..65.....2.57..8.9734.9....4......2......9...3..26194.56..1..93849..21..........4', clues: 31, searchNodes: 168, searchTier: 'very-high' },
  { puzzle: '.8...67157..8..6...5...4..82.35.987.6....2.......1.96.......5.75.26..13.9..7.....', clues: 31, searchNodes: 80, searchTier: 'high' },
  { puzzle: '.....7...13.4...79.5.2.3.6..9...45...7..5..2.5..8.........98.3..1.54..96829...7.4', clues: 31, searchNodes: 51, searchTier: 'moderate' },
  { puzzle: '7..32....4.56...8..23.94.6...1.6.79.647.15.3.2..8....1...4....6..............9325', clues: 31, searchNodes: 51, searchTier: 'moderate' },
  { puzzle: '..624...94..85..277..6138.5.8....95.......473.3.7......2936........8..32......5..', clues: 31, searchNodes: 51, searchTier: 'moderate' },
  { puzzle: '..12...48.43.......7...13.6.3..9..2..8...3.9479..5.8...273..........9.32..6412...', clues: 31, searchNodes: 51, searchTier: 'moderate' },
  { puzzle: '91..8.32.4..3....8..8621......275.93...8......54...68.79.16............1.41....62', clues: 31, searchNodes: 51, searchTier: 'moderate' },
  { puzzle: '5..26.9.3.9........728...4..6..18.3913....45....3.7..174.985.......4.697..17.....', clues: 33, searchNodes: 49, searchTier: 'moderate' },
  { puzzle: '..3.7..42.......3......59.7.2..56184.4..12..91..4.8.2......3..8..82..4.1.721.4..3', clues: 33, searchNodes: 62, searchTier: 'high' },
  { puzzle: '8....5..31......6..37.84......9...8...3.5821.52.34..96...5...4..1..6..38249.1..5.', clues: 33, searchNodes: 49, searchTier: 'moderate' },
  { puzzle: '..863....31...79..2.49.58...5....3877..8.......1.4.52.68.4.2..1.27.....8.4.5...9.', clues: 33, searchNodes: 49, searchTier: 'moderate' },
  { puzzle: '9..6....45.48.16...6..54...6..1.54....573.1.....4..835.31....4.7.6.....2.4...756.', clues: 33, searchNodes: 110, searchTier: 'very-high' },
  { puzzle: '....27.952..4.5.7..6...1..8.24......95.1..462...342..9.8..93.5...52....3..958....', clues: 33, searchNodes: 49, searchTier: 'moderate' },
  { puzzle: '..8..6.....14.72.6642...1572..3..9....6.9.8.21..8..7.5..3...61..6.2.3.7.9.......3', clues: 33, searchNodes: 78, searchTier: 'high' },
  { puzzle: '7...3.6.......21835..68...28...63....6.....4.4.9..8..535....7...4.3..5..182.9543.', clues: 33, searchNodes: 54, searchTier: 'high' },
  { puzzle: '..3497682.4.32...7....56.49........53...4..2..7..8.1349.186.....38..4........3891', clues: 35, searchNodes: 47, searchTier: 'moderate' },
  { puzzle: '94..3.....5...64...324.9.565683..91.....5.63....1...753...4...112.......6745...29', clues: 35, searchNodes: 51, searchTier: 'moderate' },
  { puzzle: '16.238..4..2.57....3.....6....7.31..9.6...5.......5..9..74..65.8.13.6.92.49.2178.', clues: 35, searchNodes: 47, searchTier: 'moderate' },
  { puzzle: '387..2.5.2.6.......5.89..761.3.7.6....93..5....54.83..5...8476..7.....9.9.4.5..28', clues: 35, searchNodes: 47, searchTier: 'moderate' },
  { puzzle: '7.24..8.3.6.1.8.2.8..7.3.4613....2.46..54.9..4.........1..76.82.7.284....4...5..7', clues: 35, searchNodes: 47, searchTier: 'moderate' },
  { puzzle: '97....2....8.9.7...14..2.63.9...8..7.3.2.6.98.5.1..34.7.....4..24...7..9.839.567.', clues: 35, searchNodes: 47, searchTier: 'moderate' },
  { puzzle: '9..5....23.59.7481.2.34..75.....4...63.19........53.49..6.1.5..87.235...2......17', clues: 35, searchNodes: 47, searchTier: 'moderate' },
  { puzzle: '2..8...37..3....61..9.36.8.7.2..36.853..74129.9.5...7.......5.2...9.8.13..5.4.8..', clues: 35, searchNodes: 68, searchTier: 'high' },
  { puzzle: '.8.7.1..4...985.7.719.6...5.6..982...3.....4.8.2........1.39.679.86..3123..41..89', clues: 37, searchNodes: 45, searchTier: 'low' },
  { puzzle: '627.4153..3.......8.1.59.627.......1183.6...545...86..9.4..7....78.9.1.4...124.9.', clues: 37, searchNodes: 45, searchTier: 'low' },
  { puzzle: '74..8.2.5.2...9.7...65.2....7...1..321.7..864.9.8..7.21.9.2...7..294.5...87.35..9', clues: 37, searchNodes: 45, searchTier: 'low' },
  { puzzle: '72...63..8.9...6..36.87.14.598..1...6.4..8....1..64.954.26...3....31..261..94.5..', clues: 37, searchNodes: 45, searchTier: 'low' },
  { puzzle: '...8.135.173.5.4.88.5..4...38...7.9..5..2.73...1.6..2..3.51....6..493...549.82..3', clues: 37, searchNodes: 45, searchTier: 'low' },
  { puzzle: '..7.3......5..4.7.46.87...5591...36727.35..4.6437...82.56.8....9...47....3.29...6', clues: 37, searchNodes: 45, searchTier: 'low' },
  { puzzle: '4.9..86....7..5.29.2.7.9..5..417....51.98..36....5...4.7.841.6339...64.1.41.....2', clues: 37, searchNodes: 45, searchTier: 'low' },
  { puzzle: '72.91.5...9687..........7..93846..25..7..1.4.1.2....3...5.4..7..19..3...37469528.', clues: 37, searchNodes: 45, searchTier: 'low' },
  { puzzle: '36.2..47.1.4.3.8.2..27416....73......4..267.5.918573647.......3.3.9..5..915.63...', clues: 40, searchNodes: 42, searchTier: 'low' },
  { puzzle: '85..34..771.8...3239..27.....924...6.37.5.8...2....3.9..341.6.524.596.1.56.....94', clues: 40, searchNodes: 42, searchTier: 'low' },
  { puzzle: '.....3.....3...4.1182.75.6.8193576426.78.1....4..9...85317.42.....9..53.498.3..7.', clues: 40, searchNodes: 42, searchTier: 'low' },
  { puzzle: '....56.7....9245.154..8792..3264..95..1295.4.9.4..3.1...3.1...72..43..594..76....', clues: 40, searchNodes: 42, searchTier: 'low' },
  { puzzle: '8...75..4....9.7.8.95846..11.24.8.6.658.39.4.3.9.21...9875..326....8.....23..7..5', clues: 40, searchNodes: 42, searchTier: 'low' },
  { puzzle: '8.71..2..9365.214...24..73..236589.41.5.3..7.....215..4.1.6.3.....247.5..7.3..4..', clues: 40, searchNodes: 42, searchTier: 'low' },
  { puzzle: '58.3..196..39....54....7.8.7.8.213...34...95.2.54.9.1.8.1.635...72..5....562.47.1', clues: 40, searchNodes: 42, searchTier: 'low' },
  { puzzle: '32...74.8..1..4.96.9..613.2..4.3....2.35.98.4.1.4.......2.9.6.38371462...6.2.3.41', clues: 40, searchNodes: 42, searchTier: 'low' }
] as const

// prettier-ignore
export const REPRESENTATIVE_WARMUP_CASES = [
  { puzzle: '3.245..7...9.1.6...1....5.96.37...4......3......24.......6.....1.4.8.2.5....3.7..', clues: 26, searchNodes: 82 },
  { puzzle: '..4...7.1.......84.87.4..5..1..3794..7....5..5..6..1.734.2...9...58..4.6..1.5....', clues: 30, searchNodes: 52 },
  { puzzle: '9....81.7.2.94..8...5.6..9.....2197.2.....5.1.9...6..3.39.12....1.3.4.5.74.6..3.2', clues: 34, searchNodes: 68 },
  { puzzle: '....6..23.26..5487.4.7.25....8.4.6..........4..5.793..693421.757..3569.....8.7.36', clues: 38, searchNodes: 44 },
  { puzzle: '.46...271...6....4..2.57..9.258..3...792......................8....8....49...3.17', clues: 25, searchNodes: 69 },
  { puzzle: '92......331..2.8.....5.1..76.3.427....1.....48....7....3.....6..6..531.8....69.7.', clues: 29, searchNodes: 222 },
  { puzzle: '84.5.63.....3.....3.1..8..9.5.73...16....4.321..6.98.42.4..5.8.5.......69..48...5', clues: 33, searchNodes: 49 },
  { puzzle: '.9...2.5..1....28.5..8...37.7.136948...4.85...3.9.7.12.56......9.13.5.6.3.46.1725', clues: 39, searchNodes: 43 }
] as const

export const REPRESENTATIVE_CORPUS = Object.freeze(
  REPRESENTATIVE_CORPUS_CASES.map(entry => entry.puzzle)
)

export const REPRESENTATIVE_WARMUP_CORPUS = Object.freeze(
  REPRESENTATIVE_WARMUP_CASES.map(entry => entry.puzzle)
)
