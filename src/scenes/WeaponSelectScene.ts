import Phaser from 'phaser';
import { WEAPON_CONFIG, type WeaponType } from './weapons';

const WEAPON_OPTIONS: { weapon: WeaponType; name: string; description: string }[] = [
  {
    weapon: 'pistol',
    name: 'PISTOL',
    description: `正面へ1発\n連打${WEAPON_CONFIG.pistol.tapFireFrames}f / 長押し${WEAPON_CONFIG.pistol.holdFireFrames}f / 消費${WEAPON_CONFIG.pistol.ptCost}pt`,
  },
  {
    weapon: 'shotgun',
    name: 'SHOTGUN',
    description: `左右20度に3発\n${WEAPON_CONFIG.shotgun.tapFireFrames}f間隔 / 消費${WEAPON_CONFIG.shotgun.ptCost}pt`,
  },
  {
    weapon: 'assaultRifle',
    name: 'ASSAULT RIFLE',
    description: `正面へ1発 / Y座標±10px\n${WEAPON_CONFIG.assaultRifle.holdFireFrames}f間隔 / 消費${WEAPON_CONFIG.assaultRifle.ptCost}pt`,
  },
];

export class WeaponSelectScene extends Phaser.Scene {
  private selectedIndex = 0;
  private panels!: Phaser.GameObjects.Rectangle[];
  private names!: Phaser.GameObjects.Text[];
  private descriptions!: Phaser.GameObjects.Text[];
  private left!: Phaser.Input.Keyboard.Key;
  private right!: Phaser.Input.Keyboard.Key;
  private enter!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('WeaponSelectScene');
  }

  create(): void {
    this.selectedIndex = 0;
    this.cameras.main.setBackgroundColor('#08111f');
    this.add.text(640, 150, 'WEAPON SELECT', {
      fontFamily: 'sans-serif',
      fontSize: '48px',
      color: '#7de3ff',
    }).setOrigin(0.5);
    this.add.text(640, 220, '使用する武器を選択してください', {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      color: '#d9e8ff',
    }).setOrigin(0.5);

    this.panels = [];
    this.names = [];
    this.descriptions = [];

    WEAPON_OPTIONS.forEach((option, index) => {
      const x = 230 + index * 410;
      const panel = this.add.rectangle(x, 380, 320, 210, 0x102638)
        .setInteractive();
      panel.on('pointerdown', () => {
        this.selectedIndex = index;
        this.updateSelection();
      });
      this.panels.push(panel);
      this.names.push(this.add.text(x, 350, option.name, {
        fontFamily: 'sans-serif',
        fontSize: '32px',
        color: '#ffffff',
      }).setOrigin(0.5));
      this.descriptions.push(this.add.text(x, 410, option.description, {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#d9e8ff',
      }).setOrigin(0.5));
    });

    this.add.text(640, 570, '← → またはクリックで選択    ENTERで決定', {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      color: '#ffd166',
    }).setOrigin(0.5);

    this.left = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.right = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.enter = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.updateSelection();
  }

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.left)) {
      this.selectedIndex = (this.selectedIndex - 1 + WEAPON_OPTIONS.length) % WEAPON_OPTIONS.length;
      this.updateSelection();
    } else if (Phaser.Input.Keyboard.JustDown(this.right)) {
      this.selectedIndex = (this.selectedIndex + 1) % WEAPON_OPTIONS.length;
      this.updateSelection();
    }

    if (Phaser.Input.Keyboard.JustDown(this.enter)) {
      const selectedOption = WEAPON_OPTIONS[this.selectedIndex];
      if (selectedOption) this.scene.start('GameScene', { weapon: selectedOption.weapon });
    }
  }

  private updateSelection(): void {
    this.panels.forEach((panel, index) => {
      const selected = index === this.selectedIndex;
      panel.setFillStyle(selected ? 0x174359 : 0x102638);
      panel.setStrokeStyle(selected ? 3 : 1, selected ? 0x7de3ff : 0x385168);
      this.names[index]?.setColor(selected ? '#7de3ff' : '#ffffff');
    });
  }
}