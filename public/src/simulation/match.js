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
  pve: 'multiplayer_pve',
  botDm: 'multiplayer_bot_dm',
  wave: 'multiplayer_wave',
  capture: 'multiplayer_capture'
};

const DEFAULT_PLAYER_COLOR = '#6fc6ff';
const TICK_INPUT_TTL = 0.35;

const PICKUP_RESPAWN = {
  medkit: 18,
  ammo: 14,
  armor: 22,
  adrenaline: 20,
  grenade: 55,
  bandage: 48
};

const CAPTURE_TIME = 3.1;
const GRENADE_THROW_SPEED = 410;
const GRENADE_BLAST_RADIUS = 118;
const GRENADE_MAX_DAMAGE = 56;

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
  playerAvatarUrl = '',
  captureTeam = null,
  seed = `${mode}:${mapId}:${loadoutId}`
} = {}) {
  const state = createBaseMatch({ mode, mapId, seed });
  state.playerId = PLAYER_ID;
  state.loadout = clone(getLoadout(loadoutId));

  addPlayer(state, {
    id: PLAYER_ID,
    username: playerName,
    color: playerColor,
    avatarUrl: playerAvatarUrl,
    loadoutId,
    respawns: isBotDmMode(mode) || isWaveMode(mode) || isCaptureMode(mode),
    captureTeam: isCaptureMode(mode) ? captureTeam : undefined
  });

  if (mode === 'pve_elimination' || mode === MULTIPLAYER_MODES.pve) addPveEnemies(state);
  if (isBotDmMode(mode)) addDeathmatchBots(state);
  if (isWaveMode(mode) && !state.multiplayer) primeWaveMode(state);
  if (isCaptureMode(mode) && !state.multiplayer) addCaptureBots(state);

  if (isCaptureMode(mode)) {
    pushFeed(state, 'Capture zones and bank score for your team.');
    state.objective.label = 'Team score';
    state.objective.remaining = state.objective.duration;
  } else if (isWaveMode(mode)) {
    pushFeed(state, 'Survive escalating waves. Highest kills win when time expires.');
    state.objective.label = 'Wave';
  } else {
    pushFeed(state, isBotDmMode(mode) ? 'Deathmatch live. Highest score wins.' : 'Eliminate all hostiles.');
  }
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
  let idx = 0;
  const captureTeams = buildCaptureTeamOrder(mode, players);
  for (const player of players) {
    const captureTeam = captureTeams[idx];
    idx += 1;
    addPlayer(state, {
      ...player,
      respawns: mode !== MULTIPLAYER_MODES.pve,
      captureTeam
    });
  }
  if (mode === MULTIPLAYER_MODES.pve) addPveEnemies(state);
  else if (mode === MULTIPLAYER_MODES.botDm) addDeathmatchBots(state);
  else if (mode === MULTIPLAYER_MODES.wave) primeWaveMode(state);
  if (mode === MULTIPLAYER_MODES.capture) {
    pushFeed(state, 'Territory Control — hold zones to score.');
    state.objective.label = 'Team score';
    state.objective.remaining = state.objective.duration;
  } else if (mode === MULTIPLAYER_MODES.wave) {
    pushFeed(state, 'Co-op survival waves. Rack up kills.');
    state.objective.label = 'Wave';
  } else {
    pushFeed(state, isPveMode(mode) ? 'Co-op elimination live.' : isBotDmMode(mode) ? 'Bot deathmatch live.' : 'Human deathmatch live.');
  }
  return state;
}

