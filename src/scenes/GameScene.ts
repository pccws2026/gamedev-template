import Phaser from 'phaser';

type GameState = 'title' | 'playing' | 'clear' | 'gameover';

type Target = {
  shape: Phaser.GameObjects.Arc;
  visualShapes: Phaser.GameObjects.Arc[];
  radius: number;
  isBomb: boolean;
  age: number;
  velocityX: number;
  velocityY: number;
};

export class GameScene extends Phaser.Scene {
  private readonly gameWidth = 1280;
  private readonly gameHeight = 720;
  private readonly gameDuration = 30;
  private readonly clearScore = 30000;
  private readonly scorePerTarget = 100;
  private readonly comboTimeout = 2;
  private readonly scoreFeedbackDuration = 1000;
  private readonly scoreFeedbackSpacing = 48;
  private readonly targetRadius = 33.6;
  private readonly bombRadius = this.targetRadius * 0.9;
  private readonly maxTargetCount = 20;
  private readonly cursorRadius = 22;
  private readonly initialSpawnInterval = 0.5;
  private readonly finalSpawnInterval = 0.1;
  private readonly targetLifetime = 4;
  private readonly minTargetSpeed = 100;
  private readonly maxTargetSpeed = 300;
  private readonly bombChance = 0.25;
  private readonly explosionRadius = this.bombRadius * 6.5;
  private readonly targetExplosionDuration = 200;
  private readonly bombExplosionDuration = 1000;
  private readonly fireCooldown = 0.2;
  private readonly hudHeight = 78;

