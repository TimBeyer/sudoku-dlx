mod solver {
    include!(env!("AUTORESEARCH_SOLVER_SOURCE"));
}

use std::env;
use std::fs::File;
use std::io::{self, BufRead, BufReader, BufWriter, Write};

fn main() -> io::Result<()> {
    let arguments: Vec<String> = env::args().collect();
    if arguments.len() != 3 {
        eprintln!("usage: autoresearch-batch-runner <canonical-corpus> <solutions>");
        std::process::exit(2);
    }

    let input = BufReader::new(File::open(&arguments[1])?);
    let mut output = BufWriter::new(File::create(&arguments[2])?);
    let mut puzzle_count = 0usize;

    for line in input.lines() {
        let puzzle = line?;
        if puzzle.len() != 81
            || !puzzle
                .bytes()
                .all(|value| value == b'.' || (b'1'..=b'9').contains(&value))
        {
            eprintln!("non-canonical puzzle at line {}", puzzle_count + 1);
            std::process::exit(2);
        }

        let mut grid = [[0u8; 9]; 9];
        for (index, value) in puzzle.bytes().enumerate() {
            grid[index / 9][index % 9] = if value == b'.' { 0 } else { value - b'0' };
        }

        if !solver::solve(&mut grid) {
            eprintln!("no solution returned for puzzle {}", puzzle_count + 1);
            std::process::exit(3);
        }

        for row in grid {
            for value in row {
                output.write_all(&[b'0' + value])?;
            }
        }
        output.write_all(b"\n")?;
        puzzle_count += 1;
    }

    if puzzle_count == 0 {
        eprintln!("corpus contains no puzzles");
        std::process::exit(2);
    }
    output.flush()
}
