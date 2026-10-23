export type RankingCategory = 'RSG' | 'SSG' | 'DEV';

export interface ReplayFrame {
  timeMs: number;
  x: number;
  y: number;
  angle: number;
  keyCount: number;
  openedChestMask: number;
  enemies: [number, number, number, number];
}

export interface RankingEntry {
  name: string;
  timeSeconds: number;
  seed?: number;
  replay?: ReplayFrame[];
}

export interface Rankings {
  RSG: RankingEntry[];
  SSG: RankingEntry[];
  DEV: RankingEntry[];
}

export const RANKING_STORAGE_KEY = 'escape-room-rankings';
export const RANKING_LIMIT = 100;

function isRankingEntry(value: unknown): value is RankingEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return typeof entry.name === 'string'
    && /^[a-zA-Z0-9]{0,5}$/.test(entry.name)
    && typeof entry.timeSeconds === 'number'
    && Number.isFinite(entry.timeSeconds)
    && entry.timeSeconds >= 0
    && (entry.seed === undefined
      || (Number.isSafeInteger(entry.seed) && (entry.seed as number) >= 0))
    && (entry.replay === undefined || isReplay(entry.replay));
}

function isReplay(value: unknown): value is ReplayFrame[] {
  return Array.isArray(value) && value.length > 0 && value.every((frame: unknown) => {
    if (typeof frame !== 'object' || frame === null) {
      return false;
    }
    const item = frame as Record<string, unknown>;
    return typeof item.timeMs === 'number'
      && Number.isFinite(item.timeMs)
      && typeof item.x === 'number'
      && Number.isFinite(item.x)
      && typeof item.y === 'number'
      && Number.isFinite(item.y)
      && typeof item.angle === 'number'
      && Number.isFinite(item.angle)
      && typeof item.keyCount === 'number'
      && Number.isInteger(item.keyCount)
      && typeof item.openedChestMask === 'number'
      && Number.isInteger(item.openedChestMask)
      && Array.isArray(item.enemies)
      && item.enemies.length === 4
      && item.enemies.every((coordinate: unknown) => (
        typeof coordinate === 'number' && Number.isFinite(coordinate)
      ));
  });
}

function readCategory(value: unknown, category: RankingCategory): RankingEntry[] {
  if (!Array.isArray(value) || !value.every(isRankingEntry)) {
    throw new Error(`Invalid ${category} ranking data in local storage`);
  }
  return value.slice(0, RANKING_LIMIT).sort(
    (first, second) => first.timeSeconds - second.timeSeconds,
  );
}

export function getRankings(): Rankings {
  const stored = localStorage.getItem(RANKING_STORAGE_KEY);
  if (stored === null) {
    return { RSG: [], SSG: [], DEV: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch (error) {
    throw new Error('Unable to parse ranking data in local storage', { cause: error });
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid ranking data in local storage');
  }

  const rankings = parsed as Record<string, unknown>;
  return {
    RSG: readCategory(rankings.RSG, 'RSG'),
    SSG: readCategory(rankings.SSG, 'SSG'),
    DEV: rankings.DEV === undefined ? [] : readCategory(rankings.DEV, 'DEV'),
  };
}

export function getRankingPosition(
  category: RankingCategory,
  timeSeconds: number,
): number | null {
  const entries = getRankings()[category];
  const position = entries.findIndex((entry) => timeSeconds < entry.timeSeconds);
  const insertionIndex = position === -1 ? entries.length : position;
  return insertionIndex < RANKING_LIMIT ? insertionIndex + 1 : null;
}

export function addRankingEntry(
  category: RankingCategory,
  entry: RankingEntry,
): number | null {
  if (!/^[a-zA-Z0-9]{0,5}$/.test(entry.name) || !Number.isFinite(entry.timeSeconds)
    || entry.timeSeconds < 0) {
    throw new Error('Invalid ranking entry');
  }

  const rankings = getRankings();
  const entries = rankings[category];
  const position = entries.findIndex((current) => entry.timeSeconds < current.timeSeconds);
  const insertionIndex = position === -1 ? entries.length : position;
  if (insertionIndex >= RANKING_LIMIT) {
    return null;
  }
  entries.splice(insertionIndex, 0, entry);
  rankings[category] = entries.slice(0, RANKING_LIMIT);
  localStorage.setItem(RANKING_STORAGE_KEY, JSON.stringify(rankings));
  return insertionIndex + 1;
}
