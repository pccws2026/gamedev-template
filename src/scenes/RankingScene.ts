import Phaser from 'phaser';
import {
  getRankings,
  RANKING_LIMIT,
  type RankingCategory,
  type RankingEntry,
} from '../game/Ranking';

const ROW_HEIGHT = 36;
const ROWS_VISIBLE = 11;
const ROWS_TOP = 205;
const ROWS_BOTTOM = ROWS_TOP + ROW_HEIGHT * ROWS_VISIBLE;

export class RankingScene extends Phaser.Scene {
  private scrollOffset = 0;
  private scrollbarDragging = false;
  private pageContent: Phaser.GameObjects.GameObject[] = [];
  private developerRanking = false;
  private deathRanking = false;

  constructor() {
    super('RankingScene');
  }

  init(data?: { developer?: boolean; death?: boolean; scrollOffset?: number }): void {
    this.developerRanking = data?.developer ?? false;
    this.deathRanking = data?.death ?? false;
    this.scrollOffset = data?.scrollOffset ?? 0;
  }

  create(): void {
    this.pageContent = [];
    this.cameras.main.setBackgroundColor('#101722');

    const background = this.add.graphics();
    background.fillStyle(0x172333, 1);
    background.fillRect(0, 0, 1280, 720);
    background.fillStyle(0x1c2c3d, 0.96);
    background.fillRoundedRect(100, 54, 1080, 612, 16);
    background.lineStyle(2, 0x526b7b, 1);
    background.strokeRoundedRect(100, 54, 1080, 612, 16);
    background.fillStyle(this.deathRanking ? 0xe05252 : 0x58c4b8, 1);
    background.fillRect(100, 54, 1080, 6);
    if (this.developerRanking || this.deathRanking) {
      background.lineStyle(1, 0x526b7b, 1);
      background.lineBetween(460, 145, 460, ROWS_BOTTOM);
      background.lineBetween(820, 145, 820, ROWS_BOTTOM);
    }

    this.add.text(
      640,
      98,
      this.developerRanking
        ? '開発ランキング'
        : this.deathRanking ? 'デスランキング' : 'ランキング',
      {
        fontFamily: 'sans-serif',
        fontSize: '38px',
        color: this.deathRanking ? '#e05252' : '#f5f1e8',
      },
    ).setOrigin(0.5);

    this.add.text(640, 644, 'ホイール / ↑ ↓でスクロール　/　Escでタイトル', {
      fontFamily: 'sans-serif',
      fontSize: '17px',
      color: '#b7c9d8',
    }).setOrigin(0.5);
    this.add.text(640, 122, 'タイムをクリックするとリプレイを再生', {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: '#b7c9d8',
    }).setOrigin(0.5);

    this.input.keyboard?.on('keydown-ESC', this.returnToTitle, this);
    this.input.keyboard?.on('keydown-UP', () => this.scrollRows(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.scrollRows(1));
    this.input.on(
      'wheel',
      (
        pointer: Phaser.Input.Pointer,
        _over: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number,
      ) => {
        if (pointer.y >= ROWS_TOP && pointer.y <= ROWS_BOTTOM) {
          this.scrollRows(Math.sign(deltaY) * 3);
        }
      },
    );
    this.input.on('pointermove', this.dragScrollbar, this);
    this.input.on('pointerup', () => {
      this.scrollbarDragging = false;
    });
    this.renderRows();
  }

  private scrollRows(amount: number): void {
    const rankings = getRankings();
    const rowCount = this.deathRanking
      ? rankings.DTH.length
      : this.developerRanking
        ? rankings.DEV.length
        : Math.min(RANKING_LIMIT, Math.max(rankings.RSG.length, rankings.SSG.length));
    this.scrollOffset = Phaser.Math.Clamp(
      this.scrollOffset + amount,
      0,
      Math.max(0, rowCount - ROWS_VISIBLE),
    );
    this.renderRows();
  }

  private renderRows(): void {
    for (const gameObject of this.pageContent) {
      gameObject.destroy();
    }
    this.pageContent = [];

    const rankings = getRankings();
    const singleRanking = this.developerRanking || this.deathRanking;
    const positions = singleRanking
      ? [280, 640, 1000]
      : [208, 430, 640, 850, 1070];
    if (singleRanking) {
      const accentColor = this.deathRanking ? '#e05252' : '#58c4b8';
      const headings = [
        ['順位', accentColor],
        ['名前', this.deathRanking ? accentColor : '#b7c9d8'],
        ['タイム', this.deathRanking ? accentColor : '#f5d58a'],
      ] as const;
      headings.forEach(([label, color], index) => {
        this.addRowText(label, positions[index], 157, color, '32px');
      });
    } else {
      this.addRowText('RSG', (positions[0] + positions[1]) / 2, 143, '#58c4b8', '27px');
      this.addRowText('順位', positions[2], 143, '#b7c9d8', '27px');
      this.addRowText('SSG', (positions[3] + positions[4]) / 2, 143, '#f5d58a', '27px');
      this.addRowText('名前', positions[0], 174, '#58c4b8', '22px');
      this.addRowText('タイム', positions[1], 174, '#58c4b8', '22px');
      this.addRowText('名前', positions[3], 174, '#f5d58a', '22px');
      this.addRowText('タイム', positions[4], 174, '#f5d58a', '22px');
    }

    const rowCount = this.deathRanking
      ? rankings.DTH.length
      : this.developerRanking
        ? rankings.DEV.length
        : Math.min(RANKING_LIMIT, Math.max(rankings.RSG.length, rankings.SSG.length));
    if (rowCount === 0) {
      this.addRowText('まだランキングがありません', 640, ROWS_TOP, '#b7c9d8', '26px');
      return;
    }

    const visibleRows = Math.min(ROWS_VISIBLE, rowCount - this.scrollOffset);
    for (let index = 0; index < visibleRows; index += 1) {
      const rank = this.scrollOffset + index;
      const y = ROWS_TOP + index * ROW_HEIGHT;
      if (singleRanking) {
        const category = this.deathRanking ? 'DTH' : 'DEV';
        const entries = this.deathRanking ? rankings.DTH : rankings.DEV;
        this.renderSingleEntry(entries[rank], rank, positions, y, category);
      } else {
        this.renderEntry(rankings.RSG[rank], rank, 'RSG', positions, y);
        this.renderEntry(rankings.SSG[rank], rank, 'SSG', positions, y);
      }
    }
    this.renderScrollbar(rowCount);
  }

  private renderEntry(
    entry: RankingEntry | undefined,
    rank: number,
    category: RankingCategory,
    positions: number[],
    y: number,
  ): void {
    const isRsg = category === 'RSG';
    const nameColumn = isRsg ? 0 : 3;
    const timeColumn = isRsg ? 1 : 4;
    if (isRsg) {
      this.addRowText(`${rank + 1}位`, positions[2], y, '#f5f1e8', '30px');
    }
    if (!entry) {
      return;
    }
    const categoryColor = isRsg ? '#58c4b8' : '#f5d58a';
    this.addRowText(entry.name, positions[nameColumn], y, '#f5f1e8', '30px');
    const timeText = this.addRowText(
      `${entry.timeSeconds.toFixed(3)}秒`,
      positions[timeColumn],
      y,
      '#f5f1e8',
      '30px',
    );
    if (entry.replay?.length && entry.seed !== undefined) {
      timeText.setInteractive({ useHandCursor: true });
      timeText.on('pointerdown', () => {
        this.scene.start('ReplayScene', {
          category,
          entry,
          rankingScrollOffset: this.scrollOffset,
        });
      });
      timeText.on('pointerover', () => timeText.setColor(categoryColor));
      timeText.on('pointerout', () => timeText.setColor('#f5f1e8'));
    }
  }

  private renderSingleEntry(
    entry: RankingEntry | undefined,
    rank: number,
    positions: number[],
    y: number,
    category: 'DEV' | 'DTH',
  ): void {
    if (!entry) {
      return;
    }
    this.addRowText(
      `${rank + 1}位`,
      positions[0],
      y,
      '#f5f1e8',
      '30px',
    );
    this.addRowText(entry.name, positions[1], y, '#f5f1e8', '30px');
    const replayText = this.addRowText(
      `${entry.timeSeconds.toFixed(3)}秒`,
      positions[2],
      y,
      '#f5f1e8',
      '30px',
    );
    if (entry.replay?.length && entry.seed !== undefined) {
      replayText.setInteractive({ useHandCursor: true });
      replayText.on('pointerdown', () => {
        this.scene.start('ReplayScene', {
          category,
          entry,
          rankingScrollOffset: this.scrollOffset,
        });
      });
      const hoverColor = category === 'DTH' ? '#e05252' : '#58c4b8';
      replayText.on('pointerover', () => replayText.setColor(hoverColor));
      replayText.on('pointerout', () => replayText.setColor('#f5f1e8'));
    }
  }

  private renderScrollbar(rowCount: number): void {
    if (rowCount <= ROWS_VISIBLE) {
      return;
    }
    const trackTop = ROWS_TOP;
    const trackHeight = ROWS_VISIBLE * ROW_HEIGHT;
    const graphics = this.add.graphics();
    graphics.fillStyle(0x26384a, 1);
    graphics.fillRoundedRect(1150, trackTop, 8, trackHeight, 4);
    const thumbHeight = Math.max(36, trackHeight * ROWS_VISIBLE / rowCount);
    const maxOffset = Math.max(1, rowCount - ROWS_VISIBLE);
    const thumbTop = trackTop
      + (trackHeight - thumbHeight) * this.scrollOffset / maxOffset;
    graphics.fillStyle(this.deathRanking ? 0xe05252 : 0x58c4b8, 1);
    graphics.fillRoundedRect(1150, thumbTop, 8, thumbHeight, 4);
    this.pageContent.push(graphics);
    const track = this.add.zone(1140, trackTop, 28, trackHeight)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    track.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.scrollbarDragging = true;
      this.scrollToScrollbarPointer(pointer.y, rowCount, thumbHeight, trackHeight);
    });
    this.pageContent.push(track);
  }

  private dragScrollbar(pointer: Phaser.Input.Pointer): void {
    if (!this.scrollbarDragging || !pointer.isDown) {
      return;
    }
    const rankings = getRankings();
    const rowCount = this.deathRanking
      ? rankings.DTH.length
      : this.developerRanking
        ? rankings.DEV.length
        : Math.min(RANKING_LIMIT, Math.max(rankings.RSG.length, rankings.SSG.length));
    const trackHeight = ROWS_VISIBLE * ROW_HEIGHT;
    const thumbHeight = Math.max(36, trackHeight * ROWS_VISIBLE / rowCount);
    this.scrollToScrollbarPointer(pointer.y, rowCount, thumbHeight, trackHeight);
  }

  private scrollToScrollbarPointer(
    pointerY: number,
    rowCount: number,
    thumbHeight: number,
    trackHeight: number,
  ): void {
    const maxOffset = Math.max(0, rowCount - ROWS_VISIBLE);
    const travel = trackHeight - thumbHeight;
    const progress = travel > 0
      ? Phaser.Math.Clamp((pointerY - ROWS_TOP - thumbHeight / 2) / travel, 0, 1)
      : 0;
    this.scrollOffset = Math.round(progress * maxOffset);
    this.renderRows();
  }

  private addRowText(
    text: string,
    x: number,
    y: number,
    color: string,
    fontSize: string,
  ): Phaser.GameObjects.Text {
    const item = this.add.text(x, y, text, {
      fontFamily: 'monospace',
      fontSize,
      color,
      align: 'center',
    }).setOrigin(0.5, 0);
    this.pageContent.push(item);
    return item;
  }

  private returnToTitle(): void {
    this.scene.start('TitleScene');
  }
}
