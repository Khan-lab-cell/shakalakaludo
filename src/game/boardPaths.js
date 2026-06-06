// 15x15 Ludo board geometry.
// PATH is the 52-cell outer loop, traversed clockwise starting from red's
// start square. Each color's HOME_PATH is the 5-cell home column leading
// from the main path to the final home. SAFE_SQUARES is the set of
// main-path indices where pieces cannot be captured.

export const BOARD_SIZE = 15;
export const PATH_LENGTH = 52;
export const HOME_COLUMN_LENGTH = 5;

export const COLORS = ['red', 'blue', 'green', 'yellow'];

// 52-cell main path, clockwise from red start (6,1).
// Index 0 is red's start; index 13 is blue's; index 27 is yellow's; index 40 is green's.
export const PATH = [
  { r: 6, c: 1 }, { r: 6, c: 2 }, { r: 6, c: 3 }, { r: 6, c: 4 }, { r: 6, c: 5 }, // 0-4
  { r: 5, c: 6 }, { r: 4, c: 6 }, { r: 3, c: 6 }, { r: 2, c: 6 }, { r: 1, c: 6 }, { r: 0, c: 6 }, // 5-10
  { r: 0, c: 7 }, { r: 0, c: 8 }, // 11-12
  { r: 1, c: 8 }, { r: 2, c: 8 }, { r: 3, c: 8 }, { r: 4, c: 8 }, { r: 5, c: 8 }, // 13-17
  { r: 6, c: 8 }, { r: 6, c: 9 }, { r: 6, c: 10 }, { r: 6, c: 11 }, { r: 6, c: 12 }, { r: 6, c: 13 }, // 18-23
  { r: 6, c: 14 }, // 24
  { r: 7, c: 14 }, { r: 8, c: 14 }, // 25-26
  { r: 8, c: 13 }, { r: 8, c: 12 }, { r: 8, c: 11 }, { r: 8, c: 10 }, { r: 8, c: 9 }, // 27-31
  { r: 9, c: 8 }, { r: 10, c: 8 }, { r: 11, c: 8 }, { r: 12, c: 8 }, { r: 13, c: 8 }, { r: 14, c: 8 }, // 32-37
  { r: 14, c: 7 }, { r: 14, c: 6 }, // 38-39
  { r: 13, c: 6 }, { r: 12, c: 6 }, { r: 11, c: 6 }, { r: 10, c: 6 }, { r: 9, c: 6 }, { r: 8, c: 6 }, // 40-45
  { r: 8, c: 5 }, { r: 8, c: 4 }, { r: 8, c: 3 }, { r: 8, c: 2 }, { r: 8, c: 1 }, { r: 8, c: 0 }, // 46-51
];

// Where each color enters the board.
export const START = { red: 0, blue: 13, green: 40, yellow: 27 };

// Main-path index where each color turns into its home column.
// This is the cell just BEFORE the color's start, going clockwise.
export const HOME_ENTRY = { red: 51, blue: 12, green: 39, yellow: 26 };

// 5-cell home column for each color, from the entry cell to just before center.
export const HOME_PATH = {
  red: [
    { r: 7, c: 0 }, { r: 7, c: 1 }, { r: 7, c: 2 }, { r: 7, c: 3 }, { r: 7, c: 4 },
  ],
  blue: [
    { r: 0, c: 7 }, { r: 1, c: 7 }, { r: 2, c: 7 }, { r: 3, c: 7 }, { r: 4, c: 7 },
  ],
  yellow: [
    { r: 7, c: 14 }, { r: 7, c: 13 }, { r: 7, c: 12 }, { r: 7, c: 11 }, { r: 7, c: 10 },
  ],
  green: [
    { r: 14, c: 7 }, { r: 13, c: 7 }, { r: 12, c: 7 }, { r: 11, c: 7 }, { r: 10, c: 7 },
  ],
};

// Final home cell (center of the 4-color triangle) for each color.
export const FINAL_HOME = {
  red: { r: 7, c: 5 },
  blue: { r: 5, c: 7 },
  yellow: { r: 7, c: 9 },
  green: { r: 9, c: 7 },
};

// Safe squares: 4 starting squares + 4 star squares (8 cells before each home entry).
// Computed below so it stays in sync with HOME_ENTRY.
export const SAFE_SQUARES = new Set([
  START.red, START.blue, START.green, START.yellow,
  (HOME_ENTRY.red + PATH_LENGTH - 8) % PATH_LENGTH,
  (HOME_ENTRY.blue + PATH_LENGTH - 8) % PATH_LENGTH,
  (HOME_ENTRY.green + PATH_LENGTH - 8) % PATH_LENGTH,
  (HOME_ENTRY.yellow + PATH_LENGTH - 8) % PATH_LENGTH,
]);

// Home base cells: the 6x6 corner area for each color.
export const HOME_BASE = {
  red: { rows: [0, 5], cols: [0, 5] },
  blue: { rows: [0, 5], cols: [9, 14] },
  green: { rows: [9, 14], cols: [0, 5] },
  yellow: { rows: [9, 14], cols: [9, 14] },
};

// The 4 fixed positions inside each home base where pieces sit before being released.
export const HOME_SLOTS = {
  red: [
    { r: 1, c: 1 }, { r: 1, c: 4 }, { r: 4, c: 1 }, { r: 4, c: 4 },
  ],
  blue: [
    { r: 1, c: 10 }, { r: 1, c: 13 }, { r: 4, c: 10 }, { r: 4, c: 13 },
  ],
  green: [
    { r: 10, c: 1 }, { r: 10, c: 4 }, { r: 13, c: 1 }, { r: 13, c: 4 },
  ],
  yellow: [
    { r: 10, c: 10 }, { r: 10, c: 13 }, { r: 13, c: 10 }, { r: 13, c: 13 },
  ],
};

// Seat number → color (used when assigning colors to players in join order).
export const SEAT_COLORS = ['red', 'blue', 'yellow', 'green'];
