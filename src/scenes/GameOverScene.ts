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
    this.cameras.main.setBackgroundColor(cleared ? '#102d2a' : '#2a111b');
    this.add.text(640, 250, cleared ? 'MISSION CLEAR' : 'GAME OVER', {
      fontFamily: 'sans-serif',
      fontSize: '60px',
      color: cleared ? '#7dffcf' : '#ff8b94',
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