export type TileSuit = 'manzu' | 'pinzu' | 'souzu' | 'honor';
export type HonorTile = 'east' | 'south' | 'west' | 'north' | 'white' | 'green' | 'red';

export type Tile = {
  id: number;
  suit: TileSuit;
  rank?: number;
  honor?: HonorTile;
};

const honorLabels: Record<HonorTile, string> = {
  east: '東',
  south: '南',
  west: '西',
  north: '北',
  white: '白',
  green: '發',
  red: '中',
};

const numberLabels = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

export function createWall(): Tile[] {
  const wall: Tile[] = [];
  let id = 0;
  const suits: TileSuit[] = ['manzu', 'pinzu', 'souzu'];
  for (const suit of suits) {
    for (let rank = 1; rank <= 9; rank += 1) {
      for (let copy = 0; copy < 4; copy += 1) {
        wall.push({ id, suit, rank });
        id += 1;
      }
    }
  }
  const honors: HonorTile[] = ['east', 'south', 'west', 'north', 'white', 'green', 'red'];
  for (const honor of honors) {
    for (let copy = 0; copy < 4; copy += 1) {
      wall.push({ id, suit: 'honor', honor });
      id += 1;
    }
  }
  return wall;
}

export function shuffleTiles(tiles: Tile[]): Tile[] {
  const shuffled = [...tiles];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function tileLabel(tile: Tile): string {
  if (tile.suit === 'honor' && tile.honor) {
    return honorLabels[tile.honor];
  }
  if (tile.rank && tile.suit !== 'honor') {
    const suffix: Record<Exclude<TileSuit, 'honor'>, string> = {
      manzu: '萬',
      pinzu: '筒',
      souzu: '索',
    };
    return `${numberLabels[tile.rank]}${suffix[tile.suit]}`;
  }
  return '?';
}

export function tileColor(tile: Tile): string {
  if (tile.suit === 'manzu') return '#dc2626';
  if (tile.suit === 'pinzu') return '#2563eb';
  if (tile.suit === 'souzu') return '#16a34a';
  return '#111827';
}

export function sortTiles(tiles: Tile[]): Tile[] {
  return [...tiles].sort((first, second) => first.id - second.id);
}
