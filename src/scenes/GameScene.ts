import Phaser from 'phaser';
import { WEAPON_CONFIG, type WeaponType } from './weapons';

const WIDTH = 1280;
const HEIGHT = 720;
const FRAME_MS = 1000 / 60;
const PLAYER_SPEED = 500;
const PLAYER_HP = 20;
const PLAYER_INVINCIBLE = 30 * FRAME_MS;
const STAR_DURATION = 180 * FRAME_MS;
const SCORE_BOOST_DURATION = 300 * FRAME_MS;
const ITEM_DROP_CHANCE = 0.25;
const ITEM_SPEED = 180;
const BOSS_SPAWN = 1200 * FRAME_MS;
const BOSS_PATTERN_SWITCH = 300 * FRAME_MS;
const BOSS_HP = 50;
const BOSS_ENTRY_DISTANCE = 300;
const BOSS_ENTRY_SPEED = 300;
const BULLET_SPEED = 1200;
const PLAYER_DAMAGE_SCORE = -30;
const BOSS_DEFEAT_SCORE = 500;
const SHOTGUN_ANGLES = [-Math.PI / 9, 0, Math.PI / 9];

type BossPattern = 'A' | 'B';
type EnemyType = 'A' | 'B' | 'C';
type ItemType = 'bomb' | 'star' | 'scoreBoost';
type ItemEffect = {
  type: ItemType;
  duration: number;
};
type PhysicsObject =
  | Phaser.Types.Physics.Arcade.GameObjectWithBody
  | Phaser.Physics.Arcade.Body
  | Phaser.Physics.Arcade.StaticBody
  | Phaser.Tilemaps.Tile;

