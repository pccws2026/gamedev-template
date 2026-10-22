import Phaser from 'phaser';

export class HelloScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private trampoline!: Phaser.GameObjects.Rectangle;
  private enemyOne!: Phaser.GameObjects.Rectangle;
  private enemyTwoEnemies: Phaser.GameObjects.Rectangle[] = [];
  private enemyTwoPredictionLines: Phaser.GameObjects.Graphics[] = [];
  private beam!: Phaser.GameObjects.Rectangle;
  private predictionLine!: Phaser.GameObjects.Graphics;
  private beamLine!: Phaser.Geom.Line;
  private beamCollisionLines: Phaser.Geom.Line[] = [];
  private jumpLabel!: Phaser.GameObjects.Text;
  private jumpGauge!: Phaser.GameObjects.Graphics;
  private coinIcon!: Phaser.GameObjects.Graphics;
  private coinLabel!: Phaser.GameObjects.Text;
  private stageLabel!: Phaser.GameObjects.Text;
  private itemHudLabel!: Phaser.GameObjects.Text;
  private beamCountdownLabel!: Phaser.GameObjects.Text;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private moveLeftKey!: Phaser.Input.Keyboard.Key;
  private moveRightKey!: Phaser.Input.Keyboard.Key;
  private leftArrowKey!: Phaser.Input.Keyboard.Key;
  private rightArrowKey!: Phaser.Input.Keyboard.Key;
  private jumpWKey!: Phaser.Input.Keyboard.Key;
  private jumpUpKey!: Phaser.Input.Keyboard.Key;
  private fastFallSKey!: Phaser.Input.Keyboard.Key;
  private fastFallDownKey!: Phaser.Input.Keyboard.Key;
  private jumpCount = 0;
  private coins = 0;
  private readonly coinStorageKey = 'trampoline-dodger-coins';
  private readonly shieldStorageKey = 'trampoline-dodger-shields';
  private readonly previewStorageKey = 'trampoline-dodger-red-preview';
  private readonly beamCountdownStorageKey = 'trampoline-dodger-beam-countdown';
  private shieldCharges = 0;
  private redPreviewPurchased = false;
  private beamCountdownPurchased = false;
  private shieldProtectionUntil = 0;
  private beamDamageUntil = 0;
  private titleObjects: Phaser.GameObjects.GameObject[] = [];
  private shieldButtonLabel!: Phaser.GameObjects.Text;
  private previewButtonBackground!: Phaser.GameObjects.Rectangle;
  private previewButtonLabel!: Phaser.GameObjects.Text;
  private beamCountdownButtonLabel!: Phaser.GameObjects.Text;
  private shopMessageLabel!: Phaser.GameObjects.Text;
  private state: 'title' | 'playing' | 'gameover' | 'clear' = 'title';
  private stage = 1;
  private enemyTwoAttackStarted = false;
  private enemyTwoWaveStartedAt = 0;
  private enemyTwoWaveId = 0;
  private jumpHeldTime = 0;
  private nextJumpAllowedAt = 0;
  private beamActive = false;
  private beamCycleId = 0;
  private statusText?: Phaser.GameObjects.Text;
  private promptText?: Phaser.GameObjects.Text;

  constructor() {
    super('HelloScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101827');
    this.drawBackdrop();
    this.coins = this.loadCoins();
    this.shieldCharges = this.loadShieldCharges();
    this.redPreviewPurchased = localStorage.getItem(this.previewStorageKey) === 'true';
    this.beamCountdownPurchased = localStorage.getItem(this.beamCountdownStorageKey) === 'true';

    this.player = this.add.rectangle(640, 602, 38, 54, 0x55d6be);
    this.trampoline = this.add.rectangle(640, 638, 180, 18, 0xf3b562);
    this.enemyOne = this.add.rectangle(1030, 470, 52, 90, 0xf25f5c);
    this.beam = this.add.rectangle(0, 0, 260, 10, 0xffe66d);
    this.predictionLine = this.add.graphics();
    this.beamLine = new Phaser.Geom.Line();

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
    this.jumpGauge = this.add.graphics();
    this.coinIcon = this.add.graphics();
    this.coinIcon.fillStyle(0xffca3a, 1).fillCircle(1164, 42, 16);
    this.coinIcon.lineStyle(3, 0xffed9a, 1).strokeCircle(1164, 42, 14);
    this.coinIcon.lineStyle(2, 0xc88719, 1).strokeCircle(1164, 42, 9);
    this.coinIcon.fillStyle(0xffed9a, 1).fillCircle(1159, 37, 3);
    this.coinLabel = this.add.text(1240, 28, '', this.textStyle(24, '#f7f4ea')).setOrigin(1, 0);
    this.stageLabel = this.add.text(40, 86, '', this.textStyle(18, '#9fb3c8'));
    this.itemHudLabel = this.add.text(40, 114, '', this.textStyle(16, '#55d6be')).setVisible(false);
    this.beamCountdownLabel = this.add.text(
      this.enemyOne.x,
      this.enemyOne.y - 64,
      '',
      this.textStyle(14, '#fff3d1'),
    ).setOrigin(0.5).setVisible(false);
    const keyboard = this.input.keyboard!;
    this.spaceKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.moveLeftKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.moveRightKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.leftArrowKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.rightArrowKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.jumpWKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.jumpUpKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.fastFallSKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.fastFallDownKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    keyboard.on('keydown-ENTER', this.handleEnter, this);

    this.showTitle();
  }

  update(time: number): void {
    if (this.state !== 'playing') {
      return;
    }
    if (this.player.getBounds().bottom >= this.scale.height) {
      this.finish('gameover');
      return;
    }
    this.updateBeamCountdown();

    const jumpHeld = this.spaceKey.isDown || this.jumpWKey.isDown || this.jumpUpKey.isDown;
    const jumpPressed = Phaser.Input.Keyboard.JustDown(this.spaceKey)
      || Phaser.Input.Keyboard.JustDown(this.jumpWKey)
      || Phaser.Input.Keyboard.JustDown(this.jumpUpKey);
    if (jumpPressed && this.isGrounded() && time >= this.nextJumpAllowedAt) {
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocityY(-240);
      this.jumpHeldTime = 0;
      this.nextJumpAllowedAt = time + 1000;
      this.jumpCount += 1;
      this.coins = Math.min(this.coins + 1, 999);
      localStorage.setItem(this.coinStorageKey, this.coins.toString());
      this.updateHud();
      if (this.jumpCount === 25) {
        this.stage = 2;
        this.enemyOne.setVisible(false);
        (this.enemyOne.body as Phaser.Physics.Arcade.StaticBody).enable = false;
        this.beam.setVisible(false);
        this.beamCycleId += 1;
        this.predictionLine.clear();
        this.beamActive = false;
        this.beamDamageUntil = 0;
        this.beamCountdownLabel.setVisible(false);
        this.cameras.main.flash(500, 255, 255, 255);
        this.stageLabel.setText('STAGE 2  /  PURPLE HUNTER');
      }
      if (this.jumpCount >= 50) {
        this.finish('clear');
        return;
      }
    }

    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    const movingLeft = this.moveLeftKey.isDown || this.leftArrowKey.isDown;
    const movingRight = this.moveRightKey.isDown || this.rightArrowKey.isDown;
    const horizontalSpeed = movingRight === movingLeft
      ? 0
      : movingLeft ? -260 : 260;
    playerBody.setVelocityX(horizontalSpeed);
    if (jumpHeld && playerBody.velocity.y < 0 && this.jumpHeldTime < 400 && this.player.y > 100) {
      this.jumpHeldTime += 1000 / 60;
      playerBody.setVelocityY(-550);
    }
    playerBody.gravity.y = (this.fastFallSKey.isDown || this.fastFallDownKey.isDown)
      && playerBody.velocity.y > 0
      ? this.physics.world.gravity.y
      : 0;
    if (this.player.y <= 100 && playerBody.velocity.y < 0) {
      playerBody.setVelocityY(0);
    }
    if (!jumpHeld && playerBody.velocity.y < 0) {
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
    this.beamDamageUntil = 0;
    this.beamCountdownLabel.setVisible(false);
    this.jumpLabel.setVisible(false);
    this.jumpGauge.setVisible(false);
    this.coinIcon.setVisible(true);
    this.coinLabel.setVisible(true).setText(this.coins.toString().padStart(3, '0'));
    this.stageLabel.setVisible(false);
    this.itemHudLabel.setVisible(false);
    this.statusText?.destroy();
    this.promptText?.destroy();
    this.clearTitleObjects();
    this.createTitleMenu();
  }

  private startGame(): void {
    this.state = 'playing';
    this.time.timeScale = 1;
    this.physics.world.timeScale = 1;
    this.tweens.timeScale = 1;
    this.beamCycleId += 1;
    this.jumpCount = 0;
    this.stage = 1;
    this.shieldProtectionUntil = 0;
    this.jumpHeldTime = 0;
    this.nextJumpAllowedAt = 0;
    this.clearTitleObjects();
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
    this.jumpLabel.setVisible(true);
    this.jumpGauge.setVisible(true);
    this.coinIcon.setVisible(true);
    this.coinLabel.setVisible(true);
    this.stageLabel.setVisible(true).setText('STAGE 1  /  赤い秀一');
    this.itemHudLabel.setVisible(this.shieldCharges > 0);
    this.updateHud();
    const cycleId = this.beamCycleId;
    this.time.delayedCall(1000, () => {
      if (cycleId === this.beamCycleId && this.state === 'playing' && this.stage === 1) {
        this.fireBeam();
      }
    });
  }

  private finish(result: 'gameover' | 'clear'): void {
    this.state = result;
    this.beamCycleId += 1;
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    playerBody.setVelocity(0, 0);
    playerBody.gravity.y = 0;
    this.beam.setVisible(false);
    this.beamActive = false;
    this.beamDamageUntil = 0;
    this.beamCountdownLabel.setVisible(false);
    this.hideEnemyTwoEnemies();
    this.predictionLine.clear();
    this.beamActive = false;
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
    if (this.state !== 'playing' || this.time.now < this.shieldProtectionUntil) {
      return;
    }
    if (this.shieldCharges > 0) {
      this.shieldCharges -= 1;
      this.shieldProtectionUntil = this.time.now + 700;
      localStorage.setItem(this.shieldStorageKey, this.shieldCharges.toString());
      if (this.stage === 1) {
        this.beamCycleId += 1;
        this.beam.setVisible(false);
        this.predictionLine.clear();
        this.beamActive = false;
        const cycleId = this.beamCycleId;
        this.time.delayedCall(700, () => {
          if (cycleId === this.beamCycleId && this.state === 'playing' && this.stage === 1) {
            this.fireBeam();
          }
        });
      } else {
        this.hideEnemyTwoEnemies();
      }
      this.cameras.main.flash(250, 85, 214, 190);
      this.updateHud();
      return;
    }
    this.finish('gameover');
  }

  private fireBeam(): void {
    const cycleId = ++this.beamCycleId;
    this.beamActive = false;
    this.beamDamageUntil = 0;
    this.beamCountdownLabel.setVisible(false);
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
    const drawBeamPrediction = (color: number): void => {
      this.predictionLine.clear();
      this.predictionLine.lineStyle(8, color, 0.9);
      this.predictionLine.lineBetween(this.enemyOne.x, this.enemyOne.y, endX, endY);
    };
    const redLeadDuration = this.redPreviewPurchased ? 350 : 0;
    drawBeamPrediction(this.redPreviewPurchased ? 0xf25f5c : 0xffe66d);
    this.beam.setSize(length, beamThickness).setPosition(midpointX, midpointY).setRotation(angle).setVisible(false);
    this.beamActive = false;
    const predictionDuration = 400;
    const totalPredictionDuration = redLeadDuration + predictionDuration;
    const beamDuration = Phaser.Math.Between(100, 1000);
    if (this.redPreviewPurchased) {
      this.time.delayedCall(redLeadDuration, () => {
        if (cycleId === this.beamCycleId && this.state === 'playing' && this.stage === 1) {
          drawBeamPrediction(0xffe66d);
        }
      });
    }
    this.time.delayedCall(totalPredictionDuration, () => {
      if (cycleId !== this.beamCycleId || this.state !== 'playing' || this.stage !== 1) {
        return;
      }
      this.predictionLine.clear();
      this.beamActive = true;
      this.beamDamageUntil = this.time.now + beamDuration;
      this.beam.setVisible(true);
    });
    this.time.delayedCall(totalPredictionDuration + beamDuration, () => {
      if (cycleId !== this.beamCycleId) {
        return;
      }
      this.beam.setVisible(false);
      this.beamActive = false;
      this.beamDamageUntil = 0;
      this.beamCountdownLabel.setVisible(false);
    });
    this.time.delayedCall(totalPredictionDuration + beamDuration, () => {
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
      const drawEnemyPrediction = (color: number): void => {
        predictionLine.clear();
        predictionLine.lineStyle(5, color, 0.9);
        predictionLine.lineBetween(0, startY, 1280, startY);
      };
      const redLeadDuration = this.redPreviewPurchased ? 350 : 0;
      drawEnemyPrediction(this.redPreviewPurchased ? 0xf25f5c : 0xc77dff);
      if (this.redPreviewPurchased) {
        this.time.delayedCall(redLeadDuration, () => {
          if (waveId === this.enemyTwoWaveId && this.state === 'playing' && this.stage === 2) {
            drawEnemyPrediction(0xc77dff);
          }
        });
      }
      this.time.delayedCall(redLeadDuration + 500, () => {
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
    this.coinLabel.setText(this.coins.toString().padStart(3, '0'));
    this.itemHudLabel.setText(this.shieldCharges > 0 ? `シールド残り: ${this.shieldCharges}` : '');
    this.itemHudLabel.setVisible(this.state === 'playing' && this.shieldCharges > 0);
    const gaugeWidth = 300;
    const gaugeProgress = Phaser.Math.Clamp(this.jumpCount / 50, 0, 1);
    this.jumpGauge.clear();
    this.jumpGauge.fillStyle(0x253b52, 1).fillRoundedRect(40, 56, gaugeWidth, 14, 7);
    this.jumpGauge.fillStyle(0x55d6be, 1).fillRoundedRect(40, 56, gaugeWidth * gaugeProgress, 14, 7);
    this.jumpGauge.fillStyle(0xf3b562, 1).fillRect(40 + gaugeWidth / 2 - 1, 53, 2, 20);
  }

  private updateBeamCountdown(): void {
    if (!this.beamCountdownPurchased || this.stage !== 1 || !this.beamActive) {
      this.beamCountdownLabel.setVisible(false);
      return;
    }
    const remainingMs = this.beamDamageUntil - this.time.now;
    if (remainingMs <= 0) {
      this.beamCountdownLabel.setVisible(false);
      return;
    }
    const remainingSeconds = (Math.ceil(remainingMs / 100) / 10).toFixed(1);
    this.beamCountdownLabel
      .setText(remainingSeconds)
      .setPosition(this.enemyOne.x, this.enemyOne.y - 64)
      .setVisible(true);
  }

  private loadCoins(): number {
    const savedCoins = Number(localStorage.getItem(this.coinStorageKey));
    return Number.isFinite(savedCoins) ? Phaser.Math.Clamp(Math.floor(savedCoins), 0, 999) : 0;
  }

  private loadShieldCharges(): number {
    const savedCharges = Number(localStorage.getItem(this.shieldStorageKey));
    return Number.isFinite(savedCharges) ? Math.max(0, Math.floor(savedCharges)) : 0;
  }

  private createTitleMenu(): void {
    this.addTitleObject(this.add.text(640, 50, 'TRAMPOLINE DODGER', {
      ...this.textStyle(48, '#f7f4ea'),
      align: 'center',
    }).setOrigin(0.5));
    this.addTitleObject(this.add.text(640, 104, 'SHOP', this.textStyle(24, '#f3b562')).setOrigin(0.5));

    this.addTitleObject(this.add.rectangle(640, 200, 800, 92, 0x17243a).setStrokeStyle(1, 0x3c587d));
    this.addTitleObject(this.add.text(280, 178, 'シールド', this.textStyle(22, '#f7f4ea')));
    this.addTitleObject(this.add.text(280, 210, '次の被弾を1回だけ無効化', this.textStyle(17, '#9fb3c8')));
    const shieldButton = this.createShopButton(990, 200, 190, 56, () => this.buyShield());
    this.shieldButtonLabel = shieldButton.label;

    this.addTitleObject(this.add.rectangle(640, 315, 800, 92, 0x17243a).setStrokeStyle(1, 0x3c587d));
    this.addTitleObject(this.add.text(280, 293, '赤い攻撃予告', this.textStyle(22, '#f7f4ea')));
    this.addTitleObject(this.add.text(280, 325, '赤い先行予告のあと、通常の予告線が表示される', this.textStyle(17, '#9fb3c8')));
    const previewButton = this.createShopButton(990, 315, 190, 56, () => this.buyRedPreview());
    this.previewButtonBackground = previewButton.background;
    this.previewButtonLabel = previewButton.label;

    this.addTitleObject(this.add.rectangle(640, 430, 800, 92, 0x17243a).setStrokeStyle(1, 0x3c587d));
    this.addTitleObject(this.add.text(280, 408, 'ビーム残り時間', this.textStyle(22, '#f7f4ea')));
    this.addTitleObject(this.add.text(280, 440, '攻撃判定中、敵の上に残り秒数を表示', this.textStyle(17, '#9fb3c8')));
    const countdownButton = this.createShopButton(990, 430, 190, 56, () => this.buyBeamCountdown());
    this.beamCountdownButtonLabel = countdownButton.label;

    this.shopMessageLabel = this.addTitleObject(this.add.text(640, 520, '', this.textStyle(17, '#f7f4ea')).setOrigin(0.5));
    const startButton = this.createShopButton(640, 600, 280, 64, () => this.startGame());
    startButton.background.setFillStyle(0x55d6be, 1);
    startButton.background.on('pointerover', () => startButton.background.setFillStyle(0x8be8d6, 1));
    startButton.background.on('pointerout', () => startButton.background.setFillStyle(0x55d6be, 1));
    startButton.label.setText('ゲーム開始').setFontSize(24).setColor('#101827');

    const resetButton = this.addTitleObject(
      this.add.rectangle(1152, 676, 216, 44, 0x8e3e45).setInteractive({ useHandCursor: true }),
    );
    this.addTitleObject(this.add.text(1152, 676, 'データリセット', this.textStyle(17, '#fff4ea')).setOrigin(0.5));
    resetButton.on('pointerover', () => resetButton.setFillStyle(0xb84f58, 1));
    resetButton.on('pointerout', () => resetButton.setFillStyle(0x8e3e45, 1));
    resetButton.on('pointerdown', () => this.resetSaveData());

    this.refreshShopUi('クリックで購入 / ENTERでも開始できます');
  }

  private createShopButton(
    x: number,
    y: number,
    width: number,
    height: number,
    onClick: () => void,
  ): { background: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text } {
    const background = this.add.rectangle(x, y, width, height, 0xf3b562)
      .setInteractive({ useHandCursor: true });
    const label = this.add.text(x, y, '', this.textStyle(18, '#101827')).setOrigin(0.5);
    background.on('pointerover', () => background.setFillStyle(0xffd88a, 1));
    background.on('pointerout', () => {
      background.setFillStyle(label.text === '購入済み' ? 0x365c55 : 0xf3b562, 1);
    });
    background.on('pointerdown', () => {
      if (this.state === 'title') {
        onClick();
      }
    });
    this.addTitleObject(background);
    this.addTitleObject(label);
    return { background, label };
  }

  private buyShield(): void {
    if (this.coins < 10) {
      this.refreshShopUi('コインが足りません');
      return;
    }
    this.coins -= 10;
    this.shieldCharges += 1;
    localStorage.setItem(this.coinStorageKey, this.coins.toString());
    localStorage.setItem(this.shieldStorageKey, this.shieldCharges.toString());
    this.refreshShopUi('シールドを購入しました');
  }

  private buyRedPreview(): void {
    if (this.redPreviewPurchased) {
      this.refreshShopUi('赤い攻撃予告は購入済みです');
      return;
    }
    if (this.coins < 5) {
      this.refreshShopUi('コインが足りません');
      return;
    }
    this.coins -= 5;
    this.redPreviewPurchased = true;
    localStorage.setItem(this.coinStorageKey, this.coins.toString());
    localStorage.setItem(this.previewStorageKey, 'true');
    this.refreshShopUi('赤い攻撃予告を購入しました');
  }

  private buyBeamCountdown(): void {
    if (this.beamCountdownPurchased) {
      this.refreshShopUi('ビーム残り時間は購入済みです');
      return;
    }
    if (this.coins < 10) {
      this.refreshShopUi('コインが足りません');
      return;
    }
    this.coins -= 10;
    this.beamCountdownPurchased = true;
    localStorage.setItem(this.coinStorageKey, this.coins.toString());
    localStorage.setItem(this.beamCountdownStorageKey, 'true');
    this.refreshShopUi('ビーム残り時間を購入しました');
  }

  private resetSaveData(): void {
    this.coins = 0;
    this.shieldCharges = 0;
    this.redPreviewPurchased = false;
    this.beamCountdownPurchased = false;
    localStorage.removeItem(this.coinStorageKey);
    localStorage.removeItem(this.shieldStorageKey);
    localStorage.removeItem(this.previewStorageKey);
    localStorage.removeItem(this.beamCountdownStorageKey);
    this.refreshShopUi('所持コインと購入アイテムをリセットしました');
  }

  private refreshShopUi(message: string): void {
    this.coinLabel.setText(this.coins.toString().padStart(3, '0'));
    this.shieldButtonLabel.setText(`購入 10  /  所持 ${this.shieldCharges}`);
    this.previewButtonLabel.setText(this.redPreviewPurchased ? '購入済み' : '購入 5');
    this.previewButtonBackground.setFillStyle(this.redPreviewPurchased ? 0x365c55 : 0xf3b562, 1);
    this.beamCountdownButtonLabel.setText(this.beamCountdownPurchased ? '購入済み' : '購入 10');
    this.shopMessageLabel.setText(message);
  }

  private addTitleObject<T extends Phaser.GameObjects.GameObject>(gameObject: T): T {
    this.titleObjects.push(gameObject);
    return gameObject;
  }

  private clearTitleObjects(): void {
    this.titleObjects.forEach((gameObject) => gameObject.destroy());
    this.titleObjects = [];
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
