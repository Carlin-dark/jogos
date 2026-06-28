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

function broadcastPlayers() {
  io.emit("players", { players: Array.from(players.values()) });
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

  players.set(socket.id, {
    id: socket.id,
    name: `Jogador-${socket.id.slice(0, 5)}`,
    x: Math.random() * 600,
    y: Math.random() * 400,
    angle: 0,
    score: 0,
    health: 100,
    maxHealth: 100,
  });

  broadcastPlayers();

  socket.on("playerMove", (data) => {
    const player = players.get(socket.id);
    if (player) {
      player.x = data.x;
      player.y = data.y;
      player.angle = data.angle;
      player.score = data.score;
    }
  });

  socket.on("shoot", (data) => {
    socket.broadcast.emit("playerShoot", {
      playerId: socket.id,
      x: data.x,
      y: data.y,
      angle: data.angle,
    });
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

  socket.on("disconnect", () => {
    players.delete(socket.id);
    broadcastPlayers();
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
