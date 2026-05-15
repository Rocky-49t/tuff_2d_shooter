import { MAPS } from '../public/src/content/maps.js';
import { LOADOUTS } from '../public/src/content/weapons.js';
import {
  MULTIPLAYER_MODES,
  addPlayer,
  applyPlayerInput,
  createRoomMatch,
  serializeSnapshot,
  removePlayer,
  updateRoomMatch
} from '../public/src/simulation/match.js';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_PLAYERS = 5;
const CHAT_LIMIT = 50;
const CHAT_COOLDOWN_MS = 600;
const ROOM_IDLE_MS = 1000 * 60 * 45;
const VALID_MODES = new Set([MULTIPLAYER_MODES.pvp, MULTIPLAYER_MODES.pve]);
const VALID_MAPS = new Set(MAPS.map((map) => map.id));
const VALID_LOADOUTS = new Set(LOADOUTS.map((loadout) => loadout.id));
const DEFAULT_SETTINGS = {
  mode: MULTIPLAYER_MODES.pvp,
  mapId: MAPS[0].id,
  timeLimit: 180
};
const DEFAULT_PROFILE = {
  username: 'Operator',
  color: '#6fc6ff',
  loadoutId: LOADOUTS[0].id
};

export function createRoomManager({ now = () => Date.now(), codeGenerator = createRoomCode } = {}) {
  const rooms = new Map();
  const playerRooms = new Map();

  function createRoom(socketId, profile = {}, settings = {}) {
    const code = uniqueCode(rooms, codeGenerator);
    const room = {
      code,
      hostId: socketId,
      status: 'lobby',
      settings: sanitizeSettings(settings),
      players: new Map(),
      chat: [],
      match: null,
      pendingEvents: [],
      snapshotAccumulator: 0,
      matchEndedEmitted: false,
      createdAt: now(),
      lastActiveAt: now()
    };
    rooms.set(code, room);
    joinRoom(code, socketId, profile);
    return room;
  }

  function joinRoom(code, socketId, profile = {}) {
    const room = getRoomOrThrow(rooms, code);
    const existing = room.players.get(socketId);
    if (!existing && room.players.size >= MAX_PLAYERS) throw new Error('Room is full.');
    const player = {
      id: socketId,
      ...DEFAULT_PROFILE,
      ...sanitizeProfile(profile),
      joinedAt: existing?.joinedAt || now(),
      lastChatAt: existing?.lastChatAt || 0
    };
    room.players.set(socketId, player);
    playerRooms.set(socketId, room.code);
    room.lastActiveAt = now();
    if (room.status === 'playing' && room.match) addPlayer(room.match, player);
    pushSystemChat(room, `${player.username} joined.`);
    return room;
  }

  function updateSettings(code, socketId, patch = {}) {
    const room = getRoomOrThrow(rooms, code);
    assertHost(room, socketId);
    if (room.status !== 'lobby') throw new Error('Settings are locked while a match is running.');
    room.settings = sanitizeSettings({ ...room.settings, ...patch });
    room.lastActiveAt = now();
    return room;
  }

  function setProfile(socketId, profile = {}) {
    const room = getRoomByPlayer(socketId);
    if (!room) throw new Error('Join or create a room first.');
    const player = room.players.get(socketId);
    Object.assign(player, sanitizeProfile(profile));
    if (room.match) addPlayer(room.match, player);
    room.lastActiveAt = now();
    return room;
  }

  function startRoom(code, socketId) {
    const room = getRoomOrThrow(rooms, code);
    assertHost(room, socketId);
    if (room.players.size < 1) throw new Error('A room needs at least one player.');
    room.status = 'playing';
    room.matchEndedEmitted = false;
    room.snapshotAccumulator = 0;
    room.pendingEvents = [];
    room.match = createRoomMatch({
      ...room.settings,
      players: [...room.players.values()],
      seed: `${room.code}:${now()}`
    });
    room.lastActiveAt = now();
    pushSystemChat(room, 'Match started.');
    return room;
  }

  function returnToLobby(code, socketId) {
    const room = getRoomOrThrow(rooms, code);
    assertHost(room, socketId);
    room.status = 'lobby';
    room.match = null;
    room.pendingEvents = [];
    room.matchEndedEmitted = false;
    room.lastActiveAt = now();
    pushSystemChat(room, 'Room returned to lobby.');
    return room;
  }

  function leaveRoom(socketId) {
    const room = getRoomByPlayer(socketId);
    if (!room) return null;
    const player = room.players.get(socketId);
    room.players.delete(socketId);
    playerRooms.delete(socketId);
    if (room.match) removePlayer(room.match, socketId);
    if (player) pushSystemChat(room, `${player.username} left.`);
    if (room.players.size === 0) {
      rooms.delete(room.code);
      return null;
    }
    if (room.hostId === socketId) {
      room.hostId = room.players.keys().next().value;
      pushSystemChat(room, `${room.players.get(room.hostId).username} is now host.`);
    }
    room.lastActiveAt = now();
    return room;
  }

  function receiveInput(socketId, input) {
    const room = getRoomByPlayer(socketId);
    if (!room || room.status !== 'playing' || !room.match) return null;
    applyPlayerInput(room.match, socketId, input);
    room.lastActiveAt = now();
    return room;
  }

  function sendChat(socketId, text) {
    const room = getRoomByPlayer(socketId);
    if (!room) throw new Error('Join or create a room first.');
    const player = room.players.get(socketId);
    const at = now();
    if (at - player.lastChatAt < CHAT_COOLDOWN_MS) throw new Error('Chat is cooling down.');
    const message = sanitizeChat(text);
    if (!message) throw new Error('Chat message is empty.');
    player.lastChatAt = at;
    const chat = {
      id: `${at}:${socketId}`,
      at,
      playerId: socketId,
      username: player.username,
      color: player.color,
      message
    };
    room.chat.push(chat);
    room.chat = room.chat.slice(-CHAT_LIMIT);
    room.lastActiveAt = at;
    return { room, chat };
  }

  function tick(dt) {
    const snapshotRooms = [];
    const endedRooms = [];
    const at = now();
    for (const room of rooms.values()) {
      if (room.players.size === 0 || at - room.lastActiveAt > ROOM_IDLE_MS) {
        rooms.delete(room.code);
        continue;
      }
      if (room.status !== 'playing' || !room.match) continue;
      updateRoomMatch(room.match, dt);
      room.pendingEvents.push(...room.match.events);
      room.snapshotAccumulator += dt;
      if (room.snapshotAccumulator >= 1 / 20) {
        room.snapshotAccumulator = 0;
        snapshotRooms.push(room);
      }
      if (room.match.phase === 'complete' && !room.matchEndedEmitted) {
        room.matchEndedEmitted = true;
        endedRooms.push(room);
      }
    }
    return { snapshotRooms, endedRooms };
  }

  function consumeEvents(room) {
    const events = room.pendingEvents;
    room.pendingEvents = [];
    return events;
  }

  function snapshotFor(room, playerId, events = room.pendingEvents) {
    if (!room.match) return null;
    return serializeSnapshot(room.match, { playerId, events });
  }

  function publicRoomState(room) {
    return {
      code: room.code,
      hostId: room.hostId,
      status: room.status,
      settings: { ...room.settings },
      players: [...room.players.values()].map((player) => ({
        id: player.id,
        username: player.username,
        color: player.color,
        loadoutId: player.loadoutId,
        isHost: player.id === room.hostId
      })),
      chat: room.chat.slice(-CHAT_LIMIT),
      sharePath: `/?room=${room.code}`
    };
  }

  function getRoomByPlayer(socketId) {
    const code = playerRooms.get(socketId);
    return code ? rooms.get(code) : null;
  }

  function getRoom(code) {
    return rooms.get(String(code || '').toUpperCase());
  }

  function health() {
    return {
      rooms: rooms.size,
      players: [...rooms.values()].reduce((sum, room) => sum + room.players.size, 0),
      activeMatches: [...rooms.values()].filter((room) => room.status === 'playing').length
    };
  }

  return {
    rooms,
    createRoom,
    joinRoom,
    updateSettings,
    setProfile,
    startRoom,
    returnToLobby,
    leaveRoom,
    receiveInput,
    sendChat,
    tick,
    consumeEvents,
    snapshotFor,
    publicRoomState,
    getRoom,
    getRoomByPlayer,
    health
  };
}

