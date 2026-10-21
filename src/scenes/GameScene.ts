import Phaser from 'phaser';

type GameState = 'title' | 'playing' | 'clear' | 'gameover';
type TargetKind = 'regular' | 'bomb' | 'split' | 'stealth' | 'fake' | 'boss' | 'clock' | 'armored' | 'fragment';
type PickupKind = 'slowMotion' | 'wideShot' | 'scoreBoost';

type Target = {
  shape: Phaser.GameObjects.Shape;
  visualShapes: Phaser.GameObjects.Shape[];
  visualOffsets: { x: number; y: number }[];
  radius: number;
  kind: TargetKind;
  health: number;
  maxHealth: number;
  age: number;
  blinkElapsed: number;
  isVisible: boolean;
  velocityX: number;
  velocityY: number;
  directionChangeRemaining: number;
};

type Pickup = {
  shape: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  kind: PickupKind;
  age: number;
};

export class GameScene extends Phaser.Scene {
  private readonly gameWidth = 1280;
  private readonly gameHeight = 720;
  private readonly gameDuration = 30;
  private readonly bossSpawnScore = 30000;
  private readonly scorePerTarget = 100;
  private readonly fakeTargetPenalty = 500;
  private readonly clockTimeBonus = 5;
  private readonly bossHealth = 10;
  private readonly bossRadius = 64;
  private readonly bossClockSpawnInterval = 1.5;
  private readonly bossMinSpeed = 450;
  private readonly bossMaxSpeed = 650;
  private readonly bossMinDirectionChangeInterval = 0.12;
  private readonly bossMaxDirectionChangeInterval = 0.35;
  private readonly pickupRadius = 34;
  private readonly pickupSpawnInterval = 7;
  private readonly pickupLifetime = 8;
  private readonly slowMotionDuration = 3;
  private readonly scoreBoostDuration = 5;
  private readonly scoreBoostMultiplier = 2;
  private readonly comboTimeout = 2;
  private readonly scoreFeedbackDuration = 1000;
  private readonly scoreFeedbackSpacing = 48;
  private readonly targetRadius = 33.6;
  private readonly bombRadius = this.targetRadius * 0.9;
  private readonly maxTargetCount = 20;
  private readonly cursorRadius = 22;
  private readonly initialSpawnInterval = 0.4;
  private readonly finalSpawnInterval = 0.08;
  private readonly targetLifetime = 4;
  private readonly stealthVisibleDuration = 0.9;
  private readonly stealthInvisibleDuration = 0.3;
  private readonly minTargetSpeed = 100;
  private readonly maxTargetSpeed = 300;
  private readonly explosionRadius = this.bombRadius * 6.5;
  private readonly targetExplosionDuration = 200;
  private readonly bombExplosionDuration = 1000;
  private readonly fireCooldown = 0.2;
  private readonly hudHeight = 112;
  private readonly aimGaugeSpeed = 1.5;
  private readonly maxShotSpread = 56;

