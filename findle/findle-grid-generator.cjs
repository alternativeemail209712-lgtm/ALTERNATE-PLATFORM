// grid-generator.js
// Builds a word-search-style letter grid for a themed puzzle, the way
// Findle's board works like a classic word search: every theme word sits along a straight line
// of adjacent cells (any of 8 directions), words are allowed to share
// letters where their paths cross, and any leftover cells are filled
// with random letters so the hidden words aren't obvious at a glance.

const DIRECTIONS = [
  [0, 1], [0, -1], [1, 0], [-1, 0],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];
const FILLER_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function tryBuildGrid(words, size) {
  const grid = Array.from({ length: size }, () => Array(size).fill(null));
  const placements = {};

  // Longer words are harder to fit, so place them first.
  const ordered = [...words].sort((a, b) => b.length - a.length);

  for (const word of ordered) {
    let placed = false;

    for (let attempt = 0; attempt < 500 && !placed; attempt++) {
      const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
      const row0 = Math.floor(Math.random() * size);
      const col0 = Math.floor(Math.random() * size);
      const endRow = row0 + dir[0] * (word.length - 1);
      const endCol = col0 + dir[1] * (word.length - 1);
      if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue;

      const cells = [];
      let ok = true;
      for (let i = 0; i < word.length; i++) {
        const r = row0 + dir[0] * i;
        const c = col0 + dir[1] * i;
        const existing = grid[r][c];
        if (existing !== null && existing !== word[i]) { ok = false; break; }
        cells.push([r, c]);
      }
      if (!ok) continue;

      cells.forEach(([r, c], i) => { grid[r][c] = word[i]; });
      placements[word] = cells;
      placed = true;
    }

    if (!placed) return null; // caller should retry with a bigger grid
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === null) {
        grid[r][c] = FILLER_LETTERS[Math.floor(Math.random() * FILLER_LETTERS.length)];
      }
    }
  }

  return { grid, placements };
}

/**
 * Generates a grid that fits every word in `words` (already the exact
 * theme word list for one puzzle). Starts at `startSize` and grows the
 * board a step at a time if the words don't fit, up to a sane cap.
 */
function generatePuzzleGrid(words, startSize = 6) {
  const upperWords = words.map((w) => w.toUpperCase());
  let size = startSize;

  for (let tries = 0; tries < 8; tries++) {
    const result = tryBuildGrid(upperWords, size);
    if (result) return { ...result, size };
    size += 1;
  }

  // Extremely unlikely fallback: lay words out in plain rows so the
  // game never hard-fails even if random placement kept failing.
  const size2 = Math.max(startSize, Math.max(...upperWords.map((w) => w.length)));
  const grid = Array.from({ length: upperWords.length }, () => Array(size2).fill(null));
  const placements = {};
  upperWords.forEach((word, row) => {
    const cells = [];
    for (let c = 0; c < word.length; c++) { grid[row][c] = word[c]; cells.push([row, c]); }
    placements[word] = cells;
  });
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < size2; c++) {
      if (grid[r][c] === null) grid[r][c] = FILLER_LETTERS[Math.floor(Math.random() * FILLER_LETTERS.length)];
    }
  }
  return { grid, placements, size: size2 };
}

module.exports = { generatePuzzleGrid };
