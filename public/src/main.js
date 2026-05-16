import { GameScene } from './phaser/GameScene.js';
import { createTransport } from './net/transport.js';
import {
  appendChat,
  getProfile,
  initUI,
  setRoomState,
  setSocketStatus,
  showError,
  showMenu
} from './ui/dom.js';
import { unlockAudio } from './ui/audio.js';

const transport = createTransport();
let currentRoom = null;
let autoJoinAttempted = false;

transport.onStatus((status) => {
  setSocketStatus(status);
  const roomCode = new URLSearchParams(window.location.search).get('room');
  if (status === 'online' && roomCode && !autoJoinAttempted) {
    autoJoinAttempted = true;
    transport.joinRoom({ code: roomCode, profile: getProfile() });
  }
});
transport.onRoomState((room) => {
  currentRoom = room;
  setRoomState(room, transport.id());
  if (room?.status === 'lobby') {
    window.dispatchEvent(new Event('multiplayer:left'));
    showMenu();
    window.history.replaceState(null, '', room.sharePath);
  }
});
transport.onSnapshot((snapshot) => {
  unlockAudio();
  window.dispatchEvent(new CustomEvent('multiplayer:snapshot', { detail: snapshot }));
});
transport.onChat(appendChat);
transport.onError(showError);
transport.onLeft(() => {
  currentRoom = null;
  setRoomState(null, transport.id());
  showMenu();
  window.history.replaceState(null, '', window.location.pathname);
  window.dispatchEvent(new Event('multiplayer:left'));
});

window.addEventListener('multiplayer:input', (event) => {
  transport.sendInput(event.detail);
});

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-host',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#101312',
  input: {
    keyboard: {
      capture: []
    }
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    parent: 'game-host',
    width: '100%',
    height: '100%'
  },
  physics: {
    default: 'arcade'
  },
  scene: [GameScene]
});

initUI({
  onStart(selection) {
    unlockAudio();
    window.dispatchEvent(new CustomEvent('match:start', { detail: selection }));
  },
  async onCreateRoom(payload) {
    const response = await transport.createRoom(payload);
    if (response?.room) window.history.replaceState(null, '', response.room.sharePath);
  },
  async onJoinRoom(payload) {
    const response = await transport.joinRoom(payload);
    if (response?.room) window.history.replaceState(null, '', response.room.sharePath);
  },
  onUpdateRoomSettings(payload) {
    transport.updateSettings(payload);
  },
  onStartRoom(payload) {
    unlockAudio();
    transport.startRoom(payload);
  },
  onReturnRoomLobby(payload) {
    transport.returnLobby(payload);
  },
  onLeaveRoom() {
    transport.leaveRoom();
  },
  onSendChat(message) {
    transport.sendChat(message);
  },
  onProfileChange(profile) {
    if (currentRoom) transport.setProfile({ profile });
  },
  onResume() {
    window.dispatchEvent(new Event('match:resume'));
  },
  onRestart() {
    unlockAudio();
    if (currentRoom?.status === 'playing' && currentRoom.hostId === transport.id()) {
      transport.startRoom({ code: currentRoom.code });
      return;
    }
    window.dispatchEvent(new Event('match:restart'));
  },
  onMenu() {
    if (currentRoom?.status === 'playing') {
      if (currentRoom.hostId === transport.id()) transport.returnLobby({ code: currentRoom.code });
      else transport.leaveRoom();
      return;
    }
    showMenu();
    window.dispatchEvent(new Event('match:menu'));
  }
});

window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});
