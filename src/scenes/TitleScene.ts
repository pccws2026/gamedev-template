import Phaser from 'phaser';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#08111f');
    this.add.text(640, 230, 'STARLINE DEFENDER', {
      fontFamily: 'sans-serif',
      fontSize: '56px',
      color: '#7de3ff',
    }).setOrigin(0.5);
    this.add.text(640, 325, '矢印キー: 移動    SPACE: 発射    Z: 爆弾', {
      fontFamily: 'sans-serif',
      fontSize: '24px',
      color: '#d9e8ff',
    }).setOrigin(0.5);
    this.add.text(640, 390, '敵を倒して爆弾・スター無敵・スコア倍率アイテムを獲得しよう', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#a9bdd6',
    }).setOrigin(0.5);
    this.add.text(640, 470, 'ENTERキーで武器選択', {
      fontFamily: 'sans-serif',
      fontSize: '28px',
      color: '#ffd166',
    }).setOrigin(0.5);

    const enter = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    enter?.once('down', () => this.scene.start('WeaponSelectScene'));
  }
}