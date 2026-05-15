import { InputBindings } from '../input/bindings.js';
import { createMatch, getActiveWeapon, getPlayer, updateMatch } from '../simulation/match.js';
import { playEventSound } from '../ui/audio.js';
import { setPaused, showGameHUD, showResult, updateHUD } from '../ui/dom.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.state = null;
    this.pausedByUi = false;
    this.effects = [];
    this.lastSelection = null;
    this.resultShown = false;
    this.networkMode = 'local';
    this.snapshotBuffer = [];
    this.inputSeq = 0;
    this.inputSendAccumulator = 0;
    this.lastMultiplayerInput = null;
    this.nameLabels = new Map();
  }

  create() {
    this.worldLayer = this.add.graphics();
    this.dynamicLayer = this.add.graphics();
    this.fxLayer = this.add.graphics();
    this.inputBindings = new InputBindings(this);
    this.cameras.main.setBackgroundColor('#101312');
    this.input.keyboard.on('keydown-ESC', () => this.togglePause());
    window.addEventListener('match:start', (event) => this.startMatch(event.detail));
    window.addEventListener('match:resume', () => this.setPause(false));
    window.addEventListener('match:restart', () => {
      if (this.lastSelection) this.startMatch(this.lastSelection);
    });
    window.addEventListener('match:menu', () => {
      this.state = null;
      this.networkMode = 'local';
      this.snapshotBuffer = [];
      this.renderEmpty();
    });
    window.addEventListener('multiplayer:snapshot', (event) => this.receiveSnapshot(event.detail));
    window.addEventListener('multiplayer:left', () => {
      this.state = null;
      this.networkMode = 'local';
      this.snapshotBuffer = [];
      this.renderEmpty();
    });
    this.renderEmpty();
  }

  startMatch(selection) {
    this.lastSelection = selection;
    this.networkMode = 'local';
    this.snapshotBuffer = [];
    this.state = createMatch(selection);
    this.pausedByUi = false;
    this.resultShown = false;
    this.cameras.main.setBounds(0, 0, this.state.map.width, this.state.map.height);
    showGameHUD();
    setPaused(false);
    this.renderStaticWorld();
  }

  receiveSnapshot(snapshot) {
    if (!snapshot) return;
    this.networkMode = 'multiplayer';
    this.snapshotBuffer.push({ receivedAt: performance.now() / 1000, snapshot });
    this.snapshotBuffer = this.snapshotBuffer.slice(-8);
    const mapChanged = !this.state || this.state.map?.id !== snapshot.map?.id;
    this.state = snapshot;
    if (mapChanged) {
      this.cameras.main.setBounds(0, 0, snapshot.map.width, snapshot.map.height);
      this.renderStaticWorld();
    }
    showGameHUD();
  }

  update(_time, deltaMs) {
    if (!this.state) return;
    if (this.networkMode === 'multiplayer') {
      this.updateMultiplayer(deltaMs);
      return;
    }
    const player = getPlayer(this.state);
    if (!this.pausedByUi && this.state.phase === 'playing') {
      const input = this.inputBindings.read(player);
      updateMatch(this.state, input, deltaMs / 1000);
      this.handleEvents(this.state.events);
    }
    this.followPlayer();
    this.renderDynamicWorld();
    updateHUD(this.state);
    if (this.state.phase === 'complete' && !this.resultShown) {
      this.resultShown = true;
      showResult(this.state);
    }
  }

  updateMultiplayer(deltaMs) {
    const renderState = this.getInterpolatedState();
    if (!renderState) return;
    this.state = renderState;
    const player = getPlayer(renderState);
    if (player && renderState.phase === 'playing' && !this.pausedByUi) {
      const input = this.inputBindings.read(player);
      input.seq = ++this.inputSeq;
      this.inputSendAccumulator += deltaMs / 1000;
      this.lastMultiplayerInput = input;
      if (this.inputSendAccumulator >= 1 / 30 || input.fire || input.reload || input.swap !== null) {
        this.inputSendAccumulator = 0;
        window.dispatchEvent(new CustomEvent('multiplayer:input', { detail: input }));
      }
    }
    this.followPlayer();
    this.renderDynamicWorld();
    updateHUD(renderState);
    if (renderState.phase === 'complete' && !this.resultShown) {
      this.resultShown = true;
      showResult(renderState);
    }
  }

  togglePause() {
    if (!this.state || this.state.phase !== 'playing') return;
    this.setPause(!this.pausedByUi);
  }

  setPause(paused) {
    this.pausedByUi = paused;
    setPaused(paused);
  }

  handleEvents(events) {
    for (const event of events) {
      playEventSound(event);
      if (event.type === 'shot') {
        this.effects.push({ type: 'muzzle', x: event.x, y: event.y, angle: event.angle, age: 0, ttl: 0.08 });
      }
      if (event.type === 'hit' || event.type === 'impact') {
        this.effects.push({ type: 'spark', x: event.x, y: event.y, age: 0, ttl: 0.16 });
      }
      if (event.type === 'death') {
        this.effects.push({ type: 'ring', x: event.x, y: event.y, age: 0, ttl: 0.35 });
        this.cameras.main.shake(70, 0.004);
      }
      if (event.type === 'pickup') {
        this.effects.push({ type: 'pickup', x: event.x, y: event.y, age: 0, ttl: 0.3 });
      }
    }
  }

  followPlayer() {
    const player = getPlayer(this.state);
    if (!player) return;
    this.cameras.main.startFollow({ x: player.x, y: player.y }, true, 0.12, 0.12);
    this.cameras.main.setZoom(window.innerWidth < 800 ? 0.72 : 0.88);
  }

  renderEmpty() {
    this.worldLayer.clear();
    this.dynamicLayer.clear();
    this.fxLayer.clear();
    this.cameras.main.stopFollow();
    for (const label of this.nameLabels.values()) label.destroy();
    this.nameLabels.clear();
  }

  renderStaticWorld() {
    const map = this.state.map;
    const g = this.worldLayer;
    g.clear();
    g.fillStyle(parseColor(map.background), 1);
    g.fillRect(0, 0, map.width, map.height);

    g.lineStyle(1, 0x39403d, 0.45);
    for (let x = 0; x <= map.width; x += 80) g.lineBetween(x, 0, x, map.height);
    for (let y = 0; y <= map.height; y += 80) g.lineBetween(0, y, map.width, y);

    g.fillStyle(0x333b38, 1);
    g.lineStyle(2, 0x717b73, 0.55);
    for (const rect of map.obstacles) {
      g.fillRect(rect.x, rect.y, rect.w, rect.h);
      g.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }

    g.fillStyle(0x55635f, 0.65);
    g.lineStyle(1, 0xa9b4a6, 0.35);
    for (const rect of map.cover) {
      g.fillRect(rect.x, rect.y, rect.w, rect.h);
      g.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }

    g.fillStyle(0xd14949, 0.24);
    g.lineStyle(1, 0xf05252, 0.45);
    for (const hazard of map.hazards) {
      g.fillRect(hazard.x, hazard.y, hazard.w, hazard.h);
      g.strokeRect(hazard.x, hazard.y, hazard.w, hazard.h);
    }
  }

  renderDynamicWorld() {
    const g = this.dynamicLayer;
    g.clear();
    this.drawPickups(g);
    this.drawBullets(g);
    this.drawEntities(g);
    this.syncNameLabels();
    this.drawEffects();
  }

  drawPickups(g) {
    for (const pickup of this.state.pickups) {
      if (!pickup.active) continue;
      const color = pickup.type === 'medkit' ? 0xf05252 : pickup.type === 'ammo' ? 0xd6f05f : pickup.type === 'armor' ? 0x6fc6ff : 0xefb64a;
      g.fillStyle(color, 0.92);
      g.fillCircle(pickup.x, pickup.y, 12);
      g.lineStyle(2, 0x101312, 0.75);
      g.strokeCircle(pickup.x, pickup.y, 12);
    }
  }

  drawBullets(g) {
    for (const bullet of this.state.bullets) {
      g.lineStyle(3, bullet.team === 'blue' ? 0xd6f05f : 0xefb64a, 0.9);
      g.lineBetween(bullet.previousX, bullet.previousY, bullet.x, bullet.y);
      g.fillStyle(0xf8ffd5, 1);
      g.fillCircle(bullet.x, bullet.y, 3);
    }
  }

  drawEntities(g) {
    const player = getPlayer(this.state);
    for (const entity of this.state.entities) {
      if (entity.dead) {
        g.lineStyle(2, 0x4c3434, 0.8);
        g.strokeCircle(entity.x, entity.y, entity.radius * 0.65);
        continue;
      }
      const isPlayer = entity.id === this.state.playerId;
      const color = parseColor(entity.color || (isPlayer ? '#6fc6ff' : entity.team === 'hostile' ? '#f05252' : '#efb64a'));
      const outline = this.state.time < entity.invulnerableUntil ? 0xd6f05f : 0x101312;
      const weapon = getActiveWeapon(entity);
      g.lineStyle(3, outline, 0.9);
      g.fillStyle(color, isPlayer ? 1 : 0.92);
      g.fillCircle(entity.x, entity.y, entity.radius);
      g.strokeCircle(entity.x, entity.y, entity.radius);

      const barrelLength = weapon.id === 'breacher' ? 32 : 42;
      g.lineStyle(isPlayer ? 6 : 5, 0xe9eee6, isPlayer ? 0.95 : 0.75);
      g.lineBetween(
        entity.x + Math.cos(entity.angle) * 8,
        entity.y + Math.sin(entity.angle) * 8,
        entity.x + Math.cos(entity.angle) * barrelLength,
        entity.y + Math.sin(entity.angle) * barrelLength
      );

      const healthRatio = entity.health / entity.maxHealth;
      g.fillStyle(0x101312, 0.85);
      g.fillRect(entity.x - 24, entity.y - entity.radius - 14, 48, 5);
      g.fillStyle(healthRatio > 0.55 ? 0xd6f05f : healthRatio > 0.25 ? 0xefb64a : 0xf05252, 1);
      g.fillRect(entity.x - 24, entity.y - entity.radius - 14, 48 * healthRatio, 5);

      if (isPlayer && player) {
        const pointer = this.input.activePointer;
        const aim = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        g.lineStyle(1, 0xd6f05f, 0.22);
        g.lineBetween(entity.x, entity.y, aim.x, aim.y);
      }
    }
  }

  drawEffects() {
    const g = this.fxLayer;
    g.clear();
    const dt = this.game.loop.delta / 1000;
    this.effects = this.effects.filter((effect) => {
      effect.age += dt;
      const t = Math.min(1, effect.age / effect.ttl);
      const alpha = 1 - t;
      if (effect.type === 'muzzle') {
        g.fillStyle(0xf8ffd5, alpha);
        g.fillTriangle(
          effect.x,
          effect.y,
          effect.x - Math.cos(effect.angle + 0.45) * 18,
          effect.y - Math.sin(effect.angle + 0.45) * 18,
          effect.x - Math.cos(effect.angle - 0.45) * 18,
          effect.y - Math.sin(effect.angle - 0.45) * 18
        );
      } else if (effect.type === 'spark') {
        g.lineStyle(2, 0xefb64a, alpha);
        g.strokeCircle(effect.x, effect.y, 8 + t * 20);
      } else if (effect.type === 'ring') {
        g.lineStyle(4, 0xf05252, alpha);
        g.strokeCircle(effect.x, effect.y, 12 + t * 42);
      } else if (effect.type === 'pickup') {
        g.lineStyle(3, 0xd6f05f, alpha);
        g.strokeCircle(effect.x, effect.y, 8 + t * 32);
      }
      return effect.age < effect.ttl;
    });
  }

  syncNameLabels() {
    const liveIds = new Set();
    for (const entity of this.state.entities) {
      if (!entity.isPlayer || entity.dead) continue;
      liveIds.add(entity.id);
      let label = this.nameLabels.get(entity.id);
      if (!label) {
        label = this.add.text(entity.x, entity.y, entity.name, {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '13px',
          fontStyle: '700',
          color: '#e9eee6',
          stroke: '#101312',
          strokeThickness: 4
        }).setOrigin(0.5, 1);
        this.nameLabels.set(entity.id, label);
      }
      label.setText(entity.name);
      label.setPosition(entity.x, entity.y - entity.radius - 18);
      label.setVisible(true);
    }
    for (const [id, label] of this.nameLabels) {
      if (!liveIds.has(id)) label.setVisible(false);
    }
  }

  getInterpolatedState() {
    if (this.snapshotBuffer.length === 0) return this.state;
    const latest = this.snapshotBuffer[this.snapshotBuffer.length - 1];
    if (this.snapshotBuffer.length === 1) return latest.snapshot;
    const renderTime = latest.snapshot.serverTime - 0.1;
    let older = this.snapshotBuffer[0];
    let newer = latest;
    for (let i = 0; i < this.snapshotBuffer.length - 1; i += 1) {
      const a = this.snapshotBuffer[i];
      const b = this.snapshotBuffer[i + 1];
      if (a.snapshot.serverTime <= renderTime && b.snapshot.serverTime >= renderTime) {
        older = a;
        newer = b;
        break;
      }
    }
    const span = Math.max(0.001, newer.snapshot.serverTime - older.snapshot.serverTime);
    const t = Phaser.Math.Clamp((renderTime - older.snapshot.serverTime) / span, 0, 1);
    const state = {
      ...newer.snapshot,
      objective: { ...newer.snapshot.objective },
      score: structuredClone(newer.snapshot.score),
      feed: [...newer.snapshot.feed],
      map: newer.snapshot.map,
      entities: newer.snapshot.entities.map((entity) => ({ ...entity })),
      bullets: newer.snapshot.bullets.map((bullet) => ({ ...bullet })),
      pickups: newer.snapshot.pickups.map((pickup) => ({ ...pickup }))
    };
    for (const entity of state.entities) {
      const previous = older.snapshot.entities.find((item) => item.id === entity.id);
      if (!previous || previous.dead || entity.dead) continue;
      entity.x = Phaser.Math.Linear(previous.x, entity.x, t);
      entity.y = Phaser.Math.Linear(previous.y, entity.y, t);
      entity.angle = lerpAngle(previous.angle, entity.angle, t);
    }
    for (const bullet of state.bullets) {
      const previous = older.snapshot.bullets.find((item) => item.id === bullet.id);
      if (!previous) continue;
      bullet.previousX = Phaser.Math.Linear(previous.previousX, bullet.previousX, t);
      bullet.previousY = Phaser.Math.Linear(previous.previousY, bullet.previousY, t);
      bullet.x = Phaser.Math.Linear(previous.x, bullet.x, t);
      bullet.y = Phaser.Math.Linear(previous.y, bullet.y, t);
    }
    this.applyLocalPrediction(state, latest);
    return state;
  }

  applyLocalPrediction(state, latest) {
    const player = state.entities.find((entity) => entity.id === state.playerId);
    const input = this.lastMultiplayerInput;
    if (!player || player.dead || !input) return;
    const elapsed = Math.min(0.08, performance.now() / 1000 - latest.receivedAt);
    const length = Math.hypot(input.moveX, input.moveY);
    if (length <= 0.001) return;
    const sprint = input.sprint && player.stamina > 1 ? 1.35 : 1;
    player.x = Phaser.Math.Clamp(player.x + (input.moveX / length) * player.speed * sprint * elapsed, player.radius + 4, state.map.width - player.radius - 4);
    player.y = Phaser.Math.Clamp(player.y + (input.moveY / length) * player.speed * sprint * elapsed, player.radius + 4, state.map.height - player.radius - 4);
  }
}

function parseColor(hex) {
  return Number.parseInt(hex.replace('#', ''), 16);
}

function lerpAngle(a, b, t) {
  const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + delta * t;
}
