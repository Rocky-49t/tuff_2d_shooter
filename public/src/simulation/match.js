import { MAPS } from '../content/maps.js';
import { LOADOUTS, WEAPONS } from '../content/weapons.js';
import {
  circleIntersectsRect,
  clamp,
  createSeed,
  distance,
  distancePointToSegment,
  normalize,
  pointInRect,
  random,
  segmentIntersectsRect
} from './math.js';

export const PLAYER_ID = 'player';
export const MATCH_PHASES = {
  playing: 'playing',
  complete: 'complete'
};

export const MULTIPLAYER_MODES = {
  pvp: 'multiplayer_pvp',
  pve: 'multiplayer_pve'
};

const DEFAULT_PLAYER_COLOR = '#6fc6ff';
const TICK_INPUT_TTL = 0.35;

const PICKUP_RESPAWN = {
  medkit: 18,
  ammo: 14,
  armor: 22,
  adrenaline: 20
};

const ARCHETYPES = {
  rifle: { health: 100, armor: 15, speed: 182, weapon: 'mk18', aggression: 0.85, preferredRange: 420 },
  rusher: { health: 92, armor: 8, speed: 225, weapon: 'vector', aggression: 1.1, preferredRange: 250 },
  sniper: { health: 85, armor: 10, speed: 150, weapon: 'marksman', aggression: 0.65, preferredRange: 660 },
  support: { health: 125, armor: 25, speed: 150, weapon: 'lmg', aggression: 0.75, preferredRange: 500 }
};

export function getMap(mapId) {
  return MAPS.find((map) => map.id === mapId) || MAPS[0];
}

export function getLoadout(loadoutId) {
  return LOADOUTS.find((loadout) => loadout.id === loadoutId) || LOADOUTS[0];
}

export function createMatch({
  mode = 'pve_elimination',
  mapId = MAPS[0].id,
  loadoutId = LOADOUTS[0].id,
  playerName = 'Operator',
  playerColor = DEFAULT_PLAYER_COLOR,
  seed = `${mode}:${mapId}:${loadoutId}`
} = {}) {
  const state = createBaseMatch({ mode, mapId, seed });
  state.playerId = PLAYER_ID;
  state.loadout = clone(getLoadout(loadoutId));

  addPlayer(state, {
    id: PLAYER_ID,
    username: playerName,
    color: playerColor,
    loadoutId,
    respawns: isPvpMode(mode)
  });

  if (isPveMode(mode)) addPveEnemies(state);
  if (mode === 'pvp_deathmatch') addDeathmatchBots(state);

  pushFeed(state, isPvpMode(mode) ? 'Deathmatch live. Highest score wins.' : 'Eliminate all hostiles.');
  return state;
}

export function createRoomMatch({
  mode = MULTIPLAYER_MODES.pvp,
  mapId = MAPS[0].id,
  timeLimit = 180,
  players = [],
  seed = `${mode}:${mapId}:${Date.now()}`
} = {}) {
  const state = createBaseMatch({ mode, mapId, seed, timeLimit });
  state.multiplayer = true;
  state.inputs = {};
  for (const player of players) addPlayer(state, player);
  if (isPveMode(mode)) addPveEnemies(state);
  pushFeed(state, isPveMode(mode) ? 'Co-op elimination live.' : 'Human deathmatch live.');
  return state;
}

