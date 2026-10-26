import Phaser from 'phaser';
import { removeRankingEntry } from '../game/Ranking';
import type { RankingCategory } from '../game/Ranking';

interface RankingDeleteSceneData {
  category: RankingCategory;
  position: number;
  returnScene: string;
}

const ELEMENT_SYMBOLS = [
  'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne',
  'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca',
  'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn',
  'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr', 'Rb', 'Sr', 'Y', 'Zr',
  'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn',
  'Sb', 'Te', 'I', 'Xe', 'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd',
  'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb',
  'Lu', 'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg',
  'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn', 'Fr', 'Ra', 'Ac', 'Th',
  'Pa', 'U', 'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf', 'Es', 'Fm',
];

const CATEGORY_NAMES: Record<RankingCategory, string> = {
  RSG: 'RSG',
  SSG: 'SSG',
  DEV: '開発',
  DTH: 'デス',
};

export class RankingDeleteScene extends Phaser.Scene {
  private category!: RankingCategory;
  private position = 0;
  private returnScene = 'TitleScene';
  private password = '';
  private passwordFocused = true;
  private passwordText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private completed = false;

  constructor() {
    super('RankingDeleteScene');
  }

  init(data: RankingDeleteSceneData): void {
    this.category = data.category;
    this.position = data.position;
    this.returnScene = data.returnScene;
    this.password = '';
    this.passwordFocused = true;
    this.completed = false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101722');
    const background = this.add.graphics();
    background.fillStyle(0x172333, 1);
    background.fillRect(0, 0, 1280, 720);
    background.fillStyle(0x1c2c3d, 0.98);
    background.fillRoundedRect(310, 190, 660, 340, 12);
    background.lineStyle(2, 0xe05252, 1);
    background.strokeRoundedRect(310, 190, 660, 340, 12);
    background.fillStyle(0xe05252, 1);
    background.fillRect(310, 190, 660, 6);

    this.add.text(640, 235, 'ランキング記録の削除', {
      fontFamily: 'sans-serif',
      fontSize: '32px',
      color: '#f5f1e8',
    }).setOrigin(0.5);
    this.add.text(
      640,
      292,
      `${CATEGORY_NAMES[this.category]}ランキング ${this.position}位を削除しますか？`,
      {
        fontFamily: 'sans-serif',
        fontSize: '22px',
        color: '#f5d58a',
      },
    ).setOrigin(0.5);
    this.add.text(640, 335, '順位に対応する元素記号を入力してください', {
      fontFamily: 'sans-serif',
      fontSize: '17px',
      color: '#b7c9d8',
    }).setOrigin(0.5);

    const inputBackground = this.add.graphics();
    inputBackground.fillStyle(0x101722, 1);
    inputBackground.fillRoundedRect(520, 370, 240, 44, 6);
    inputBackground.lineStyle(2, 0x58c4b8, 1);
    inputBackground.strokeRoundedRect(520, 370, 240, 44, 6);
    this.passwordText = this.add.text(640, 392, '', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#f5f1e8',
    }).setOrigin(0.5);
    this.add.zone(520, 370, 240, 44)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.passwordFocused = true;
      });

    this.statusText = this.add.text(640, 435, '', {
      fontFamily: 'sans-serif',
      fontSize: '17px',
      color: '#e8876b',
    }).setOrigin(0.5);

    const yesButton = this.add.text(550, 485, 'YES', {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#f5f1e8',
      backgroundColor: '#8d3737',
      padding: { x: 26, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    yesButton.on('pointerdown', () => this.confirmDeletion());
    const noButton = this.add.text(730, 485, 'NO', {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#f5f1e8',
      backgroundColor: '#26384a',
      padding: { x: 26, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    noButton.on('pointerdown', () => this.returnToCaller());

    this.input.keyboard?.on('keydown', this.handleKeyboard, this);
  }

  private handleKeyboard(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.returnToCaller();
      return;
    }
    if (event.key === 'Enter') {
      this.confirmDeletion();
      return;
    }
    if (!this.passwordFocused || this.completed) {
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      this.password = this.password.slice(0, -1);
    } else if (/^[a-zA-Z]$/.test(event.key) && this.password.length < 2) {
      this.password += event.key;
    }
    this.passwordText.setText(this.password || '▏');
  }

  private confirmDeletion(): void {
    if (this.completed) {
      return;
    }
    const expectedPassword = ELEMENT_SYMBOLS[this.position - 1];
    if (this.password.toLowerCase() !== expectedPassword.toLowerCase()) {
      this.statusText.setText('パスワードが間違っています');
      return;
    }
    if (!removeRankingEntry(this.category, this.position)) {
      this.statusText.setText('指定順位に記録がありません');
      return;
    }
    this.completed = true;
    this.passwordFocused = false;
    this.statusText.setColor('#58c4b8').setText('記録を削除しました');
  }

  private returnToCaller(): void {
    this.scene.start(this.returnScene);
  }
}