const ENEMY_CONFIG: Record<EnemyType, {
  texture: string;
  width: number;
  height: number;
  color: number;
  speed: number;
  hp: number;
  fireInterval: number | null;
  contactDamage: number;
  defeatScore: number;
  spawnInterval: number;
  maxCount: number;
}> = {
  A: {
    texture: 'enemyA',
    width: 35,
    height: 35,
    color: 0xff5964,
    speed: 400,
    hp: 1,
    fireInterval: 120 * FRAME_MS,
    contactDamage: 2,
    defeatScore: 60,
    spawnInterval: 50 * FRAME_MS,
    maxCount: 10,
  },
  B: {
    texture: 'enemyB',
    width: 75,
    height: 75,
    color: 0xff9f43,
    speed: 200,
    hp: 4,
    fireInterval: 180 * FRAME_MS,
    contactDamage: 2,
    defeatScore: 60,
    spawnInterval: 90 * FRAME_MS,
    maxCount: 5,
  },
  C: {
    texture: 'enemyC',
    width: 40,
    height: 40,
    color: 0x7de3ff,
    speed: 500,
    hp: 1,
    fireInterval: null,
    contactDamage: 1,
    defeatScore: 20,
    spawnInterval: 80 * FRAME_MS,
    maxCount: 5,
  },
};

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerBullets!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private items!: Phaser.Physics.Arcade.Group;
  private boss!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private space!: Phaser.Input.Keyboard.Key;
  private bombKey!: Phaser.Input.Keyboard.Key;
  private score = 0;
  private hp = PLAYER_HP;
  private lastShotAt = -Infinity;
  private invincibleUntil = 0;
  private starUntil = 0;
  private scoreBoostUntil = 0;
  private bombStock = 0;
  private bossHp = BOSS_HP;
  private bossActive = false;
  private bossAttacking = false;
  private bossPattern: BossPattern = 'A';
  private bossPatternStartedAt = 0;
  private bossDirection = 1;
  private ending = false;
  private enemySpawnTimers: Record<EnemyType, number> = { A: 0, B: 0, C: 0 };
  private elapsed = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private bossText!: Phaser.GameObjects.Text;
  private itemText!: Phaser.GameObjects.Text;
  private itemGauge!: Phaser.GameObjects.Graphics;
  private weapon: WeaponType = 'pistol';

  constructor() {
    super('GameScene');
  }

  init(data: { weapon?: WeaponType }): void {
    this.weapon = data.weapon === 'shotgun' || data.weapon === 'assaultRifle' ? data.weapon : 'pistol';
  }

  create(): void {
    this.resetGameState();
    this.createTextures();
    this.cameras.main.setBackgroundColor('#08111f');
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.space = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.bombKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);

    this.player = this.physics.add.sprite(120, HEIGHT / 2, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.body?.setSize(this.player.width, this.player.height);

    this.playerBullets = this.physics.add.group({ defaultKey: 'playerBullet', maxSize: 50, allowGravity: false });
    this.enemyBullets = this.physics.add.group({ defaultKey: 'enemyBullet', maxSize: 40, allowGravity: false });
    this.enemies = this.physics.add.group({ defaultKey: 'enemyA', maxSize: 20, allowGravity: false });
    this.items = this.physics.add.group({ defaultKey: 'itemBomb', maxSize: 20, allowGravity: false });
    this.boss = this.physics.add.sprite(WIDTH + 100, HEIGHT / 2, 'boss');
    this.boss.setCollideWorldBounds(true);
    this.boss.setActive(false).setVisible(false);
    if (this.boss.body) this.boss.body.enable = false;

    this.physics.add.overlap(this.playerBullets, this.enemies, this.hitEnemy, undefined, this);
    this.physics.add.overlap(this.playerBullets, this.boss, this.hitBoss, () => this.bossAttacking, this);
    this.physics.add.overlap(this.enemyBullets, this.player, this.hitPlayer, undefined, this);
    this.physics.add.overlap(this.player, this.items, this.collectItem, undefined, this);

    this.scoreText = this.add.text(24, 20, '', this.hudStyle());
    this.hpText = this.add.text(24, 54, '', this.hudStyle());
    this.timeText = this.add.text(1060, 20, '', this.hudStyle());
    this.bossText = this.add.text(460, 20, '', this.hudStyle()).setColor('#ff8b94');
    this.itemText = this.add.text(24, 88, '', this.hudStyle()).setFontSize('18px').setColor('#ffd166');
    this.add.text(850, 56, 'STAR\nP+', this.hudStyle()).setFontSize('16px');
    this.itemGauge = this.add.graphics();
    this.updateHud();
  }

  private resetGameState(): void {
    this.score = 0;
    this.hp = PLAYER_HP;
    this.lastShotAt = -Infinity;
    this.invincibleUntil = 0;
    this.starUntil = 0;
    this.scoreBoostUntil = 0;
    this.bombStock = 0;
    this.bossHp = BOSS_HP;
    this.bossActive = false;
    this.bossAttacking = false;
    this.bossPattern = 'A';
    this.bossPatternStartedAt = 0;
    this.bossDirection = 1;
    this.ending = false;
    this.enemySpawnTimers = { A: 0, B: 0, C: 0 };
    this.elapsed = 0;
    this.lastBossShotAt = -Infinity;
  }

  update(_time: number, delta: number): void {
    if (this.ending) return;
    this.elapsed += delta;
    this.updatePlayer();
    this.updateEnemyContacts();
    if (Phaser.Input.Keyboard.JustDown(this.space)) this.handleSpacePress();
    this.updateHeldFire();
    if (Phaser.Input.Keyboard.JustDown(this.bombKey)) this.useBomb();
    this.updateEnemySpawn(delta);
    this.updateEnemyFiring();
    this.updateBoss(delta);
    this.cleanupOffscreen();
    this.updatePlayerStatus();
    this.updateHud();
  }

  private createTextures(): void {
    this.makeTexture('player', 63, 42, 0x7de3ff);
    for (const config of Object.values(ENEMY_CONFIG)) {
      this.makeTexture(config.texture, config.width, config.height, config.color);
    }
    this.makeTexture('boss', 100, 130, 0xc77dff);
    this.makeTexture('playerBullet', 18, 6, 0xffd166);
    this.makeTexture('enemyBullet', 18, 6, 0xff8b94);
    this.makeItemTexture('itemBomb', 'bomb');
    this.makeItemTexture('itemStar', 'star');
    this.makeItemTexture('itemScoreBoost', 'scoreBoost');
  }

  private makeTexture(key: string, width: number, height: number, color: number): void {
    if (this.textures.exists(key)) return;
    const graphics = this.add.graphics();
    graphics.fillStyle(color, 1).fillRect(0, 0, width, height);
    graphics.generateTexture(key, width, height);
    graphics.destroy();
  }

  private makeItemTexture(key: string, itemType: ItemType): void {
    if (this.textures.exists(key)) return;
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffffff, 1);
    if (itemType === 'bomb') {
      graphics.fillStyle(0x73d7ff, 1).fillCircle(16, 19, 10);
      graphics.lineStyle(3, 0xffd166, 1).lineBetween(21, 12, 25, 6);
      graphics.fillStyle(0xff5964, 1).fillCircle(26, 5, 3);
    } else if (itemType === 'star') {
      const points = Array.from({ length: 10 }, (_, index) => {
        const angle = -Math.PI / 2 + index * Math.PI / 5;
        const radius = index % 2 === 0 ? 15 : 7;
        return new Phaser.Math.Vector2(16 + Math.cos(angle) * radius, 16 + Math.sin(angle) * radius);
      });
      graphics.fillStyle(0xffe066, 1).fillPoints(points, true);
      graphics.lineStyle(2, 0xffffff, 1).strokePoints(points, true);
    } else {
      graphics.fillStyle(0xa98bff, 1).fillRoundedRect(2, 3, 28, 26, 6);
      graphics.lineStyle(3, 0xffffff, 1).lineBetween(8, 16, 16, 16);
      graphics.lineBetween(12, 12, 12, 20);
      graphics.lineBetween(19, 12, 26, 12);
      graphics.lineBetween(19, 16, 26, 16);
      graphics.lineBetween(19, 20, 26, 20);
    }
    graphics.generateTexture(key, 32, 32);
    graphics.destroy();
  }

  private hudStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: 'sans-serif', fontSize: '22px', color: '#d9e8ff' };
  }

  private updatePlayer(): void {
    const vertical = (this.cursors.down.isDown ? 1 : 0) - (this.cursors.up.isDown ? 1 : 0);
    const horizontal = (this.cursors.right.isDown ? 1 : 0) - (this.cursors.left.isDown ? 1 : 0);
    const direction = new Phaser.Math.Vector2(horizontal, vertical).normalize();
    this.player.setVelocity(direction.x * PLAYER_SPEED, direction.y * PLAYER_SPEED);
  }

  private handleSpacePress(): void {
    const tapInterval = WEAPON_CONFIG[this.weapon].tapFireFrames * FRAME_MS;
    if (this.elapsed - this.lastShotAt >= tapInterval) this.firePlayerBullet();
  }

  private updateHeldFire(): void {
    const holdInterval = WEAPON_CONFIG[this.weapon].holdFireFrames * FRAME_MS;
    if (this.space.isDown && this.elapsed - this.lastShotAt >= holdInterval) {
      this.firePlayerBullet();
    }
  }

  private firePlayerBullet(): void {
    const angles = this.weapon === 'shotgun' ? SHOTGUN_ANGLES : [0];
    const bulletX = this.player.x + this.player.displayWidth / 2;
    const bulletY = this.player.y + (this.weapon === 'assaultRifle' ? Phaser.Math.Between(-10, 10) : 0);
    for (const angle of angles) {
      const bullet = this.playerBullets.get(bulletX, bulletY, 'playerBullet') as Phaser.Physics.Arcade.Sprite | null;
      if (!bullet) continue;
      bullet.enableBody(true, bulletX, bulletY, true, true);
      bullet.setVelocity(Math.cos(angle) * BULLET_SPEED, Math.sin(angle) * BULLET_SPEED);
      bullet.setRotation(angle);
    }
    this.lastShotAt = this.elapsed;
    this.score -= WEAPON_CONFIG[this.weapon].ptCost;
  }

  private updateEnemySpawn(delta: number): void {
    if (this.bossActive) return;
    for (const enemyType of Object.keys(ENEMY_CONFIG) as EnemyType[]) {
      const config = ENEMY_CONFIG[enemyType];
      this.enemySpawnTimers[enemyType] += delta;
      if (this.enemySpawnTimers[enemyType] < config.spawnInterval) continue;
      this.enemySpawnTimers[enemyType] -= config.spawnInterval;
      const count = this.enemies.getChildren().filter((child) =>
        child.active
        && child instanceof Phaser.Physics.Arcade.Sprite
        && child.getData('type') === enemyType,
      ).length;
      if (count >= config.maxCount) continue;
      this.spawnEnemy(enemyType, config);
    }
  }

  private spawnEnemy(enemyType: EnemyType, config: (typeof ENEMY_CONFIG)[EnemyType]): void {
    const startX = WIDTH + config.width / 2;
    const startY = Phaser.Math.Between(config.height / 2, HEIGHT - config.height / 2);
    const enemy = this.enemies.get(startX, startY, config.texture) as Phaser.Physics.Arcade.Sprite | null;
    if (!enemy) return;
    enemy.setTexture(config.texture);
    enemy.enableBody(true, startX, startY, true, true)
      .setData('type', enemyType)
      .setData('hp', config.hp)
      .setData('contactHandled', false)
      .setData('nextFireAt', this.elapsed + (config.fireInterval ?? Infinity));
    enemy.body?.setSize(config.width, config.height);

    if (enemyType === 'C') {
      const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      enemy.setRotation(angle).setVelocity(Math.cos(angle) * config.speed, Math.sin(angle) * config.speed);
    } else {
      enemy.setRotation(0).setVelocityX(-config.speed).setVelocityY(0);
    }
  }

  private fireEnemyBullet(source: Phaser.Physics.Arcade.Sprite): void {
    if (!source.active) return;
    if (source === this.boss) this.fireBossSpread();
    else this.fireEnemyBulletFrom(source.x - source.displayWidth / 2, source.y);
  }

  private updateEnemyFiring(): void {
    if (this.bossActive) return;
    for (const child of this.enemies.getChildren()) {
      if (!(child instanceof Phaser.Physics.Arcade.Sprite) || !child.active) continue;
      const enemyType = child.getData('type') as EnemyType;
      const config = ENEMY_CONFIG[enemyType];
      if (config.fireInterval === null || this.elapsed < (child.getData('nextFireAt') as number)) continue;
      this.fireEnemyBullet(child);
      child.setData('nextFireAt', this.elapsed + config.fireInterval);
    }
  }

  private fireBossSpread(): void {
    const phaseTwo = this.bossHp <= 20;
    const bulletCount = phaseTwo ? 5 : 3;
    if (this.enemyBullets.getTotalFree() < bulletCount) return;
    const left = this.boss.x - this.boss.displayWidth / 2;
    const top = this.boss.y - this.boss.displayHeight / 2;
    const center = this.boss.y;
    const bottom = this.boss.y + this.boss.displayHeight / 2;
    const positions = phaseTwo
      ? [top, top + (center - top) / 2, center, center + (bottom - center) / 2, bottom]
      : [top, center, bottom];
    for (const y of positions) this.fireEnemyBulletFrom(left, y);
  }

  private fireEnemyBulletFrom(x: number, y: number): void {
    const bullet = this.enemyBullets.get(x, y) as Phaser.Physics.Arcade.Sprite | null;
    if (bullet) bullet.enableBody(true, x, y, true, true).setVelocityX(-BULLET_SPEED);
  }

  private updateBoss(delta: number): void {
    if (!this.bossActive && this.elapsed >= BOSS_SPAWN) {
      this.bossActive = true;
      this.bossDirection = Phaser.Math.RND.pick([-1, 1]);
      const startX = WIDTH + this.boss.displayWidth / 2;
      this.boss.enableBody(true, startX, HEIGHT / 2, true, true).setVelocityX(-BOSS_ENTRY_SPEED);
    }
    if (!this.bossActive) return;
    if (!this.bossAttacking) {
      const entryTargetX = WIDTH + this.boss.displayWidth / 2 - BOSS_ENTRY_DISTANCE;
      if (this.boss.x <= entryTargetX) {
        this.boss.setX(entryTargetX);
        this.boss.setVelocityX(0);
        this.bossAttacking = true;
        this.bossPatternStartedAt = this.elapsed;
        this.fireEnemyBullet(this.boss);
      }
      return;
    }
    const phaseTwo = this.bossHp <= 20;
    if (this.bossPattern === 'A') {
      const speed = phaseTwo ? 600 : 400;
      const halfHeight = this.boss.displayHeight / 2;
      const nextY = this.boss.y + this.bossDirection * speed * delta / 1000;
      if (nextY <= halfHeight) {
        this.boss.setY(halfHeight);
        this.bossDirection = 1;
      } else if (nextY >= HEIGHT - halfHeight) {
        this.boss.setY(HEIGHT - halfHeight);
        this.bossDirection = -1;
      } else {
        this.boss.setY(nextY);
      }
      this.boss.setVelocityY(0);
    } else {
      const difference = this.player.y - this.boss.y;
      this.boss.setVelocityY(Math.sign(difference) * (phaseTwo ? 270 : 230));
    }
    if (this.elapsed - this.bossPatternStartedAt >= BOSS_PATTERN_SWITCH) {
      this.bossPattern = this.bossPattern === 'A' ? 'B' : 'A';
      this.bossPatternStartedAt = this.elapsed;
    }
    const fireInterval = (phaseTwo ? 20 : 30) * FRAME_MS;
    if (this.elapsed - this.lastBossShotAt >= fireInterval) {
      this.fireEnemyBullet(this.boss);
      this.lastBossShotAt = this.elapsed;
    }
    void delta;
  }

  private lastBossShotAt = -Infinity;

  private hitEnemy(object1: PhysicsObject, object2: PhysicsObject): void {
    const first = this.toSprite(object1);
    const second = this.toSprite(object2);
    const bullet = first?.texture.key === 'playerBullet' ? first : second?.texture.key === 'playerBullet' ? second : null;
    const enemy = first?.getData('type') ? first : second?.getData('type') ? second : null;
    if (!bullet || !enemy) return;
    bullet.disableBody(true, true);
    const hp = (enemy.getData('hp') as number) - 1;
    if (hp <= 0) {
      this.killEnemy(enemy);
    } else {
      enemy.setData('hp', hp);
    }
  }

  private hitBoss(object1: PhysicsObject, object2: PhysicsObject): void {
    const first = this.toSprite(object1);
    const second = this.toSprite(object2);
    const bullet = first?.texture.key === 'playerBullet' ? first : second?.texture.key === 'playerBullet' ? second : null;
    if (!bullet) return;
    bullet.disableBody(true, true);
    this.damageBoss(1);
  }

  private hitPlayer(object1: PhysicsObject, object2: PhysicsObject): void {
    if (this.ending) return;
    const first = this.toSprite(object1);
    const second = this.toSprite(object2);
    const bullet = first?.texture.key === 'enemyBullet'
      ? first
      : second?.texture.key === 'enemyBullet'
        ? second
        : null;
    if (!bullet) return;
    bullet.disableBody(true, true);
    if (this.isStarActive()) return;
    if (this.elapsed < this.invincibleUntil) return;
    this.damagePlayer(1);
  }

  private updateEnemyContacts(): void {
    const playerBody = this.player.body;
    if (!playerBody?.enable) return;

    for (const child of this.enemies.getChildren()) {
      if (!(child instanceof Phaser.Physics.Arcade.Sprite) || !child.active) continue;
      const enemyBody = child.body;
      if (
        !enemyBody?.enable
        || playerBody.right <= enemyBody.left
        || playerBody.left >= enemyBody.right
        || playerBody.bottom <= enemyBody.top
        || playerBody.top >= enemyBody.bottom
      ) continue;
      this.touchEnemy(child);
    }
  }

  private touchEnemy(enemy: Phaser.Physics.Arcade.Sprite): void {
    if (this.ending) return;
    if (!enemy.active) return;
    if (enemy.getData('contactHandled') === true) return;
    if (this.isStarActive()) {
      enemy.setData('contactHandled', true);
      this.time.delayedCall(0, () => this.killEnemy(enemy));
      return;
    }
    if (this.elapsed < this.invincibleUntil) return;
    const enemyType = enemy.getData('type') as EnemyType;
    enemy.setData('contactHandled', true);
    this.damagePlayer(ENEMY_CONFIG[enemyType].contactDamage);
    this.time.delayedCall(0, () => enemy.disableBody(true, true));
  }

  private damagePlayer(amount: number): void {
    if (this.ending) return;
    this.hp -= amount;
    this.score += PLAYER_DAMAGE_SCORE;
    this.invincibleUntil = this.elapsed + PLAYER_INVINCIBLE;
    if (this.hp <= 0) {
      this.ending = true;
      this.time.delayedCall(0, () => this.finish(false));
    }
  }

  private killEnemy(enemy: Phaser.Physics.Arcade.Sprite): void {
    if (!enemy.active) return;
    const enemyType = enemy.getData('type') as EnemyType;
    this.createExplosion(enemy.x, enemy.y, 1);
    enemy.disableBody(true, true);
    this.addPoints(ENEMY_CONFIG[enemyType].defeatScore);
    if (Phaser.Math.RND.frac() < ITEM_DROP_CHANCE) this.dropItem(enemy.x, enemy.y);
  }

  private dropItem(x: number, y: number): void {
    const itemType = Phaser.Math.RND.pick(['bomb', 'star', 'scoreBoost'] as const);
    const texture = itemType === 'bomb' ? 'itemBomb' : itemType === 'star' ? 'itemStar' : 'itemScoreBoost';
    const effect: ItemEffect = {
      type: itemType,
      duration: itemType === 'star' ? STAR_DURATION : itemType === 'scoreBoost' ? SCORE_BOOST_DURATION : 0,
    };
    const item = this.items.get(x, y, texture) as Phaser.Physics.Arcade.Sprite | null;
    if (!item) return;
    item.setTexture(texture);
    item.enableBody(true, x, y, true, true);
    item.body?.setSize(item.displayWidth, item.displayHeight);
    item.setActive(true).setVisible(true);
    item.setData('itemType', itemType)
      .setData('itemEffect', effect)
      .setVelocity(-ITEM_SPEED, 0);
  }

  private collectItem(firstObject: PhysicsObject, secondObject: PhysicsObject): void {
    const firstSprite = this.toSprite(firstObject);
    const secondSprite = this.toSprite(secondObject);
    const item = [firstSprite, secondSprite].find((sprite) =>
      sprite?.active && sprite.getData('itemType') !== undefined,
    );
    if (!item || !item.active) return;
    const itemType = item.getData('itemType') as ItemType | undefined;
    if (!itemType) return;
    const storedEffect = item.getData('itemEffect') as ItemEffect | undefined;
    const itemEffect: ItemEffect = storedEffect ?? {
      type: itemType,
      duration: itemType === 'star' ? STAR_DURATION : itemType === 'scoreBoost' ? SCORE_BOOST_DURATION : 0,
    };
    item.disableBody(true, true);
    item.setActive(false).setVisible(false);

    if (itemEffect.type === 'bomb') {
      this.bombStock = Math.min(3, this.bombStock + 1);
    } else if (itemEffect.type === 'star') {
      this.starUntil = this.elapsed + itemEffect.duration;
    } else {
      this.scoreBoostUntil = this.elapsed + itemEffect.duration;
    }
  }

  private useBomb(): void {
    if (this.bombStock <= 0 || this.ending) return;
    this.bombStock -= 1;
    this.createExplosion(this.player.x, this.player.y, 1.4, 350);
    const enemies = this.enemies.getChildren().filter((child): child is Phaser.Physics.Arcade.Sprite =>
      child instanceof Phaser.Physics.Arcade.Sprite && child.active,
    );
    for (const enemy of enemies) this.killEnemy(enemy);
    if (this.bossActive) this.damageBoss(10);
  }

  private damageBoss(amount: number): void {
    if (this.ending || !this.bossActive) return;
    this.bossHp = Math.max(0, this.bossHp - amount);
    if (this.bossHp > 0) return;
    this.ending = true;
    this.createExplosion(this.boss.x, this.boss.y, 2.2, 1000);
    this.boss.disableBody(true, true);
    this.addPoints(BOSS_DEFEAT_SCORE);
    this.time.delayedCall(1000, () => this.finish(true), undefined, this);
  }

  private addPoints(points: number): void {
    const multiplier = this.elapsed < this.scoreBoostUntil ? 1.25 : 1;
    this.score += Math.round(points * multiplier);
  }

  private isStarActive(): boolean {
    return this.elapsed < this.starUntil;
  }

  private updatePlayerStatus(): void {
    if (this.isStarActive()) {
      const flashOn = Math.floor((this.elapsed - (this.starUntil - STAR_DURATION)) / 500) % 2 === 0;
      if (flashOn) this.player.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      else this.player.clearTint();
      this.player.setAlpha(1);
      return;
    }
    this.player.clearTint();
    this.player.setAlpha(this.elapsed < this.invincibleUntil ? 0.45 : 1);
  }

  private createExplosion(x: number, y: number, size: number, duration = 500): void {
    const effects: Phaser.GameObjects.GameObject[] = [];
    const flash = this.add.circle(x, y, 14 * size, 0xfff1a8);
    const ring = this.add.circle(x, y, 18 * size, 0xff7b54, 0.35);
    ring.setStrokeStyle(4 * size, 0xffd166, 1);
    effects.push(flash, ring);

    this.tweens.add({
      targets: flash,
      scale: 2.8,
      alpha: 0,
      duration: duration * 0.44,
      ease: 'Cubic.easeOut',
    });
    this.tweens.add({
      targets: ring,
      scale: 3.2,
      alpha: 0,
      duration: duration * 0.84,
      ease: 'Cubic.easeOut',
    });

    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8;
      const distance = 34 * size;
      const spark = this.add.rectangle(x, y, 7 * size, 3 * size, index % 2 === 0 ? 0xffd166 : 0xff5964);
      spark.setOrigin(0.5).setRotation(angle);
      effects.push(spark);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.2,
        duration: duration * 0.72,
        ease: 'Cubic.easeOut',
      });
    }

    this.time.delayedCall(duration, () => {
      for (const effect of effects) effect.destroy();
    });
  }

  private cleanupOffscreen(): void {
    for (const child of this.playerBullets.children) {
      if (child instanceof Phaser.Physics.Arcade.Sprite) this.disableIfOutside(child, 0, WIDTH);
    }
    for (const child of this.enemyBullets.children) {
      if (child instanceof Phaser.Physics.Arcade.Sprite) this.disableIfOutside(child, 0, WIDTH);
    }
    for (const child of this.enemies.children) {
      if (child instanceof Phaser.Physics.Arcade.Sprite) this.disableEnemyIfOutside(child);
    }
    for (const child of this.items.children) {
      if (child instanceof Phaser.Physics.Arcade.Sprite) this.disableIfOutside(child, 0, WIDTH);
    }
  }

  private disableIfOutside(object: Phaser.Physics.Arcade.Sprite, minX: number, maxX: number): boolean {
    const left = object.x - object.displayWidth / 2;
    const right = object.x + object.displayWidth / 2;
    if (object.active && (right < minX || left > maxX)) object.disableBody(true, true);
    return true;
  }

  private disableEnemyIfOutside(enemy: Phaser.Physics.Arcade.Sprite): void {
    const left = enemy.x - enemy.displayWidth / 2;
    const right = enemy.x + enemy.displayWidth / 2;
    const top = enemy.y - enemy.displayHeight / 2;
    const bottom = enemy.y + enemy.displayHeight / 2;
    const enemyType = enemy.getData('type') as EnemyType;
    const outside = enemyType === 'C'
      ? right < 0 || left > WIDTH || bottom < 0 || top > HEIGHT
      : right < 0;
    if (enemy.active && outside) enemy.disableBody(true, true);
  }

  private toSprite(object: PhysicsObject): Phaser.Physics.Arcade.Sprite | null {
    if (object instanceof Phaser.Physics.Arcade.Sprite) return object;
    if (object instanceof Phaser.Physics.Arcade.Body && object.gameObject instanceof Phaser.Physics.Arcade.Sprite) {
      return object.gameObject;
    }
    return null;
  }

  private updateHud(): void {
    this.scoreText.setText(`SCORE  ${this.score}`);
    this.hpText.setText(`HP  ${Math.max(0, this.hp)}/${PLAYER_HP}`);
    this.timeText.setText(`TIME  ${(this.elapsed / 1000).toFixed(1)}`);
    this.bossText.setText(this.bossActive ? `BOSS  ${Math.max(0, this.bossHp)}/${BOSS_HP}` : '');
    this.itemText.setText(`BOMB  ${this.bombStock}/3`);
    this.updateItemGauges();
  }

  private updateItemGauges(): void {
    const gaugeX = 930;
    const firstGaugeY = 60;
    const gaugeWidth = 320;
    const gaugeHeight = 10;
    const gaugeGap = 10;
    const gauges: Array<{
      until: number;
      duration: number;
      color: number;
    }> = [
      { until: this.starUntil, duration: STAR_DURATION, color: 0xffe066 },
      { until: this.scoreBoostUntil, duration: SCORE_BOOST_DURATION, color: 0xa98bff },
    ];

    this.itemGauge.clear();
    gauges.forEach((gauge, index) => {
      const remaining = gauge.until - this.elapsed;
      const y = firstGaugeY + index * (gaugeHeight + gaugeGap);
      const ratio = Phaser.Math.Clamp(remaining / gauge.duration, 0, 1);
      this.itemGauge.fillStyle(0x26344d, 1).fillRoundedRect(gaugeX, y, gaugeWidth, gaugeHeight, 4);
      if (ratio > 0) {
        this.itemGauge.fillStyle(gauge.color, 1).fillRoundedRect(gaugeX, y, gaugeWidth * ratio, gaugeHeight, 4);
      }
    });
  }

  private finish(cleared: boolean): void {
    this.ending = true;
    this.scene.start('GameOverScene', { cleared, score: this.score });
  }
}