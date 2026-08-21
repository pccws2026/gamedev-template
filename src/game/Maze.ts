export interface MazeWall {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MazeCellCenter {
  x: number;
  y: number;
  row: number;
  column: number;
}

export interface MazeData {
  walls: MazeWall[];
  walkableCells: MazeCellCenter[];
  start: MazeCellCenter;
}

const ROOM_X = 48;
const ROOM_Y = 112;
const ROOM_WIDTH = 1184;
const ROOM_HEIGHT = 560;
const MAZE_COLUMNS = 21;
const MAZE_ROWS = 9;
const WALL_THICKNESS = 15;

function cellCenter(row: number, column: number): MazeCellCenter {
  const cellWidth = ROOM_WIDTH / MAZE_COLUMNS;
  const cellHeight = ROOM_HEIGHT / MAZE_ROWS;
  return {
    x: ROOM_X + (column + 0.5) * cellWidth,
    y: ROOM_Y + (row + 0.5) * cellHeight,
    row,
    column,
  };
}

function shuffle<T>(items: T[]): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

export function createMaze(): MazeData {
  const grid = Array.from({ length: MAZE_ROWS }, () =>
    Array.from({ length: MAZE_COLUMNS }, () => true),
  );
  const startRow = 1;
  const startColumn = 1;
  const visit = (row: number, column: number): void => {
    grid[row][column] = false;
    const directions = shuffle([
      [-2, 0],
      [2, 0],
      [0, -2],
      [0, 2],
    ] as const);

    for (const [rowOffset, columnOffset] of directions) {
      const nextRow = row + rowOffset;
      const nextColumn = column + columnOffset;
      if (
        nextRow <= 0 ||
        nextRow >= MAZE_ROWS - 1 ||
        nextColumn <= 0 ||
        nextColumn >= MAZE_COLUMNS - 1 ||
        !grid[nextRow][nextColumn]
      ) {
        continue;
      }

      grid[row + rowOffset / 2][column + columnOffset / 2] = false;
      visit(nextRow, nextColumn);
    }
  };
  visit(startRow, startColumn);

  const cellWidth = ROOM_WIDTH / MAZE_COLUMNS;
  const cellHeight = ROOM_HEIGHT / MAZE_ROWS;
  const walls: MazeWall[] = [];
  const walkableCells: MazeCellCenter[] = [];

  for (let row = 0; row < MAZE_ROWS; row += 1) {
    let column = 0;
    while (column < MAZE_COLUMNS) {
      if (!grid[row][column]) {
        walkableCells.push(cellCenter(row, column));
        column += 1;
        continue;
      }

      const startColumn = column;
      while (column < MAZE_COLUMNS && grid[row][column]) {
        column += 1;
      }
      walls.push({
        x: ROOM_X + startColumn * cellWidth,
        y: ROOM_Y + row * cellHeight + cellHeight / 2 - WALL_THICKNESS / 2,
        width: (column - startColumn) * cellWidth,
        height: WALL_THICKNESS,
      });
    }
  }

  for (let column = 0; column < MAZE_COLUMNS; column += 1) {
    let row = 0;
    while (row < MAZE_ROWS) {
      if (!grid[row][column]) {
        row += 1;
        continue;
      }

      const startRow = row;
      while (row < MAZE_ROWS && grid[row][column]) {
        row += 1;
      }
      walls.push({
        x: ROOM_X + column * cellWidth + cellWidth / 2 - WALL_THICKNESS / 2,
        y: ROOM_Y + startRow * cellHeight,
        width: WALL_THICKNESS,
        height: (row - startRow) * cellHeight,
      });
    }
  }

  return {
    walls,
    walkableCells,
    start: cellCenter(startRow, startColumn),
  };
}
