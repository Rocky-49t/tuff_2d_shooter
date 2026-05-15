import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');
const port = Number(process.env.PORT || 3000);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

const lobbies = new Map();

app.use(express.static(publicDir));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    game: 'tactical-2d-shooter',
    socketClients: io.engine.clientsCount
  });
});

io.on('connection', (socket) => {
  socket.emit('server:hello', {
    id: socket.id,
    message: 'Socket transport ready. Gameplay is local-authoritative in v1.'
  });

  socket.on('lobby:join', ({ playerName = 'Operator', mode = 'pve_elimination' } = {}) => {
    const lobbyId = `${mode}:default`;
    const lobby = lobbies.get(lobbyId) || { id: lobbyId, mode, players: new Map() };
    lobby.players.set(socket.id, { id: socket.id, playerName });
    lobbies.set(lobbyId, lobby);
    socket.join(lobbyId);
    io.to(lobbyId).emit('lobby:update', {
      id: lobbyId,
      mode,
      players: [...lobby.players.values()]
    });
  });

  socket.on('match:intent', (payload = {}) => {
    socket.emit('match:ack', {
      accepted: true,
      receivedAt: Date.now(),
      payload
    });
  });

  socket.on('disconnect', () => {
    for (const [lobbyId, lobby] of lobbies) {
      if (!lobby.players.delete(socket.id)) continue;
      io.to(lobbyId).emit('lobby:update', {
        id: lobbyId,
        mode: lobby.mode,
        players: [...lobby.players.values()]
      });
      if (lobby.players.size === 0) lobbies.delete(lobbyId);
    }
  });
});

server.listen(port, () => {
  console.log(`Tactical 2D Shooter running at http://localhost:${port}`);
});