export function addPlayer(state, {
  id,
  username = 'Operator',
  color = DEFAULT_PLAYER_COLOR,
  loadoutId = LOADOUTS[0].id,
  respawns = isPvpMode(state.mode)
} = {}) {
  if (!id) throw new Error('addPlayer requires an id');
  const existing = state.entities.find((entity) => entity.id === id);
  if (existing) {
    existing.name = username;
    existing.color = color;
    state.score[id] ||= { kills: 0, deaths: 0, name: username, team: existing.team, color };
    state.score[id].name = username;
    state.score[id].color = color;
    return existing;
  }

  const loadout = getLoadout(loadoutId);
  const spawn = chooseSpawn(state, state.map.playerSpawns, 24);
  const team = isPveMode(state.mode) ? 'blue' : id;
  const entity = createEntity(state, {
    id,
    name: username,
    color,
    team,
    faction: 'player',
    x: spawn.x,
    y: spawn.y,
    isPlayer: true,
    health: 115,
    armor: loadout.armor,
    speed: 226 + loadout.speedBonus,
    weapons: loadout.weapons,
    respawns
  });
  entity.loadoutId = loadout.id;
  state.entities.push(entity);
  if (!state.playerIds.includes(id)) state.playerIds.push(id);
  state.score[id] = state.score[id] || { kills: 0, deaths: 0, name: username, team, color };
  state.score[id].name = username;
  state.score[id].team = team;
  state.score[id].color = color;
  state.inputs[id] = makeInput();
  return entity;
}

export function removePlayer(state, playerId) {
  state.entities = state.entities.filter((entity) => entity.id !== playerId);
  state.playerIds = state.playerIds.filter((id) => id !== playerId);
  delete state.inputs[playerId];
}

export function applyPlayerInput(state, playerId, input = makeInput()) {
  if (!state.playerIds.includes(playerId)) return;
  state.inputs[playerId] = sanitizeInput(state, input);
}

export function makeInput(overrides = {}) {
  return {
    seq: 0,
    moveX: 0,
    moveY: 0,
    aimX: 0,
    aimY: 0,
    fire: false,
    reload: false,
    swap: null,
    sprint: false,
    interact: false,
    pause: false,
    sentAt: 0,
    ...overrides
  };
}

export function updateMatch(state, inputOrInputs = null, dt = 1 / 60) {
  if (inputOrInputs && looksLikeInput(inputOrInputs)) {
    const playerId = state.playerId || PLAYER_ID;
    state.inputs[playerId] = sanitizeInput(state, inputOrInputs);
  } else if (inputOrInputs && typeof inputOrInputs === 'object') {
    for (const [playerId, input] of Object.entries(inputOrInputs)) {
      applyPlayerInput(state, playerId, input);
    }
  }
  return stepMatch(state, dt);
}

export function updateRoomMatch(state, dt = 1 / 60) {
  return stepMatch(state, dt);
}

export function serializeSnapshot(state, { playerId = state.playerId, events = state.events } = {}) {
  return {
    version: state.version,
    serverTime: state.time,
    mode: state.mode,
    phase: state.phase,
    endedReason: state.endedReason,
    playerId,
    playerIds: [...state.playerIds],
    map: state.map,
    objective: clone(state.objective),
    score: clone(state.score),
    feed: state.feed.slice(0, 6),
    events: clone(events || []),
    entities: state.entities.map((entity) => ({
      id: entity.id,
      name: entity.name,
      color: entity.color,
      team: entity.team,
      faction: entity.faction,
      isPlayer: entity.isPlayer,
      dead: entity.dead,
      x: entity.x,
      y: entity.y,
      vx: entity.vx,
      vy: entity.vy,
      angle: entity.angle,
      radius: entity.radius,
      health: entity.health,
      maxHealth: entity.maxHealth,
      armor: entity.armor,
      maxArmor: entity.maxArmor,
      speed: entity.speed,
      stamina: entity.stamina,
      maxStamina: entity.maxStamina,
      activeWeaponIndex: entity.activeWeaponIndex,
      weapons: [...entity.weapons],
      ammo: clone(entity.ammo),
      respawnAt: entity.respawnAt,
      invulnerableUntil: entity.invulnerableUntil
    })),
    bullets: state.bullets.map((bullet) => ({ ...bullet })),
    pickups: state.pickups.map((pickup) => ({ ...pickup }))
  };
}

export function getPlayerView(state, playerId) {
  return serializeSnapshot(state, { playerId });
}

export function getPlayer(state, playerId = state.playerId || PLAYER_ID) {
  return state.entities.find((entity) => entity.id === playerId);
}

export function getActiveWeapon(entity) {
  const weaponId = entity?.weapons?.[entity.activeWeaponIndex] || entity?.weapons?.[0];
  return WEAPONS[weaponId] || WEAPONS.mk18;
}