export function addPlayer(state, {
  id,
  username = 'Operator',
  color = DEFAULT_PLAYER_COLOR,
  avatarUrl = '',
  loadoutId = LOADOUTS[0].id,
  respawns = isBotDmMode(state.mode) || isWaveMode(state.mode) || isCaptureMode(state.mode),
  captureTeam: preferredCapture = null
} = {}) {
  if (!id) throw new Error('addPlayer requires an id');
  const existing = state.entities.find((entity) => entity.id === id);
  if (existing) {
    existing.name = username;
    existing.color = color;
    if (avatarUrl) existing.avatarUrl = avatarUrl;
    state.score[id] ||= { kills: 0, deaths: 0, name: username, team: existing.team, color };
    state.score[id].name = username;
    state.score[id].color = color;
    return existing;
  }

  const loadout = getLoadout(loadoutId);
  let spawnZones = state.map.playerSpawns;
  let team;
  if (isCaptureMode(state.mode)) {
    if (preferredCapture === 'bravo') team = 'bravo';
    else if (preferredCapture === 'alpha') team = 'alpha';
    else {
      const a = state.entities.filter((e) => e.team === 'alpha' && e.isPlayer).length;
      const b = state.entities.filter((e) => e.team === 'bravo' && e.isPlayer).length;
      team = a <= b ? 'alpha' : 'bravo';
    }
    spawnZones = team === 'bravo' ? state.map.teamSpawns.bravo : state.map.teamSpawns.alpha;
  } else if (isPveMode(state.mode)) {
    team = 'blue';
  } else {
    team = id;
  }
  const spawn = chooseSpawn(state, spawnZones, 24);
  const entity = createEntity(state, {
    id,
    name: username,
    color,
    avatarUrl,
    team,
    faction: 'player',
    x: spawn.x,
    y: spawn.y,
    isPlayer: true,
    health: 115,
    armor: loadout.armor,
    speed: 226 + loadout.speedBonus,
    weapons: loadout.weapons,
    loadoutId,
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
    useGrenade: false,
    useBandage: false,
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
      avatarUrl: entity.avatarUrl || '',
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
      grenades: entity.grenades,
      bandages: entity.bandages,
      activeWeaponIndex: entity.activeWeaponIndex,
      weapons: [...entity.weapons],
      ammo: clone(entity.ammo),
      respawnAt: entity.respawnAt,
      invulnerableUntil: entity.invulnerableUntil
    })),
    bullets: state.bullets.map((bullet) => ({ ...bullet })),
    thrownGrenades: state.thrownGrenades.map((g) => ({ ...g })),
    pickups: state.pickups.map((pickup) => ({ ...pickup })),
    wave: state.wave ? { ...state.wave } : null,
    capture: state.capture ? clone(state.capture) : null
  };
}

export function getPlayerView(state, playerId) {
  return serializeSnapshot(state, { playerId });
}

export function getPlayer(state, playerId = state.playerId || PLAYER_ID) {
  return state.entities.find((entity) => entity.id === playerId);
}

export function getActiveWeapon(entity) {
  if (entity?.zombie) return WEAPONS.zombie_claw;
  const weaponId = entity?.weapons?.[entity.activeWeaponIndex] || entity?.weapons?.[0];
  if (!weaponId) return WEAPONS.mk18;
  return WEAPONS[weaponId] || WEAPONS.mk18;
}

export function getActiveAmmo(entity) {
  const weapon = getActiveWeapon(entity);
  return entity?.ammo?.[weapon.id] || { mag: 0, reserve: 0, reloadRemaining: 0, cooldown: 0 };
}

function enrichMatchMap(map) {
  const m = clone(map);
  if (!m.teamSpawns) {
    const ps = [...(m.playerSpawns || [])].sort((a, b) => a.x - b.x);
    if (ps.length >= 2) {
      m.teamSpawns = { alpha: [ps[0]], bravo: [ps[1]] };
    } else if (ps.length === 1) {
      const p = ps[0];
      const rad = Math.max(100, p.radius || 100);
      m.teamSpawns = {
        alpha: [{ x: clamp(p.x - Math.min(380, m.width * 0.22), rad + 40, m.width * 0.42), y: p.y, radius: rad }],
        bravo: [{ x: clamp(p.x + Math.min(380, m.width * 0.22), m.width * 0.58, m.width - rad - 40), y: p.y, radius: rad }]
      };
    } else {
      m.teamSpawns = {
        alpha: [{ x: m.width * 0.22, y: m.height * 0.5, radius: 140 }],
        bravo: [{ x: m.width * 0.78, y: m.height * 0.5, radius: 140 }]
      };
    }
  }
  return m;
}

