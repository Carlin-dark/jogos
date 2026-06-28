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

const rooms = new Map();
const WORLD = { width: 1200, height: 800 };
const KILL_TARGET = 20;
const STARTING_ENEMIES = 8;

function getRoomName(socket) {
  return (socket.handshake.query?.room || "sala1").toString().trim() || "sala1";
}

function getPlayerName(socket) {
  return socket.handshake.query?.name?.toString().trim() || `Jogador-${socket.id.slice(0, 5)}`;
}

function createObstacles() {
  return [
    { x: 220, y: 180, w: 140, h: 40 },
    { x: 560, y: 120, w: 80, h: 120 },
    { x: 820, y: 280, w: 140, h: 50 },
    { x: 300, y: 520, w: 180, h: 40 },
    { x: 860, y: 620, w: 120, h: 80 },
  ];
}

function createRoomState(roomName) {
  return {
    name: roomName,
    players: new Map(),
    enemies: [],
    bullets: [],
    obstacles: createObstacles(),
    winner: null,
  };
}

function getRoomState(roomName) {
  if (!rooms.has(roomName)) {
    rooms.set(roomName, createRoomState(roomName));
  }
  return rooms.get(roomName);
}

function spawnEnemies(room) {
  while (room.enemies.length < STARTING_ENEMIES) {
    room.enemies.push({
      id: `${room.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      x: 80 + Math.random() * (WORLD.width - 160),
      y: 80 + Math.random() * (WORLD.height - 160),
      vx: (Math.random() - 0.5) * 2.2,
      vy: (Math.random() - 0.5) * 2.2,
      radius: 10,
      health: 30,
      maxHealth: 30,
    });
  }
}

function emitRoomState(room) {
  if (!room) return;

  const players = Array.from(room.players.values()).map((player) => ({
    ...player,
    score: player.score || player.kills || 0,
  }));

  io.to(room.name).emit("gameState", {
    room: room.name,
    players,
    enemies: room.enemies,
    bullets: room.bullets,
    obstacles: room.obstacles,
    winner: room.winner,
  });
}

function collideWithObstacle(x, y, radius) {
  return false;
}

function resolvePosition(room, player) {
  const radius = 10;
  const nextX = Math.max(radius, Math.min(WORLD.width - radius, player.x));
  const nextY = Math.max(radius, Math.min(WORLD.height - radius, player.y));

  for (const obstacle of room.obstacles) {
    if (
      nextX + radius > obstacle.x &&
      nextX - radius < obstacle.x + obstacle.w &&
      nextY + radius > obstacle.y &&
      nextY - radius < obstacle.y + obstacle.h
    ) {
      return { x: player.x, y: player.y };
    }
  }

  return { x: nextX, y: nextY };
}

function applyDamage(room, player, amount, sourceId) {
  if (!player || !player.alive) return;

  player.health = Math.max(0, player.health - amount);
  if (player.health <= 0) {
    player.alive = false;
    player.deaths = (player.deaths || 0) + 1;
    player.respawnTimer = 180;
    player.health = 0;

    if (sourceId && sourceId !== player.id) {
      const killer = room.players.get(sourceId);
      if (killer && killer.alive) {
        killer.kills = (killer.kills || 0) + 1;
        killer.score = killer.kills;
        if (killer.kills >= KILL_TARGET) {
          room.winner = {
            id: killer.id,
            name: killer.name,
            kills: killer.kills,
          };
          io.to(room.name).emit("message", { msg: `${killer.name} venceu matando ${killer.kills} monstros!`, timestamp: new Date().toISOString() });
        }
      }
    }
  }
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
  const room = getRoomState(roomName);

  socket.join(roomName);

  room.players.set(socket.id, {
    id: socket.id,
    name: playerName,
    room: roomName,
    x: 100 + Math.random() * 200,
    y: 100 + Math.random() * 200,
    angle: 0,
    score: 0,
    kills: 0,
    deaths: 0,
    health: 100,
    maxHealth: 100,
    alive: true,
    respawnTimer: 0,
  });

  spawnEnemies(room);
  socket.emit("playerAssigned", { id: socket.id, name: playerName, room: roomName });
  emitRoomState(room);

  socket.on("joinRoom", (data) => {
    const nextRoom = (data?.roomName || "sala1").toString().trim() || "sala1";
    const currentPlayer = room.players.get(socket.id);
    if (!currentPlayer) return;

    const previousRoomName = currentPlayer.room;
    if (previousRoomName && previousRoomName !== nextRoom) {
      socket.leave(previousRoomName);
      const previousRoom = rooms.get(previousRoomName);
      if (previousRoom) {
        previousRoom.players.delete(socket.id);
        emitRoomState(previousRoom);
      }
    }

    currentPlayer.room = nextRoom;
    socket.join(nextRoom);
    const nextRoomState = getRoomState(nextRoom);
    nextRoomState.players.set(socket.id, currentPlayer);
    socket.emit("playerAssigned", { id: socket.id, name: currentPlayer.name, room: nextRoom });
    spawnEnemies(nextRoomState);
    emitRoomState(nextRoomState);
    socket.emit("message", { msg: `Você entrou na sala ${nextRoom}`, timestamp: new Date().toISOString() });
  });

  socket.on("playerMove", (data) => {
    const player = room.players.get(socket.id);
    if (player && player.alive) {
      player.x = data.x;
      player.y = data.y;
      player.angle = data.angle;
      player.score = player.kills || 0;

      const resolved = resolvePosition(room, player);
      player.x = resolved.x;
      player.y = resolved.y;
    }
  });

  socket.on("shoot", (data) => {
    const player = room.players.get(socket.id);
    if (player && player.alive) {
      room.bullets.push({
        id: `${socket.id}-${Date.now()}`,
        ownerId: socket.id,
        x: data.x,
        y: data.y,
        vx: Math.cos(data.angle || 0) * 9,
        vy: Math.sin(data.angle || 0) * 9,
        radius: 4,
        life: 90,
      });
    }
  });

  socket.on("hello", (data) => {
    socket.emit("message", {
      msg: `Echo: ${data.msg}`,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("chatMessage", (data) => {
    const player = room.players.get(socket.id);
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
    const player = room.players.get(socket.id);
    if (player) {
      room.players.delete(socket.id);
      emitRoomState(room);
    }
  });
});

setInterval(() => {
  for (const room of rooms.values()) {
    if (room.winner) {
      emitRoomState(room);
      continue;
    }

    spawnEnemies(room);

    for (const player of room.players.values()) {
      if (!player.alive) {
        player.respawnTimer = Math.max(0, player.respawnTimer - 1);
        if (player.respawnTimer <= 0) {
          player.alive = true;
          player.health = player.maxHealth;
          player.x = 100 + Math.random() * 200;
          player.y = 100 + Math.random() * 200;
        }
      }
    }

    for (const enemy of room.enemies) {
      enemy.x += enemy.vx;
      enemy.y += enemy.vy;

      if (enemy.x < 10 || enemy.x > WORLD.width - 10) enemy.vx *= -1;
      if (enemy.y < 10 || enemy.y > WORLD.height - 10) enemy.vy *= -1;
      enemy.x = Math.max(10, Math.min(WORLD.width - 10, enemy.x));
      enemy.y = Math.max(10, Math.min(WORLD.height - 10, enemy.y));

      for (const player of room.players.values()) {
        if (!player.alive) continue;
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < enemy.radius + 10) {
          applyDamage(room, player, 8, "enemy");
        }
      }
    }

    for (let i = room.bullets.length - 1; i >= 0; i--) {
      const bullet = room.bullets[i];
      bullet.x += bullet.vx;
      bullet.y += bullet.vy;
      bullet.life -= 1;

      if (bullet.life <= 0 || bullet.x < 0 || bullet.x > WORLD.width || bullet.y < 0 || bullet.y > WORLD.height) {
        room.bullets.splice(i, 1);
        continue;
      }

      for (let j = room.enemies.length - 1; j >= 0; j--) {
        const enemy = room.enemies[j];
        const dx = bullet.x - enemy.x;
        const dy = bullet.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bullet.radius + enemy.radius) {
          enemy.health -= 18;
          room.bullets.splice(i, 1);
          if (enemy.health <= 0) {
            room.enemies.splice(j, 1);
            const shooter = room.players.get(bullet.ownerId);
            if (shooter && shooter.alive) {
              shooter.kills = (shooter.kills || 0) + 1;
              shooter.score = shooter.kills;
              if (shooter.kills >= KILL_TARGET) {
                room.winner = { id: shooter.id, name: shooter.name, kills: shooter.kills };
                io.to(room.name).emit("message", { msg: `${shooter.name} venceu matando ${shooter.kills} monstros!`, timestamp: new Date().toISOString() });
              }
            }
          }
          break;
        }
      }

      if (room.bullets[i]) {
        for (const player of room.players.values()) {
          if (player.id === bullet.ownerId || !player.alive) continue;
          const dx = bullet.x - player.x;
          const dy = bullet.y - player.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < bullet.radius + 10) {
            applyDamage(room, player, 12, bullet.ownerId);
            room.bullets.splice(i, 1);
            break;
          }
        }
      }
    }

    while (room.enemies.length < STARTING_ENEMIES) {
      spawnEnemies(room);
    }

    emitRoomState(room);
  }
}, 1000 / 30);

const PORT = process.env.PORT || 3000;
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
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