  private state: GameState = 'title';
  private remainingTime = this.gameDuration;
  private score = 0;
  private combo = 0;
  private comboRemaining = 0;
  private bossSpawned = false;
  private spawnElapsed = 0;
  private pickupSpawnElapsed = 0;
  private slowMotionRemaining = 0;
  private scoreBoostRemaining = 0;
  private wideShotReady = false;
  private cooldownRemaining = 0;
  private isAiming = false;
  private aimGauge = 0;
  private aimGaugeDirection = 1;
  private cursorX = this.gameWidth / 2;
  private cursorY = this.gameHeight / 2;
  private targets: Target[] = [];
  private pickups: Pickup[] = [];
  private fadingTargetShapes: Phaser.GameObjects.Shape[] = [];
  private explosions: Phaser.GameObjects.Arc[] = [];
  private screenTexts: Phaser.GameObjects.Text[] = [];
  private cursorGraphics!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private bossHealthText!: Phaser.GameObjects.Text;
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
    this.bossHealthText = this.add.text(this.gameWidth / 2, 78, '', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#fca5a5',
    }).setOrigin(0.5).setVisible(false);
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
    if (this.isAiming) {
      this.aimGauge += this.aimGaugeDirection * this.aimGaugeSpeed * elapsed;
      if (this.aimGauge >= 1) {
        this.aimGauge = 1;
        this.aimGaugeDirection = -1;
      } else if (this.aimGauge <= 0) {
        this.aimGauge = 0;
        this.aimGaugeDirection = 1;
      }
    }
    if (this.comboRemaining === 0) {
      this.combo = 0;
      this.comboText.setVisible(false);
    }
    this.drawCursor();
    this.spawnElapsed += elapsed;
    this.pickupSpawnElapsed += elapsed;
    this.slowMotionRemaining = Math.max(0, this.slowMotionRemaining - elapsed);
    this.scoreBoostRemaining = Math.max(0, this.scoreBoostRemaining - elapsed);

    if (!this.bossSpawned && this.score >= this.bossSpawnScore) {
      this.spawnBoss();
    }
    if (!this.bossSpawned) {
      const spawnInterval = this.getSpawnInterval();
      if (this.spawnElapsed >= spawnInterval) {
        this.spawnElapsed -= spawnInterval;
        this.spawnTarget();
      }
    } else if (this.spawnElapsed >= this.bossClockSpawnInterval) {
      this.spawnElapsed -= this.bossClockSpawnInterval;
      this.spawnClockTarget();
    }
    if (!this.bossSpawned && this.pickupSpawnElapsed >= this.pickupSpawnInterval) {
      this.pickupSpawnElapsed -= this.pickupSpawnInterval;
      this.spawnPickup();
    }

    for (const target of [...this.targets]) {
      target.age += elapsed;
      if (target.kind === 'stealth') {
        target.blinkElapsed += elapsed;
        const blinkDuration = target.isVisible ? this.stealthVisibleDuration : this.stealthInvisibleDuration;
        if (target.blinkElapsed >= blinkDuration) {
          target.blinkElapsed -= blinkDuration;
          target.isVisible = !target.isVisible;
          target.visualShapes.forEach((shape) => shape.setAlpha(target.isVisible ? 1 : 0));
        }
      }
      this.moveTarget(target, elapsed * (this.slowMotionRemaining > 0 ? 0.5 : 1));
      if (target.kind !== 'boss' && target.age >= this.targetLifetime) {
        this.fadeOutTarget(target.shape);
      }
    }
    for (const pickup of [...this.pickups]) {
      pickup.age += elapsed;
      if (pickup.age >= this.pickupLifetime) {
        this.removePickup(pickup);
      }
    }
    this.resolveTargetCollisions();

    this.updateHud();
    if (this.remainingTime <= 0) {
      this.finishGame(false);
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
    if (this.state !== 'playing' || pointer.button !== 0) {
      return;
    }

    const tap = new Phaser.Geom.Circle(
      Phaser.Math.Clamp(pointer.worldX, 0, this.gameWidth),
      Phaser.Math.Clamp(pointer.worldY, this.hudHeight, this.gameHeight),
      this.cursorRadius,
    );
    this.cursorX = tap.x;
    this.cursorY = tap.y;
    this.drawCursor();
    const pickup = this.pickups.find((entry) =>
      Phaser.Geom.Intersects.CircleToCircle(tap, new Phaser.Geom.Circle(entry.shape.x, entry.shape.y, this.pickupRadius)),
    );
    if (pickup) {
      this.collectPickup(pickup);
      return;
    }
    if (this.cooldownRemaining > 0) {
      return;
    }

    if (!this.isAiming) {
      this.isAiming = true;
      this.aimGauge = 0;
      this.aimGaugeDirection = 1;
      return;
    }

    this.isAiming = false;
    this.cooldownRemaining = this.fireCooldown;
    const shotSpread = (1 - this.aimGauge) * this.maxShotSpread;
    const shotAngle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const shotDistance = Phaser.Math.FloatBetween(0, shotSpread);
    const shotX = Phaser.Math.Clamp(
      this.cursorX + Math.cos(shotAngle) * shotDistance,
      this.wideShotReady ? this.cursorRadius * 3 : 0,
      this.wideShotReady ? this.gameWidth - this.cursorRadius * 3 : this.gameWidth,
    );
    const shotY = Phaser.Math.Clamp(this.cursorY + Math.sin(shotAngle) * shotDistance, this.hudHeight, this.gameHeight);
    const shotOffsets = this.getShotOffsets();
    if (this.wideShotReady) {
      this.wideShotReady = false;
      this.drawCursor();
      this.showFloatingText(shotX, shotY, '横3つ攻撃！', '#86efac');
    }
    let hitSomething = false;
    for (const offset of shotOffsets) {
      const cursor = new Phaser.Geom.Circle(
        shotX + offset,
        shotY,
        this.cursorRadius,
      );
      for (const pickup of [...this.pickups]) {
        const pickupCircle = new Phaser.Geom.Circle(pickup.shape.x, pickup.shape.y, this.pickupRadius);
        if (Phaser.Geom.Intersects.CircleToCircle(cursor, pickupCircle)) {
          this.collectPickup(pickup);
          hitSomething = true;
        }
      }
      for (const target of [...this.targets]) {
        if (!target.isVisible) {
          continue;
        }
        const targetCircle = new Phaser.Geom.Circle(target.shape.x, target.shape.y, target.radius);
        if (Phaser.Geom.Intersects.CircleToCircle(cursor, targetCircle)) {
          this.resolveHit(target);
          hitSomething = true;
        }
      }
    }
    if (!hitSomething) {
      this.combo = 0;
      this.comboRemaining = 0;
      this.comboText.setVisible(false);
    }
  }

  private startGame(): void {
    this.clearTargets();
    this.clearPickups();
    this.clearExplosions();
    this.clearScreenTexts();
    this.state = 'playing';
    this.remainingTime = this.gameDuration;
    this.score = 0;
    this.combo = 0;
    this.comboRemaining = 0;
    this.bossSpawned = false;
    this.pickupSpawnElapsed = 0;
    this.slowMotionRemaining = 0;
    this.scoreBoostRemaining = 0;
    this.wideShotReady = false;
    this.comboText.setVisible(false);
    this.bossHealthText.setVisible(false);
    this.clearScoreFeedback();
    this.spawnElapsed = 0;
    this.cooldownRemaining = 0;
    this.isAiming = false;
    this.aimGauge = 0;
    this.aimGaugeDirection = 1;
    this.hudText.setVisible(true);
    this.updateHud();
    this.drawCursor();
  }

  private finishGame(isClear: boolean): void {
    this.state = isClear ? 'clear' : 'gameover';
    this.clearTargets();
    this.clearPickups();
    this.clearExplosions();
    this.cursorGraphics.clear();
    this.isAiming = false;
    this.comboText.setVisible(false);
    this.bossHealthText.setVisible(false);
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
      const kind = this.getRandomTargetKind();
      const radius = kind === 'bomb' ? this.bombRadius : this.targetRadius;
      const overlapsTarget = this.targets.some((target) => Phaser.Math.Distance.Between(x, y, target.shape.x, target.shape.y) < radius + target.radius);
      if (!overlapsTarget) {
        this.addTarget(x, y, kind, radius);
        return;
      }
    }
  }

  private spawnClockTarget(): void {
    if (this.targets.length >= this.maxTargetCount) {
      return;
    }

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const x = Phaser.Math.Between(this.targetRadius + 20, this.gameWidth - this.targetRadius - 20);
      const y = Phaser.Math.Between(this.hudHeight + this.targetRadius + 20, this.gameHeight - this.targetRadius - 20);
      const overlapsTarget = this.targets.some((target) => Phaser.Math.Distance.Between(x, y, target.shape.x, target.shape.y) < this.targetRadius + target.radius);
      if (!overlapsTarget) {
        this.addTarget(x, y, 'clock', this.targetRadius);
        return;
      }
    }
  }

  private spawnPickup(): void {
    if (this.pickups.length >= 2) {
      return;
    }

    const kinds: PickupKind[] = ['slowMotion', 'wideShot', 'scoreBoost'];
    const kind = Phaser.Utils.Array.GetRandom(kinds);
    const appearance = {
      slowMotion: { color: 0x8b5cf6, label: 'SLOW' },
      wideShot: { color: 0x22c55e, label: '3HIT' },
      scoreBoost: { color: 0xf59e0b, label: '2X' },
    }[kind];

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const x = Phaser.Math.Between(this.pickupRadius + 20, this.gameWidth - this.pickupRadius - 20);
      const y = Phaser.Math.Between(this.hudHeight + this.pickupRadius + 20, this.gameHeight - this.pickupRadius - 20);
      const overlapsTarget = this.targets.some((target) =>
        Phaser.Math.Distance.Between(x, y, target.shape.x, target.shape.y) < this.pickupRadius + target.radius,
      );
      const overlapsPickup = this.pickups.some((pickup) =>
        Phaser.Math.Distance.Between(x, y, pickup.shape.x, pickup.shape.y) < this.pickupRadius * 2,
      );
      if (!overlapsTarget && !overlapsPickup) {
        const shape = this.add.circle(x, y, this.pickupRadius, appearance.color).setStrokeStyle(4, 0xf8fafc).setDepth(10);
        const label = this.add.text(x, y, appearance.label, {
          fontFamily: 'monospace',
          fontSize: '15px',
          color: '#ffffff',
        }).setOrigin(0.5).setDepth(11);
        this.pickups.push({ shape, label, kind, age: 0 });
        return;
      }
    }
  }

  private collectPickup(pickup: Pickup): void {
    if (!this.pickups.includes(pickup)) {
      return;
    }

    const { x, y } = pickup.shape;
    this.removePickup(pickup);
    switch (pickup.kind) {
      case 'slowMotion':
        this.slowMotionRemaining = this.slowMotionDuration;
        this.showFloatingText(x, y, 'スローモーション！', '#c4b5fd');
        break;
      case 'wideShot':
        this.wideShotReady = true;
        this.showFloatingText(x, y, '横3つ攻撃：次の射撃で発動', '#86efac');
        break;
      case 'scoreBoost':
        this.scoreBoostRemaining = this.scoreBoostDuration;
        this.showFloatingText(x, y, 'スコア2倍！', '#fcd34d');
        break;
    }
  }

  private removePickup(pickup: Pickup): void {
    const index = this.pickups.indexOf(pickup);
    if (index === -1) {
      return;
    }

    this.pickups.splice(index, 1);
    pickup.shape.destroy();
    pickup.label.destroy();
  }

  private clearPickups(): void {
    for (const pickup of this.pickups) {
      pickup.shape.destroy();
      pickup.label.destroy();
    }
    this.pickups = [];
  }

  private getRandomTargetKind(): TargetKind {
    const roll = Phaser.Math.FloatBetween(0, 1);
    if (roll < 0.05) {
      return 'bomb';
    }
    if (roll < 0.1925) {
      return 'split';
    }
    if (roll < 0.31125) {
      return 'stealth';
    }
    if (roll < 0.43) {
      return 'fake';
    }
    if (roll < 0.525) {
      return 'clock';
    }
    if (roll < 0.703125) {
      return 'armored';
    }
    return 'regular';
  }

  private addTarget(x: number, y: number, kind: TargetKind, radius: number): Target {
    let visualShapes: Phaser.GameObjects.Shape[];
    switch (kind) {
      case 'bomb':
        visualShapes = [
          this.add.circle(x, y, radius, 0x111827).setStrokeStyle(4, 0x475569),
          this.add.rectangle(x + radius * 0.37, y - radius * 0.78, radius * 0.3, radius * 0.27, 0x64748b)
            .setRotation(-0.55),
          this.add.rectangle(x + radius * 0.55, y - radius * 1.08, radius * 0.1, radius * 0.35, 0x92400e)
            .setRotation(-0.55),
          this.add.circle(x + radius * 0.65, y - radius * 1.25, radius * 0.16, 0xf97316),
          this.add.star(x + radius * 0.65, y - radius * 1.25, 4, radius * 0.06, radius * 0.13, 0xfef08a),
        ];
        break;
      case 'clock':
        visualShapes = [
          this.add.circle(x, y, radius, 0x0284c7).setStrokeStyle(4, 0xe0f2fe),
          this.add.circle(x, y, radius * 0.78, 0xf8fafc),
          this.add.rectangle(x, y - radius * 0.2, radius * 0.09, radius * 0.42, 0x0c4a6e),
          this.add.rectangle(x + radius * 0.12, y - radius * 0.05, radius * 0.38, radius * 0.09, 0x0c4a6e)
            .setRotation(-0.55),
          this.add.circle(x, y, radius * 0.1, 0x0c4a6e),
        ];
        break;
      case 'boss':
        visualShapes = [
          this.add.circle(x, y, radius, 0x7f1d1d).setStrokeStyle(6, 0xfca5a5),
          this.add.circle(x, y, radius * 0.72, 0xdc2626),
          this.add.circle(x, y, radius * 0.46, 0x7f1d1d),
          this.add.circle(x, y, radius * 0.22, 0xfca5a5),
        ];
        break;
      case 'armored':
        visualShapes = [
          this.add.circle(x, y, radius, 0x64748b).setStrokeStyle(5, 0xe2e8f0),
          this.add.circle(x, y, radius * 0.72, 0x334155),
          this.add.circle(x, y, radius * 0.46, 0xf97316),
          this.add.circle(x, y, radius * 0.22, 0xffedd5),
        ];
        break;
      case 'fragment':
        visualShapes = [
          this.add.circle(x, y, radius, 0xffffff).setStrokeStyle(2, 0x67e8f9),
          this.add.circle(x, y, radius * 0.62, 0xf97316),
          this.add.circle(x, y, radius * 0.3, 0xffffff),
        ];
        break;
      case 'split':
      case 'stealth':
      case 'fake':
      case 'regular':
        visualShapes = [
          this.add.circle(x, y, radius, 0xffffff),
          this.add.circle(x, y, radius * 0.72, 0xf97316),
          this.add.circle(x, y, radius * 0.46, 0xffffff),
          this.add.circle(x, y, radius * 0.22, 0xf97316),
        ];
        if (kind === 'split') {
          visualShapes[0].setStrokeStyle(4, 0x67e8f9);
        } else if (kind === 'stealth') {
          visualShapes[0].setStrokeStyle(4, 0xa78bfa);
        } else if (kind === 'fake') {
          visualShapes.forEach((shape) => shape.setAlpha(0.65));
        }
        break;
    }

    const maxHealth = kind === 'boss' ? this.bossHealth : kind === 'armored' ? 2 : 1;
    const directionX = Phaser.Math.Between(-1, 1);
    const directionY = Phaser.Math.Between(-1, 1);
    const hasDirection = directionX !== 0 || directionY !== 0;
    const velocity = kind === 'boss'
      ? Phaser.Math.FloatBetween(this.bossMinSpeed, this.bossMaxSpeed)
      : Phaser.Math.FloatBetween(this.minTargetSpeed, this.maxTargetSpeed);
    const bossAngle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const normalizedLength = Math.hypot(directionX, directionY) || 1;
    const target: Target = {
      shape: visualShapes[0],
      visualShapes,
      visualOffsets: visualShapes.map((visualShape) => ({
        x: visualShape.x - x,
        y: visualShape.y - y,
      })),
      radius,
      kind,
      health: maxHealth,
      maxHealth,
      age: 0,
      blinkElapsed: 0,
      isVisible: true,
      velocityX: kind === 'boss' ? Math.cos(bossAngle) * velocity : hasDirection ? (directionX / normalizedLength) * velocity : 0,
      velocityY: kind === 'boss' ? Math.sin(bossAngle) * velocity : hasDirection ? (directionY / normalizedLength) * velocity : 0,
      directionChangeRemaining: kind === 'boss'
        ? Phaser.Math.FloatBetween(this.bossMinDirectionChangeInterval, this.bossMaxDirectionChangeInterval)
        : 0,
    };
    this.targets.push(target);
    return target;
  }

  private spawnBoss(): void {
    this.bossSpawned = true;
    this.spawnElapsed = 0;
    this.clearTargets();
    this.clearPickups();
    this.addTarget(this.gameWidth / 2, this.gameHeight / 2 + 40, 'boss', this.bossRadius);
    this.bossHealthText.setVisible(true);
    this.showFloatingText(this.gameWidth / 2, 220, 'ボス出現！', '#fca5a5');
  }

  private removeTarget(target: Phaser.GameObjects.Shape): void {
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

  private fadeOutTarget(target: Phaser.GameObjects.Shape): void {
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

    if (target.kind === 'bomb') {
      this.explodeBomb(target);
      return;
    }

    this.resolveNonBombHit(target);
  }

  private resolveNonBombHit(target: Target): void {
    if (!this.targets.includes(target)) {
      return;
    }

    const x = target.shape.x;
    const y = target.shape.y;
    if (target.kind === 'fake') {
      this.score = Math.max(0, this.score - this.fakeTargetPenalty);
      this.combo = 0;
      this.comboRemaining = 0;
      this.comboText.setVisible(false);
      this.showFloatingText(x, y, `-${this.fakeTargetPenalty}点`, '#fda4af');
      this.removeTarget(target.shape);
      return;
    }
    if (target.kind === 'clock') {
      this.remainingTime += this.clockTimeBonus;
      this.showFloatingText(x, y, `+${this.clockTimeBonus}秒`, '#7dd3fc');
      this.removeTarget(target.shape);
      return;
    }
    if (target.kind === 'armored') {
      target.health -= 1;
      if (target.health > 0) {
        target.visualShapes[0].setStrokeStyle(6, 0xfacc15);
        target.visualShapes[1].setFillStyle(0x475569);
        this.addTargetScore();
        this.showFloatingText(x, y, `残り ${target.health}発`, '#fde68a');
        return;
      }
    }
    if (target.kind === 'boss') {
      target.health -= 1;
      this.updateHud();
      if (target.health > 0) {
        target.visualShapes[0].setStrokeStyle(8, 0xfacc15);
        this.showExplosion(x, y, this.targetExplosionDuration);
        return;
      }
      this.showExplosion(x, y, this.bombExplosionDuration);
      this.removeTarget(target.shape);
      this.finishGame(true);
      return;
    }

    this.addTargetScore();
    this.showExplosion(x, y, this.targetExplosionDuration);
    this.removeTarget(target.shape);
    if (target.kind === 'split') {
      const fragmentRadius = this.targetRadius * 0.42;
      this.addTarget(x - fragmentRadius, y, 'fragment', fragmentRadius);
      this.addTarget(x + fragmentRadius, y, 'fragment', fragmentRadius);
    }
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
      if (current.kind === 'bomb') {
        this.comboRemaining = this.comboTimeout;
        this.showComboText();
        this.showExplosion(centerX, centerY, this.bombExplosionDuration);
        this.removeTarget(current.shape);
        for (const target of [...this.targets]) {
          if (Phaser.Math.Distance.Between(centerX, centerY, target.shape.x, target.shape.y) <= this.explosionRadius) {
            pendingTargets.push(target);
          }
        }
      } else {
        this.resolveNonBombHit(current);
      }
      if (this.state !== 'playing') {
        break;
      }
    }
  }

  private showFloatingText(x: number, y: number, message: string, color: string): void {
    const feedback = this.add.text(x, y, message, {
      fontFamily: 'sans-serif',
      fontSize: '26px',
      color,
      stroke: '#0f172a',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(1001);
    this.tweens.add({
      targets: feedback,
      y: y - 40,
      alpha: 0,
      duration: 900,
      onComplete: () => feedback.destroy(),
    });
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
    const scoreMultiplier = this.scoreBoostRemaining > 0 ? this.scoreBoostMultiplier : 1;
    const points = this.scorePerTarget * this.combo * scoreMultiplier;
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
      const targetY = this.hudHeight + index * this.scoreFeedbackSpacing;
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
    if (target.kind === 'boss') {
      target.directionChangeRemaining -= elapsed;
      if (target.directionChangeRemaining <= 0) {
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const speed = Phaser.Math.FloatBetween(this.bossMinSpeed, this.bossMaxSpeed);
        target.velocityX = Math.cos(angle) * speed;
        target.velocityY = Math.sin(angle) * speed;
        target.directionChangeRemaining = Phaser.Math.FloatBetween(
          this.bossMinDirectionChangeInterval,
          this.bossMaxDirectionChangeInterval,
        );
      }
    }

    const minX = target.radius + 20;
    const maxX = this.gameWidth - target.radius - 20;
    const minY = this.hudHeight + target.radius + 20;
    const maxY = this.gameHeight - target.radius - 20;
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
    this.setTargetPosition(target, nextX, nextY);
  }

  private setTargetPosition(target: Target, x: number, y: number): void {
    target.visualShapes.forEach((shape, index) => {
      const offset = target.visualOffsets[index];
      shape.setPosition(x + offset.x, y + offset.y);
    });
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
        this.setTargetPosition(first, first.shape.x - normalX * separation, first.shape.y - normalY * separation);
        this.setTargetPosition(second, second.shape.x + normalX * separation, second.shape.y + normalY * separation);
      }
    }
  }

  private updateHud(): void {
    this.hudText.setText(`${this.score}点                         残り ${this.remainingTime.toFixed(1)}秒`);
    this.hudText.setPosition(28, 24);
    const boss = this.targets.find((target) => target.kind === 'boss');
    const bossHealth = boss ? `BOSS HP ${boss.health}/${boss.maxHealth}` : '';
    if (this.bossHealthText.text !== bossHealth) {
      this.bossHealthText.setText(bossHealth);
    }
    this.bossHealthText.setVisible(boss !== undefined && this.state === 'playing');
  }

  private drawCursor(): void {
    this.cursorGraphics.clear();
    if (this.state !== 'playing') {
      return;
    }
    const cursorColor = this.cooldownRemaining > 0 ? 0xef4444 : this.wideShotReady ? 0x86efac : this.isAiming ? 0xf8fafc : 0x67e8f9;
    this.cursorGraphics.lineStyle(3, cursorColor, 1);
    const shotOffsets = this.getShotOffsets();
    for (const offset of shotOffsets) {
      this.cursorGraphics.strokeCircle(this.cursorX + offset, this.cursorY, this.cursorRadius);
    }
    this.cursorGraphics.lineBetween(this.cursorX - 32, this.cursorY, this.cursorX + 32, this.cursorY);
    this.cursorGraphics.lineBetween(this.cursorX, this.cursorY - 32, this.cursorX, this.cursorY + 32);
    if (this.isAiming) {
      const gaugeBaseRadius = this.cursorRadius + 12;
      this.cursorGraphics.lineStyle(5, 0x334155, 0.85);
      this.cursorGraphics.beginPath();
      this.cursorGraphics.arc(this.cursorX, this.cursorY, gaugeBaseRadius, -Math.PI / 2, Math.PI * 1.5);
      this.cursorGraphics.strokePath();
      const gaugeColor = this.aimGauge >= 0.66 ? 0x86efac : this.aimGauge >= 0.33 ? 0xfacc15 : 0xfb7185;
      this.cursorGraphics.lineStyle(5, gaugeColor, 1);
      this.cursorGraphics.beginPath();
      this.cursorGraphics.arc(this.cursorX, this.cursorY, gaugeBaseRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.aimGauge);
      this.cursorGraphics.strokePath();
    }
  }

  private getShotOffsets(): number[] {
    return this.wideShotReady ? [-this.cursorRadius * 2, 0, this.cursorRadius * 2] : [0];
  }

  private showTitle(): void {
    this.clearScreenTexts();
    this.state = 'title';
    this.isAiming = false;
    this.hudText.setVisible(false);
    this.comboText.setVisible(false);
    this.bossHealthText.setVisible(false);
    this.cursorGraphics.clear();
    const title = this.add.text(this.gameWidth / 2, 190, 'TARGET RANGE', {
      fontFamily: 'Georgia, serif', fontSize: '64px', color: '#f8fafc', stroke: '#0f172a', strokeThickness: 8,
    }).setOrigin(0.5);
    const guide = this.add.text(this.gameWidth / 2, 320, [
      '分裂: 命中で小型化  /  透明: 見える間に撃つ  /  偽物: 撃つと減点',
      '時計: +5秒  /  装甲: 2発必要  /  爆弾: 周囲を巻き込む',
      'アイテム: タッチで獲得（スロー・横3つ攻撃・スコア2倍）',
      '30,000点でボス出現。ボスを倒すとステージクリア！',
    ], {
      fontFamily: 'sans-serif', fontSize: '22px', color: '#cbd5e1', align: 'center', lineSpacing: 16,
    }).setOrigin(0.5);
    const prompt = this.add.text(this.gameWidth / 2, 510, 'スペースキーで始める', {
      fontFamily: 'sans-serif', fontSize: '28px', color: '#67e8f9',
    }).setOrigin(0.5);
    this.screenTexts.push(title, guide, prompt);
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