export function getActiveAmmo(entity) {
  const weapon = getActiveWeapon(entity);
  return entity?.ammo?.[weapon.id] || { mag: 0, reserve: 0, reloadRemaining: 0, cooldown: 0 };
}

function createBaseMatch({ mode, mapId, seed, timeLimit = null }) {
  const map = clone(getMap(mapId));
  const duration = timeLimit === null || timeLimit === 'none'
    ? null
    : Number.isFinite(Number(timeLimit)) ? Math.max(15, Number(timeLimit)) : map.matchDuration;
  const state = {
    version: 2,
    mode,
    map,
    loadout: null,
    time: 0,
    phase: MATCH_PHASES.playing,
    endedReason: '',
    rngState: createSeed(seed),
    nextEntityId: 1,
    nextBulletId: 1,
    nextPickupId: 1,
    playerId: PLAYER_ID,
    playerIds: [],
    entities: [],
    bullets: [],
    pickups: [],
    events: [],
    feed: [],
    inputs: {},
    objective: {
      label: isPvpMode(mode) ? 'Time' : 'Hostiles',
      remaining: isPvpMode(mode) ? duration : map.pveEnemies.length,
      duration,
      winner: null
    },
    score: {}
  };
  state.pickups = map.pickups.map((pickup) => ({
    id: `pickup-${state.nextPickupId++}`,
    type: pickup.type,
    x: pickup.x,
    y: pickup.y,
    active: true,
    respawnAt: 0
  }));
  return state;
}

function stepMatch(state, dt) {
  if (!state || state.phase !== MATCH_PHASES.playing) return state;
  const safeDt = clamp(dt, 0, 0.05);
  state.time += safeDt;
  state.events = [];

  for (const entity of state.entities) {
    updateReloads(entity, safeDt);
    updateRespawn(state, entity);
    if (!entity.dead) applyHazards(state, entity, safeDt);
  }

  for (const pickup of state.pickups) updatePickupRespawn(state, pickup);
  expireStaleInputs(state);

  const commands = new Map();
  for (const playerId of state.playerIds) commands.set(playerId, state.inputs[playerId] || makeInput());
  for (const entity of state.entities) {
    if (entity.ai && !entity.dead) commands.set(entity.id, buildAICommand(state, entity));
  }

  for (const entity of state.entities) {
    if (entity.dead) continue;
    applyCommand(state, entity, commands.get(entity.id) || makeInput(), safeDt);
  }

  updateBullets(state, safeDt);
  updatePickups(state);
  updateObjective(state);
  return state;
}

function addPveEnemies(state) {
  for (const enemy of state.map.pveEnemies) {
    const archetype = ARCHETYPES[enemy.archetype] || ARCHETYPES.rifle;
    state.entities.push(createEntity(state, {
      name: labelForArchetype(enemy.archetype),
      color: '#f05252',
      team: 'hostile',
      faction: 'hostile',
      x: enemy.x,
      y: enemy.y,
      health: archetype.health,
      armor: archetype.armor,
      speed: archetype.speed,
      weapons: [archetype.weapon, 'sidearm'],
      ai: {
        type: enemy.archetype,
        aggression: archetype.aggression,
        preferredRange: archetype.preferredRange,
        thinkAt: 0,
        strafe: 1
      }
    }));
  }
}

function addDeathmatchBots(state) {
  const botCount = state.map.pvpBots || 5;
  for (let i = 0; i < botCount; i += 1) {
    const archetypeKeys = ['rifle', 'rusher', 'sniper', 'support'];
    const archetypeName = archetypeKeys[i % archetypeKeys.length];
    const archetype = ARCHETYPES[archetypeName];
    const spawn = chooseSpawn(state, state.map.botSpawns, 26);
    const id = `bot-${i + 1}`;
    state.entities.push(createEntity(state, {
      id,
      name: `Bot ${i + 1}`,
      color: '#efb64a',
      team: id,
      faction: 'bot',
      x: spawn.x,
      y: spawn.y,
      health: archetype.health,
      armor: archetype.armor,
      speed: archetype.speed,
      weapons: [archetype.weapon, 'sidearm'],
      respawns: true,
      ai: {
        type: archetypeName,
        aggression: archetype.aggression,
        preferredRange: archetype.preferredRange,
        thinkAt: 0,
        strafe: i % 2 === 0 ? 1 : -1
      }
    }));
    state.score[id] = { kills: 0, deaths: 0, name: `Bot ${i + 1}`, team: id, color: '#efb64a' };
  }
}

