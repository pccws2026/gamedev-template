import Phaser from 'phaser';
import { createWall, shuffleTiles, sortTiles, tileColor, tileLabel, type Tile } from '../mahjong/tiles';

type MahjongState = 'title' | 'playing';
type TileVisual = { tile: Tile; body: Phaser.GameObjects.Rectangle; label?: Phaser.GameObjects.Text };

export class MahjongScene extends Phaser.Scene {
  private readonly gameWidth = 1280;
  private readonly gameHeight = 720;
  private readonly tableGreen = 0x14532d;
  private readonly tileWidth = 56;
  private readonly tileHeight = 76;
  private readonly tileGap = 4;

  private state: MahjongState = 'title';
  private wall: Tile[] = [];
  private playerHand: Tile[] = [];
  private cpuHand: Tile[] = [];
  private playerDiscards: Tile[] = [];
  private doraIndicator!: Tile;
  private isPlayerDealer = false;
  private selectedTileId: number | undefined;
  private screenObjects: Phaser.GameObjects.GameObject[] = [];
  private playerVisuals: TileVisual[] = [];
  private wallCountText!: Phaser.GameObjects.Text;
  private actionText!: Phaser.GameObjects.Text;

  constructor() {
    super('MahjongScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(this.tableGreen);
    this.input.on('pointerdown', this.handleScenePointerDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.showTitle();
  }

  private handleScenePointerDown(): void {
    if (this.state === 'title') {
      this.startRound();
    }
  }

  private showTitle(): void {
    this.clearScreen();
    this.state = 'title';
    const title = this.add.text(this.gameWidth / 2, 270, '二人麻雀', {
      fontFamily: 'serif', fontSize: '72px', color: '#f8fafc', stroke: '#052e16', strokeThickness: 8,
    }).setOrigin(0.5);
    const prompt = this.add.text(this.gameWidth / 2, 390, 'クリックで始める', {
      fontFamily: 'sans-serif', fontSize: '30px', color: '#fde68a',
    }).setOrigin(0.5);
    this.screenObjects.push(title, prompt);
  }

  private startRound(): void {
    const shuffled = shuffleTiles(createWall());
    this.doraIndicator = shuffled.pop() as Tile;
    this.isPlayerDealer = Math.random() < 0.5;
    const playerCount = this.isPlayerDealer ? 14 : 13;
    const cpuCount = this.isPlayerDealer ? 13 : 14;
    this.playerHand = shuffled.splice(0, playerCount);
    this.cpuHand = shuffled.splice(0, cpuCount);
    this.wall = shuffled;
    this.playerDiscards = [];
    this.selectedTileId = undefined;
    this.state = 'playing';
    this.clearScreen();
    this.drawTableFrame();
    this.drawCpuHand();
    this.drawCenterInfo();
    this.drawPlayerHand();
    this.drawActionButtons();
    if (this.isPlayerDealer) {
      this.actionText.setText('親です。牌を選んで捨ててください');
    }
  }

  private drawTableFrame(): void {
    const roundText = this.add.text(28, 22, `東一局    親: ${this.isPlayerDealer ? 'PLAYER' : 'CPU'}`, {
      fontFamily: 'monospace', fontSize: '24px', color: '#f8fafc',
    });
    const cpuPoints = this.add.text(this.gameWidth - 28, 22, 'CPU 25,000点', {
      fontFamily: 'monospace', fontSize: '24px', color: '#fecaca',
    }).setOrigin(1, 0);
    const playerPoints = this.add.text(28, this.gameHeight - 116, 'PLAYER 25,000点', {
      fontFamily: 'monospace', fontSize: '24px', color: '#bfdbfe',
    });
    this.screenObjects.push(roundText, cpuPoints, playerPoints);
  }

  private drawCpuHand(): void {
    const startX = (this.gameWidth - (this.cpuHand.length * (this.tileWidth + this.tileGap))) / 2;
    for (let index = 0; index < this.cpuHand.length; index += 1) {
      const x = startX + index * (this.tileWidth + this.tileGap);
      const tile = this.add.rectangle(x, 92, this.tileWidth, this.tileHeight, 0xf59e0b)
        .setOrigin(0, 0).setStrokeStyle(2, 0x7c2d12);
      this.screenObjects.push(tile);
    }
  }

  private drawPlayerHand(): void {
    this.playerVisuals = [];
    const sortedHand = sortTiles(this.playerHand);
    this.playerHand = sortedHand;
    const totalWidth = sortedHand.length * this.tileWidth + (sortedHand.length - 1) * this.tileGap;
    const startX = (this.gameWidth - totalWidth) / 2;
    sortedHand.forEach((tile, index) => {
      const x = startX + index * (this.tileWidth + this.tileGap);
      const body = this.add.rectangle(x, this.gameHeight - 208, this.tileWidth, this.tileHeight, 0xf8fafc)
        .setOrigin(0, 0).setStrokeStyle(2, 0x1f2937).setInteractive({ useHandCursor: true });
      const label = this.add.text(x + this.tileWidth / 2, this.gameHeight - 170, tileLabel(tile), {
        fontFamily: 'serif', fontSize: '24px', color: tileColor(tile),
      }).setOrigin(0.5);
      body.on('pointerdown', () => this.handleTileClick(tile.id));
      const visual = { tile, body, label };
      this.playerVisuals.push(visual);
      this.screenObjects.push(body, label);
    });
  }

  private handleTileClick(tileId: number): void {
    if (this.state !== 'playing') return;
    const visual = this.playerVisuals.find((entry) => entry.tile.id === tileId);
    if (!visual) return;
    if (this.selectedTileId === tileId) {
      this.playerHand = this.playerHand.filter((tile) => tile.id !== tileId);
      this.playerDiscards.push(visual.tile);
      this.selectedTileId = undefined;
      this.actionText.setText(`${tileLabel(visual.tile)}を捨てました。次は「ツモる」`);
      this.redrawRoundObjects();
      return;
    }
    if (this.selectedTileId !== undefined) {
      const previous = this.playerVisuals.find((entry) => entry.tile.id === this.selectedTileId);
      previous?.body.setY(this.gameHeight - 208);
    }
    this.selectedTileId = tileId;
    visual.body.setY(this.gameHeight - 222);
    this.actionText.setText(`${tileLabel(visual.tile)}を選択中。もう一度クリックで捨てます`);
  }

  private drawCenterInfo(): void {
    const wall = this.add.rectangle(this.gameWidth / 2 - 90, 305, 180, 92, 0xf8fafc)
      .setStrokeStyle(3, 0x0f172a);
    const wallLabel = this.add.text(this.gameWidth / 2, 330, '牌山', {
      fontFamily: 'serif', fontSize: '30px', color: '#111827',
    }).setOrigin(0.5);
    this.wallCountText = this.add.text(this.gameWidth / 2, 370, `残り ${this.wall.length}枚`, {
      fontFamily: 'monospace', fontSize: '22px', color: '#111827',
    }).setOrigin(0.5);
    const dora = this.add.rectangle(this.gameWidth / 2 + 130, 305, this.tileWidth, this.tileHeight, 0xf8fafc)
      .setStrokeStyle(2, 0x1f2937);
    const doraLabel = this.add.text(this.gameWidth / 2 + 158, 343, tileLabel(this.doraIndicator), {
      fontFamily: 'serif', fontSize: '24px', color: tileColor(this.doraIndicator),
    }).setOrigin(0.5);
    this.screenObjects.push(wall, wallLabel, this.wallCountText, dora, doraLabel);
  }

  private drawActionButtons(): void {
    const buttons = ['ツモる', 'ポン', 'チー', 'カン', 'リーチ', 'ロン', 'ツモ'];
    const buttonWidth = 110;
    const gap = 10;
    const totalWidth = buttons.length * buttonWidth + (buttons.length - 1) * gap;
    const startX = (this.gameWidth - totalWidth) / 2;
    buttons.forEach((label, index) => {
      const x = startX + index * (buttonWidth + gap);
      const button = this.add.rectangle(x, this.gameHeight - 52, buttonWidth, 38, 0x1d4ed8)
        .setOrigin(0, 0).setStrokeStyle(2, 0xbfdbfe).setInteractive({ useHandCursor: true });
      const text = this.add.text(x + buttonWidth / 2, this.gameHeight - 33, label, {
        fontFamily: 'sans-serif', fontSize: '19px', color: '#f8fafc',
      }).setOrigin(0.5);
      button.on('pointerdown', () => this.handleAction(label));
      this.screenObjects.push(button, text);
    });
    this.actionText = this.add.text(this.gameWidth / 2, 438, '牌山からツモってください', {
      fontFamily: 'sans-serif', fontSize: '20px', color: '#dcfce7',
    }).setOrigin(0.5);
    this.screenObjects.push(this.actionText);
  }

  private handleAction(label: string): void {
    if (label !== 'ツモる' || this.wall.length === 0 || this.playerHand.length % 3 !== 1) {
      return;
    }
    const drawnTile = this.wall.pop();
    if (!drawnTile) return;
    this.playerHand.push(drawnTile);
    this.wallCountText.setText(`残り ${this.wall.length}枚`);
    this.actionText.setText(`${tileLabel(drawnTile)}をツモりました。牌を選んで捨ててください`);
    this.redrawRoundObjects();
  }

  private redrawRoundObjects(): void {
    this.clearScreen();
    this.drawTableFrame();
    this.drawCpuHand();
    this.drawCenterInfo();
    this.drawPlayerHand();
    this.drawActionButtons();
  }

  private clearScreen(): void {
    for (const object of this.screenObjects) object.destroy();
    this.screenObjects = [];
    this.playerVisuals = [];
  }

  private cleanup(): void {
    this.input.off('pointerdown', this.handleScenePointerDown, this);
  }
}
