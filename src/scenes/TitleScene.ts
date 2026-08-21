import Phaser from 'phaser';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#010611');

    const space = this.add.graphics();
    space.fillGradientStyle(0x010611, 0x020b1c, 0x020611, 0x061a33, 1, 1, 1, 1);
    space.fillRect(0, 0, 1280, 720);

    const stars = this.add.graphics();
    const starPositions = [
      [74, 92, 2], [142, 188, 1], [218, 76, 1], [286, 154, 2],
      [366, 64, 1], [438, 132, 1], [514, 88, 2], [592, 178, 1],
      [674, 72, 1], [748, 136, 2], [824, 54, 1], [902, 182, 1],
      [978, 94, 2], [1058, 148, 1], [1152, 76, 1], [1212, 202, 2],
      [92, 574, 1], [176, 642, 2], [254, 536, 1], [342, 610, 1],
      [426, 566, 2], [518, 656, 1], [606, 548, 1], [704, 626, 2],
      [794, 574, 1], [884, 658, 1], [966, 532, 2], [1048, 606, 1],
      [1138, 558, 1], [1218, 646, 2], [56, 334, 1], [1220, 392, 1],
    ];

    starPositions.forEach(([x, y, radius], index) => {
      const glowRadius = radius * 5;
      stars.fillStyle(0x78cfff, 0.08);
      stars.fillCircle(x, y, glowRadius);
      stars.fillStyle(index % 4 === 0 ? 0xffffff : 0xa9e8ff, 0.8);
      stars.fillCircle(x, y, radius);
    });

    const horizon = this.add.graphics();
    horizon.lineStyle(1, 0x2e8fc4, 0.24);
    horizon.lineBetween(120, 452, 1160, 452);
    horizon.lineStyle(1, 0x7edfff, 0.1);
    horizon.lineBetween(270, 459, 1010, 459);

    const titleStars = this.add.graphics();
    [[404, 218, 5], [508, 263, 3], [774, 203, 4], [884, 247, 3]].forEach(([x, y, size]) => {
      titleStars.fillStyle(0x8edfff, 0.12);
      titleStars.fillCircle(x, y, size * 3);
      titleStars.fillStyle(0xffffff, 0.95);
      titleStars.fillTriangle(x, y - size * 2, x - size / 2, y, x + size / 2, y);
      titleStars.fillTriangle(x, y + size * 2, x - size / 2, y, x + size / 2, y);
      titleStars.fillTriangle(x - size * 2, y, x, y - size / 2, x, y + size / 2);
      titleStars.fillTriangle(x + size * 2, y, x, y - size / 2, x, y + size / 2);
    });

    const createTitleLine = (text: string, y: number) => {
      const titleLine = this.add.text(640, y, text, {
        fontFamily: 'Arial Black, Noto Sans JP, sans-serif',
        fontStyle: 'bold',
        fontSize: '90px',
        color: '#071a42',
        stroke: '#8fd9eb',
        strokeThickness: 4,
        shadow: {
          offsetX: 0,
          offsetY: 0,
          color: '#43cfff',
          blur: 22,
          stroke: true,
          fill: true,
        },
      }).setOrigin(0.5);
      const titleGloss = titleLine.context.createLinearGradient(0, 0, 0, titleLine.height);
      titleGloss.addColorStop(0, '#b8e7f0');
      titleGloss.addColorStop(0.18, '#78bfd4');
      titleGloss.addColorStop(0.45, '#24477e');
      titleGloss.addColorStop(1, '#020817');
      titleLine.setFill(titleGloss);
    };

    createTitleLine('STARLINE', 174);
    createTitleLine('DEFENDER', 284);
    this.add.text(640, 366, '矢印キー: 移動    SPACE: 発射', {
      fontFamily: 'sans-serif',
      fontSize: '24px',
      color: '#c4eaff',
      shadow: { offsetX: 0, offsetY: 0, color: '#327fa8', blur: 8, stroke: true, fill: true },
    }).setOrigin(0.5);
    this.add.text(640, 470, 'ENTERキーで開始', {
      fontFamily: 'sans-serif',
      fontSize: '28px',
      color: '#f4fdff',
      stroke: '#5bcfff',
      strokeThickness: 1,
      shadow: { offsetX: 0, offsetY: 0, color: '#42c8ff', blur: 12, stroke: true, fill: true },
    }).setOrigin(0.5);

    const enter = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    enter?.once('down', () => this.scene.start('GameScene'));
  }
}