function createEntity(state, options) {
  const weapons = [...options.weapons];
  const entity = {
    id: options.id || `entity-${state.nextEntityId++}`,
    name: options.name || 'Combatant',
    color: options.color || DEFAULT_PLAYER_COLOR,
    team: options.team || 'hostile',
    faction: options.faction || 'hostile',
    x: options.x,
    y: options.y,
    vx: 0,
    vy: 0,
    angle: 0,
    radius: 22,
    health: options.health,
    maxHealth: options.health,
    armor: options.armor || 0,
    maxArmor: options.armor || 0,
    speed: options.speed || 200,
    stamina: 100,
    maxStamina: 100,
    activeWeaponIndex: 0,
    weapons,
    ammo: {},
    isPlayer: Boolean(options.isPlayer),
    ai: options.ai || null,
    dead: false,
    respawns: Boolean(options.respawns),
    respawnAt: 0,
    invulnerableUntil: state.time + (options.isPlayer ? 1.2 : 0.5),
    lastDamageAt: -10
  };
  for (const weaponId of weapons) {
    const weapon = WEAPONS[weaponId];
    entity.ammo[weaponId] = {
      mag: weapon.magazineSize,
      reserve: weapon.ammoReserve,
      reloadRemaining: 0,
      cooldown: 0
    };
  }
  return entity;
}

function applyCommand(state, entity, input, dt) {
  if (Number.isInteger(input.swap)) {
    entity.activeWeaponIndex = clamp(input.swap, 0, entity.weapons.length - 1);
  }

  const aimDx = input.aimX - entity.x;
  const aimDy = input.aimY - entity.y;
  if (Math.hypot(aimDx, aimDy) > 3) entity.angle = Math.atan2(aimDy, aimDx);

  const move = normalize(input.moveX, input.moveY);
  const sprinting = input.sprint && entity.stamina > 1 && move.length > 0;
  const speed = entity.speed * (sprinting ? 1.35 : 1);
  entity.stamina = clamp(entity.stamina + (sprinting ? -32 : 22) * dt, 0, entity.maxStamina);
  moveEntity(state, entity, move.x * speed * dt, move.y * speed * dt);

  if (input.reload) startReload(entity);
  if (input.fire) fireWeapon(state, entity);
}

function moveEntity(state, entity, dx, dy) {
  if (dx === 0 && dy === 0) {
    entity.vx = 0;
    entity.vy = 0;
    return;
  }

  const originalX = entity.x;
  const originalY = entity.y;
  entity.x += dx;
  if (isBlocked(state, entity)) entity.x = originalX;
  entity.y += dy;
  if (isBlocked(state, entity)) entity.y = originalY;
  entity.x = clamp(entity.x, entity.radius + 4, state.map.width - entity.radius - 4);
  entity.y = clamp(entity.y, entity.radius + 4, state.map.height - entity.radius - 4);
  entity.vx = entity.x - originalX;
  entity.vy = entity.y - originalY;
}

function isBlocked(state, entity) {
  const circle = { x: entity.x, y: entity.y, radius: entity.radius };
  return state.map.obstacles.some((rect) => circleIntersectsRect(circle, rect));
}

function startReload(entity) {
  const weapon = getActiveWeapon(entity);
  const ammo = entity.ammo[weapon.id];
  if (!ammo || ammo.reloadRemaining > 0 || ammo.reserve <= 0 || ammo.mag >= weapon.magazineSize) return;
  ammo.reloadRemaining = weapon.reloadTime;
}

