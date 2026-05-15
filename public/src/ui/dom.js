import { LOADOUTS, MODES, WEAPONS } from '../content/weapons.js';
import { MAPS } from '../content/maps.js';
import { getActiveAmmo, getActiveWeapon, getPlayer } from '../simulation/match.js';

const ROOM_MODES = [
  { id: 'multiplayer_pvp', name: 'Human PvP' },
  { id: 'multiplayer_pve', name: 'Co-op PvE' }
];
const elements = {};
let feedSignature = '';
let currentRoom = null;
let currentSocketId = null;
let localSelection = {
  mode: MODES[0].id,
  mapId: MAPS[0].id,
  loadoutId: LOADOUTS[0].id
};

export function initUI(callbacks) {
  cacheElements();
  populateRoomSelects();
  loadProfile();
  renderLocalOptions();

  elements.start.addEventListener('click', () => callbacks.onStart({ ...localSelection, playerName: getProfile().username, playerColor: getProfile().color }));
  elements.createRoom.addEventListener('click', () => callbacks.onCreateRoom({ profile: getProfile(), settings: getRoomSettings() }));
  elements.joinRoom.addEventListener('click', () => callbacks.onJoinRoom({ code: elements.roomCodeInput.value, profile: getProfile() }));
  elements.startRoom.addEventListener('click', () => currentRoom && callbacks.onStartRoom({ code: currentRoom.code }));
  elements.returnLobby.addEventListener('click', () => currentRoom && callbacks.onReturnRoomLobby({ code: currentRoom.code }));
  elements.leaveRoom.addEventListener('click', () => callbacks.onLeaveRoom());
  elements.resume.addEventListener('click', callbacks.onResume);
  elements.restart.addEventListener('click', callbacks.onRestart);
  elements.returnMenu.addEventListener('click', callbacks.onMenu);
  elements.resultMenu.addEventListener('click', callbacks.onMenu);
  elements.chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const message = elements.chatInput.value.trim();
    if (!message) return;
    callbacks.onSendChat(message);
    elements.chatInput.value = '';
  });

  for (const input of [elements.profileName, elements.profileColor, elements.roomLoadout]) {
    input.addEventListener('change', () => {
      saveProfile();
      callbacks.onProfileChange?.(getProfile());
    });
  }
  for (const input of [elements.roomMode, elements.roomMap, elements.roomTime]) {
    input.addEventListener('change', () => {
      if (currentRoom && currentRoom.hostId === currentSocketId && currentRoom.status === 'lobby') {
        callbacks.onUpdateRoomSettings({ code: currentRoom.code, settings: getRoomSettings() });
      }
    });
  }

  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  if (roomCode) elements.roomCodeInput.value = roomCode.toUpperCase();
}

export function getProfile() {
  cacheElements();
  return {
    username: elements.profileName.value.trim() || 'Operator',
    color: elements.profileColor.value || '#6fc6ff',
    loadoutId: elements.roomLoadout.value || localSelection.loadoutId
  };
}

export function setSocketStatus(status) {
  cacheElements();
  elements.socketStatus.textContent = `Socket: ${status}`;
}

export function setRoomState(room, socketId) {
  cacheElements();
  currentRoom = room;
  currentSocketId = socketId;
  if (!room) {
    elements.roomPanel.classList.add('is-hidden');
    elements.chatPanel.classList.add('is-hidden');
    return;
  }
  const isHost = room.hostId === socketId;
  elements.roomPanel.classList.toggle('is-hidden', room.status === 'playing');
  elements.chatPanel.classList.remove('is-hidden');
  elements.roomCodeLabel.textContent = room.code;
  elements.roomShareLink.textContent = `${window.location.origin}${room.sharePath}`;
  elements.roomMode.value = room.settings.mode;
  elements.roomMap.value = room.settings.mapId;
  elements.roomTime.value = room.settings.timeLimit === null ? 'none' : String(room.settings.timeLimit);
  for (const control of [elements.roomMode, elements.roomMap, elements.roomTime]) {
    control.disabled = !isHost || room.status !== 'lobby';
  }
  elements.startRoom.disabled = !isHost || room.status !== 'lobby';
  elements.returnLobby.disabled = !isHost || room.status !== 'playing';
  renderRoomPlayers(room.players);
  renderChat(room.chat);
}

