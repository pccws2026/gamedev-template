import Phaser from 'phaser';

export class HelloScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private trampoline!: Phaser.GameObjects.Rectangle;
  private enemyOne!: Phaser.GameObjects.Rectangle;
  private enemyTwoEnemies: Phaser.GameObjects.Rectangle[] = [];
  private enemyTwoPredictionLines: Phaser.GameObjects.Graphics[] = [];
  private beam!: Phaser.GameObjects.Rectangle;
  private ally!: Phaser.GameObjects.Rectangle;
  private allyBeam!: Phaser.GameObjects.Rectangle;
  private allyPredictionLine!: Phaser.GameObjects.Graphics;
  private predictionLine!: Phaser.GameObjects.Graphics;
  private beamLine!: Phaser.Geom.Line;
  private allyBeamLine!: Phaser.Geom.Line;
  private beamCollisionLines: Phaser.Geom.Line[] = [];
  private jumpLabel!: Phaser.GameObjects.Text;
  private stageLabel!: Phaser.GameObjects.Text;
  private healthLabel!: Phaser.GameObjects.Text;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private jumpCount = 0;
  private state: 'title' | 'playing' | 'gameover' | 'clear' = 'title';
  private stage = 1;
  private enemyTwoAttackStarted = false;
  private enemyTwoWaveStartedAt = 0;
  private enemyTwoWaveId = 0;
  private jumpHeldTime = 0;
  private nextJumpAllowedAt = 0;
  private beamActive = false;
  private beamCycleId = 0;
  private allyBeamActive = false;
  private allyShotId = 0;
  private allySpawnTimer?: Phaser.Time.TimerEvent;
  private health = 3;
  private readonly maxHealth = 3;
  private invulnerableUntil = 0;
  private statusText?: Phaser.GameObjects.Text;
  private promptText?: Phaser.GameObjects.Text;

  constructor() {
    super('HelloScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101827');
    this.drawBackdrop();

    this.player = this.add.rectangle(640, 602, 38, 54, 0x55d6be);
    this.trampoline = this.add.rectangle(640, 638, 180, 18, 0xf3b562);
    this.enemyOne = this.add.rectangle(1030, 470, 52, 90, 0xf25f5c);
    this.beam = this.add.rectangle(0, 0, 260, 10, 0xffe66d);
    this.ally = this.add.rectangle(110, 500, 48, 64, 0xff72b6);
    this.allyBeam = this.add.rectangle(0, 0, 260, 14, 0xff72b6);
    this.allyPredictionLine = this.add.graphics();
    this.predictionLine = this.add.graphics();
    this.beamLine = new Phaser.Geom.Line();
    this.allyBeamLine = new Phaser.Geom.Line();

    this.physics.add.existing(this.player);
    this.physics.add.existing(this.trampoline, true);
    this.physics.add.existing(this.enemyOne, true);

    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    playerBody.setCollideWorldBounds(true);
    playerBody.setSize(34, 50, true);
    for (let index = 0; index < 7; index += 1) {
      const enemy = this.add.rectangle(0, 0, 76, 32, 0xc77dff).setVisible(false);
      const predictionLine = this.add.graphics();
      this.physics.add.existing(enemy);
      const enemyBody = enemy.body as Phaser.Physics.Arcade.Body;
      enemyBody.allowGravity = false;
      enemyBody.setVelocity(0, 0);
      enemyBody.immovable = true;
      this.physics.add.overlap(this.player, enemy, this.hitEnemy, undefined, this);
      this.enemyTwoEnemies.push(enemy);
      this.enemyTwoPredictionLines.push(predictionLine);
    }
    this.physics.add.collider(this.player, this.trampoline);
    this.physics.add.overlap(this.player, this.enemyOne, this.hitEnemy, undefined, this);

    this.jumpLabel = this.add.text(40, 28, '', this.textStyle(24, '#f7f4ea'));
    this.stageLabel = this.add.text(40, 64, '', this.textStyle(18, '#9fb3c8'));
    this.healthLabel = this.add.text(40, 92, '', this.textStyle(18, '#ff9bc9'));
    const keyboard = this.input.keyboard!;
    this.spaceKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    keyboard.on('keydown-ENTER', this.handleEnter, this);

    this.showTitle();
  }

  update(time: number): void {
    if (this.state !== 'playing') {
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && this.isGrounded() && time >= this.nextJumpAllowedAt) {
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocityY(-240);
      this.jumpHeldTime = 0;
      this.nextJumpAllowedAt = time + 1000;
      this.jumpCount += 1;
      this.updateHud();
      if (this.jumpCount === 25) {
        this.stage = 2;
        this.enemyOne.setVisible(false);
        (this.enemyOne.body as Phaser.Physics.Arcade.StaticBody).enable = false;
        this.beam.setVisible(false);
        this.beamCycleId += 1;
        this.predictionLine.clear();
        this.beamActive = false;
        this.cameras.main.flash(500, 255, 255, 255);
        this.stageLabel.setText('STAGE 2  /  PURPLE HUNTER');
      }
      if (this.jumpCount >= 50) {
        this.finish('clear');
        return;
      }
    }

    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    if (this.spaceKey.isDown && playerBody.velocity.y < 0 && this.jumpHeldTime < 400 && this.player.y > 100) {
      this.jumpHeldTime += 1000 / 60;
      playerBody.setVelocityY(-550);
    }
    if (this.player.y <= 100 && playerBody.velocity.y < 0) {
      playerBody.setVelocityY(0);
    }
    if (this.spaceKey.isUp && playerBody.velocity.y < 0) {
      playerBody.setVelocityY(0);
    }

    if (this.stage === 2 && this.jumpCount >= 25) {
      if (!this.enemyTwoAttackStarted && this.isGrounded()) {
        this.enemyTwoAttackStarted = true;
        this.enemyTwoWaveStartedAt = time;
        this.spawnEnemyTwoWave();
      }
      if (this.enemyTwoAttackStarted) {
        if (time - this.enemyTwoWaveStartedAt >= 3500) {
          this.enemyTwoWaveStartedAt = time;
          this.spawnEnemyTwoWave();
        }
      }
    }

    if (this.beamActive && this.beamCollisionLines.some((line) => Phaser.Geom.Intersects.LineToRectangle(line, this.player.getBounds()))) {
      this.hitEnemy();
    }

    if (this.allyBeamActive && Phaser.Geom.Intersects.LineToRectangle(this.allyBeamLine, this.player.getBounds())) {
      this.healPlayer();
    }
  }

  private showTitle(): void {
    this.state = 'title';
    this.beamCycleId += 1;
    this.player.setVisible(false);
    this.trampoline.setVisible(false);
    this.enemyOne.setVisible(false);
    this.hideEnemyTwoEnemies();
    this.enemyTwoAttackStarted = false;
    this.beam.setVisible(false);
    this.predictionLine.clear();
    this.beamActive = false;
    this.jumpLabel.setVisible(false);
    this.stageLabel.setVisible(false);
    this.healthLabel.setVisible(false);
    this.stopAllySupport();
    this.hideAlly();
    this.statusText?.destroy();
    this.promptText?.destroy();
    this.statusText = this.add.text(640, 300, 'TRAMPOLINE\nDODGER', {
      ...this.textStyle(64, '#f7f4ea'),
      align: 'center',
    }).setOrigin(0.5);
    this.promptText = this.add.text(640, 440, 'ENTER でスタート', this.textStyle(22, '#f3b562')).setOrigin(0.5);
  }

  private startGame(): void {
    this.state = 'playing';
    this.time.timeScale = 1;
    this.physics.world.timeScale = 1;
    this.tweens.timeScale = 1;
    this.beamCycleId += 1;
    this.jumpCount = 0;
    this.stage = 1;
    this.health = this.maxHealth;
    this.invulnerableUntil = 0;
    this.jumpHeldTime = 0;
    this.nextJumpAllowedAt = 0;
    this.statusText?.destroy();
    this.promptText?.destroy();
    this.player.setPosition(640, 602).setVisible(true);
    (this.player.body as Phaser.Physics.Arcade.Body).reset(640, 602);
    this.trampoline.setVisible(true);
    this.enemyOne.setVisible(true);
    (this.enemyOne.body as Phaser.Physics.Arcade.StaticBody).enable = true;
    this.hideEnemyTwoEnemies();
    this.enemyTwoAttackStarted = false;
    this.beam.setVisible(false);
    this.predictionLine.clear();
    this.beamActive = false;
    this.hideAlly();
    this.stopAllySupport();
    this.allySpawnTimer = this.time.addEvent({
      delay: 5000,
      callback: this.spawnAlly,
      callbackScope: this,
      loop: true,
    });
    this.jumpLabel.setVisible(true);
    this.stageLabel.setVisible(true).setText('STAGE 1  /  赤い秀一');
    this.healthLabel.setVisible(true);
    this.updateHud();
    this.fireBeam();
  }

  private finish(result: 'gameover' | 'clear'): void {
    this.state = result;
    this.beamCycleId += 1;
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.beam.setVisible(false);
    this.hideEnemyTwoEnemies();
    this.predictionLine.clear();
    this.beamActive = false;
    this.stopAllySupport();
    this.hideAlly();
    this.statusText?.destroy();
    this.promptText?.destroy();
    this.statusText = this.add.text(640, 330, result === 'clear' ? 'CLEAR!' : 'GAME OVER', {
      ...this.textStyle(68, result === 'clear' ? '#55d6be' : '#f25f5c'),
    }).setOrigin(0.5);
    this.promptText = this.add.text(640, 440, 'ENTER でタイトルへ', this.textStyle(22, '#f3b562')).setOrigin(0.5);
  }

  private handleEnter(): void {
    if (this.state === 'title') {
      this.startGame();
    } else if (this.state === 'gameover' || this.state === 'clear') {
      this.showTitle();
    }
  }

  private hitEnemy(): void {
    if (this.state === 'playing' && this.time.now >= this.invulnerableUntil) {
      this.health -= 1;
      this.invulnerableUntil = this.time.now + 900;
      this.updateHud();
      this.cameras.main.flash(120, 255, 80, 100);
      if (this.health <= 0) {
        this.finish('gameover');
      }
    }
  }

  private spawnAlly(): void {
    if (this.state !== 'playing' || this.ally.visible) {
      return;
    }

    this.ally.setPosition(110, Phaser.Math.Between(170, 540)).setVisible(true);
    this.allyPredictionLine.clear();
    this.allyBeam.setVisible(false);
    this.allyBeamActive = false;
    const shotId = ++this.allyShotId;
    const previewAngle = Phaser.Math.Angle.Between(this.ally.x, this.ally.y, this.player.x, this.player.y);
    const previewEndX = this.ally.x + Math.cos(previewAngle) * 1400;
    const previewEndY = this.ally.y + Math.sin(previewAngle) * 1400;
    this.allyPredictionLine.lineStyle(6, 0xff72b6, 0.8).lineBetween(this.ally.x, this.ally.y, previewEndX, previewEndY);

    this.time.delayedCall(500, () => {
      if (shotId !== this.allyShotId || this.state !== 'playing' || !this.ally.visible) {
        return;
      }
      const angle = Phaser.Math.Angle.Between(this.ally.x, this.ally.y, this.player.x, this.player.y);
      const endX = this.ally.x + Math.cos(angle) * 1400;
      const endY = this.ally.y + Math.sin(angle) * 1400;
      this.allyBeamLine.setTo(this.ally.x, this.ally.y, endX, endY);
      const midpointX = this.ally.x + Math.cos(angle) * 700;
      const midpointY = this.ally.y + Math.sin(angle) * 700;
      this.allyPredictionLine.clear();
      this.allyBeam.setSize(1400, 24).setPosition(midpointX, midpointY).setRotation(angle).setVisible(true);
      this.allyBeamActive = true;
    });

    this.time.delayedCall(1200, () => {
      if (shotId === this.allyShotId) {
        this.hideAlly();
      }
    });
  }

  private hideAlly(): void {
    this.allyShotId += 1;
    this.ally.setVisible(false);
    this.allyBeam.setVisible(false);
    this.allyPredictionLine.clear();
    this.allyBeamActive = false;
  }

  private stopAllySupport(): void {
    this.allySpawnTimer?.remove();
    this.allySpawnTimer = undefined;
  }

  private healPlayer(): void {
    if (this.state !== 'playing' || !this.allyBeamActive) {
      return;
    }
    this.health = Math.min(this.maxHealth, this.health + 1);
    this.updateHud();
    this.cameras.main.flash(180, 255, 114, 190);
    this.hideAlly();
  }

  private fireBeam(): void {
    const cycleId = ++this.beamCycleId;
    const targetX = this.player.x;
    const targetY = this.player.y;
    const angle = Phaser.Math.Angle.Between(this.enemyOne.x, this.enemyOne.y, targetX, targetY);
    const length = 1600;
    const endX = this.enemyOne.x + Math.cos(angle) * length;
    const endY = this.enemyOne.y + Math.sin(angle) * length;
    const midpointX = this.enemyOne.x + Math.cos(angle) * length / 2;
    const midpointY = this.enemyOne.y + Math.sin(angle) * length / 2;
    this.beamLine.setTo(
      this.enemyOne.x,
      this.enemyOne.y,
      endX,
      endY,
    );
    const beamThickness = 36;
    const normalX = -Math.sin(angle);
    const normalY = Math.cos(angle);
    this.beamCollisionLines = [-1, -0.5, 0, 0.5, 1].map((offset) => {
      const distance = offset * beamThickness / 2;
      return new Phaser.Geom.Line(
        this.enemyOne.x + normalX * distance,
        this.enemyOne.y + normalY * distance,
        endX + normalX * distance,
        endY + normalY * distance,
      );
    });
    this.predictionLine.clear();
    this.predictionLine.lineStyle(8, 0xffe66d, 0.9);
    this.predictionLine.lineBetween(this.enemyOne.x, this.enemyOne.y, endX, endY);
    this.beam.setSize(length, beamThickness).setPosition(midpointX, midpointY).setRotation(angle).setVisible(false);
    this.beamActive = false;
    const predictionDuration = 400;
    const beamDuration = Phaser.Math.Between(100, 1000);
    this.time.delayedCall(predictionDuration, () => {
      if (cycleId !== this.beamCycleId || this.state !== 'playing' || this.stage !== 1) {
        return;
      }
      this.predictionLine.clear();
      this.beamActive = true;
      this.beam.setVisible(true);
    });
    this.time.delayedCall(predictionDuration + beamDuration, () => {
      if (cycleId !== this.beamCycleId) {
        return;
      }
      this.beam.setVisible(false);
      this.beamActive = false;
    });
    this.time.delayedCall(predictionDuration + beamDuration, () => {
      if (cycleId !== this.beamCycleId) {
        return;
      }
      this.predictionLine.clear();
      if (this.state === 'playing' && this.stage === 1) {
        this.fireBeam();
      }
    });
  }

  private spawnEnemyTwoWave(): void {
    const crossingSpeed = 1340 / 3;
    const leftCount = Phaser.Math.Between(0, 6);
    const leftStartX = -30 + Phaser.Math.Between(0, 160);
    const rightStartX = 1310 - Phaser.Math.Between(0, 160);
    const waveId = ++this.enemyTwoWaveId;
    this.enemyTwoEnemies.forEach((enemy, index) => {
      const fromLeft = index < leftCount;
      const startX = fromLeft ? leftStartX : rightStartX;
      const startY = Phaser.Math.Between(100, 620);
      const body = enemy.body as Phaser.Physics.Arcade.Body;
      const predictionLine = this.enemyTwoPredictionLines[index];
      enemy.setPosition(startX, startY).setVisible(false);
      body.reset(startX, startY);
      body.setSize(76, 32, true);
      body.enable = false;
      body.setVelocity(0, 0);
      predictionLine.clear();
      predictionLine.lineStyle(5, 0xc77dff, 0.9);
      predictionLine.lineBetween(0, startY, 1280, startY);
      this.time.delayedCall(500, () => {
        if (waveId !== this.enemyTwoWaveId || this.state !== 'playing' || this.stage !== 2) {
          return;
        }
        predictionLine.clear();
        enemy.setVisible(true);
        body.enable = true;
        body.setVelocityX(fromLeft ? crossingSpeed : -crossingSpeed);
      });
    });
  }

  private hideEnemyTwoEnemies(): void {
    this.enemyTwoWaveId += 1;
    this.enemyTwoEnemies.forEach((enemy) => {
      enemy.setVisible(false);
      const body = enemy.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0, 0);
      body.enable = false;
    });
    this.enemyTwoPredictionLines.forEach((predictionLine) => predictionLine.clear());
  }

  private isGrounded(): boolean {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    return body.blocked.down || body.touching.down;
  }

  private updateHud(): void {
    this.jumpLabel.setText(`JUMPS  ${this.jumpCount.toString().padStart(2, '0')} / 50`);
    this.healthLabel.setText(`HP  ${this.health} / ${this.maxHealth}`);
  }

  private textStyle(fontSize: number, color: string): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: 'sans-serif',
      fontSize,
      color,
      fontStyle: 'bold',
    };
  }

  private drawBackdrop(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x17243a, 1).fillRect(0, 0, 1280, 720);
    graphics.fillStyle(0x203454, 1).fillRect(0, 590, 1280, 130);
    graphics.lineStyle(2, 0x3c587d, 1).lineBetween(0, 590, 1280, 590);
    graphics.fillStyle(0xf3b562, 0.18).fillCircle(1100, 110, 90);
  }
}