function updateReloads(entity, dt) {
  for (const weaponId of entity.weapons) {
    const weapon = WEAPONS[weaponId];
    const ammo = entity.ammo[weaponId];
    ammo.cooldown = Math.max(0, ammo.cooldown - dt);
    if (ammo.reloadRemaining <= 0) continue;
    ammo.reloadRemaining = Math.max(0, ammo.reloadRemaining - dt);
    if (ammo.reloadRemaining === 0) {
      const needed = weapon.magazineSize - ammo.mag;
      const loaded = Math.min(needed, ammo.reserve);
      ammo.mag += loaded;
      ammo.reserve -= loaded;
    }
  }
}

function fireWeapon(state, entity) {
  const weapon = getActiveWeapon(entity);
  const ammo = entity.ammo[weapon.id];
  if (!ammo || ammo.cooldown > 0 || ammo.reloadRemaining > 0) return;
  if (ammo.mag <= 0) {
    startReload(entity);
    state.events.push({ type: 'dryFire', entityId: entity.id, x: entity.x, y: entity.y });
    return;
  }

  ammo.mag -= 1;
  ammo.cooldown = 1 / weapon.fireRate;
  const muzzleX = entity.x + Math.cos(entity.angle) * (entity.radius + 12);
  const muzzleY = entity.y + Math.sin(entity.angle) * (entity.radius + 12);
  for (let i = 0; i < weapon.pellets; i += 1) {
    const pelletSpread = (random(state) - 0.5) * weapon.spread + (weapon.pellets > 1 ? (i - (weapon.pellets - 1) / 2) * weapon.spread * 0.45 : 0);
    const recoil = (random(state) - 0.5) * weapon.recoil;
    const angle = entity.angle + pelletSpread + recoil;
    state.bullets.push({
      id: `bullet-${state.nextBulletId++}`,
      ownerId: entity.id,
      team: entity.team,
      weaponId: weapon.id,
      x: muzzleX,
      y: muzzleY,
      previousX: muzzleX,
      previousY: muzzleY,
      vx: Math.cos(angle) * weapon.projectileSpeed,
      vy: Math.sin(angle) * weapon.projectileSpeed,
      damage: weapon.damage,
      range: weapon.range,
      travel: 0,
      radius: weapon.pellets > 1 ? 4 : 5
    });
  }
  state.events.push({ type: 'shot', entityId: entity.id, weaponId: weapon.id, x: muzzleX, y: muzzleY, angle: entity.angle });
}

function updateBullets(state, dt) {
  const survivors = [];
  for (const bullet of state.bullets) {
    const old = { x: bullet.x, y: bullet.y };
    bullet.previousX = old.x;
    bullet.previousY = old.y;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.travel += Math.hypot(bullet.x - old.x, bullet.y - old.y);
    const next = { x: bullet.x, y: bullet.y };

    const blocked = state.map.obstacles.some((rect) => segmentIntersectsRect(old, next, rect));
    if (blocked) {
      state.events.push({ type: 'impact', x: bullet.x, y: bullet.y });
      continue;
    }

    const hit = findBulletHit(state, bullet, old, next);
    if (hit) {
      applyDamage(state, hit, bullet, old, next);
      continue;
    }

    if (bullet.travel < bullet.range && bullet.x > 0 && bullet.y > 0 && bullet.x < state.map.width && bullet.y < state.map.height) {
      survivors.push(bullet);
    }
  }
  state.bullets = survivors;
}

function findBulletHit(state, bullet, old, next) {
  let closest = null;
  let closestDistance = Infinity;
  for (const entity of state.entities) {
    if (entity.dead || entity.id === bullet.ownerId) continue;
    if (isPveMode(state.mode) && entity.team === bullet.team) continue;
    const missDistance = distancePointToSegment(entity, old, next);
    if (missDistance > entity.radius + bullet.radius) continue;
    const alongDistance = distance(old, entity);
    if (alongDistance < closestDistance) {
      closest = entity;
      closestDistance = alongDistance;
    }
  }
  return closest;
}