export function appendChat(message) {
  cacheElements();
  if (!currentRoom) return;
  currentRoom.chat = [...(currentRoom.chat || []), message].slice(-50);
  renderChat(currentRoom.chat);
}

export function showError(error) {
  cacheElements();
  const message = typeof error === 'string' ? error : error?.message;
  if (!message) return;
  const line = document.createElement('div');
  line.className = 'feed-line';
  line.textContent = message;
  elements.feed.prepend(line);
}

export function showMenu() {
  cacheElements();
  elements.menu.classList.remove('is-hidden');
  elements.hud.classList.add('is-hidden');
  elements.pause.classList.add('is-hidden');
  elements.result.classList.add('is-hidden');
}

export function showGameHUD() {
  cacheElements();
  elements.menu.classList.add('is-hidden');
  elements.hud.classList.remove('is-hidden');
  elements.pause.classList.add('is-hidden');
  elements.result.classList.add('is-hidden');
  if (currentRoom?.status === 'playing') elements.roomPanel.classList.add('is-hidden');
}

export function setPaused(paused) {
  cacheElements();
  elements.pause.classList.toggle('is-hidden', !paused);
}

export function showResult(state) {
  cacheElements();
  elements.result.classList.remove('is-hidden');
  elements.pause.classList.add('is-hidden');
  const playerWon = state.objective.winner === state.playerId;
  elements.resultTitle.textContent = playerWon ? 'Mission Complete' : 'Operation Failed';
  const playerScore = state.score[state.playerId];
  elements.resultBody.textContent = `${state.endedReason} Kills: ${playerScore?.kills || 0}. Deaths: ${playerScore?.deaths || 0}.`;
}

export function updateHUD(state) {
  cacheElements();
  const player = getPlayer(state);
  if (!player) return;
  const weapon = getActiveWeapon(player);
  const ammo = getActiveAmmo(player);
  elements.healthFill.style.width = `${Math.round((player.health / player.maxHealth) * 100)}%`;
  elements.armorFill.style.width = `${Math.round((player.armor / Math.max(1, player.maxArmor + 35)) * 100)}%`;
  elements.weaponName.textContent = weapon.displayName;
  elements.ammoCount.textContent = ammo.reloadRemaining > 0
    ? `Reloading ${Math.ceil(ammo.reloadRemaining * 10) / 10}s`
    : `${ammo.mag} / ${ammo.reserve}`;
  elements.objectiveLabel.textContent = state.objective.label;
  elements.objectiveValue.textContent = state.objective.remaining === null
    ? 'No Limit'
    : state.mode.includes('pvp') ? formatTime(state.objective.remaining) : `${state.objective.remaining}`;
  elements.scoreValue.textContent = `${state.score[state.playerId]?.kills || 0}`;
  updateFeed(state);
  updateMinimap(state);
  updateScoreboard(state);
}

function renderLocalOptions() {
  renderOptions(elements.modeOptions, MODES, localSelection.mode, (mode) => {
    localSelection.mode = mode.id;
    renderLocalOptions();
  });
  renderOptions(elements.mapOptions, MAPS, localSelection.mapId, (map) => {
    localSelection.mapId = map.id;
    renderLocalOptions();
  });
  renderOptions(elements.loadoutOptions, LOADOUTS, localSelection.loadoutId, (loadout) => {
    localSelection.loadoutId = loadout.id;
    elements.roomLoadout.value = loadout.id;
    saveProfile();
    renderLocalOptions();
  });
}

