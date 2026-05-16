import { InputBindings } from '../input/bindings.js';
import { isDomTypingFocused } from '../input/uiFocus.js';
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
    this.avatarImages = new Map();
    this.pendingAvatars = new Set();
    /** Smoothed display offset vs server for local player (reduces jitter). */
    this.localSmoothDx = 0;
    this.localSmoothDy = 0;
  }

  create() {
    this.worldLayer = this.add.graphics();
    this.dynamicLayer = this.add.graphics();
    this.fxLayer = this.add.graphics();
    this.inputBindings = new InputBindings(this);
    this.cameras.main.setBackgroundColor('#101312');
    const syncTypingKeyboard = () => {
      if (this.input?.keyboard) this.input.keyboard.enabled = !isDomTypingFocused();
    };
    syncTypingKeyboard();
    window.addEventListener('focusin', syncTypingKeyboard);
    window.addEventListener('focusout', syncTypingKeyboard);
    this.events.once('destroy', () => {
      window.removeEventListener('focusin', syncTypingKeyboard);
      window.removeEventListener('focusout', syncTypingKeyboard);
    });
    this.input.keyboard.on('keydown-ESC', () => {
      if (!isDomTypingFocused()) this.togglePause();
    });
    window.addEventListener('match:start', (event) => this.startMatch(event.detail));
    window.addEventListener('match:resume', () => this.setPause(false));
    window.addEventListener('match:restart', () => {
      if (this.lastSelection) this.startMatch(this.lastSelection);
    });
    window.addEventListener('match:menu', () => {
      this.state = null;
      this.networkMode = 'local';
      this.snapshotBuffer = [];
      this.localSmoothDx = 0;
      this.localSmoothDy = 0;
      this.renderEmpty();
    });
    window.addEventListener('multiplayer:snapshot', (event) => this.receiveSnapshot(event.detail));
    window.addEventListener('multiplayer:left', () => {
      this.state = null;
      this.networkMode = 'local';
      this.snapshotBuffer = [];
      this.localSmoothDx = 0;
      this.localSmoothDy = 0;
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
    if (snapshot.events?.length) this.handleEvents(snapshot.events);
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
      if (
        this.inputSendAccumulator >= 1 / 30
        || input.fire
        || input.reload
        || input.swap !== null
        || input.useGrenade
        || input.useBandage
      ) {
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
    const live = getPlayer(this.state);
    const cam = this.cameras.main;
    const hearRadius =
      live && cam
        ? (Math.hypot(cam.width, cam.height) / Math.max(0.001, cam.zoom || 1)) * 0.65 + 400
        : null;
    const listener =
      live && hearRadius != null ? { x: live.x, y: live.y, hearRadius } : null;
    for (const event of events) {
      playEventSound(event, listener);
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
      if (event.type === 'explosion') {
        this.effects.push({ type: 'blast', x: event.x, y: event.y, age: 0, ttl: 0.42, radius: event.radius || 118 });
      }
      if (event.type === 'pickup') {
        this.effects.push({ type: 'pickup', x: event.x, y: event.y, age: 0, ttl: 0.3 });
      }
    }
  }

  followPlayer() {
    const player = getPlayer(this.state);
    if (!player) return;
    this.cameras.main.startFollow({ x: player.x, y: player.y }, true, 0.18, 0.18);
    this.cameras.main.setZoom(window.innerWidth < 800 ? 0.72 : 0.88);
  }

  renderEmpty() {
    this.worldLayer.clear();
    this.dynamicLayer.clear();
    this.fxLayer.clear();
    this.cameras.main.stopFollow();
    for (const label of this.nameLabels.values()) label.destroy();
    this.nameLabels.clear();
    for (const spr of this.avatarImages.values()) spr.destroy();
    this.avatarImages.clear();
  }

  renderStaticWorld() {
    const map = this.state.map;
    const g = this.worldLayer;
    g.clear();
    g.fillStyle(parseColor(map.background), 1);
    g.fillRect(0, 0, map.width, map.height);

    if (map.decorations?.length) {
      for (const d of map.decorations) drawDecoration(g, d);
    }

    g.lineStyle(1, 0x39403d, 0.32);
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
    this.drawCaptureZones(g);
    this.drawPickups(g);
    this.drawThrownGrenades(g);
    this.drawBullets(g);
    this.drawEntities(g);
    this.syncNameLabels();
    this.syncAvatarSprites();
    this.drawEffects();
  }

  drawCaptureZones(g) {
    const cap = this.state.capture;
    if (!cap?.points?.length) return;
    for (const cp of cap.points) {
      let fill = 0x4a5652;
      let line = 0xb4bdb8;
      if (cp.owner === 'alpha') {
        fill = 0x1f4a6e;
        line = 0x5eb0e8;
      } else if (cp.owner === 'bravo') {
        fill = 0x6e2a2a;
        line = 0xe85d5d;
      }
      g.fillStyle(fill, 0.2);
      g.lineStyle(3, line, 0.5);
      g.fillCircle(cp.x, cp.y, cp.radius);
      g.strokeCircle(cp.x, cp.y, cp.radius);
    }
  }

  drawPickups(g) {
    for (const pickup of this.state.pickups) {
      if (!pickup.active) continue;
      let color = 0xefb64a;
      if (pickup.type === 'medkit') color = 0xf05252;
      else if (pickup.type === 'ammo') color = 0xd6f05f;
      else if (pickup.type === 'armor') color = 0x6fc6ff;
      else if (pickup.type === 'grenade') color = 0x88aa33;
      else if (pickup.type === 'bandage') color = 0xe8dcc4;
      g.fillStyle(color, 0.92);
      g.fillCircle(pickup.x, pickup.y, 12);
      g.lineStyle(2, 0x101312, 0.75);
      g.strokeCircle(pickup.x, pickup.y, 12);
    }
  }

  drawThrownGrenades(g) {
    const list = this.state.thrownGrenades || [];
    for (const gr of list) {
      g.fillStyle(0x3d4a28, 1);
      g.fillCircle(gr.x, gr.y, 7);
      g.lineStyle(2, 0xd6f05f, 0.85);
      g.strokeCircle(gr.x, gr.y, 7);
    }
  }

  drawBullets(g) {
    for (const bullet of this.state.bullets) {
      const col = bulletTeamColor(bullet.team);
      g.lineStyle(3, col, 0.9);
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
      const fillAlpha = entity.avatarUrl ? 0.28 : isPlayer ? 1 : 0.92;
      g.lineStyle(3, outline, 0.9);
      g.fillStyle(color, fillAlpha);
      g.fillCircle(entity.x, entity.y, entity.radius);
      g.strokeCircle(entity.x, entity.y, entity.radius);

      const barrelLength = weapon.id === 'breacher' ? 32 : 42;
      if (weapon.id === 'zombie_claw') {
        g.lineStyle(5, 0xb84a4a, 0.72);
        g.lineBetween(
          entity.x + Math.cos(entity.angle) * 6,
          entity.y + Math.sin(entity.angle) * 6,
          entity.x + Math.cos(entity.angle) * 18,
          entity.y + Math.sin(entity.angle) * 18
        );
      } else {
        g.lineStyle(isPlayer ? 6 : 5, 0xe9eee6, isPlayer ? 0.95 : 0.75);
        g.lineBetween(
          entity.x + Math.cos(entity.angle) * 8,
          entity.y + Math.sin(entity.angle) * 8,
          entity.x + Math.cos(entity.angle) * barrelLength,
          entity.y + Math.sin(entity.angle) * barrelLength
        );
      }

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
      } else if (effect.type === 'blast') {
        const r = effect.radius * (0.35 + t * 0.95);
        g.lineStyle(5, 0xf05252, alpha * 0.85);
        g.strokeCircle(effect.x, effect.y, r);
        g.fillStyle(0xf8ffd5, alpha * 0.12);
        g.fillCircle(effect.x, effect.y, r * 0.55);
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

  syncAvatarSprites() {
    const live = new Set();
    for (const entity of this.state.entities) {
      if (!entity.avatarUrl || entity.dead || !entity.isPlayer) {
        const hidden = this.avatarImages.get(entity.id);
        if (hidden) hidden.setVisible(false);
        continue;
      }
      live.add(entity.id);
      const key = `avatar-tex-${entity.id}`;
      if (!this.textures.exists(key)) {
        queueAvatarTexture(this, key, entity.avatarUrl);
        continue;
      }
      let img = this.avatarImages.get(entity.id);
      if (!img) {
        img = this.add.image(entity.x, entity.y, key).setDepth(8);
        this.avatarImages.set(entity.id, img);
      }
      img.setTexture(key);
      const size = entity.radius * 1.85;
      img.setDisplaySize(size, size);
      img.setPosition(entity.x, entity.y);
      if (img.texture?.key && typeof img.setCircleCrop === 'function') {
        img.setCircleCrop(img.width / 2, img.height / 2, Math.min(img.width, img.height) / 2);
      }
      img.setVisible(true);
    }
    for (const [id, spr] of this.avatarImages) {
      if (!live.has(id)) spr.setVisible(false);
    }
  }

  getInterpolatedState() {
    if (this.snapshotBuffer.length === 0) return this.state;
    const latest = this.snapshotBuffer[this.snapshotBuffer.length - 1];
    if (this.snapshotBuffer.length === 1) return latest.snapshot;
    const renderTime = latest.snapshot.serverTime - 0.14;
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
      pickups: newer.snapshot.pickups.map((pickup) => ({ ...pickup })),
      thrownGrenades: (newer.snapshot.thrownGrenades || []).map((x) => ({ ...x })),
      wave: newer.snapshot.wave ? { ...newer.snapshot.wave } : null,
      capture: newer.snapshot.capture ? structuredClone(newer.snapshot.capture) : null
    };
    for (const entity of state.entities) {
      const previous = older.snapshot.entities.find((item) => item.id === entity.id);
      if (!previous || previous.dead || entity.dead) continue;
      if (entity.id === state.playerId) {
        const snap = newer.snapshot.entities.find((e) => e.id === entity.id);
        if (snap) {
          entity.x = snap.x;
          entity.y = snap.y;
          entity.angle = snap.angle;
        }
        continue;
      }
      entity.x = Phaser.Math.Linear(previous.x, entity.x, t);
      entity.y = Phaser.Math.Linear(previous.y, entity.y, t);
      entity.angle = lerpAngle(previous.angle, entity.angle, t);
    }
    for (const grenade of state.thrownGrenades) {
      const po = older.snapshot.thrownGrenades?.find((x) => x.id === grenade.id);
      if (!po) continue;
      grenade.x = Phaser.Math.Linear(po.x, grenade.x, t);
      grenade.y = Phaser.Math.Linear(po.y, grenade.y, t);
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
    const elapsedRaw = performance.now() / 1000 - latest.receivedAt;
    const elapsed = Math.min(0.055, elapsedRaw);
    const length = Math.hypot(input.moveX, input.moveY);
    if (length <= 0.001) return;
    const sprint = input.sprint && player.stamina > 1 ? 1.35 : 1;
    const damp = 0.72;
    const dx = (input.moveX / length) * player.speed * sprint * elapsed * damp;
    const dy = (input.moveY / length) * player.speed * sprint * elapsed * damp;
    player.x = Phaser.Math.Clamp(player.x + dx, player.radius + 4, state.map.width - player.radius - 4);
    player.y = Phaser.Math.Clamp(player.y + dy, player.radius + 4, state.map.height - player.radius - 4);
  }
}

function parseColor(hex) {
  return Number.parseInt(hex.replace('#', ''), 16);
}

function bulletTeamColor(team) {
  if (team === 'blue') return 0xd6f05f;
  if (team === 'alpha') return 0x6fc6ff;
  if (team === 'bravo') return 0xf05252;
  return 0xefb64a;
}

function drawDecoration(g, d) {
  const a = d.alpha ?? 1;
  if (d.kind === 'grass' || d.kind === 'sand' || d.kind === 'water' || d.kind === 'road' || d.kind === 'lot' || d.kind === 'field') {
    g.fillStyle(parseColor(d.color), a);
    g.fillRect(d.x, d.y, d.w, d.h);
    return;
  }
  if (d.kind === 'tree' || d.kind === 'rock') {
    g.fillStyle(parseColor(d.color), a);
    const rad = d.r || 18;
    g.fillCircle(d.x, d.y, rad);
    if (d.kind === 'tree') {
      g.fillStyle(parseColor(d.trunk || '#4a3728'), a);
      g.fillRect(d.x - 4, d.y + rad * 0.15, 8, rad * 1.05);
    }
    return;
  }
  if (d.kind === 'building') {
    g.fillStyle(parseColor(d.color), a);
    g.fillRect(d.x, d.y, d.w, d.h);
    g.lineStyle(2, parseColor(d.stroke || '#1a1e1c'), 0.55 * a);
    g.strokeRect(d.x, d.y, d.w, d.h);
  }
}

function queueAvatarTexture(scene, key, dataUrl) {
  if (scene.pendingAvatars.has(key)) return;
  scene.pendingAvatars.add(key);
  const im = new Image();
  im.crossOrigin = 'anonymous';
  im.onload = () => {
    try {
      if (!scene.textures.exists(key)) scene.textures.addImage(key, im);
    } finally {
      scene.pendingAvatars.delete(key);
    }
  };
  im.onerror = () => scene.pendingAvatars.delete(key);
  im.src = dataUrl;
}

function lerpAngle(a, b, t) {
  const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + delta * t;
}
