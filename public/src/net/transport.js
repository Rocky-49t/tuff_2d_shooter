export function createTransport() {
  if (typeof window === 'undefined' || typeof window.io !== 'function') {
    return createLocalTransport('Socket.IO client unavailable');
  }

  const socket = window.io({ transports: ['websocket', 'polling'] });
  const listeners = {
    status: new Set(),
    room: new Set(),
    snapshot: new Set(),
    chat: new Set(),
    error: new Set(),
    ended: new Set(),
    left: new Set()
  };
  let status = 'connecting';
  let roomState = null;

  socket.on('connect', () => setStatus('online'));
  socket.on('disconnect', () => setStatus('offline'));
  socket.on('connect_error', () => setStatus('offline'));
  socket.on('server:hello', () => notify('status', status));
  socket.on('room:state', (state) => {
    roomState = state;
    notify('room', state);
  });
  socket.on('room:left', () => {
    roomState = null;
    notify('left', null);
  });
  socket.on('match:snapshot', (snapshot) => notify('snapshot', snapshot));
  socket.on('chat:message', (message) => notify('chat', message));
  socket.on('error:message', (error) => notify('error', error));
  socket.on('match:ended', (payload) => notify('ended', payload));

  return {
    kind: 'socket',
    id: () => socket.id,
    getStatus: () => status,
    getRoomState: () => roomState,
    onStatus: (listener) => subscribe('status', listener, status),
    onRoomState: (listener) => subscribe('room', listener, roomState),
    onSnapshot: (listener) => subscribe('snapshot', listener),
    onChat: (listener) => subscribe('chat', listener),
    onError: (listener) => subscribe('error', listener),
    onEnded: (listener) => subscribe('ended', listener),
    onLeft: (listener) => subscribe('left', listener),
    createRoom(payload) {
      return request('room:create', payload);
    },
    joinRoom(payload) {
      return request('room:join', payload);
    },
    updateSettings(payload) {
      return request('room:updateSettings', payload);
    },
    setProfile(payload) {
      return request('room:setProfile', payload);
    },
    startRoom(payload) {
      return request('room:start', payload);
    },
    returnLobby(payload) {
      return request('room:returnLobby', payload);
    },
    leaveRoom(payload = {}) {
      return request('room:leave', payload);
    },
    sendInput(input) {
      socket.emit('player:input', input);
    },
    sendChat(message) {
      return request('chat:send', { message });
    }
  };

  function request(event, payload) {
    return new Promise((resolve) => {
      socket.emit(event, payload, (response) => {
        if (response && !response.ok) notify('error', response);
        resolve(response || { ok: false, message: 'No response from server.' });
      });
    });
  }

  function setStatus(next) {
    status = next;
    notify('status', status);
  }

  function subscribe(type, listener, initial) {
    listeners[type].add(listener);
    if (initial !== undefined && initial !== null) listener(initial);
    return () => listeners[type].delete(listener);
  }

  function notify(type, payload) {
    for (const listener of listeners[type]) listener(payload);
  }
}

function createLocalTransport(reason) {
  const noop = () => () => {};
  return {
    kind: 'local',
    id: () => null,
    getStatus: () => `local (${reason})`,
    getRoomState: () => null,
    onStatus(listener) {
      listener(`local (${reason})`);
      return () => {};
    },
    onRoomState: noop,
    onSnapshot: noop,
    onChat: noop,
    onError: noop,
    onEnded: noop,
    onLeft: noop,
    createRoom: async () => ({ ok: false, message: reason }),
    joinRoom: async () => ({ ok: false, message: reason }),
    updateSettings: async () => ({ ok: false, message: reason }),
    setProfile: async () => ({ ok: false, message: reason }),
    startRoom: async () => ({ ok: false, message: reason }),
    returnLobby: async () => ({ ok: false, message: reason }),
    leaveRoom: async () => ({ ok: false, message: reason }),
    sendInput() {},
    sendChat: async () => ({ ok: false, message: reason })
  };
}