function populateRoomSelects() {
  elements.roomMode.innerHTML = '';
  elements.roomMap.innerHTML = '';
  elements.roomLoadout.innerHTML = '';
  for (const mode of ROOM_MODES) addOption(elements.roomMode, mode.id, mode.name);
  for (const map of MAPS) addOption(elements.roomMap, map.id, map.name);
  for (const loadout of LOADOUTS) addOption(elements.roomLoadout, loadout.id, loadout.name);
}

function getRoomSettings() {
  return {
    mode: elements.roomMode.value,
    mapId: elements.roomMap.value,
    timeLimit: elements.roomTime.value === 'none' ? null : Number(elements.roomTime.value)
  };
}

function renderRoomPlayers(players = []) {
  elements.roomPlayers.innerHTML = '';
  for (const player of players) {
    const row = document.createElement('div');
    row.className = 'room-player';
    const name = document.createElement('span');
    const dot = document.createElement('i');
    dot.className = 'color-dot';
    dot.style.background = player.color;
    const strong = document.createElement('strong');
    strong.textContent = player.username;
    name.append(dot, strong);
    const meta = document.createElement('small');
    meta.textContent = player.isHost ? 'Host' : player.loadoutId;
    row.append(name, meta);
    elements.roomPlayers.append(row);
  }
}

function renderChat(messages = []) {
  elements.chatLog.innerHTML = '';
  for (const message of messages.slice(-50)) {
    const line = document.createElement('div');
    line.className = 'chat-line';
    const name = document.createElement('strong');
    name.textContent = `${message.username}: `;
    name.style.color = message.color || '#e9eee6';
    const text = document.createElement('span');
    text.textContent = message.message;
    line.append(name, text);
    elements.chatLog.append(line);
  }
  elements.chatLog.scrollTop = elements.chatLog.scrollHeight;
}

function updateFeed(state) {
  const signature = state.feed.map((line) => line.message).join('|');
  if (signature === feedSignature) return;
  feedSignature = signature;
  elements.feed.innerHTML = '';
  for (const line of state.feed.slice(0, 4)) {
    const div = document.createElement('div');
    div.className = 'feed-line';
    div.textContent = line.message;
    elements.feed.append(div);
  }
}

