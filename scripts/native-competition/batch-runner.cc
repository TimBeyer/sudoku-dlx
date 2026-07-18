#include <cstddef>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <string>

#ifndef SOLVER_ENTRY
#error "SOLVER_ENTRY must name the upstream first-solution function"
#endif

extern "C" std::size_t SOLVER_ENTRY(const char *input,
                                    std::size_t limit,
                                    std::uint32_t configuration,
                                    char *solution,
                                    std::size_t *num_guesses);

int main(int argc, char **argv) {
  if (argc != 3) {
    std::cerr << "usage: native-batch-runner <canonical-corpus> <solutions>\n";
    return 2;
  }

  std::ifstream input(argv[1], std::ios::binary);
  if (!input) {
    std::cerr << "could not open corpus: " << argv[1] << '\n';
    return 2;
  }

  std::ofstream output(argv[2], std::ios::binary | std::ios::trunc);
  if (!output) {
    std::cerr << "could not open solution file: " << argv[2] << '\n';
    return 2;
  }

  std::string puzzle;
  std::size_t puzzle_index = 0;
  while (std::getline(input, puzzle)) {
    if (!puzzle.empty() && puzzle.back() == '\r') puzzle.pop_back();
    if (puzzle.size() != 81) {
      std::cerr << "non-canonical puzzle at line " << (puzzle_index + 1) << '\n';
      return 2;
    }
    for (const char value : puzzle) {
      if (value != '.' && (value < '1' || value > '9')) {
        std::cerr << "non-canonical puzzle at line " << (puzzle_index + 1) << '\n';
        return 2;
      }
    }

    char solution[81]{};
    std::size_t guesses = 0;
    const std::size_t solutions = SOLVER_ENTRY(puzzle.data(), 1, 0, solution, &guesses);
    if (solutions == 0) {
      std::cerr << "no solution returned for puzzle " << (puzzle_index + 1) << '\n';
      return 3;
    }

    output.write(solution, 81);
    output.put('\n');
    if (!output) {
      std::cerr << "failed writing solution " << (puzzle_index + 1) << '\n';
      return 2;
    }
    ++puzzle_index;
  }

  if (puzzle_index == 0) {
    std::cerr << "corpus contains no puzzles\n";
    return 2;
  }
  return 0;
}
