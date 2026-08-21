import Phaser from 'phaser';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  init(data: { cleared?: boolean; score?: number }): void {
    this.registry.set('finalScore', data.score ?? 0);
    this.registry.set('cleared', data.cleared ?? false);
  }

  create(): void {
    const cleared = this.registry.get('cleared') === true;
    const score = this.registry.get('finalScore') as number;
    this.cameras.main.setBackgroundColor(cleared ? '#202014' : '#2a111b');
    this.cameras.main.fadeIn(1500, 8, 17, 31);
    this.add.text(640, 250, cleared ? 'MISSION CLEAR' : 'GAME OVER', {
      fontFamily: 'Arial Black, Noto Sans JP, sans-serif',
      fontStyle: 'bold',
      fontSize: '60px',
      color: cleared ? '#e0e45a' : '#ff3b52',
      stroke: cleared ? '#fff36a' : '#ffd6dc',
      strokeThickness: cleared ? 7 : 4,
      shadow: {
        offsetX: 0,
        offsetY: 0,
        color: cleared ? '#d8c300' : '#ff243f',
        blur: 14,
        stroke: true,
        fill: true,
      },
    }).setOrigin(0.5);
    this.add.text(640, 360, `SCORE  ${score}`, {
      fontFamily: 'sans-serif',
      fontSize: '28px',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.add.text(640, 470, 'ENTERキーでタイトルへ', {
      fontFamily: 'sans-serif',
      fontSize: '24px',
      color: '#ffd166',
    }).setOrigin(0.5);

    const enter = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    enter?.once('down', () => this.scene.start('TitleScene'));
  }
}