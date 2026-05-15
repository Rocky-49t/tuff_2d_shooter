import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { createRoomManager } from './server/rooms.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');
const port = Number(process.env.PORT || 3000);
const fixedDt = 1 / 60;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});
const roomManager = createRoomManager();

app.use(express.static(publicDir));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    game: 'tactical-2d-shooter',
    socketClients: io.engine.clientsCount,
    ...roomManager.health()
  });
});

io.on('connection', (socket) => {
  socket.emit('server:hello', {
    id: socket.id,
    message: 'Server-authoritative multiplayer ready.'
  });

  socket.on('room:create', (payload = {}, ack) => {
    respond(socket, ack, () => {
      leaveCurrentSocketRoom(socket);
      const room = roomManager.createRoom(socket.id, payload.profile, payload.settings);
      socket.join(channel(room.code));
      emitRoomState(room);
      return { room: roomManager.publicRoomState(room) };
    });
  });

  socket.on('room:join', (payload = {}, ack) => {
    respond(socket, ack, () => {
      leaveCurrentSocketRoom(socket);
      const room = roomManager.joinRoom(payload.code, socket.id, payload.profile);
      socket.join(channel(room.code));
      emitRoomState(room);
      return { room: roomManager.publicRoomState(room) };
    });
  });

  socket.on('room:updateSettings', (payload = {}, ack) => {
    respond(socket, ack, () => {
      const room = roomManager.updateSettings(payload.code, socket.id, payload.settings);
      emitRoomState(room);
      return { room: roomManager.publicRoomState(room) };
    });
  });

  socket.on('room:setProfile', (payload = {}, ack) => {
    respond(socket, ack, () => {
      const room = roomManager.setProfile(socket.id, payload.profile);
      emitRoomState(room);
      return { room: roomManager.publicRoomState(room) };
    });
  });

  socket.on('room:start', (payload = {}, ack) => {
    respond(socket, ack, () => {
      const room = roomManager.startRoom(payload.code, socket.id);
      emitRoomState(room);
      emitSnapshots(room, roomManager.consumeEvents(room));
      return { room: roomManager.publicRoomState(room) };
    });
  });

  socket.on('room:returnLobby', (payload = {}, ack) => {
    respond(socket, ack, () => {
      const room = roomManager.returnToLobby(payload.code, socket.id);
      emitRoomState(room);
      return { room: roomManager.publicRoomState(room) };
    });
  });

  socket.on('room:leave', (_payload = {}, ack) => {
    respond(socket, ack, () => {
      const previous = roomManager.getRoomByPlayer(socket.id);
      if (previous) socket.leave(channel(previous.code));
      const room = roomManager.leaveRoom(socket.id);
      if (room) emitRoomState(room);
      socket.emit('room:left');
      return { left: true };
    });
  });

  socket.on('player:input', (payload = {}) => {
    roomManager.receiveInput(socket.id, payload);
  });

  socket.on('chat:send', (payload = {}, ack) => {
    respond(socket, ack, () => {
      const { room, chat } = roomManager.sendChat(socket.id, payload.message);
      io.to(channel(room.code)).emit('chat:message', chat);
      emitRoomState(room);
      return { chat };
    });
  });

  socket.on('disconnect', () => {
    const previous = roomManager.getRoomByPlayer(socket.id);
    const room = roomManager.leaveRoom(socket.id);
    if (previous) socket.leave(channel(previous.code));
    if (room) emitRoomState(room);
  });
});

setInterval(() => {
  const { snapshotRooms, endedRooms } = roomManager.tick(fixedDt);
  for (const room of snapshotRooms) emitSnapshots(room, roomManager.consumeEvents(room));
  for (const room of endedRooms) {
    io.to(channel(room.code)).emit('match:ended', {
      reason: room.match.endedReason,
      winner: room.match.objective.winner
    });
    emitRoomState(room);
  }
}, fixedDt * 1000).unref?.();

server.listen(port, () => {
  console.log(`Tactical 2D Shooter running at http://localhost:${port}`);
});

function emitSnapshots(room, events = []) {
  if (!room.match) return;
  for (const player of room.players.values()) {
    io.to(player.id).emit('match:snapshot', roomManager.snapshotFor(room, player.id, events));
  }
}

function emitRoomState(room) {
  io.to(channel(room.code)).emit('room:state', roomManager.publicRoomState(room));
}

function respond(socket, ack, handler) {
  try {
    const result = { ok: true, ...handler() };
    if (typeof ack === 'function') ack(result);
    return result;
  } catch (error) {
    const payload = { ok: false, message: error.message || 'Something went wrong.' };
    socket.emit('error:message', payload);
    if (typeof ack === 'function') ack(payload);
    return payload;
  }
}

function leaveCurrentSocketRoom(socket) {
  const previous = roomManager.getRoomByPlayer(socket.id);
  if (!previous) return;
  socket.leave(channel(previous.code));
  const room = roomManager.leaveRoom(socket.id);
  if (room) emitRoomState(room);
}

function channel(code) {
  return `room:${code}`;
}