function applyDamage(state, target, bullet, old, next) {
  if (state.time < target.invulnerableUntil) {
    state.events.push({ type: 'deflect', x: target.x, y: target.y });
    return;
  }

  const weapon = WEAPONS[bullet.weaponId];
  const falloffStart = bullet.range * 0.55;
  const falloff = bullet.travel <= falloffStart ? 1 : 1 - clamp((bullet.travel - falloffStart) / (bullet.range - falloffStart), 0, 1) * 0.45;
  const inCover = state.map.cover.some((rect) => pointInRect(target, rect) && segmentIntersectsRect(old, next, rect));
  let damage = bullet.damage * falloff * (inCover ? 0.55 : 1);

  if (target.armor > 0) {
    const absorbed = Math.min(target.armor, damage * 0.45);
    target.armor -= absorbed;
    damage -= absorbed * 0.7;
  }

  target.health = Math.max(0, target.health - damage);
  target.lastDamageAt = state.time;
  state.events.push({
    type: 'hit',
    targetId: target.id,
    ownerId: bullet.ownerId,
    x: target.x,
    y: target.y,
    damage,
    weaponId: weapon.id
  });

  if (target.health <= 0) killEntity(state, target, bullet.ownerId);
}

function killEntity(state, target, killerId) {
  if (target.dead) return;
  target.dead = true;
  target.respawnAt = target.respawns ? state.time + 2.6 : Infinity;
  state.score[target.id] ||= { kills: 0, deaths: 0, name: target.name, team: target.team, color: target.color };
  state.score[target.id].deaths += 1;
  if (killerId && killerId !== target.id) {
    const killer = state.entities.find((entity) => entity.id === killerId);
    state.score[killerId] ||= { kills: 0, deaths: 0, name: killer?.name || killerId, team: killer?.team || killerId, color: killer?.color || DEFAULT_PLAYER_COLOR };
    state.score[killerId].kills += 1;
  }
  state.events.push({ type: 'death', targetId: target.id, killerId, x: target.x, y: target.y });
  const killer = state.entities.find((entity) => entity.id === killerId);
  pushFeed(state, `${killer?.name || 'Unknown'} eliminated ${target.name}`);
}

function updateRespawn(state, entity) {
  if (!entity.dead || !entity.respawns || state.time < entity.respawnAt) return;
  const spawnSet = entity.isPlayer ? state.map.playerSpawns : state.map.botSpawns;
  const spawn = chooseSpawn(state, spawnSet, entity.radius);
  entity.x = spawn.x;
  entity.y = spawn.y;
  entity.health = entity.maxHealth;
  entity.armor = entity.maxArmor;
  entity.stamina = entity.maxStamina;
  entity.dead = false;
  entity.invulnerableUntil = state.time + 1.4;
  for (const weaponId of entity.weapons) {
    const weapon = WEAPONS[weaponId];
    entity.ammo[weaponId].mag = weapon.magazineSize;
    entity.ammo[weaponId].reloadRemaining = 0;
    entity.ammo[weaponId].cooldown = 0;
  }
  state.events.push({ type: 'respawn', entityId: entity.id, x: entity.x, y: entity.y });
}

function buildAICommand(state, entity) {
  const target = chooseTarget(state, entity);
  if (!target) return makeInput();
  const toTarget = { x: target.x - entity.x, y: target.y - entity.y };
  const range = Math.hypot(toTarget.x, toTarget.y);
  const los = hasLineOfSight(state, entity, target);
  const preferred = entity.ai.preferredRange;
  const forward = normalize(toTarget.x, toTarget.y);
  const strafe = { x: -forward.y * entity.ai.strafe, y: forward.x * entity.ai.strafe };
  const pressure = range > preferred ? 1 : range < preferred * 0.55 ? -0.6 : 0;
  const moveX = forward.x * pressure + strafe.x * 0.55;
  const moveY = forward.y * pressure + strafe.y * 0.55;
  const ammo = getActiveAmmo(entity);
  const weapon = getActiveWeapon(entity);
  const shouldReload = ammo.mag <= Math.max(2, weapon.magazineSize * 0.18);
  const shouldFire = los && range < weapon.range * 0.94 && ammo.reloadRemaining <= 0 && random(state) < entity.ai.aggression;

  if (state.time >= entity.ai.thinkAt) {
    entity.ai.thinkAt = state.time + 0.8 + random(state) * 0.7;
    entity.ai.strafe *= random(state) > 0.4 ? 1 : -1;
  }

  return makeInput({
    moveX,
    moveY,
    aimX: target.x + (random(state) - 0.5) * 22,
    aimY: target.y + (random(state) - 0.5) * 22,
    fire: shouldFire,
    reload: shouldReload,
    sprint: range > preferred * 1.3 && entity.ai.type === 'rusher'
  });
}

