import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoomManager, sanitizeChat, sanitizeProfile, sanitizeSettings } from '../server/rooms.js';

function manager() {
  let now = 1000;
  let count = 0;
  return {
    get now() {
      return now;
    },
    advance(ms) {
      now += ms;
    },
    rooms: createRoomManager({
      now: () => now,
      codeGenerator: () => `ABC12${++count}`
    })
  };
}

test('room creation, joining, profile sanitization, and lookup work', () => {
  const ctx = manager();
  const room = ctx.rooms.createRoom('host', { username: '<Ace>', color: '#ff0000', loadoutId: 'recon' });
  ctx.rooms.joinRoom(room.code, 'guest', { username: 'Guest', color: '#00ffaa', loadoutId: 'support' });
  const state = ctx.rooms.publicRoomState(room);
  assert.equal(state.code, 'ABC121');
  assert.equal(state.hostId, 'host');
  assert.equal(state.players.length, 2);
  assert.equal(state.players[0].username, 'Ace');
  assert.equal(ctx.rooms.getRoom('abc121'), room);
});

test('only host can change settings and settings lock during play', () => {
  const ctx = manager();
  const room = ctx.rooms.createRoom('host');
  ctx.rooms.joinRoom(room.code, 'guest');
  assert.throws(() => ctx.rooms.updateSettings(room.code, 'guest', { mapId: 'metro_station' }), /Only the room host/);
  ctx.rooms.updateSettings(room.code, 'host', { mode: 'multiplayer_pvp', mapId: 'metro_station', timeLimit: null });
  assert.equal(room.settings.mapId, 'metro_station');
  assert.equal(room.settings.timeLimit, null);
  ctx.rooms.startRoom(room.code, 'host');
  assert.equal(room.status, 'playing');
  assert.throws(() => ctx.rooms.updateSettings(room.code, 'host', { mapId: 'killhouse' }), /locked/);
});

test('chat is sanitized, retained, and rate limited', () => {
  const ctx = manager();
  const room = ctx.rooms.createRoom('host', { username: 'Host' });
  const first = ctx.rooms.sendChat('host', '<hello> & squad');
  assert.equal(first.chat.message, 'hello squad');
  assert.equal(room.chat.at(-1).username, 'Host');
  assert.throws(() => ctx.rooms.sendChat('host', 'too fast'), /cooling down/);
  ctx.advance(700);
  assert.equal(ctx.rooms.sendChat('host', 'ready').chat.message, 'ready');
  assert.equal(sanitizeChat('x'.repeat(200)).length, 160);
});

test('PvP rooms are human-only, server authoritative, and score kills', () => {
  const ctx = manager();
  const room = ctx.rooms.createRoom('host', { username: 'Alpha' }, { mode: 'multiplayer_pvp', mapId: 'killhouse', timeLimit: 120 });
  ctx.rooms.joinRoom(room.code, 'guest', { username: 'Bravo' });
  ctx.rooms.startRoom(room.code, 'host');
  assert.equal(room.match.entities.every((entity) => entity.isPlayer), true);
  const alpha = room.match.entities.find((entity) => entity.id === 'host');
  const bravo = room.match.entities.find((entity) => entity.id === 'guest');
  Object.assign(alpha, { x: 180, y: 180, angle: 0 });
  Object.assign(bravo, { x: 310, y: 180, health: 1, armor: 0, invulnerableUntil: 0 });
  ctx.rooms.receiveInput('host', { aimX: bravo.x, aimY: bravo.y, fire: true });
  for (let i = 0; i < 45; i += 1) ctx.rooms.tick(1 / 60);
  assert.equal(bravo.dead, true);
  assert.equal(room.match.score.host.kills, 1);
  for (let i = 0; i < 180; i += 1) ctx.rooms.tick(1 / 60);
  assert.equal(bravo.dead, false);
});

test('co-op PvE disables friendly fire and keeps hostile AI server-side', () => {
  const ctx = manager();
  const room = ctx.rooms.createRoom('host', { username: 'Alpha' }, { mode: 'multiplayer_pve', mapId: 'killhouse', timeLimit: 180 });
  ctx.rooms.joinRoom(room.code, 'guest', { username: 'Bravo' });
  ctx.rooms.startRoom(room.code, 'host');
  assert.ok(room.match.entities.some((entity) => entity.team === 'hostile' && entity.ai));
  const alpha = room.match.entities.find((entity) => entity.id === 'host');
  const bravo = room.match.entities.find((entity) => entity.id === 'guest');
  Object.assign(alpha, { x: 180, y: 180, angle: 0 });
  Object.assign(bravo, { x: 310, y: 180, health: 50, armor: 0, invulnerableUntil: 0 });
  ctx.rooms.receiveInput('host', { aimX: bravo.x, aimY: bravo.y, fire: true });
  for (let i = 0; i < 45; i += 1) ctx.rooms.tick(1 / 60);
  assert.equal(bravo.health, 50);
});

test('snapshots are player-specific and leaving cleans up rooms', () => {
  const ctx = manager();
  const room = ctx.rooms.createRoom('host');
  ctx.rooms.joinRoom(room.code, 'guest');
  ctx.rooms.startRoom(room.code, 'host');
  ctx.rooms.tick(1 / 60);
  const snapshot = ctx.rooms.snapshotFor(room, 'guest', ctx.rooms.consumeEvents(room));
  assert.equal(snapshot.playerId, 'guest');
  assert.equal(snapshot.entities.length, 2);
  ctx.rooms.leaveRoom('host');
  assert.equal(room.hostId, 'guest');
  ctx.rooms.leaveRoom('guest');
  assert.equal(ctx.rooms.getRoom(room.code), undefined);
});

test('rooms enforce the 5 player cap', () => {
  const ctx = manager();
  const room = ctx.rooms.createRoom('p1');
  for (let i = 2; i <= 5; i += 1) ctx.rooms.joinRoom(room.code, `p${i}`);
  assert.equal(room.players.size, 5);
  assert.throws(() => ctx.rooms.joinRoom(room.code, 'p6'), /full/);
});

test('settings and profile sanitizers choose safe defaults', () => {
  assert.deepEqual(sanitizeSettings({ mode: 'bad', mapId: 'bad', timeLimit: 9999 }), {
    mode: 'multiplayer_pvp',
    mapId: 'killhouse',
    timeLimit: 600
  });
  assert.deepEqual(sanitizeProfile({ username: '<Rogue>', color: 'red', loadoutId: 'bad' }), {
    username: 'Rogue',
    color: '#6fc6ff',
    loadoutId: 'rifleman',
    avatarUrl: '',
    captureTeam: 'auto'
  });
});
