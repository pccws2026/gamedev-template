import Phaser from 'phaser';
import { createInitialChests, type ChestData } from '../game/Chest';
import { createSeededRandom, createMaze } from '../game/Maze';
import type { ReplayFrame, RankingCategory, RankingEntry } from '../game/Ranking';

interface ReplaySceneData {
  category: RankingCategory;
  entry: RankingEntry;
}

const SEEK_X = 180;
const SEEK_WIDTH = 860;
const SEEK_Y = 635;
const BOARD_TOP = 120;
const BOARD_HEIGHT = 430;
const BOARD_SCALE_Y = BOARD_HEIGHT / 560;

function replayY(y: number): number {
  return BOARD_TOP + (y - 112) * BOARD_SCALE_Y;
}

export class ReplayScene extends Phaser.Scene {
  private entry!: RankingEntry;
  private category!: RankingCategory;
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
  private keyCountText!: Phaser.GameObjects.Text;
  private chests: ChestData[] = [];

  constructor() {
    super('ReplayScene');
  }

  init(data: ReplaySceneData): void {
    this.entry = data.entry;
    this.category = data.category;
    this.frames = data.entry.replay ?? [];
    this.durationMs = this.frames.at(-1)?.timeMs ?? 0;
    this.currentTimeMs = 0;
    this.isPlaying = true;
    this.isSeeking = false;
  }

  create(): void {
    const maze = createMaze(this.entry.seed ?? 0);
    this.chests = createInitialChests(
      maze.walkableCells,
      createSeededRandom((this.entry.seed ?? 0) ^ 0x5f3759df),
    );
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
    const doorGraphics = this.add.graphics();
    const doorWidth = maze.exitDoor.isVertical ? 26 : 56;
    const doorHeight = maze.exitDoor.isVertical ? 56 : 26;
    doorGraphics.fillStyle(0x58c4b8, 1);
    doorGraphics.fillRect(
      maze.exitDoor.x - doorWidth / 2,
      replayY(maze.exitDoor.y) - doorHeight * BOARD_SCALE_Y / 2,
      doorWidth,
      doorHeight * BOARD_SCALE_Y,
    );

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
    const rankingTitle = this.category === 'DEV' ? '開発ランキング' : `${this.category}ランキング`;
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

    const seedButton = this.add.text(640, 687, `Seed: ${this.entry.seed ?? '不明'}　（クリックでタイトルへ）`, {
      fontFamily: 'monospace',
      fontSize: '17px',
      color: '#f5d58a',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    seedButton.on('pointerdown', () => {
      if (this.entry.seed !== undefined) {
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
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('RankingScene', {
      developer: this.category === 'DEV',
    }));
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

    this.chestGraphics.clear();
    this.chests.forEach((chest, index) => {
      const isOpened = (stateFrame.openedChestMask & (1 << index)) !== 0;
      const chestY = replayY(chest.y);
      this.chestGraphics.fillStyle(isOpened ? 0x66717d : 0xc8894b, 1);
      this.chestGraphics.fillRect(chest.x - 12, chestY - 8 * BOARD_SCALE_Y, 24, 16 * BOARD_SCALE_Y);
      this.chestGraphics.fillStyle(isOpened ? 0x84909a : 0xe2ad62, 1);
      this.chestGraphics.fillRect(chest.x - 12, chestY - 8 * BOARD_SCALE_Y, 24, 4 * BOARD_SCALE_Y);
    });

    this.enemyGraphics.clear();
    this.enemyGraphics.fillStyle(0xe05252, 1);
    for (const enemyIndex of [0, 2]) {
      const previousX = previous.enemies[enemyIndex];
      const previousY = previous.enemies[enemyIndex + 1];
      const nextX = next.enemies[enemyIndex];
      const nextY = next.enemies[enemyIndex + 1];
      const isAlive = (
        stateFrame.enemies[enemyIndex] !== 0
        || stateFrame.enemies[enemyIndex + 1] !== 0
      );
      const enemyX = previousX !== 0 || previousY !== 0
        ? Phaser.Math.Linear(previousX, nextX || previousX, progress)
        : nextX;
      const enemyY = previousX !== 0 || previousY !== 0
        ? Phaser.Math.Linear(previousY, nextY || previousY, progress)
        : nextY;
      if (isAlive) {
        this.enemyGraphics.fillCircle(enemyX, replayY(enemyY), 20);
      }
    }
    this.updateControls();
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
