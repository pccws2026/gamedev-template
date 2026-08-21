import type { MazeCellCenter } from './Maze';

export interface ChestData {
  x: number;
  y: number;
  isCorrect: boolean;
  isOpened: boolean;
}

export function createInitialChests(walkableCells: readonly MazeCellCenter[]): ChestData[] {
  const positions = [...walkableCells]
    .filter((cell) => cell.row !== 1 || cell.column !== 1)
    .sort(() => Math.random() - 0.5)
    .slice(0, 10);
  const correctChestIndices = new Set<number>();

  while (correctChestIndices.size < 3) {
    correctChestIndices.add(Math.floor(Math.random() * positions.length));
  }

  return positions.map((position, index) => {
    return {
      x: position.x,
      y: position.y,
      isCorrect: correctChestIndices.has(index),
      isOpened: false,
    };
  });
}