export function sanitizeProfile(profile = {}) {
  return {
    username: sanitizeUsername(profile.username),
    color: sanitizeColor(profile.color),
    loadoutId: VALID_LOADOUTS.has(profile.loadoutId) ? profile.loadoutId : DEFAULT_PROFILE.loadoutId
  };
}

export function sanitizeSettings(settings = {}) {
  const mode = VALID_MODES.has(settings.mode) ? settings.mode : DEFAULT_SETTINGS.mode;
  const mapId = VALID_MAPS.has(settings.mapId) ? settings.mapId : DEFAULT_SETTINGS.mapId;
  let timeLimit = settings.timeLimit;
  if (timeLimit === 'none' || timeLimit === null || timeLimit === 0) {
    timeLimit = null;
  } else {
    timeLimit = Number.isFinite(Number(timeLimit)) ? Math.round(Number(timeLimit)) : DEFAULT_SETTINGS.timeLimit;
    timeLimit = Math.max(30, Math.min(600, timeLimit));
  }
  return { mode, mapId, timeLimit };
}

export function sanitizeChat(text) {
  return sanitizeText(text, 160);
}

function getRoomOrThrow(rooms, code) {
  const room = rooms.get(String(code || '').toUpperCase());
  if (room) return room;
  throw new Error('Room not found.');
}

function assertHost(room, socketId) {
  if (room.hostId !== socketId) throw new Error('Only the room host can do that.');
}

function pushSystemChat(room, message) {
  room.chat.push({
    id: `system:${Date.now()}:${room.chat.length}`,
    at: Date.now(),
    playerId: 'system',
    username: 'System',
    color: '#d6f05f',
    message
  });
  room.chat = room.chat.slice(-CHAT_LIMIT);
}

function uniqueCode(rooms, codeGenerator) {
  let code = codeGenerator();
  while (rooms.has(code)) code = codeGenerator();
  return code;
}

function createRoomCode() {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

function sanitizeUsername(value) {
  const clean = sanitizeText(value, 18).replace(/[^\w .-]/g, '').trim();
  return clean || DEFAULT_PROFILE.username;
}

function sanitizeColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : DEFAULT_PROFILE.color;
}

function sanitizeText(value, limit) {
  return String(value || '')
    .replace(/[<>&"']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}
