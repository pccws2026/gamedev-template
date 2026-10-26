import Phaser from 'phaser';
import { createInitialChests, type ChestData } from '../game/Chest';
import { createSeededRandom, createMaze } from '../game/Maze';
import type { ReplayFrame, RankingCategory, RankingEntry } from '../game/Ranking';

interface ReplaySceneData {
  category?: RankingCategory;
  entry: RankingEntry;
  title?: string;
  returnScene?: string;
  rankingScrollOffset?: number;
}

const SEEK_X = 180;
const SEEK_WIDTH = 860;
const SEEK_Y = 635;
const BOARD_TOP = 120;
const BOARD_HEIGHT = 430;
const BOARD_SCALE_Y = BOARD_HEIGHT / 560;
const DAMAGE_FLASH_DURATION_MS = 200;
const KEY_PICKUP_DURATION_MS = 900;

function replayY(y: number): number {
  return BOARD_TOP + (y - 112) * BOARD_SCALE_Y;
}

export class ReplayScene extends Phaser.Scene {
  private entry!: RankingEntry;
  private category!: RankingCategory;
  private replayTitle?: string;
  private returnScene?: string;
  private rankingScrollOffset = 0;
  private frames: ReplayFrame[] = [];
  private durationMs = 0;
  private currentTimeMs = 0;
  private isPlaying = true;
  private isSeeking = false;
  private playButton!: Phaser.GameObjects.Text;
  private rewindButton!: Phaser.GameObjects.Text;
  private fastForwardButton!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private seekGraphics!: Phaser.GameObjects.Graphics;
  private player!: Phaser.GameObjects.Arc;
  private playerDirection!: Phaser.GameObjects.Graphics;
  private chestGraphics!: Phaser.GameObjects.Graphics;
  private enemyGraphics!: Phaser.GameObjects.Graphics;
  private doorGraphics!: Phaser.GameObjects.Graphics;
  private statusBarGraphics!: Phaser.GameObjects.Graphics;
  private keyPickupGraphics!: Phaser.GameObjects.Graphics;
  private keyCountText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private doorStatusText!: Phaser.GameObjects.Text;
  private keyPickupText!: Phaser.GameObjects.Text;
  private exitDoorBounds!: { x: number; y: number; width: number; height: number };
  private chests: ChestData[] = [];

  constructor() {
    super('ReplayScene');
  }

  init(data: ReplaySceneData): void {
    this.entry = data.entry;
    this.category = data.category ?? 'RSG';
    this.replayTitle = data.title;
    this.returnScene = data.returnScene;
    this.rankingScrollOffset = data.rankingScrollOffset ?? 0;
    this.frames = data.entry.replay ?? [];
    this.durationMs = this.frames.at(-1)?.timeMs ?? 0;
    this.currentTimeMs = 0;
    this.isPlaying = true;
    this.isSeeking = false;
  }

