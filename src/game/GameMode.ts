export type GameMode = 'limited' | 'elapsed';

let selectedMode: GameMode = 'elapsed';

export function getGameMode(): GameMode {
  return selectedMode;
}

export function setGameMode(mode: GameMode): void {
  selectedMode = mode;
}