function randomPickupPosition(state) {
  for (let k = 0; k < 56; k += 1) {
    const spot = findOpenPickupSpot(state);
    if (spot) return spot;
  }
  return null;
}

function createBaseMatch({ mode, mapId, seed, timeLimit = null }) {
  const map = enrichMatchMap(getMap(mapId));
  const fallbackDuration = Math.max(60, Number(map.matchDuration) || 180);
  let duration =
    timeLimit === null || timeLimit === 'none'
      ? null
      : Number.isFinite(Number(timeLimit))
        ? Math.max(15, Number(timeLimit))
        : fallbackDuration;
  if (duration !== null && !Number.isFinite(duration)) duration = fallbackDuration;
  const state = {
    version: 3,
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
    thrownGrenades: [],
    pickups: [],
    events: [],
    feed: [],
    inputs: {},
    wave: null,
    capture: null,
    rarePickupIn: 0,
    objective: {
      label: isPvpMode(mode) || isBotDmMode(mode) ? 'Time' : 'Hostiles',
      remaining: isPvpMode(mode) || isBotDmMode(mode) ? duration : map.pveEnemies?.length || 0,
      duration,
      winner: null
    },
    score: {}
  };
  state.rarePickupIn = 10 + random(state) * 20;
  state.pickups = map.pickups.map((pickup) => {
    const pt = randomPickupPosition(state) || { x: map.width / 2, y: map.height / 2 };
    return {
      id: `pickup-${state.nextPickupId++}`,
      type: pickup.type,
      x: pt.x,
      y: pt.y,
      active: true,
      respawnAt: 0
    };
  });
  if (isWaveMode(mode)) {
    state.wave = { completedWaves: 0, nextSpawn: state.time + 3.5 };
    state.objective.label = 'Wave';
    state.objective.remaining = 1;
  }
  if (isCaptureMode(mode)) {
    state.capture = initCaptureState(map);
    state.objective.label = 'Team score';
    state.objective.remaining = duration;
  }
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
  updateThrownGrenades(state, safeDt);
  updatePickups(state);
  if (isWaveMode(state.mode)) updateWaveMode(state, safeDt);
  if (isCaptureMode(state.mode)) updateCaptureMode(state, safeDt);
  updateRarePickupSpawns(state, safeDt);
  updateZombieMelee(state, safeDt);
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
  const weapons = [...(options.weapons || [])];
  const isZombie = Boolean(options.zombie);
  const loadout = options.loadoutId ? getLoadout(options.loadoutId) : null;
  const kitGrenades = loadout?.grenades ?? 2;
  const kitBandages = loadout?.bandages ?? 2;
  const entity = {
    id: options.id || `entity-${state.nextEntityId++}`,
    name: options.name || 'Combatant',
    color: options.color || DEFAULT_PLAYER_COLOR,
    avatarUrl: options.avatarUrl || '',
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
    grenades: options.grenades ?? kitGrenades,
    bandages: options.bandages ?? kitBandages,
    ammo: {},
    isPlayer: Boolean(options.isPlayer),
    ai: options.ai || null,
    zombie: isZombie,
    dead: false,
    respawns: Boolean(options.respawns),
    respawnAt: 0,
    invulnerableUntil: state.time + (options.isPlayer ? 1.2 : 0.5),
    lastDamageAt: -10
  };
  if (isZombie) {
    entity.weapons = [];
    entity.meleeDamage = options.meleeDamage ?? 22;
    entity.meleeRange = options.meleeRange ?? 46;
    entity.meleeCooldown = 0;
    return entity;
  }
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
  if (Number.isInteger(input.swap) && entity.weapons.length > 0) {
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
  if (input.useBandage && entity.bandages > 0 && entity.health < entity.maxHealth - 0.5) {
    entity.bandages -= 1;
    entity.health = Math.min(entity.maxHealth, entity.health + 38);
    state.events.push({ type: 'bandage', entityId: entity.id, x: entity.x, y: entity.y });
  }
  if (input.useGrenade && entity.grenades > 0) {
    entity.grenades -= 1;
    const ang = entity.angle;
    const gx = entity.x + Math.cos(ang) * (entity.radius + 10);
    const gy = entity.y + Math.sin(ang) * (entity.radius + 10);
    state.thrownGrenades.push({
      id: `t-grenade-${state.nextEntityId++}`,
      x: gx,
      y: gy,
      vx: Math.cos(ang) * GRENADE_THROW_SPEED,
      vy: Math.sin(ang) * GRENADE_THROW_SPEED,
      fuse: 1.38,
      ownerId: entity.id,
      team: entity.team
    });
    state.events.push({ type: 'throw', entityId: entity.id, x: gx, y: gy, angle: ang });
  }
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
  if (!weapon.projectileSpeed || weapon.range <= 0) return;
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
    if (shouldSkipFriendlyFire(state, entity.team, bullet.team)) continue;
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
  let spawnSet = state.map.botSpawns;
  if (entity.isPlayer) {
    spawnSet = state.map.playerSpawns;
    if (isCaptureMode(state.mode)) {
      spawnSet = entity.team === 'bravo' ? state.map.teamSpawns.bravo : state.map.teamSpawns.alpha;
    }
  } else if (isCaptureMode(state.mode) && (entity.team === 'alpha' || entity.team === 'bravo')) {
    spawnSet = state.map.teamSpawns?.[entity.team] || state.map.botSpawns;
  }
  const spawn = entity.isPlayer
    ? chooseSpawn(state, spawnSet, entity.radius)
    : chooseSpawnAvoidingPlayers(state, spawnSet, entity.radius, 420);
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
  if (entity.zombie) {
    const target = chooseTarget(state, entity);
    if (!target) return makeInput();
    const toTarget = { x: target.x - entity.x, y: target.y - entity.y };
    const forward = normalize(toTarget.x, toTarget.y);
    const strafe = { x: -forward.y * (entity.ai?.strafe || 1), y: forward.x * (entity.ai?.strafe || 1) };
    return makeInput({
      moveX: forward.x * 0.92 + strafe.x * 0.25,
      moveY: forward.y * 0.92 + strafe.y * 0.25,
      aimX: target.x,
      aimY: target.y,
      fire: false,
      reload: false,
      sprint: false
    });
  }
  const target = chooseTarget(state, entity);
  if (!target) return makeInput();
  const toTarget = { x: target.x - entity.x, y: target.y - entity.y };
  const range = Math.hypot(toTarget.x, toTarget.y);
  const los = hasLineOfSight(state, entity, target);
  const preferred = entity.ai.preferredRange;
  const forward = normalize(toTarget.x, toTarget.y);
  const strafe = { x: -forward.y * entity.ai.strafe, y: forward.x * entity.ai.strafe };
  const pressure = range > preferred ? 1 : range < preferred * 0.55 ? -0.6 : 0;
  let moveX = forward.x * pressure + strafe.x * 0.55;
  let moveY = forward.y * pressure + strafe.y * 0.55;
  if (isCaptureMode(state.mode) && entity.faction === 'bot' && state.capture) {
    const capT = pickCaptureObjective(state, entity);
    if (capT && random(state) < 0.36) {
      const to = normalize(capT.x - entity.x, capT.y - entity.y);
      moveX = moveX * 0.48 + to.x * 0.52;
      moveY = moveY * 0.48 + to.y * 0.52;
      const blended = normalize(moveX, moveY);
      moveX = blended.x;
      moveY = blended.y;
    }
  }
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
    if (isCaptureMode(state.mode)) return candidate.team !== entity.team;
    if (isPveMode(state.mode) || isWaveMode(state.mode)) return candidate.team !== entity.team;
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
      } else if (pickup.type === 'grenade') {
        player.grenades = Math.min(5, player.grenades + 1);
        pushFeed(state, `${player.name} picked up a grenade.`);
      } else if (pickup.type === 'bandage') {
        player.bandages = Math.min(6, player.bandages + 1);
        pushFeed(state, `${player.name} picked up bandages.`);
      }
      pickup.active = false;
      pickup.respawnAt = state.time + (PICKUP_RESPAWN[pickup.type] || 16);
      state.events.push({ type: 'pickup', entityId: player.id, pickupType: pickup.type, x: pickup.x, y: pickup.y });
    }
  }
}