  create(): void {
    const maze = createMaze(this.entry.seed ?? 0);
    this.chests = this.entry.chestPositions
      ? this.entry.chestPositions.map(({ x, y }, index) => ({
        x,
        y,
        isCorrect: ((this.entry.correctChestMask ?? 0) & (1 << index)) !== 0,
        isOpened: false,
      }))
      : createInitialChests(
        maze.walkableCells,
        createSeededRandom((this.entry.seed ?? 0) ^ 0x5f3759df),
      ).map((chest) => ({ ...chest, isCorrect: false }));
    this.cameras.main.setBackgroundColor('#101722');
    const background = this.add.graphics();
    background.fillStyle(0x172333, 1);
    background.fillRect(0, 0, 1280, 720);
    background.fillStyle(0x26384a, 1);
    background.fillRect(48, BOARD_TOP, 1184, BOARD_HEIGHT);

    const walls = this.add.graphics();
    walls.fillStyle(0x0d1720, 1);
    for (const wall of maze.walls) {
      walls.fillRect(wall.x, replayY(wall.y), wall.width, wall.height * BOARD_SCALE_Y);
    }
    const doorWidth = maze.exitDoor.isVertical ? 26 : 56;
    const doorHeight = maze.exitDoor.isVertical ? 56 : 26;
    this.exitDoorBounds = {
      x: maze.exitDoor.x - doorWidth / 2,
      y: replayY(maze.exitDoor.y) - doorHeight * BOARD_SCALE_Y / 2,
      width: doorWidth,
      height: doorHeight * BOARD_SCALE_Y,
    };
    this.doorGraphics = this.add.graphics().setDepth(4);

    this.chestGraphics = this.add.graphics().setDepth(3);
    this.enemyGraphics = this.add.graphics().setDepth(5);
    this.player = this.add.circle(0, 0, 20, 0x58c4b8).setDepth(7);
    this.player.setStrokeStyle(3, 0xd8fff4);
    this.playerDirection = this.add.graphics().setDepth(8);
    this.keyCountText = this.add.text(36, 26, '', {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      color: '#f5d58a',
    });
    this.statusText = this.add.text(36, 54, '', {
      fontFamily: 'monospace',
      fontSize: '17px',
      color: '#f5f1e8',
    });
    this.statusBarGraphics = this.add.graphics().setDepth(2);
    this.add.text(952, 14, 'HP', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#b7c9d8',
    });
    this.add.text(952, 41, 'EG', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#b7c9d8',
    });
    this.doorStatusText = this.add.text(640, 78, '', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#f5f1e8',
      backgroundColor: '#101722',
      padding: { x: 10, y: 4 },
    }).setOrigin(0.5);
    this.keyPickupText = this.add.text(0, 0, '鍵を獲得！', {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#f5d58a',
      stroke: '#101722',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(9).setVisible(false);
    this.keyPickupGraphics = this.add.graphics().setDepth(8);
    const rankingTitle = this.replayTitle
      ?? (this.category === 'DEV'
        ? '開発ランキング'
        : this.category === 'DTH'
          ? 'デスランキング'
          : `${this.category}ランキング`);
    this.add.text(640, 34, `${rankingTitle} リプレイ`, {
      fontFamily: 'sans-serif',
      fontSize: '28px',
      color: '#f5f1e8',
    }).setOrigin(0.5);

    this.playButton = this.add.text(640, 585, '', {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#f5f1e8',
      backgroundColor: '#26384a',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.playButton.on('pointerdown', () => this.togglePlayback());
    this.rewindButton = this.add.text(470, 585, '◀ 5秒', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#f5f1e8',
      backgroundColor: '#26384a',
      padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.rewindButton.on('pointerdown', () => this.seekBy(-5000));
    this.fastForwardButton = this.add.text(810, 585, '5秒 ▶', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#f5f1e8',
      backgroundColor: '#26384a',
      padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.fastForwardButton.on('pointerdown', () => this.seekBy(5000));
    this.timeText = this.add.text(1080, SEEK_Y - 11, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#f5f1e8',
    }).setOrigin(0, 0.5);
    this.seekGraphics = this.add.graphics();
    this.add.zone(SEEK_X, SEEK_Y - 12, SEEK_WIDTH, 24)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        this.isSeeking = true;
        this.seekToPointer(pointer);
      });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isSeeking && pointer.isDown) {
        this.seekToPointer(pointer);
      }
    });
    this.input.on('pointerup', () => {
      this.isSeeking = false;
    });

    const seedButton = this.add.text(
      640,
      687,
      this.returnScene
        ? 'リザルトへ戻る（クリック）'
        : `Seed: ${this.entry.seed ?? '不明'}　（クリックでタイトルへ）`,
      {
      fontFamily: 'monospace',
      fontSize: '17px',
      color: '#f5d58a',
      },
    ).setOrigin(0.5).setInteractive({ useHandCursor: true });
    seedButton.on('pointerdown', () => {
      if (this.returnScene) {
        this.returnToScene();
      } else if (this.entry.seed !== undefined) {
        this.scene.start('TitleScene', { seed: this.entry.seed });
      }
    });

    this.input.keyboard?.on('keydown-SPACE', this.togglePlayback, this);
    this.input.keyboard?.on('keydown-LEFT', (event: KeyboardEvent) => {
      if (!event.repeat) {
        this.seekBy(-5000);
      }
    });
    this.input.keyboard?.on('keydown-RIGHT', (event: KeyboardEvent) => {
      if (!event.repeat) {
        this.seekBy(5000);
      }
    });
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.returnScene) {
        this.returnToScene();
      } else {
        this.scene.start('RankingScene', {
          developer: this.category === 'DEV',
          death: this.category === 'DTH',
          scrollOffset: this.rankingScrollOffset,
        });
      }
    });
    this.renderFrame();
  }

  update(_time: number, delta: number): void {
    if (this.isPlaying && !this.isSeeking) {
      this.currentTimeMs = Math.min(this.durationMs, this.currentTimeMs + delta);
      if (this.currentTimeMs >= this.durationMs) {
        this.isPlaying = false;
      }
      this.renderFrame();
    }
  }

  private togglePlayback(event?: KeyboardEvent): void {
    if (event?.repeat) {
      return;
    }
    this.isPlaying = !this.isPlaying;
    if (this.currentTimeMs >= this.durationMs && this.isPlaying) {
      this.currentTimeMs = 0;
      this.renderFrame();
    }
    this.updateControls();
  }

  private seekBy(amount: number): void {
    this.currentTimeMs = Phaser.Math.Clamp(
      this.currentTimeMs + amount,
      0,
      this.durationMs,
    );
    this.renderFrame();
  }

  private seekToPointer(pointer: Phaser.Input.Pointer): void {
    this.currentTimeMs = Phaser.Math.Clamp(
      (pointer.x - SEEK_X) / SEEK_WIDTH,
      0,
      1,
    ) * this.durationMs;
    this.renderFrame();
  }

  private renderFrame(): void {
    if (this.frames.length === 0) {
      return;
    }
    let nextIndex = this.frames.findIndex((frame) => frame.timeMs >= this.currentTimeMs);
    if (nextIndex < 0) {
      nextIndex = this.frames.length - 1;
    }
    const next = this.frames[nextIndex];
    const previous = this.frames[Math.max(0, nextIndex - 1)];
    const span = next.timeMs - previous.timeMs;
    const progress = span > 0
      ? Phaser.Math.Clamp((this.currentTimeMs - previous.timeMs) / span, 0, 1)
      : 0;
    const stateFrame = progress >= 1 ? next : previous;
    const x = Phaser.Math.Linear(previous.x, next.x, progress);
    const y = Phaser.Math.Linear(previous.y, next.y, progress);
    const angle = Phaser.Math.Linear(previous.angle, next.angle, progress);
    const screenY = replayY(y);
    this.player.setPosition(x, screenY);
    this.playerDirection.clear();
    this.playerDirection.lineStyle(4, 0xf5f1e8, 1);
    this.playerDirection.lineBetween(
      x,
      screenY,
      x + Math.cos(angle) * 30,
      screenY + Math.sin(angle) * 30 * BOARD_SCALE_Y,
    );
    this.keyCountText.setText(`鍵: ${stateFrame.keyCount}/3`);
    const hp = Phaser.Math.Linear(previous.hp ?? 10, next.hp ?? previous.hp ?? 10, progress);
    const energy = Phaser.Math.Linear(previous.energy ?? 1, next.energy ?? previous.energy ?? 1, progress);
    this.statusText.setText(`HP: ${hp.toFixed(1)}　EG: ${energy.toFixed(2)}`);
    const hpMax = stateFrame.hpMax ?? 10;
    const energyMax = stateFrame.energyMax ?? 1;
    this.drawStatusBar(985, 14, 240, 10, hp / hpMax, 0xe8876b);
    this.drawStatusBar(985, 41, 240, 10, energy / energyMax, 0x58c4b8);
    this.drawExitDoor(stateFrame.keyCount);
    let lastDamageFrame: ReplayFrame | undefined;
    for (let index = Math.min(nextIndex, this.frames.length - 1); index >= 0; index -= 1) {
      const frame = this.frames[index];
      if (frame.tookDamage === true && frame.timeMs <= this.currentTimeMs) {
        lastDamageFrame = frame;
        break;
      }
    }
    const tookDamage = lastDamageFrame !== undefined
      && this.currentTimeMs - lastDamageFrame.timeMs < DAMAGE_FLASH_DURATION_MS;
    this.player.setFillStyle(tookDamage ? 0xff3b3b : 0x58c4b8);
    this.player.setStrokeStyle(tookDamage ? 5 : 3, tookDamage ? 0xffffff : 0xd8fff4);
    let lastKeyFrame: ReplayFrame | undefined;
    for (let index = Math.min(nextIndex, this.frames.length - 1); index >= 0; index -= 1) {
      const frame = this.frames[index];
      if (frame.keyAcquired === true && frame.timeMs <= this.currentTimeMs) {
        lastKeyFrame = frame;
        break;
      }
    }
    const keyAge = lastKeyFrame ? this.currentTimeMs - lastKeyFrame.timeMs : KEY_PICKUP_DURATION_MS;
    const keyProgress = Phaser.Math.Clamp(keyAge / KEY_PICKUP_DURATION_MS, 0, 1);
    const showingKeyPickup = lastKeyFrame !== undefined && keyAge < KEY_PICKUP_DURATION_MS;
    this.keyPickupText
      .setPosition(x, screenY - 48)
      .setVisible(showingKeyPickup)
      .setAlpha(1 - keyProgress);
    this.keyPickupGraphics.clear().setAlpha(1 - keyProgress);
    if (showingKeyPickup) {
      this.keyPickupGraphics.lineStyle(5, 0xf5d58a, 1);
      this.keyPickupGraphics.strokeCircle(x, screenY, 24 + keyProgress * 28);
    }

    this.chestGraphics.clear();
    this.chests.forEach((chest, index) => {
      const isOpened = (stateFrame.openedChestMask & (1 << index)) !== 0;
      const chestY = replayY(chest.y);
      this.chestGraphics.fillStyle(isOpened ? 0x66717d : 0xc8894b, 1);
      this.chestGraphics.fillRect(chest.x - 12, chestY - 8 * BOARD_SCALE_Y, 24, 16 * BOARD_SCALE_Y);
      this.chestGraphics.fillStyle(isOpened ? 0x84909a : 0xe2ad62, 1);
      this.chestGraphics.fillRect(chest.x - 12, chestY - 8 * BOARD_SCALE_Y, 24, 4 * BOARD_SCALE_Y);
      if (chest.isCorrect) {
        const keyX = chest.x + 18;
        const keyY = chestY - 17;
        this.chestGraphics.lineStyle(3, 0xf5d58a, 1);
        this.chestGraphics.strokeCircle(keyX, keyY, 5);
        this.chestGraphics.lineBetween(keyX + 5, keyY, keyX + 16, keyY);
        this.chestGraphics.lineBetween(keyX + 11, keyY, keyX + 11, keyY + 4);
        this.chestGraphics.lineBetween(keyX + 15, keyY, keyX + 15, keyY + 3);
      }
    });

    this.enemyGraphics.clear();
    const enemyCount = this.frames.reduce(
      (count, frame) => Math.max(count, Math.floor(frame.enemies.length / 2)),
      0,
    );
    for (let enemySlot = 0; enemySlot < enemyCount; enemySlot += 1) {
      const enemyIndex = enemySlot * 2;
      const previousX = previous.enemies[enemyIndex] ?? next.enemies[enemyIndex] ?? 0;
      const previousY = previous.enemies[enemyIndex + 1] ?? next.enemies[enemyIndex + 1] ?? 0;
      const nextX = next.enemies[enemyIndex] ?? previousX;
      const nextY = next.enemies[enemyIndex + 1] ?? previousY;
      const recordedEnemyHp = stateFrame.enemyHp?.[enemySlot];
      const isAlive = recordedEnemyHp === undefined
        ? (stateFrame.enemies[enemyIndex] ?? 0) !== 0
          || (stateFrame.enemies[enemyIndex + 1] ?? 0) !== 0
        : recordedEnemyHp > 0;
      const enemyX = Phaser.Math.Linear(previousX, nextX, progress);
      const enemyY = Phaser.Math.Linear(previousY, nextY, progress);
      let lastEnemyDamageFrame: ReplayFrame | undefined;
      for (let index = Math.min(nextIndex, this.frames.length - 1); index >= 0; index -= 1) {
        const frame = this.frames[index];
        if (
          frame.enemyTookDamage?.[enemySlot] === true
          && frame.timeMs <= this.currentTimeMs
        ) {
          lastEnemyDamageFrame = frame;
          break;
        }
      }
      const enemyHitAge = lastEnemyDamageFrame
        ? this.currentTimeMs - lastEnemyDamageFrame.timeMs
        : DAMAGE_FLASH_DURATION_MS;
      const enemyHit = enemyHitAge < DAMAGE_FLASH_DURATION_MS;
      if (isAlive || enemyHit) {
        const enemyScreenY = replayY(enemyY);
        const enemyHp = stateFrame.enemyHp?.[enemySlot] ?? stateFrame.enemyHpMax ?? 20;
        const enemyHpMax = stateFrame.enemyHpMax ?? 20;
        this.enemyGraphics.fillStyle(enemyHit ? 0xffdf72 : 0xe05252, 1);
        this.enemyGraphics.fillCircle(enemyX, enemyScreenY, 20);
        if (enemyHit) {
          this.enemyGraphics.lineStyle(4, 0xffffff, 1);
          this.enemyGraphics.strokeCircle(enemyX, enemyScreenY, 25);
        }
        if (isAlive) {
          this.enemyGraphics.fillStyle(0x26384a, 1);
          this.enemyGraphics.fillRect(enemyX - 20, enemyScreenY - 29, 40, 5);
          this.enemyGraphics.fillStyle(0xe8876b, 1);
          this.enemyGraphics.fillRect(
            enemyX - 19,
            enemyScreenY - 28,
            38 * Phaser.Math.Clamp(enemyHp / enemyHpMax, 0, 1),
            3,
          );
        }
      }
    }
    this.updateControls();
  }

  private drawStatusBar(
    x: number,
    y: number,
    width: number,
    height: number,
    value: number,
    color: number,
  ): void {
    this.statusBarGraphics.fillStyle(0x26384a, 1);
    this.statusBarGraphics.fillRect(x, y, width, height);
    this.statusBarGraphics.fillStyle(color, 1);
    this.statusBarGraphics.fillRect(
      x + 2,
      y + 2,
      (width - 4) * Phaser.Math.Clamp(value, 0, 1),
      height - 4,
    );
    this.statusBarGraphics.lineStyle(1, 0x7f9bb3, 1);
    this.statusBarGraphics.strokeRect(x, y, width, height);
  }

  private drawExitDoor(keyCount: number): void {
    const canEscape = keyCount >= 3;
    this.doorGraphics.clear();
    this.doorGraphics.fillStyle(canEscape ? 0x58c4b8 : 0x8c554e, 1);
    this.doorGraphics.fillRect(
      this.exitDoorBounds.x,
      this.exitDoorBounds.y,
      this.exitDoorBounds.width,
      this.exitDoorBounds.height,
    );
    this.doorGraphics.lineStyle(2, canEscape ? 0xd8fff4 : 0xf2b09b, 1);
    this.doorGraphics.strokeRect(
      this.exitDoorBounds.x,
      this.exitDoorBounds.y,
      this.exitDoorBounds.width,
      this.exitDoorBounds.height,
    );
    this.doorStatusText
      .setText(canEscape ? '脱出可能' : `施錠中　鍵 ${keyCount}/3`)
      .setColor(canEscape ? '#58c4b8' : '#f2b09b');
  }

  private returnToScene(): void {
    if (!this.returnScene) {
      return;
    }
    this.scene.stop();
    this.scene.resume(this.returnScene);
  }

  private updateControls(): void {
    this.playButton.setText(this.isPlaying ? '一時停止' : '再生');
    const elapsed = this.currentTimeMs / 1000;
    this.timeText.setText(
      `${elapsed.toFixed(1)} / ${(this.durationMs / 1000).toFixed(1)}秒`,
    );
    this.seekGraphics.clear();
    this.seekGraphics.fillStyle(0x26384a, 1);
    this.seekGraphics.fillRoundedRect(SEEK_X, SEEK_Y - 3, SEEK_WIDTH, 6, 3);
    const progress = this.durationMs === 0 ? 0 : this.currentTimeMs / this.durationMs;
    this.seekGraphics.fillStyle(0x58c4b8, 1);
    this.seekGraphics.fillRoundedRect(SEEK_X, SEEK_Y - 3, SEEK_WIDTH * progress, 6, 3);
    this.seekGraphics.fillStyle(0xf5d58a, 1);
    this.seekGraphics.fillCircle(SEEK_X + SEEK_WIDTH * progress, SEEK_Y, 9);
    this.seekGraphics.lineStyle(1, 0xf5f1e8, 1);
    this.seekGraphics.strokeCircle(SEEK_X + SEEK_WIDTH * progress, SEEK_Y, 9);
  }
}
