export interface GameSettings {
  playerSpeed: number;
  playerAttack: number;
  playerAttackRange: number;
  playerHp: number;
  playerEnergy: number;
  enemySpeed: number;
  enemyAttack: number;
  enemyAttackRange: number;
  enemyHp: number;
  gameSpeed: number;
  developerMode: boolean;
  roundTimeSeconds: number;
  elapsedTimeStartSeconds: number;
  timerEnabled: boolean;
}

export type SystemCommandResult =
  | 'applied'
  | 'ignored'
  | 'invalid'
  | 'not-command'
  | 'show-developer-ranking';
type MultiplierSetting = keyof Pick<
  GameSettings,
  | 'playerSpeed'
  | 'playerAttack'
  | 'playerAttackRange'
  | 'playerHp'
  | 'playerEnergy'
  | 'enemySpeed'
  | 'enemyAttack'
  | 'enemyAttackRange'
  | 'enemyHp'
>;

const DEFAULT_SETTINGS: GameSettings = {
  playerSpeed: 1,
  playerAttack: 1,
  playerAttackRange: 1,
  playerHp: 1,
  playerEnergy: 1,
  enemySpeed: 1,
  enemyAttack: 1,
  enemyAttackRange: 1,
  enemyHp: 1,
  gameSpeed: 1,
  developerMode: false,
  roundTimeSeconds: 60,
  elapsedTimeStartSeconds: 0,
  timerEnabled: true,
};

let settings: GameSettings = { ...DEFAULT_SETTINGS };
let settingsModifiedByCommand = false;

export function getGameSettings(): Readonly<GameSettings> {
  return settings;
}

export function areGameSettingsDefault(
  current: Readonly<GameSettings> = settings,
): boolean {
  return !settingsModifiedByCommand && Object.keys(DEFAULT_SETTINGS).every((key) => (
    current[key as keyof GameSettings] === DEFAULT_SETTINGS[key as keyof GameSettings]
  ));
}

export function applySystemCommand(input: string): SystemCommandResult {
  const tokens = input.trim().toLowerCase().split(/\s+/);
  if (tokens[0] === 'gamemode' || tokens[0] === 'gmd') {
    if (tokens.length !== 2) {
      return 'invalid';
    }
    if (tokens[1] === 'developer' || tokens[1] === 'dev') {
      settings.developerMode = true;
      settingsModifiedByCommand = true;
      return 'applied';
    }
    if (tokens[1] === 'default' || tokens[1] === 'def') {
      settings.developerMode = false;
      settingsModifiedByCommand = true;
      return 'applied';
    }
    return 'invalid';
  }

  if (tokens[0] !== 'system' && tokens[0] !== 'sys') {
    return 'not-command';
  }

  if (
    tokens.length === 3
    && (tokens[1] === 'developer' || tokens[1] === 'dev')
    && (tokens[2] === 'ranking' || tokens[2] === 'ran')
  ) {
    return 'show-developer-ranking';
  }

  if (tokens.length === 2 && (tokens[1] === 'default' || tokens[1] === 'def')) {
    settings = { ...DEFAULT_SETTINGS };
    settingsModifiedByCommand = false;
    return 'applied';
  }

  if (tokens.length === 3 && (tokens[1] === 'speed' || tokens[1] === 'sp')) {
    const speed = Number(tokens[2]);
    if (!Number.isFinite(speed) || speed <= 0) {
      return 'invalid';
    }
    settings.gameSpeed = speed;
    settingsModifiedByCommand = true;
    return 'applied';
  }

  if (
    tokens.length === 5
    && (tokens[2] === 'attack' || tokens[2] === 'at')
    && (tokens[3] === 'range' || tokens[3] === 'rg')
  ) {
    const range = Number(tokens[4]);
    if (!Number.isFinite(range) || range <= 0) {
      return 'invalid';
    }
    if (tokens[1] === 'player' || tokens[1] === 'pyr') {
      settings.playerAttackRange = range;
      settingsModifiedByCommand = true;
      return 'applied';
    }
    if (tokens[1] === 'enemy' || tokens[1] === 'emy') {
      settings.enemyAttackRange = range;
      settingsModifiedByCommand = true;
      return 'applied';
    }
    return 'invalid';
  }

  if (tokens[1] === 'time' && tokens.length === 3) {
    if (tokens[2] === 'true' || tokens[2] === 'false') {
      settings.timerEnabled = tokens[2] === 'true';
      settingsModifiedByCommand = true;
      return 'applied';
    }

    const seconds = Number(tokens[2]);
    if (Number.isFinite(seconds) && seconds > 0) {
      settings.roundTimeSeconds = seconds;
      settings.elapsedTimeStartSeconds = seconds;
      settingsModifiedByCommand = true;
      return 'applied';
    }
    return 'invalid';
  }

  if (tokens.length !== 4) {
    return 'invalid';
  }

  const subject = tokens[1];
  const property = tokens[2];
  const valueText = tokens[3];
  const value = Number(valueText);
  if (!Number.isFinite(value) || value <= 0) {
    return 'invalid';
  }

  if (
    (subject === 'enemy' || subject === 'emy')
    && (property === 'energy' || property === 'eg')
  ) {
    return 'ignored';
  }

  const targetSettings: Record<string, MultiplierSetting> = {
    'player speed': 'playerSpeed',
    'player sp': 'playerSpeed',
    'player attack': 'playerAttack',
    'player at': 'playerAttack',
    'player heart': 'playerHp',
    'player hp': 'playerHp',
    'player energy': 'playerEnergy',
    'player eg': 'playerEnergy',
    'pyr speed': 'playerSpeed',
    'pyr sp': 'playerSpeed',
    'pyr attack': 'playerAttack',
    'pyr at': 'playerAttack',
    'pyr heart': 'playerHp',
    'pyr hp': 'playerHp',
    'pyr energy': 'playerEnergy',
    'pyr eg': 'playerEnergy',
    'enemy speed': 'enemySpeed',
    'enemy sp': 'enemySpeed',
    'enemy attack': 'enemyAttack',
    'enemy at': 'enemyAttack',
    'enemy heart': 'enemyHp',
    'enemy hp': 'enemyHp',
    'emy speed': 'enemySpeed',
    'emy sp': 'enemySpeed',
    'emy attack': 'enemyAttack',
    'emy at': 'enemyAttack',
    'emy heart': 'enemyHp',
    'emy hp': 'enemyHp',
  };
  const settingKey = targetSettings[`${subject} ${property}`];
  if (!settingKey) {
    return 'invalid';
  }

  settings[settingKey] = value;
  settingsModifiedByCommand = true;
  return 'applied';
}