function updatePickupRespawn(state, pickup) {
  if (!pickup.active && state.time >= pickup.respawnAt) {
    const pt = randomPickupPosition(state);
    if (pt) {
      pickup.x = pt.x;
      pickup.y = pt.y;
    }
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
  if (isCaptureMode(state.mode)) {
    if (state.objective.duration === null) {
      state.objective.remaining = null;
      return;
    }
    state.objective.remaining = Math.max(0, state.objective.duration - state.time);
    if (state.time < state.objective.duration) return;
    const cap = state.capture;
    const a = cap?.teamScore?.alpha || 0;
    const b = cap?.teamScore?.bravo || 0;
    let winningTeam = null;
    if (a > b) winningTeam = 'alpha';
    else if (b > a) winningTeam = 'bravo';
    const local = getPlayer(state, state.playerId);
    const playerWon = local && winningTeam && local.team === winningTeam;
    endMatch(
      state,
      winningTeam ? `${winningTeam.toUpperCase()} wins (${Math.round(Math.max(a, b))} pts).` : 'Draw — equal score.',
      playerWon ? state.playerId : null
    );
    return;
  }

  if (isWaveMode(state.mode)) {
    state.objective.remaining = Math.max(1, state.wave?.completedWaves || 1);
    if (state.playerIds.length > 0) {
      const livingPlayers = state.playerIds
        .map((playerId) => getPlayer(state, playerId))
        .filter((player) => player && !player.dead);
      if (livingPlayers.length === 0) {
        endMatch(state, 'All operators down.', null);
        return;
      }
    }
    if (state.objective.duration === null) return;
    if (state.time < state.objective.duration) return;
    const entries = state.playerIds
      .map((id) => [id, state.score[id]?.kills || 0])
      .sort((x, y) => y[1] - x[1]);
    const winId = entries[0]?.[0] || state.playerIds[0] || null;
    endMatch(state, `Time elapsed. Most eliminations: ${state.score[winId]?.name || 'Nobody'}.`, winId);
    return;
  }

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
    if (state.playerIds.length > 0 && livingPlayers.length === 0) endMatch(state, 'Operators down. Mission failed.', null);
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

function chooseSpawnAvoidingPlayers(state, spawns, radius, minFromPlayer = 400) {
  const players = state.entities.filter((e) => e.isPlayer && !e.dead);
  let best = null;
  let bestScore = -Infinity;
  for (let attempt = 0; attempt < 52; attempt += 1) {
    const candidate = chooseSpawn(state, spawns, radius);
    let minD = Infinity;
    for (const p of players) {
      minD = Math.min(minD, distance(candidate, p));
    }
    if (minD < minFromPlayer) continue;
    const score = minD + random(state) * 50;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best || chooseSpawn(state, spawns, radius);
}

function pickCaptureObjective(state, entity) {
  const pts = state.capture?.points;
  if (!pts?.length) return null;
  const uncap = pts.filter((p) => p.owner !== entity.team);
  const pool = uncap.length ? uncap : pts;
  let best = null;
  let bestD = Infinity;
  for (const cp of pool) {
    const d = distance(entity, { x: cp.x, y: cp.y });
    if (d < bestD) {
      bestD = d;
      best = cp;
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

function updateZombieMelee(state, dt) {
  for (const entity of state.entities) {
    if (!entity.zombie || entity.dead) continue;
    entity.meleeCooldown = Math.max(0, (entity.meleeCooldown || 0) - dt);
    const target = chooseTarget(state, entity);
    if (!target || target.dead) continue;
    const reach = entity.meleeRange + target.radius * 0.45;
    if (distance(entity, target) > reach) continue;
    if (entity.meleeCooldown > 0) continue;
    entity.meleeCooldown = 0.78;
    applyDirectDamage(state, target, entity.meleeDamage, entity.id, 'zombie_claw');
    state.events.push({ type: 'melee', x: entity.x, y: entity.y, entityId: entity.id });
  }
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
    useGrenade: Boolean(input.useGrenade),
    useBandage: Boolean(input.useBandage),
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

function buildCaptureTeamOrder(mode, players = []) {
  if (!isCaptureMode(mode)) return players.map(() => undefined);
  let alpha = 0;
  let bravo = 0;
  return players.map((p) => {
    const pref = p.captureTeam === 'bravo' ? 'bravo' : p.captureTeam === 'alpha' ? 'alpha' : null;
    let assign;
    if (pref === 'alpha' || pref === 'bravo') {
      assign = pref;
    } else {
      assign = alpha <= bravo ? 'alpha' : 'bravo';
    }
    if (assign === 'alpha') alpha += 1;
    else bravo += 1;
    return assign;
  });
}

function primeWaveMode(state) {
  if (!state.wave) state.wave = { completedWaves: 0, nextSpawn: state.time + 3.5 };
}

function defaultCapturePoints(map) {
  return [
    { id: 'cp-1', x: map.width * 0.28, y: map.height * 0.52, radius: 74 },
    { id: 'cp-2', x: map.width * 0.72, y: map.height * 0.48, radius: 74 },
    { id: 'cp-3', x: map.width * 0.5, y: map.height * 0.3, radius: 70 }
  ];
}

function initCaptureState(map) {
  const pts = map.capturePoints?.length ? map.capturePoints : defaultCapturePoints(map);
  return {
    points: pts.map((p) => ({
      id: p.id,
      x: p.x,
      y: p.y,
      radius: p.radius ?? 76,
      owner: null,
      alpha: 0,
      bravo: 0
    })),
    teamScore: { alpha: 0, bravo: 0 }
  };
}

function spawnCaptureBot(state, team, archetypeName, salt) {
  const archetype = ARCHETYPES[archetypeName] || ARCHETYPES.rifle;
  const zones = state.map.teamSpawns?.[team] || state.map.botSpawns;
  const spawn = chooseSpawn(state, zones, 26);
  const ent = createEntity(state, {
    name: `${team === 'alpha' ? 'Alpha' : 'Bravo'} Unit`,
    color: team === 'alpha' ? '#5eb0e8' : '#e85d5d',
    team,
    faction: 'bot',
    x: spawn.x,
    y: spawn.y,
    health: archetype.health,
    armor: archetype.armor,
    speed: archetype.speed,
    weapons: [archetype.weapon, 'sidearm'],
    loadoutId: 'rifleman',
    respawns: true,
    ai: {
      type: archetypeName,
      aggression: archetype.aggression * 0.9,
      preferredRange: archetype.preferredRange,
      thinkAt: 0,
      strafe: salt % 2 === 0 ? 1 : -1
    }
  });
  state.entities.push(ent);
  state.score[ent.id] = { kills: 0, deaths: 0, name: ent.name, team, color: ent.color };
}

function addCaptureBots(state) {
  if (state.multiplayer) return;
  const archetypeKeys = ['rifle', 'rusher', 'sniper', 'support'];
  const playersA = state.entities.filter((e) => e.team === 'alpha' && e.isPlayer).length;
  const playersB = state.entities.filter((e) => e.team === 'bravo' && e.isPlayer).length;
  const target = 4;
  const needA = Math.max(0, target - playersA);
  const needB = Math.max(0, target - playersB);
  let idx = 0;
  for (let i = 0; i < needA; i += 1, idx += 1) {
    spawnCaptureBot(state, 'alpha', archetypeKeys[idx % archetypeKeys.length], idx);
  }
  for (let i = 0; i < needB; i += 1, idx += 1) {
    spawnCaptureBot(state, 'bravo', archetypeKeys[idx % archetypeKeys.length], idx);
  }
}

function updateWaveMode(state, dt) {
  const w = state.wave;
  if (!w) return;
  const alive = state.entities.filter((entity) => entity.team === 'hostile' && !entity.dead).length;
  if (alive === 0 && state.time >= w.nextSpawn) {
    spawnWaveCluster(state);
    w.nextSpawn = state.time + 2.4;
  }
}

function spawnWaveCluster(state) {
  const w = state.wave;
  w.completedWaves += 1;
  const wn = w.completedWaves;
  const count = Math.min(18, Math.max(3, Math.floor(2 + wn * 1.08)));
  const hpScale = 1 + wn * 0.12;
  const meleeDamage = 16 + wn * 3.4;
  for (let i = 0; i < count; i += 1) {
    const spawn = chooseSpawn(state, state.map.botSpawns, 24);
    const ent = createEntity(state, {
      name: `Wave ${wn} Infected`,
      color: '#b84a4a',
      team: 'hostile',
      faction: 'hostile',
      zombie: true,
      x: spawn.x,
      y: spawn.y,
      health: Math.round(92 * hpScale),
      armor: Math.min(26, Math.round(4 + wn * 1.15)),
      speed: 118 + Math.min(42, wn * 2.6),
      meleeDamage,
      meleeRange: 48,
      weapons: [],
      ai: {
        type: 'zombie',
        strafe: i % 2 === 0 ? 1 : -1,
        thinkAt: 0
      }
    });
    state.entities.push(ent);
  }
  pushFeed(state, `Wave ${wn} — ${count} infected.`);
}

function updateCaptureMode(state, dt) {
  const cap = state.capture;
  if (!cap) return;
  for (const cp of cap.points) {
    let aIn = false;
    let bIn = false;
    for (const e of state.entities) {
      if (e.dead) continue;
      if (e.team !== 'alpha' && e.team !== 'bravo') continue;
      if (distance(e, { x: cp.x, y: cp.y }) < cp.radius + e.radius * 0.35) {
        if (e.team === 'alpha') aIn = true;
        if (e.team === 'bravo') bIn = true;
      }
    }
    if (aIn && !bIn) {
      cp.alpha += dt;
      cp.bravo = Math.max(0, cp.bravo - dt * 0.7);
    } else if (bIn && !aIn) {
      cp.bravo += dt;
      cp.alpha = Math.max(0, cp.alpha - dt * 0.7);
    } else {
      cp.alpha = Math.max(0, cp.alpha - dt * 0.32);
      cp.bravo = Math.max(0, cp.bravo - dt * 0.32);
    }
    if (cp.alpha >= CAPTURE_TIME) {
      if (cp.owner !== 'alpha') pushFeed(state, 'ALPHA secured a sector.');
      cp.owner = 'alpha';
      cp.alpha = CAPTURE_TIME;
      cp.bravo = 0;
    }
    if (cp.bravo >= CAPTURE_TIME) {
      if (cp.owner !== 'bravo') pushFeed(state, 'BRAVO secured a sector.');
      cp.owner = 'bravo';
      cp.bravo = CAPTURE_TIME;
      cp.alpha = 0;
    }
  }
  const ownedA = cap.points.filter((p) => p.owner === 'alpha').length;
  const ownedB = cap.points.filter((p) => p.owner === 'bravo').length;
  cap.teamScore.alpha += ownedA * 12 * dt;
  cap.teamScore.bravo += ownedB * 12 * dt;
}

function updateThrownGrenades(state, dt) {
  const kept = [];
  for (const g of state.thrownGrenades) {
    g.fuse -= dt;
    const ox = g.x;
    const oy = g.y;
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    const wall = state.map.obstacles.some((rect) => segmentIntersectsRect({ x: ox, y: oy }, { x: g.x, y: g.y }, rect));
    if (wall || g.fuse <= 0) {
      detonateGrenade(state, g);
      continue;
    }
    kept.push(g);
  }
  state.thrownGrenades = kept;
}

function shouldSkipFriendlyFire(state, targetTeam, sourceTeam) {
  if (isCaptureMode(state.mode)) return targetTeam === sourceTeam;
  if (isPveMode(state.mode) || isWaveMode(state.mode)) return targetTeam === sourceTeam;
  return false;
}

function applyDirectDamage(state, target, damage, killerId, weaponId = 'grenade') {
  if (state.time < target.invulnerableUntil) {
    state.events.push({ type: 'deflect', x: target.x, y: target.y });
    return;
  }
  let dmg = damage;
  if (target.armor > 0) {
    const absorbed = Math.min(target.armor, dmg * 0.45);
    target.armor -= absorbed;
    dmg -= absorbed * 0.7;
  }
  target.health = Math.max(0, target.health - dmg);
  target.lastDamageAt = state.time;
  state.events.push({
    type: 'hit',
    targetId: target.id,
    ownerId: killerId,
    x: target.x,
    y: target.y,
    damage: dmg,
    weaponId
  });
  if (target.health <= 0) killEntity(state, target, killerId);
}

function detonateGrenade(state, grenade) {
  for (const entity of state.entities) {
    if (entity.dead || entity.id === grenade.ownerId) continue;
    if (shouldSkipFriendlyFire(state, entity.team, grenade.team)) continue;
    const dist = Math.max(0, distance(entity, grenade) - entity.radius * 0.9);
    if (dist > GRENADE_BLAST_RADIUS) continue;
    const f = 1 - clamp(dist / GRENADE_BLAST_RADIUS, 0, 1);
    applyDirectDamage(state, entity, GRENADE_MAX_DAMAGE * f, grenade.ownerId);
  }
  state.events.push({ type: 'explosion', x: grenade.x, y: grenade.y, radius: GRENADE_BLAST_RADIUS });
}

function updateRarePickupSpawns(state, dt) {
  state.rarePickupIn -= dt;
  if (state.rarePickupIn > 0) return;
  state.rarePickupIn = 26 + random(state) * 34;
  const rareCount = state.pickups.filter((p) => p.type === 'grenade' || p.type === 'bandage').length;
  if (rareCount >= 3) return;
  const type = random(state) > 0.45 ? 'grenade' : 'bandage';
  const spot = findOpenPickupSpot(state);
  if (!spot) return;
  state.pickups.push({
    id: `pickup-${state.nextPickupId++}`,
    type,
    x: spot.x,
    y: spot.y,
    active: true,
    respawnAt: 0
  });
}

function findOpenPickupSpot(state) {
  for (let attempt = 0; attempt < 28; attempt += 1) {
    const x = 120 + random(state) * (state.map.width - 240);
    const y = 120 + random(state) * (state.map.height - 240);
    if (state.map.obstacles.some((rect) => circleIntersectsRect({ x, y, radius: 18 }, rect))) continue;
    if (state.map.hazards.some((rect) => pointInRect({ x, y }, rect))) continue;
    return { x, y };
  }
  return null;
}

function isWaveMode(mode) {
  return mode === 'pve_waves' || mode === MULTIPLAYER_MODES.wave;
}

function isCaptureMode(mode) {
  return mode === 'pve_capture' || mode === MULTIPLAYER_MODES.capture;
}

function isBotDmMode(mode) {
  return mode === 'pvp_deathmatch' || mode === MULTIPLAYER_MODES.botDm;
}

function isPveMode(mode) {
  return mode === 'pve_elimination' || mode === MULTIPLAYER_MODES.pve;
}

function isPvpMode(mode) {
  return mode === MULTIPLAYER_MODES.pvp;
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
