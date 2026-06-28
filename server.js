const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

const players = new Map();
const enemies = [];

function getRoomName(socket) {
  return (socket.handshake.query?.room || "sala1").toString().trim() || "sala1";
}

function generateEnemies() {
  return Array.from({ length: Math.floor(Math.random() * 3) + 1 }, () => ({
    id: Math.random().toString(36).slice(2, 10),
    x: Math.random() * 600,
    y: Math.random() * 400,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    radius: 8,
    health: 20,
    maxHealth: 20,
  }));
}

function broadcastPlayers(roomName) {
  const roomPlayers = Array.from(players.values()).filter((player) => player.room === roomName);
  io.to(roomName).emit("players", { players: roomPlayers });
}

function getPlayerName(socket) {
  return socket.handshake.query?.name?.toString().trim() || `Jogador-${socket.id.slice(0, 5)}`;
}

app.use(express.static(path.join(__dirname)));
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "socket-game" });
});
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

io.on("connection", (socket) => {
  console.log(`Cliente conectado: ${socket.id}`);

  const playerName = getPlayerName(socket);
  const roomName = getRoomName(socket);

  socket.join(roomName);

  players.set(socket.id, {
    id: socket.id,
    name: playerName,
    room: roomName,
    x: Math.random() * 600,
    y: Math.random() * 400,
    angle: 0,
    score: 0,
    health: 100,
    maxHealth: 100,
  });

  socket.emit("playerAssigned", { id: socket.id, name: playerName, room: roomName });
  broadcastPlayers(roomName);

  socket.on("joinRoom", (data) => {
    const nextRoom = (data?.roomName || "sala1").toString().trim() || "sala1";
    const currentPlayer = players.get(socket.id);
    if (currentPlayer) {
      const previousRoom = currentPlayer.room;
      if (previousRoom && previousRoom !== nextRoom) {
        socket.leave(previousRoom);
      }
      currentPlayer.room = nextRoom;
      socket.join(nextRoom);
      socket.emit("playerAssigned", { id: socket.id, name: currentPlayer.name, room: nextRoom });
      broadcastPlayers(previousRoom);
      broadcastPlayers(nextRoom);
      socket.emit("message", { msg: `Você entrou na sala ${nextRoom}`, timestamp: new Date().toISOString() });
    }
  });

  socket.on("playerMove", (data) => {
    const player = players.get(socket.id);
    if (player) {
      player.x = data.x;
      player.y = data.y;
      player.angle = data.angle;
      player.score = data.score;
      broadcastPlayers(player.room);
    }
  });

  socket.on("shoot", (data) => {
    const player = players.get(socket.id);
    if (player) {
      socket.to(player.room).emit("playerShoot", {
        playerId: socket.id,
        x: data.x,
        y: data.y,
        angle: data.angle,
      });
    }
  });

  socket.on("enemyHit", (data) => {
    const player = players.get(socket.id);
    if (player) {
      player.score += data.score || 10;
      socket.emit("hit", { points: data.score || 10 });
      while (enemies.length < 5) {
        enemies.push(...generateEnemies());
      }
    }
  });

  socket.on("hello", (data) => {
    socket.emit("message", {
      msg: `Echo: ${data.msg}`,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("chatMessage", (data) => {
    const player = players.get(socket.id);
    const text = String(data?.text || "").trim();
    if (!text || !player) return;

    const message = {
      id: `${socket.id}-${Date.now()}`,
      playerId: socket.id,
      playerName: player.name,
      text,
      timestamp: new Date().toISOString(),
    };

    io.to(player.room).emit("chatMessage", message);
  });

  socket.on("disconnect", () => {
    const player = players.get(socket.id);
    players.delete(socket.id);
    if (player?.room) {
      broadcastPlayers(player.room);
    }
  });
});

setInterval(() => {
  for (const enemy of enemies) {
    enemy.x += enemy.vx;
    enemy.y += enemy.vy;
    if (enemy.x < 0 || enemy.x > 600) enemy.vx *= -1;
    if (enemy.y < 0 || enemy.y > 400) enemy.vy *= -1;
    enemy.x = Math.max(8, Math.min(592, enemy.x));
    enemy.y = Math.max(8, Math.min(392, enemy.y));
  }
  enemies.splice(0, Math.max(0, enemies.length - 10));
  while (enemies.length < 3) {
    enemies.push(...generateEnemies());
  }
  io.emit("enemies", { enemies });
}, 1000 / 30);

const PORT = process.env.PORT || 3000;
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const fallbackPort = 3001;
    console.log(`Porta ${PORT} ocupada. Tentando ${fallbackPort}...`);
    server.listen(fallbackPort, () => {
      console.log(`Servidor ativo em http://localhost:${fallbackPort}`);
    });
  } else {
    console.error(err);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`Servidor ativo em http://localhost:${PORT}`);
});