  private state: GameState = 'title';
  private remainingTime = this.gameDuration;
  private score = 0;
  private combo = 0;
  private comboRemaining = 0;
  private spawnElapsed = 0;
  private cooldownRemaining = 0;
  private cursorX = this.gameWidth / 2;
  private cursorY = this.gameHeight / 2;
  private targets: Target[] = [];
  private fadingTargetShapes: Phaser.GameObjects.Arc[] = [];
  private explosions: Phaser.GameObjects.Arc[] = [];
  private screenTexts: Phaser.GameObjects.Text[] = [];
  private cursorGraphics!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private scoreFeedbackTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101827');
    this.cursorGraphics = this.add.graphics().setDepth(1000);
    this.hudText = this.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '46.8px',
      color: '#f8fafc',
    });
    this.comboText = this.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '39.6px',
      color: '#fbbf24',
    }).setVisible(false).setDepth(1001);
    this.input.keyboard?.addCapture('SPACE');
    this.input.keyboard?.on('keydown-SPACE', this.handleSpace, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.showTitle();
  }

  update(_time: number, delta: number): void {
    if (this.state !== 'playing') {
      return;
    }

    const elapsed = delta / 1000;
    this.remainingTime = Math.max(0, this.remainingTime - elapsed);
    this.cooldownRemaining = Math.max(0, this.cooldownRemaining - elapsed);
    this.comboRemaining = Math.max(0, this.comboRemaining - elapsed);
    if (this.comboRemaining === 0) {
      this.combo = 0;
      this.comboText.setVisible(false);
    }
    this.drawCursor();
    this.spawnElapsed += elapsed;

    const spawnInterval = this.getSpawnInterval();
    if (this.spawnElapsed >= spawnInterval) {
      this.spawnElapsed -= spawnInterval;
      this.spawnTarget();
    }

    for (const target of [...this.targets]) {
      target.age += elapsed;
      this.moveTarget(target, elapsed);
      if (!target.isBomb && target.age >= this.targetLifetime) {
        this.fadeOutTarget(target.shape);
      }
    }
    this.resolveTargetCollisions();

    this.updateHud();
    if (this.remainingTime <= 0) {
      this.finishGame();
    }
  }

  private handleSpace(): void {
    if (this.state === 'title') {
      this.startGame();
    } else if (this.state === 'clear' || this.state === 'gameover') {
      this.showTitle();
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    this.cursorX = Phaser.Math.Clamp(pointer.worldX, 0, this.gameWidth);
    this.cursorY = Phaser.Math.Clamp(pointer.worldY, this.hudHeight, this.gameHeight);
    this.drawCursor();
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.state !== 'playing' || pointer.button !== 0 || this.cooldownRemaining > 0) {
      return;
    }

    this.cooldownRemaining = this.fireCooldown;
    const cursor = new Phaser.Geom.Circle(this.cursorX, this.cursorY, this.cursorRadius);
    let hitTarget = false;
    for (const target of [...this.targets]) {
      const targetCircle = new Phaser.Geom.Circle(target.shape.x, target.shape.y, target.radius);
      if (Phaser.Geom.Intersects.CircleToCircle(cursor, targetCircle)) {
        this.resolveHit(target);
        hitTarget = true;
      }
    }
    if (!hitTarget) {
      this.combo = 0;
      this.comboRemaining = 0;
      this.comboText.setVisible(false);
    }
  }

  private startGame(): void {
    this.clearTargets();
    this.clearExplosions();
    this.clearScreenTexts();
    this.state = 'playing';
    this.remainingTime = this.gameDuration;
    this.score = 0;
    this.combo = 0;
    this.comboRemaining = 0;
    this.comboText.setVisible(false);
    this.clearScoreFeedback();
    this.spawnElapsed = 0;
    this.cooldownRemaining = 0;
    this.hudText.setVisible(true);
    this.updateHud();
    this.drawCursor();
  }

  private finishGame(): void {
    this.state = this.score >= this.clearScore ? 'clear' : 'gameover';
    this.clearTargets();
    this.clearExplosions();
    this.cursorGraphics.clear();
    this.comboText.setVisible(false);
    this.clearScoreFeedback();
    this.hudText.setVisible(false);
    this.showResult();
  }

  private spawnTarget(): void {
    if (this.targets.length >= this.maxTargetCount) {
      return;
    }

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const x = Phaser.Math.Between(this.targetRadius + 20, this.gameWidth - this.targetRadius - 20);
      const y = Phaser.Math.Between(this.hudHeight + this.targetRadius + 20, this.gameHeight - this.targetRadius - 20);
      const isBomb = Phaser.Math.FloatBetween(0, 1) < this.bombChance;
      const radius = isBomb ? this.bombRadius : this.targetRadius;
      const overlapsTarget = this.targets.some((target) => Phaser.Math.Distance.Between(x, y, target.shape.x, target.shape.y) < radius + target.radius);
      if (!overlapsTarget) {
        const visualShapes = isBomb
          ? [
              this.add.circle(x, y, radius, 0x050505).setStrokeStyle(4, 0xffffff),
            ]
          : [
              this.add.circle(x, y, this.targetRadius, 0xffffff),
              this.add.circle(x, y, this.targetRadius * 0.72, 0xf97316),
              this.add.circle(x, y, this.targetRadius * 0.46, 0xffffff),
              this.add.circle(x, y, this.targetRadius * 0.22, 0xf97316),
            ];
        const target = visualShapes[0];
        const directionX = Phaser.Math.Between(-1, 1);
        const directionY = Phaser.Math.Between(-1, 1);
        const hasDirection = directionX !== 0 || directionY !== 0;
        const velocity = Phaser.Math.FloatBetween(this.minTargetSpeed, this.maxTargetSpeed);
        const normalizedLength = Math.hypot(directionX, directionY) || 1;
        this.targets.push({
          shape: target,
          visualShapes,
          radius,
          isBomb,
          age: 0,
          velocityX: hasDirection ? (directionX / normalizedLength) * velocity : 0,
          velocityY: hasDirection ? (directionY / normalizedLength) * velocity : 0,
        });
        return;
      }
    }
  }

  private removeTarget(target: Phaser.GameObjects.Arc): void {
    const index = this.targets.findIndex((entry) => entry.shape === target);
    if (index === -1) {
      return;
    }
    const targetEntry = this.targets[index];
    this.targets.splice(index, 1);
    targetEntry.visualShapes.forEach((shape) => shape.destroy());
  }

  private clearTargets(): void {
    for (const target of this.targets) {
      target.visualShapes.forEach((shape) => shape.destroy());
    }
    this.targets = [];
    for (const shape of this.fadingTargetShapes) {
      shape.destroy();
    }
    this.fadingTargetShapes = [];
  }

  private fadeOutTarget(target: Phaser.GameObjects.Arc): void {
    const index = this.targets.findIndex((entry) => entry.shape === target);
    if (index === -1) {
      return;
    }

    const targetEntry = this.targets[index];
    this.targets.splice(index, 1);
    this.fadingTargetShapes.push(...targetEntry.visualShapes);
    this.tweens.add({
      targets: targetEntry.visualShapes,
      alpha: 0,
      duration: this.targetExplosionDuration,
      ease: 'Linear',
      onComplete: () => {
        for (const shape of targetEntry.visualShapes) {
          const fadingIndex = this.fadingTargetShapes.indexOf(shape);
          if (fadingIndex !== -1) {
            this.fadingTargetShapes.splice(fadingIndex, 1);
          }
          shape.destroy();
        }
      },
    });
  }

  private resolveHit(target: Target): void {
    if (!this.targets.includes(target)) {
      return;
    }

    if (target.isBomb) {
      this.explodeBomb(target);
      return;
    }

    this.addTargetScore();
    this.showExplosion(target.shape.x, target.shape.y, this.targetExplosionDuration);
    this.removeTarget(target.shape);
  }

  private explodeBomb(bomb: Target): void {
    const pendingTargets: Target[] = [bomb];
    const resolvedTargets = new Set<Target>();

    while (pendingTargets.length > 0) {
      const current = pendingTargets.shift();
      if (!current || resolvedTargets.has(current)) {
        continue;
      }
      resolvedTargets.add(current);

      const centerX = current.shape.x;
      const centerY = current.shape.y;
      if (current.isBomb) {
        this.comboRemaining = this.comboTimeout;
        this.showComboText();
        this.showExplosion(centerX, centerY, this.bombExplosionDuration);
      } else {
        this.addTargetScore();
        this.showExplosion(centerX, centerY, this.targetExplosionDuration);
      }
      this.removeTarget(current.shape);

      if (current.isBomb) {
        for (const target of [...this.targets]) {
          if (Phaser.Math.Distance.Between(centerX, centerY, target.shape.x, target.shape.y) <= this.explosionRadius) {
            pendingTargets.push(target);
          }
        }
      }
    }
  }

  private showExplosion(x: number, y: number, duration: number): void {
    const explosion = this.add.circle(x, y, this.targetRadius, 0xef4444, 0.9);
    this.explosions.push(explosion);
    this.tweens.add({
      targets: explosion,
      scale: 6.5,
      alpha: 0,
      duration,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        const index = this.explosions.indexOf(explosion);
        if (index !== -1) {
          this.explosions.splice(index, 1);
        }
        explosion.destroy();
      },
    });
  }

  private addTargetScore(): void {
    this.combo += 1;
    this.comboRemaining = this.comboTimeout;
    const points = this.scorePerTarget * this.combo;
    this.showScoreFeedback(points);
    this.showComboText();
  }

  private showScoreFeedback(points: number): void {
    const feedback = this.add.text(28, 0, `+${points}点`, {
      fontFamily: 'monospace',
      fontSize: '39.6px',
      color: '#fbbf24',
    }).setDepth(1001);
    this.scoreFeedbackTexts.push(feedback);
    this.repositionScoreFeedbacks();
    this.tweens.add({
      targets: feedback,
      alpha: 0,
      delay: this.scoreFeedbackDuration,
      duration: 100,
      onComplete: () => {
        this.score += points;
        const index = this.scoreFeedbackTexts.indexOf(feedback);
        if (index !== -1) {
          this.scoreFeedbackTexts.splice(index, 1);
        }
        feedback.destroy();
        this.repositionScoreFeedbacks();
      },
    });
  }

  private repositionScoreFeedbacks(): void {
    this.scoreFeedbackTexts.forEach((feedback, index) => {
      const targetY = 78 + index * this.scoreFeedbackSpacing;
      this.tweens.add({
        targets: feedback,
        y: targetY,
        duration: 150,
        ease: 'Cubic.easeOut',
      });
    });
  }

  private clearScoreFeedback(): void {
    this.tweens.killTweensOf(this.scoreFeedbackTexts);
    for (const feedback of this.scoreFeedbackTexts) {
      feedback.destroy();
    }
    this.scoreFeedbackTexts = [];
  }

  private showComboText(): void {
    if (this.combo === 0) {
      this.comboText.setVisible(false);
      return;
    }
    this.comboText.setText(`${this.combo}コンボ`);
    this.comboText.setPosition(this.cursorX + 32, this.cursorY - 50);
    this.comboText.setAlpha(1).setVisible(true);
    this.tweens.killTweensOf(this.comboText);
    this.tweens.add({
      targets: this.comboText,
      alpha: 0,
      delay: this.comboTimeout * 1000,
      duration: 150,
      onComplete: () => this.comboText.setVisible(false),
    });
  }

  private clearExplosions(): void {
    for (const explosion of this.explosions) {
      explosion.destroy();
    }
    this.explosions = [];
  }

  private getSpawnInterval(): number {
    const progress = Phaser.Math.Clamp((this.gameDuration - this.remainingTime) / this.gameDuration, 0, 1);
    return Phaser.Math.Linear(this.initialSpawnInterval, this.finalSpawnInterval, progress);
  }

  private moveTarget(target: Target, elapsed: number): void {
    const minX = this.targetRadius + 20;
    const maxX = this.gameWidth - this.targetRadius - 20;
    const minY = this.hudHeight + this.targetRadius + 20;
    const maxY = this.gameHeight - this.targetRadius - 20;
    let nextX = target.shape.x + target.velocityX * elapsed;
    let nextY = target.shape.y + target.velocityY * elapsed;

    if (nextX < minX || nextX > maxX) {
      target.velocityX *= -1;
      nextX = Phaser.Math.Clamp(nextX, minX, maxX);
    }
    if (nextY < minY || nextY > maxY) {
      target.velocityY *= -1;
      nextY = Phaser.Math.Clamp(nextY, minY, maxY);
    }
    target.shape.setPosition(nextX, nextY);
    target.visualShapes.forEach((shape) => shape.setPosition(nextX, nextY));
  }

  private resolveTargetCollisions(): void {
    for (let firstIndex = 0; firstIndex < this.targets.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < this.targets.length; secondIndex += 1) {
        const first = this.targets[firstIndex];
        const second = this.targets[secondIndex];
        const deltaX = second.shape.x - first.shape.x;
        const deltaY = second.shape.y - first.shape.y;
        const distance = Math.hypot(deltaX, deltaY);
        const collisionDistance = first.radius + second.radius;
        if (distance >= collisionDistance) {
          continue;
        }

        const normalX = distance === 0 ? 1 : deltaX / distance;
        const normalY = distance === 0 ? 0 : deltaY / distance;
        const relativeVelocity = (second.velocityX - first.velocityX) * normalX + (second.velocityY - first.velocityY) * normalY;
        if (relativeVelocity < 0) {
          first.velocityX += relativeVelocity * normalX;
          first.velocityY += relativeVelocity * normalY;
          second.velocityX -= relativeVelocity * normalX;
          second.velocityY -= relativeVelocity * normalY;
        }

        const separation = (collisionDistance - distance) / 2;
        first.shape.x -= normalX * separation;
        first.shape.y -= normalY * separation;
        second.shape.x += normalX * separation;
        second.shape.y += normalY * separation;
      }
    }
  }

  private updateHud(): void {
    this.hudText.setText(`${this.score}点                         残り ${this.remainingTime.toFixed(1)}秒`);
    this.hudText.setPosition(28, 24);
  }

  private drawCursor(): void {
    this.cursorGraphics.clear();
    if (this.state !== 'playing') {
      return;
    }
    const cursorColor = this.cooldownRemaining > 0 ? 0xef4444 : 0x67e8f9;
    this.cursorGraphics.lineStyle(3, cursorColor, 1);
    this.cursorGraphics.strokeCircle(this.cursorX, this.cursorY, this.cursorRadius);
    this.cursorGraphics.lineBetween(this.cursorX - 32, this.cursorY, this.cursorX + 32, this.cursorY);
    this.cursorGraphics.lineBetween(this.cursorX, this.cursorY - 32, this.cursorX, this.cursorY + 32);
  }

  private showTitle(): void {
    this.clearScreenTexts();
    this.state = 'title';
    this.hudText.setVisible(false);
    this.comboText.setVisible(false);
    this.cursorGraphics.clear();
    const title = this.add.text(this.gameWidth / 2, 280, 'TARGET RANGE', {
      fontFamily: 'Georgia, serif', fontSize: '64px', color: '#f8fafc', stroke: '#0f172a', strokeThickness: 8,
    }).setOrigin(0.5);
    const prompt = this.add.text(this.gameWidth / 2, 385, 'スペースキーで始める', {
      fontFamily: 'sans-serif', fontSize: '28px', color: '#67e8f9',
    }).setOrigin(0.5);
    this.screenTexts.push(title, prompt);
  }

  private showResult(): void {
    this.clearScreenTexts();
    const result = this.add.text(this.gameWidth / 2, 280, this.state === 'clear' ? 'ゲームクリア' : 'ゲームオーバー', {
      fontFamily: 'Georgia, serif', fontSize: '60px', color: this.state === 'clear' ? '#86efac' : '#fda4af',
    }).setOrigin(0.5);
    const prompt = this.add.text(this.gameWidth / 2, 385, 'スペースキーでタイトルへもどる', {
      fontFamily: 'sans-serif', fontSize: '28px', color: '#f8fafc',
    }).setOrigin(0.5);
    const score = this.add.text(this.gameWidth / 2, 470, `${this.score}点`, {
      fontFamily: 'monospace', fontSize: '30px', color: '#fbbf24',
    }).setOrigin(0.5);
    this.screenTexts.push(result, prompt, score);
  }

  private clearScreenTexts(): void {
    for (const text of this.screenTexts) {
      text.destroy();
    }
    this.screenTexts = [];
  }

  private cleanup(): void {
    this.input.keyboard?.off('keydown-SPACE', this.handleSpace, this);
    this.input.off('pointermove', this.handlePointerMove, this);
    this.input.off('pointerdown', this.handlePointerDown, this);
  }
}
