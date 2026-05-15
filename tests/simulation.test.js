import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAPS } from '../public/src/content/maps.js';
import { createMatch, getActiveAmmo, getPlayer, makeInput, updateMatch } from '../public/src/simulation/match.js';
import { circleIntersectsRect, pointInRect } from '../public/src/simulation/math.js';

test('shooting creates visible bullets and spends magazine ammo', () => {
  const state = createMatch({ mode: 'pve_elimination', mapId: 'killhouse', loadoutId: 'rifleman', seed: 'shooting' });
  const player = getPlayer(state);
  const ammoBefore = getActiveAmmo(player).mag;
  updateMatch(state, makeInput({ aimX: player.x + 200, aimY: player.y, fire: true }), 1 / 60);
  assert.equal(getActiveAmmo(player).mag, ammoBefore - 1);
  assert.ok(state.bullets.length > 0);
});

test('reload transfers reserve ammo back into the magazine', () => {
  const state = createMatch({ mode: 'pve_elimination', mapId: 'killhouse', loadoutId: 'rifleman', seed: 'reload' });
  const player = getPlayer(state);
  const ammo = getActiveAmmo(player);
  ammo.mag = 5;
  const reserveBefore = ammo.reserve;
  updateMatch(state, makeInput({ aimX: player.x + 1, aimY: player.y, reload: true }), 1 / 60);
  for (let i = 0; i < 120; i += 1) updateMatch(state, makeInput({ aimX: player.x + 1, aimY: player.y }), 1 / 60);
  assert.equal(ammo.mag, 30);
  assert.equal(ammo.reserve, reserveBefore - 25);
});

test('PvE elimination completes when the last hostile is killed', () => {
  const state = createMatch({ mode: 'pve_elimination', mapId: 'killhouse', loadoutId: 'recon', seed: 'pve-complete' });
  const player = getPlayer(state);
  const hostile = state.entities.find((entity) => entity.team === 'hostile');
  state.entities = [player, hostile];
  hostile.x = player.x + 140;
  hostile.y = player.y;
  hostile.health = 1;
  hostile.armor = 0;
  hostile.invulnerableUntil = 0;
  player.angle = 0;
  updateMatch(state, makeInput({ aimX: hostile.x, aimY: hostile.y, fire: true }), 1 / 60);
  for (let i = 0; i < 30; i += 1) updateMatch(state, makeInput({ aimX: hostile.x, aimY: hostile.y }), 1 / 60);
  assert.equal(hostile.dead, true);
  assert.equal(state.phase, 'complete');
  assert.equal(state.objective.winner, state.playerId);
});

test('PvP kills increase score and respawn bots', () => {
  const state = createMatch({ mode: 'pvp_deathmatch', mapId: 'metro_station', loadoutId: 'recon', seed: 'pvp-respawn' });
  const player = getPlayer(state);
  const bot = state.entities.find((entity) => entity.id !== state.playerId);
  state.entities = [player, bot];
  bot.x = player.x + 140;
  bot.y = player.y;
  bot.health = 1;
  bot.armor = 0;
  bot.invulnerableUntil = 0;
  player.angle = 0;
  updateMatch(state, makeInput({ aimX: bot.x, aimY: bot.y, fire: true }), 1 / 60);
  for (let i = 0; i < 30; i += 1) updateMatch(state, makeInput({ aimX: bot.x, aimY: bot.y }), 1 / 60);
  assert.equal(state.score[state.playerId].kills, 1);
  assert.equal(bot.dead, true);
  for (let i = 0; i < 180; i += 1) updateMatch(state, makeInput({ aimX: player.x + 1, aimY: player.y }), 1 / 60);
  assert.equal(bot.dead, false);
});

test('spawn positions stay inside bounds and outside blockers or hazards', () => {
  for (const map of MAPS) {
    for (const mode of ['pve_elimination', 'pvp_deathmatch']) {
      const state = createMatch({ mode, mapId: map.id, loadoutId: 'rifleman', seed: `${map.id}:${mode}:spawn` });
      for (const entity of state.entities) {
        assert.ok(entity.x > entity.radius && entity.x < state.map.width - entity.radius);
        assert.ok(entity.y > entity.radius && entity.y < state.map.height - entity.radius);
        assert.equal(state.map.obstacles.some((rect) => circleIntersectsRect(entity, rect)), false);
        assert.equal(state.map.hazards.some((rect) => pointInRect(entity, rect)), false);
      }
    }
  }
});