function chooseTarget(state, entity) {
  const candidates = state.entities.filter((candidate) => {
    if (candidate.dead || candidate.id === entity.id) return false;
    if (isPveMode(state.mode)) return candidate.team !== entity.team;
    return true;
  });
  let best = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const d = distance(entity, candidate);
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  return best;
}

function hasLineOfSight(state, a, b) {
  return !state.map.obstacles.some((rect) => segmentIntersectsRect(a, b, rect));
}

function updatePickups(state) {
  for (const playerId of state.playerIds) {
    const player = getPlayer(state, playerId);
    if (!player || player.dead) continue;
    for (const pickup of state.pickups) {
      if (!pickup.active || distance(player, pickup) > 42) continue;
      if (pickup.type === 'medkit') {
        player.health = Math.min(player.maxHealth, player.health + 45);
        pushFeed(state, `${player.name} used a medkit.`);
      } else if (pickup.type === 'ammo') {
        for (const weaponId of player.weapons) {
          const weapon = WEAPONS[weaponId];
          player.ammo[weaponId].reserve += Math.ceil(weapon.magazineSize * 0.8);
        }
        pushFeed(state, `${player.name} restocked ammo.`);
      } else if (pickup.type === 'armor') {
        player.armor = Math.min(player.maxArmor + 35, player.armor + 35);
        pushFeed(state, `${player.name} fitted armor plates.`);
      } else if (pickup.type === 'adrenaline') {
        player.stamina = player.maxStamina;
        player.invulnerableUntil = Math.max(player.invulnerableUntil, state.time + 0.65);
        pushFeed(state, `${player.name} used adrenaline.`);
      }
      pickup.active = false;
      pickup.respawnAt = state.time + (PICKUP_RESPAWN[pickup.type] || 16);
      state.events.push({ type: 'pickup', entityId: player.id, pickupType: pickup.type, x: pickup.x, y: pickup.y });
    }
  }
}

function updatePickupRespawn(state, pickup) {
  if (!pickup.active && state.time >= pickup.respawnAt) {
    pickup.active = true;
    state.events.push({ type: 'pickupRespawn', pickupType: pickup.type, x: pickup.x, y: pickup.y });
  }
}

function applyHazards(state, entity, dt) {
  for (const hazard of state.map.hazards) {
    if (!pointInRect(entity, hazard)) continue;
    entity.health = Math.max(0, entity.health - hazard.damagePerSecond * dt);
    if (entity.health <= 0) killEntity(state, entity, null);
  }
}

function updateObjective(state) {
  if (isPveMode(state.mode)) {
    const remaining = state.entities.filter((entity) => entity.team === 'hostile' && !entity.dead).length;
    state.objective.remaining = remaining;
    if (remaining === 0) {
      endMatch(state, 'All hostiles neutralized.', state.playerIds[0] || PLAYER_ID);
      return;
    }
    const livingPlayers = state.playerIds
      .map((playerId) => getPlayer(state, playerId))
      .filter((player) => player && !player.dead);
    if (state.playerIds.length > 0 && livingPlayers.length === 0) endMatch(state, 'Operators down. Mission failed.', 'hostile');
    return;
  }

  if (state.objective.duration === null) {
    state.objective.remaining = null;
    return;
  }

  state.objective.remaining = Math.max(0, state.objective.duration - state.time);
  if (state.time < state.objective.duration) return;
  const entries = Object.entries(state.score).sort((a, b) => b[1].kills - a[1].kills || a[1].deaths - b[1].deaths);
  const winner = entries[0]?.[0] || null;
  endMatch(state, winner === (state.playerId || PLAYER_ID) ? 'Top score secured.' : `${entries[0]?.[1]?.name || 'Nobody'} won the drill.`, winner);
}

