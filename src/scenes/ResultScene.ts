import Phaser from 'phaser';
import { GameEvent, GameState, transitionGameState } from '../game/GameState';
import type { GameMode } from '../game/GameMode';
import {
  addRankingEntry,
  getRankingPosition,
  type ReplayFrame,
  type RankingCategory,
} from '../game/Ranking';

interface ResultData {
  state: GameState;
  keyCount: number;
  pCount: number;
  remainingTime: number;
  elapsedTime: number;
  clearTimeSeconds: number;
  mode: GameMode;
  seedWasSet: boolean;
  seed: number;
  replay: ReplayFrame[];
  chestPositions: { x: number; y: number }[];
  correctChestMask: number;
  deathTimeSeconds: number;
  rankingEligible: boolean;
  developerRankingEligible: boolean;
  reason?: 'timeout' | 'defeated' | 'clear';
}

export class ResultScene extends Phaser.Scene {
  private state!: GameState;
  private keyCount = 0;
  private pCount = 0;
  private remainingTime = 0;
  private elapsedTime = 0;
  private clearTimeSeconds = 0;
  private mode: GameMode = 'limited';
  private seedWasSet = false;
  private seed = 0;
  private replay: ReplayFrame[] = [];
  private chestPositions: { x: number; y: number }[] = [];
  private correctChestMask = 0;
  private deathTimeSeconds = 0;
  private rankingEligible = false;
  private developerRankingEligible = false;
  private reason: ResultData['reason'] = 'timeout';
  private rankingCategory?: RankingCategory;
  private rankingName = '';
  private rankingTimeSeconds = 0;
  private rankingNameText?: Phaser.GameObjects.Text;
  private rankingMessageText?: Phaser.GameObjects.Text;
  private rankingSubmitted = false;

  constructor() {
    super('ResultScene');
  }

  init(data: ResultData): void {
    this.state = data.state;
    this.keyCount = data.keyCount;
    this.pCount = data.pCount;
    this.remainingTime = data.remainingTime;
    this.elapsedTime = data.elapsedTime;
    this.clearTimeSeconds = data.clearTimeSeconds;
    this.mode = data.mode;
    this.seedWasSet = data.seedWasSet;
    this.seed = data.seed;
    this.replay = data.replay;
    this.chestPositions = data.chestPositions;
    this.correctChestMask = data.correctChestMask;
    this.deathTimeSeconds = data.deathTimeSeconds;
    this.rankingEligible = data.rankingEligible;
    this.developerRankingEligible = data.developerRankingEligible;
    this.reason = data.reason ?? 'timeout';
    this.rankingCategory = undefined;
    this.rankingName = '';
    this.rankingTimeSeconds = 0;
    this.rankingSubmitted = false;
  }