function updateMinimap(state) {
  const canvas = elements.minimap;
  const ctx = canvas.getContext('2d');
  const sx = canvas.width / state.map.width;
  const sy = canvas.height / state.map.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#151918';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(210, 216, 204, 0.18)';
  for (const rect of state.map.obstacles) ctx.fillRect(rect.x * sx, rect.y * sy, rect.w * sx, rect.h * sy);
  ctx.fillStyle = 'rgba(240, 82, 82, 0.4)';
  for (const hazard of state.map.hazards) ctx.fillRect(hazard.x * sx, hazard.y * sy, hazard.w * sx, hazard.h * sy);
  for (const entity of state.entities) {
    if (entity.dead) continue;
    ctx.fillStyle = entity.color || (entity.id === state.playerId ? '#6fc6ff' : '#efb64a');
    ctx.beginPath();
    ctx.arc(entity.x * sx, entity.y * sy, entity.id === state.playerId ? 3.5 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function updateScoreboard(state) {
  const ids = state.playerIds?.length ? state.playerIds : Object.keys(state.score);
  const rows = ids
    .map((id) => ({ id, ...(state.score[id] || {}) }))
    .filter((row) => row.name)
    .sort((a, b) => (b.kills || 0) - (a.kills || 0) || (a.deaths || 0) - (b.deaths || 0));
  elements.scoreboard.innerHTML = '';
  for (const row of rows.slice(0, 6)) {
    const div = document.createElement('div');
    div.className = 'score-row';
    const name = document.createElement('div');
    name.className = 'score-name';
    const dot = document.createElement('i');
    dot.className = 'color-dot';
    dot.style.background = row.color || '#d6f05f';
    const text = document.createElement('span');
    text.textContent = row.name;
    name.append(dot, text);
    const score = document.createElement('strong');
    score.textContent = `${row.kills || 0}/${row.deaths || 0}`;
    div.append(name, score);
    elements.scoreboard.append(div);
  }
}

function renderOptions(container, options, selectedId, onSelect) {
  container.innerHTML = '';
  for (const option of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `option-card ${option.id === selectedId ? 'is-selected' : ''}`;
    const detail = option.weapons
      ? option.weapons.map((id) => WEAPONS[id].displayName).join(' + ')
      : option.description;
    const title = document.createElement('strong');
    title.textContent = option.name;
    const text = document.createElement('span');
    text.textContent = detail;
    button.append(title, text);
    button.addEventListener('click', () => onSelect(option));
    container.append(button);
  }
}

function addOption(select, value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  select.append(option);
}

function loadProfile() {
  try {
    const profile = JSON.parse(localStorage.getItem('tacticalShooterProfile') || '{}');
    elements.profileName.value = profile.username || 'Operator';
    elements.profileColor.value = profile.color || '#6fc6ff';
    elements.roomLoadout.value = profile.loadoutId || localSelection.loadoutId;
  } catch {
    elements.profileName.value = 'Operator';
    elements.profileColor.value = '#6fc6ff';
  }
}

function saveProfile() {
  localStorage.setItem('tacticalShooterProfile', JSON.stringify(getProfile()));
}

function formatTime(value) {
  const seconds = Math.max(0, Math.ceil(value));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function cacheElements() {
  if (elements.menu) return;
  elements.menu = document.querySelector('#menu');
  elements.hud = document.querySelector('#hud');
  elements.pause = document.querySelector('#pause-panel');
  elements.result = document.querySelector('#result-panel');
  elements.modeOptions = document.querySelector('#mode-options');
  elements.mapOptions = document.querySelector('#map-options');
  elements.loadoutOptions = document.querySelector('#loadout-options');
  elements.start = document.querySelector('#start-match');
  elements.socketStatus = document.querySelector('#socket-status');
  elements.profileName = document.querySelector('#profile-name');
  elements.profileColor = document.querySelector('#profile-color');
  elements.roomCodeInput = document.querySelector('#room-code-input');
  elements.joinRoom = document.querySelector('#join-room');
  elements.createRoom = document.querySelector('#create-room');
  elements.roomPanel = document.querySelector('#room-panel');
  elements.roomCodeLabel = document.querySelector('#room-code-label');
  elements.roomShareLink = document.querySelector('#room-share-link');
  elements.roomMode = document.querySelector('#room-mode');
  elements.roomMap = document.querySelector('#room-map');
  elements.roomTime = document.querySelector('#room-time');
  elements.roomLoadout = document.querySelector('#room-loadout');
  elements.roomPlayers = document.querySelector('#room-players');
  elements.startRoom = document.querySelector('#start-room');
  elements.returnLobby = document.querySelector('#return-lobby');
  elements.leaveRoom = document.querySelector('#leave-room');
  elements.chatPanel = document.querySelector('#chat-panel');
  elements.chatLog = document.querySelector('#chat-log');
  elements.chatForm = document.querySelector('#chat-form');
  elements.chatInput = document.querySelector('#chat-input');
  elements.resume = document.querySelector('#resume-match');
  elements.restart = document.querySelector('#restart-match');
  elements.returnMenu = document.querySelector('#return-menu');
  elements.resultMenu = document.querySelector('#result-menu');
  elements.healthFill = document.querySelector('#health-fill');
  elements.armorFill = document.querySelector('#armor-fill');
  elements.weaponName = document.querySelector('#weapon-name');
  elements.ammoCount = document.querySelector('#ammo-count');
  elements.objectiveLabel = document.querySelector('#objective-label');
  elements.objectiveValue = document.querySelector('#objective-value');
  elements.scoreValue = document.querySelector('#score-value');
  elements.feed = document.querySelector('#feed');
  elements.minimap = document.querySelector('#minimap');
  elements.scoreboard = document.querySelector('#scoreboard');
  elements.resultTitle = document.querySelector('#result-title');
  elements.resultBody = document.querySelector('#result-body');
}