function endMatch(state, reason, winner) {
  if (state.phase === MATCH_PHASES.complete) return;
  state.phase = MATCH_PHASES.complete;
  state.endedReason = reason;
  state.objective.winner = winner;
  state.events.push({ type: 'matchEnd', reason, winner });
  pushFeed(state, reason);
}

function chooseSpawn(state, spawns, radius) {
  const spawn = spawns[Math.floor(random(state) * spawns.length)] || spawns[0];
  let best = { x: spawn.x, y: spawn.y };
  let bestScore = -Infinity;
  for (let i = 0; i < 24; i += 1) {
    const angle = random(state) * Math.PI * 2;
    const distanceFromCenter = random(state) * spawn.radius;
    const candidate = {
      x: clamp(spawn.x + Math.cos(angle) * distanceFromCenter, radius + 8, state.map.width - radius - 8),
      y: clamp(spawn.y + Math.sin(angle) * distanceFromCenter, radius + 8, state.map.height - radius - 8)
    };
    const blocked = state.map.obstacles.some((rect) => circleIntersectsRect({ ...candidate, radius }, rect));
    const hazardous = state.map.hazards.some((rect) => pointInRect(candidate, rect));
    if (blocked || hazardous) continue;
    const nearest = state.entities.reduce((min, entity) => (entity.dead ? min : Math.min(min, distance(candidate, entity))), Infinity);
    const score = nearest + random(state) * 20;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function sanitizeInput(state, input = {}) {
  const seq = Number.isFinite(Number(input.seq)) ? Math.max(0, Math.floor(Number(input.seq))) : 0;
  return makeInput({
    seq,
    moveX: clampNumber(input.moveX, -1, 1),
    moveY: clampNumber(input.moveY, -1, 1),
    aimX: clampNumber(input.aimX, -1000, state.map.width + 1000),
    aimY: clampNumber(input.aimY, -1000, state.map.height + 1000),
    fire: Boolean(input.fire),
    reload: Boolean(input.reload),
    swap: Number.isInteger(input.swap) ? clamp(input.swap, 0, 2) : null,
    sprint: Boolean(input.sprint),
    interact: Boolean(input.interact),
    pause: Boolean(input.pause),
    sentAt: state.time
  });
}

function expireStaleInputs(state) {
  for (const playerId of state.playerIds) {
    const input = state.inputs[playerId];
    if (!input) {
      state.inputs[playerId] = makeInput({ sentAt: state.time });
      continue;
    }
    if (state.time - (input.sentAt || 0) > TICK_INPUT_TTL) {
      state.inputs[playerId] = makeInput({
        seq: input.seq,
        aimX: input.aimX,
        aimY: input.aimY,
        sentAt: state.time
      });
    }
  }
}

function looksLikeInput(value) {
  return Object.hasOwn(value, 'moveX') || Object.hasOwn(value, 'fire') || Object.hasOwn(value, 'aimX');
}

function isPveMode(mode) {
  return mode === 'pve_elimination' || mode === MULTIPLAYER_MODES.pve;
}

function isPvpMode(mode) {
  return mode === 'pvp_deathmatch' || mode === MULTIPLAYER_MODES.pvp;
}

function clampNumber(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? clamp(number, min, max) : 0;
}

function pushFeed(state, message) {
  state.feed.unshift({ time: state.time, message });
  state.feed = state.feed.slice(0, 6);
}

function labelForArchetype(archetype) {
  if (archetype === 'rusher') return 'Assaulter';
  if (archetype === 'sniper') return 'Marksman';
  if (archetype === 'support') return 'Gunner';
  return 'Rifle Guard';
}

function clone(value) {
  return structuredClone(value);
}