  create(): void {
    const isClear = this.state === GameState.Clear;
    const title = isClear ? 'クリア！' : 'ゲームオーバー';
    const displayedTime = this.mode === 'limited' ? this.remainingTime : this.elapsedTime;
    const timeLabel = this.mode === 'limited' ? '残り時間' : '経過時間';
    const detail = isClear
      ? `集めた鍵：${this.keyCount}個　／　P：${this.pCount}\n${timeLabel}：${displayedTime.toFixed(3)}秒`
      : `${this.reason === 'defeated' ? '敵に倒されました' : '時間切れです'}　／　P：${this.pCount}\n${timeLabel}：${displayedTime.toFixed(3)}秒`;
    const accentColor = isClear ? 0x58c4b8 : 0xe8876b;

    this.cameras.main.setBackgroundColor('#101722');
    const background = this.add.graphics();
    background.fillStyle(0x172333, 1);
    background.fillRect(0, 0, 1280, 720);
    background.fillStyle(0x26384a, 1);
    background.fillRoundedRect(320, 120, 640, 540, 16);
    background.lineStyle(4, accentColor, 1);
    background.strokeRoundedRect(320, 120, 640, 540, 16);
    background.fillStyle(accentColor, 1);
    background.fillRect(320, 120, 640, 12);

    this.add.text(640, 220, title, {
      fontFamily: 'sans-serif',
      fontSize: '56px',
      color: isClear ? '#58c4b8' : '#e8876b',
    }).setOrigin(0.5);
    this.add.text(640, 305, detail, {
      fontFamily: 'sans-serif',
      fontSize: '24px',
      color: '#f5f1e8',
      align: 'center',
    }).setOrigin(0.5);

    if (this.rankingEligible || (isClear && this.developerRankingEligible)) {
      const category: RankingCategory = !isClear
        ? 'DTH'
        : this.rankingEligible
          ? this.seedWasSet ? 'SSG' : 'RSG'
          : 'DEV';
      this.rankingTimeSeconds = isClear ? this.clearTimeSeconds : this.deathTimeSeconds;
      const position = getRankingPosition(category, this.rankingTimeSeconds);
      if (position !== null) {
        this.rankingCategory = category;
        const categoryLabel = category === 'DEV'
          ? '開発'
          : category === 'DTH' ? 'デス' : category;
        const categoryColor = category === 'DTH'
          ? '#e05252'
          : category === 'SSG' ? '#f5d58a' : '#58c4b8';
        this.add.text(640, 390, `${categoryLabel}ランキング ${position}位`, {
          fontFamily: 'sans-serif',
          fontSize: '26px',
          color: categoryColor,
        }).setOrigin(0.5);
        this.add.text(640, 438, '名前（英数字 0〜5文字）', {
          fontFamily: 'sans-serif',
          fontSize: '18px',
          color: '#b7c9d8',
        }).setOrigin(0.5);
        this.rankingNameText = this.add.text(640, 480, '▏', {
          fontFamily: 'sans-serif',
          fontSize: '24px',
          color: '#f5f1e8',
        }).setOrigin(0.5);
        this.rankingMessageText = this.add.text(640, 530, 'Enterキーでランキングに登録', {
          fontFamily: 'sans-serif',
          fontSize: '18px',
          color: categoryColor,
        }).setOrigin(0.5);
      }
    } else {
      this.add.text(640, 430, 'ランキング登録対象外です', {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#b7c9d8',
      }).setOrigin(0.5);
    }

    this.add.text(640, 570, 'Enterキーでタイトルへ戻る', {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#b7c9d8',
    }).setOrigin(0.5);

    const replayButton = this.add.text(640, 620, '今回のプレイを再生', {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#f5f1e8',
      backgroundColor: '#26384a',
      padding: { x: 18, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    replayButton.on('pointerdown', this.openReplay, this);
    replayButton.on('pointerover', () => replayButton.setColor('#58c4b8'));
    replayButton.on('pointerout', () => replayButton.setColor('#f5f1e8'));

    this.input.keyboard?.on('keydown', this.handleNameInput, this);
    this.input.keyboard?.on('keydown-ENTER', this.handleEnter, this);
    this.input.keyboard?.on('keydown-ESC', this.returnToTitle, this);
  }

  private handleNameInput(event: KeyboardEvent): void {
    if (!this.rankingCategory || this.rankingSubmitted || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      this.rankingName = Array.from(this.rankingName).slice(0, -1).join('');
    } else if (
      /^[a-zA-Z0-9]$/.test(event.key)
      && this.rankingName.length < 5
    ) {
      this.rankingName += event.key;
    }
    this.rankingNameText?.setText(this.rankingName || '▏');
  }

  private handleEnter(event: KeyboardEvent): void {
    if (event.repeat) {
      return;
    }

    if (this.rankingCategory && !this.rankingSubmitted) {
      const position = addRankingEntry(this.rankingCategory, {
        name: this.rankingName,
        timeSeconds: this.rankingTimeSeconds,
        seed: this.seed,
        replay: this.replay,
        chestPositions: this.chestPositions,
        correctChestMask: this.correctChestMask,
      });
      this.rankingSubmitted = true;
      this.rankingMessageText?.setText(
        position === null
          ? '順位が更新されたため登録対象外になりました'
          : `${position}位に登録しました`,
      );
      this.returnToTitle();
      return;
    }

    const nextState = transitionGameState(this.state, GameEvent.EnterPressed);
    if (nextState === GameState.Title) {
      this.returnToTitle();
    }
  }

  private returnToTitle(): void {
    this.scene.start('TitleScene', { clearSeed: true });
  }

  private openReplay(): void {
    this.scene.pause();
    this.scene.launch('ReplayScene', {
      title: '今回のプレイ',
      returnScene: 'ResultScene',
      entry: {
        name: '',
        timeSeconds: this.clearTimeSeconds,
        seed: this.seed,
        replay: this.replay,
        chestPositions: this.chestPositions,
        correctChestMask: this.correctChestMask,
      },
    });
  }
}
