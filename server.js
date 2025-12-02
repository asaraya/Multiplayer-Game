const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

const http = require('http');
const { type } = require('os');
const { emit } = require('process');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, { pingInterval: 2000, pingTimeout: 5000 });

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// =========================================================
//                SALAS DINÁMICAS (WAITING ROOMS)
// =========================================================
const MAX_PLAYERS_PER_ROOM = 4;
const MIN_PLAYERS_TO_START = 2;

const rooms = {}; // roomId -> roomState
let nextRoomId = 1;

function getRoomStatePayload(room) {
  return {
    roomId: room.id,
    hostId: room.hostId,
    started: room.started,
    playerCount: room.sockets.size,
    minPlayersToStart: MIN_PLAYERS_TO_START,
    maxPlayers: MAX_PLAYERS_PER_ROOM,
  };
}

function createRoom() {
  const id = `room-${nextRoomId++}`;

  const activeMap = createMap(Date.now() + nextRoomId);

  const room = {
    id,
    hostId: null,
    sockets: new Set(),
    started: false,

    // Estado del juego por sala (match aislado)
    activeMap,
    powerUps: activeMap.powerUps,
    obstacles: activeMap.obstacles,
    walls: activeMap.walls,

    players: {},       // socketId -> player
    projectiles: {},   // projectileId -> projectile
    projectileId: 0,
  };

  rooms[id] = room;

  console.log(`[ROOM] creada ${id} | MAPA: ${activeMap.name} (seed ${activeMap.seed}) ${activeMap.width}x${activeMap.height}`);
  return room;
}

function findRoomForNewPlayer() {
  // Busca sala NO iniciada con espacio
  for (const id in rooms) {
    const room = rooms[id];
    if (!room.started && room.sockets.size < MAX_PLAYERS_PER_ROOM) return room;
  }
  return createRoom();
}

function emitRoomState(room) {
  io.to(room.id).emit('roomState', getRoomStatePayload(room));
}

function removePlayerFromRoom(roomId, socketId) {
  const room = rooms[roomId];
  if (!room) return;

  room.sockets.delete(socketId);
  delete room.players[socketId];

  // Reasignar host si el host se fue
  if (room.hostId === socketId) {
    const newHost = room.sockets.values().next().value || null;
    room.hostId = newHost;
    if (newHost) {
      io.to(newHost).emit('roomInfo', {
        roomId: room.id,
        isHost: true,
        minPlayersToStart: MIN_PLAYERS_TO_START,
        maxPlayers: MAX_PLAYERS_PER_ROOM,
      });
    }
  }

  // Si la sala queda vacía, se elimina
  if (room.sockets.size === 0) {
    delete rooms[roomId];
    console.log(`[ROOM] eliminada ${roomId}`);
    return;
  }

  // Avisar cambios
  io.to(roomId).emit('playersUpdate', room.players);
  emitRoomState(room);
}

// =========================================================

const projectiles = {}; // (YA NO SE USA GLOBALMENTE, pero lo dejo para no romper imports)
let projectileId = 0;  // (YA NO SE USA GLOBALMENTE, pero lo dejo para no romper imports)

//Tamaño del mapa
const MAP_WIDTH = 1200;
const MAP_HEIGHT = 700;

const POWERUP_TYPES = [
  { type: 'extraLife', radius: 5 },
  { type: 'extraBullets', radius: 5 },
];

const OBSTACLE_TYPES = [
  { type: 'asteroid', radius: 5 },
  { type: 'alien', radius: 5 },
  { type: 'slowTrap', radius: 5 }
];

// Variantes de mapa, se pueden poner más si se quiere
const MAP_VARIANTS = [
  { name: 'Cinturon de asteroides', powerUps: 8, obstacles: 14, walls: 4 },
  { name: 'Anillo helado', powerUps: 10, obstacles: 10, walls: 5 },
  { name: 'Ruinas alien', powerUps: 12, obstacles: 12, walls: 6 },
];

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function randomInMap(limit, rand, padding = 40) {
  const safeLimit = Math.max(limit - padding * 2, 0);
  return padding + safeLimit * rand();
}

function randomPointAvoidingWalls(width, height, radius, randFn, wallCollection = {}) {
  let attempts = 0;
  const availableWalls = wallCollection || {};
  while (attempts < 10) {
    const x = randomInMap(width, randFn);
    const y = randomInMap(height, randFn);
    const collides = Object.values(availableWalls).some((wall) =>
      circleIntersectsRect(x, y, radius, wall)
    );
    if (!collides) {
      return { x, y };
    }
    attempts++;
  }
  return { x: randomInMap(width, randFn), y: randomInMap(height, randFn) };
}

function createMap(seed = Date.now()) {
  const rand = mulberry32(seed);
  const variant = MAP_VARIANTS[Math.floor(rand() * MAP_VARIANTS.length)];
  const map = {
    name: variant.name,
    seed,
    id: seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    powerUps: {},
    obstacles: {},
    walls: {},
    nextPowerUpId: 0,
    nextObstacleId: 0,
    nextWallId: 0
  };

  for (let i = 0; i < variant.walls; i++) {
    const isHorizontal = rand() > 0.5;
    const length = isHorizontal
      ? map.width * 0.25 + map.width * 0.15 * rand()
      : map.height * 0.25 + map.height * 0.15 * rand();
    const thickness = 30 + 20 * rand();
    map.walls[map.nextWallId] = {
      x: randomInMap(map.width, rand),
      y: randomInMap(map.height, rand),
      width: isHorizontal ? length : thickness,
      height: isHorizontal ? thickness : length,
      type: 'wall'
    };
    map.nextWallId++;
  }

  for (let i = 0; i < variant.powerUps; i++) {
    const chosen = POWERUP_TYPES[Math.floor(rand() * POWERUP_TYPES.length)];
    const point = randomPointAvoidingWalls(map.width, map.height, chosen.radius, rand, map.walls);
    map.powerUps[map.nextPowerUpId] = {
      x: point.x,
      y: point.y,
      radius: chosen.radius,
      type: chosen.type
    };
    map.nextPowerUpId++;
  }

  for (let i = 0; i < variant.obstacles; i++) {
    const chosen = OBSTACLE_TYPES[Math.floor(rand() * OBSTACLE_TYPES.length)];
    const point = randomPointAvoidingWalls(map.width, map.height, chosen.radius, rand, map.walls);
    map.obstacles[map.nextObstacleId] = {
      x: point.x,
      y: point.y,
      radius: chosen.radius,
      type: chosen.type
    };
    map.nextObstacleId++;
  }

  return map;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function circleIntersectsRect(px, py, radius, rect) {
  const closestX = clamp(px, rect.x - rect.width / 2, rect.x + rect.width / 2);
  const closestY = clamp(py, rect.y - rect.height / 2, rect.y + rect.height / 2);
  const dx = px - closestX;
  const dy = py - closestY;
  return dx * dx + dy * dy < radius * radius;
}

function spawnObstacle(room) {
  const chosen = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
  const point = randomPointAvoidingWalls(room.activeMap.width, room.activeMap.height, chosen.radius, Math.random, room.walls);
  room.obstacles[room.activeMap.nextObstacleId] = {
    x: point.x,
    y: point.y,
    radius: chosen.radius,
    type: chosen.type
  };
  room.activeMap.nextObstacleId++;
}

function spawnPowerUp(room) {
  const chosen = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  const point = randomPointAvoidingWalls(room.activeMap.width, room.activeMap.height, chosen.radius, Math.random, room.walls);
  room.powerUps[room.activeMap.nextPowerUpId] = {
    x: point.x,
    y: point.y,
    radius: chosen.radius,
    type: chosen.type
  };
  room.activeMap.nextPowerUpId++;
}

// Naves
const SHIPS = [
  "images/spaceship.png"
];

io.on('connection', (socket) => {
  console.log('a user connected');

  // ======================
  // ASIGNAR SALA DINÁMICA
  // ======================
  const room = findRoomForNewPlayer();
  socket.join(room.id);

  room.sockets.add(socket.id);
  if (!room.hostId) room.hostId = socket.id;

  socket.data.roomId = room.id;
  socket.data.isHost = socket.id === room.hostId;

  socket.emit('roomInfo', {
    roomId: room.id,
    isHost: socket.data.isHost,
    minPlayersToStart: MIN_PLAYERS_TO_START,
    maxPlayers: MAX_PLAYERS_PER_ROOM,
  });

  emitRoomState(room);

  // ======================
  // CREAR JUGADOR EN ESA SALA
  // ======================
  const spawnPoint = randomPointAvoidingWalls(room.activeMap.width, room.activeMap.height, 15, Math.random, room.walls);

  room.players[socket.id] = {
    x: spawnPoint.x,
    y: spawnPoint.y,
    color: `hsl(${360 * Math.random()}, 100%, 50%)`,
    radius: 15,
    lifes: 30,
    bullets: 10,
    sequence: 0,
    ship: "images/spaceship.png", // Valor por defecto
    playerName: `Jugador-${socket.id.slice(0, 4)}`, // Nombre por defecto
    angle: 0,
    frozenUntil: 0,
    canvas: null
  };

  // Enviar estado inicial solo a esa sala/jugador
  io.to(room.id).emit('playersUpdate', room.players);

  socket.emit('mapInit', {
    id: room.activeMap.id,
    width: room.activeMap.width,
    height: room.activeMap.height,
    name: room.activeMap.name,
    seed: room.activeMap.seed
  });

  socket.emit('wallsUpdate', room.walls);
  socket.emit('powerUpsUpdate', room.powerUps);
  socket.emit('obstaclesUpdate', room.obstacles);

  // ======================
  // CONFIG DE JUGADOR
  // ======================
  socket.on('playerConfig', (config) => {
    const roomId = socket.data.roomId;
    const r = rooms[roomId];
    if (!r) return;

    if (r.players[socket.id]) {
      r.players[socket.id].playerName = config.name;
      r.players[socket.id].ship = config.ship;
      console.log(`Jugador ${socket.id} configurado en ${roomId}: ${config.name}, Nave: ${config.ship}`);

      io.to(roomId).emit('playersUpdate', r.players);
    }
  });

  // ======================
  // INICIAR PARTIDA (SOLO HOST, MIN 2)
  // ======================
  socket.on('startGame', () => {
    const roomId = socket.data.roomId;
    const r = rooms[roomId];
    if (!r) return;

    if (r.hostId !== socket.id) {
      socket.emit('errorMessage', 'Solo el anfitrión puede iniciar la partida.');
      return;
    }

    if (r.sockets.size < MIN_PLAYERS_TO_START) {
      socket.emit('errorMessage', 'Necesitás al menos 2 jugadores en la sala para empezar.');
      return;
    }

    if (r.started) return;

    r.started = true;
    io.to(roomId).emit('gameStarted', { roomId });
    emitRoomState(r);
  });

  // ======================
  // DISPARAR (BLOQUEADO SI NO INICIÓ)
  // ======================
  socket.on('shootProjectile', ({ x, y, angle }) => {
    const roomId = socket.data.roomId;
    const r = rooms[roomId];
    if (!r) return;
    if (!r.started) return;

    r.projectileId += 1;

    const velocity = {
      x: Math.cos(angle) * 5,
      y: Math.sin(angle) * 5
    };

    r.projectiles[r.projectileId] = {
      x,
      y,
      velocity,
      radius: 5,
      playerId: socket.id
    };
  });

  // ======================
  // BALAS (BLOQUEADO SI NO INICIÓ)
  // ======================
  socket.on('updateBullets', (bullets) => {
    const roomId = socket.data.roomId;
    const r = rooms[roomId];
    if (!r) return;
    if (!r.started) return;

    if (r.players[socket.id]) {
      r.players[socket.id].bullets = bullets;
      io.to(roomId).emit('playersUpdate', r.players);
    }
  });

  socket.on('initCanvas', ({ width, height, devicePixelRatio }) => {
    const roomId = socket.data.roomId;
    const r = rooms[roomId];
    if (!r) return;

    if (!r.players[socket.id]) return;

    r.players[socket.id].canvas = {
      width,
      height
    };

    r.players[socket.id].radius = 15;
    if (devicePixelRatio > 1) r.players[socket.id].radius = 2 * 15;
  });

  socket.on("updateAngle", (angle) => {
    const roomId = socket.data.roomId;
    const r = rooms[roomId];
    if (!r) return;
    if (!r.started) return;

    if (r.players[socket.id]) {
      r.players[socket.id].angle = angle;
      io.to(roomId).emit('playersUpdate', r.players);
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
    const roomId = socket.data.roomId;
    removePlayerFromRoom(roomId, socket.id);
  });

  // ======================
  // MOVIMIENTO (BLOQUEADO SI NO INICIÓ)
  // ======================
  socket.on('move', ({ dx, dy, sequence }) => {
    const roomId = socket.data.roomId;
    const r = rooms[roomId];
    if (!r) return;
    if (!r.started) return;

    const player = r.players[socket.id];
    if (!player) return;

    const targetX = clamp(player.x + dx, player.radius, r.activeMap.width - player.radius);
    const targetY = clamp(player.y + dy, player.radius, r.activeMap.height - player.radius);

    const collidesWithWall = Object.values(r.walls).some(
      (wall) => circleIntersectsRect(targetX, targetY, player.radius, wall)
    );

    if (!collidesWithWall) {
      player.x = targetX;
      player.y = targetY;
    }

    player.sequence = sequence;
  });

  console.log('Current rooms:', Object.keys(rooms).length);
});

// =========================================================
//                 LOOP DEL JUEGO POR SALA
// =========================================================
setInterval(() => {
  for (const roomId in rooms) {
    const room = rooms[roomId];

    // PROYECTILES
    for (const id in room.projectiles) {
      const projectile = room.projectiles[id];
      projectile.x += projectile.velocity.x;
      projectile.y += projectile.velocity.y;

      if (
        projectile.x - 5 >= room.activeMap.width ||
        projectile.x + 5 <= 0 ||
        projectile.y - 5 >= room.activeMap.height ||
        projectile.y + 5 <= 0
      ) {
        delete room.projectiles[id];
        continue;
      }

      let hitWall = false;
      for (const wid in room.walls) {
        if (circleIntersectsRect(projectile.x, projectile.y, projectile.radius, room.walls[wid])) {
          delete room.projectiles[id];
          hitWall = true;
          break;
        }
      }
      if (hitWall) continue;

      // Colisión con jugadores (solo de la misma sala)
      for (const pid in room.players) {
        const player = room.players[pid];
        const distance = Math.hypot(projectile.x - player.x, projectile.y - player.y);

        if (distance < projectile.radius + player.radius && projectile.playerId !== pid) {
          player.lifes -= 1;
          delete room.projectiles[id];
          console.log(`[${roomId}] Player hit:`, player.playerName);

          if (player.lifes <= 0) {
            console.log(`[${roomId}] Player eliminated:`, player.playerName);
            delete room.players[pid];
          }
          break;
        }
      }
    }

    // POWER-UPS
    for (const puid in room.powerUps) {
      const powerUp = room.powerUps[puid];
      for (const pid in room.players) {
        const player = room.players[pid];
        const distance = Math.hypot(powerUp.x - player.x, powerUp.y - player.y);

        if (distance < powerUp.radius + player.radius - 10) {
          if (powerUp.type === 'extraLife') {
            player.lifes += 5;
            console.log(`[${roomId}] ${player.playerName} obtuvo +5 vidas`);
          } else if (powerUp.type === 'extraBullets') {
            player.bullets += 5;
            console.log(`[${roomId}] ${player.playerName} obtuvo +5 balas`);
          }

          delete room.powerUps[puid];
          break;
        }
      }
    }

    // OBSTÁCULOS
    for (const oid in room.obstacles) {
      const obstacle = room.obstacles[oid];
      for (const pid in room.players) {
        const player = room.players[pid];
        const distance = Math.hypot(obstacle.x - player.x, obstacle.y - player.y);

        if (distance < obstacle.radius + player.radius - 10) {
          switch (obstacle.type) {
            case 'asteroid':
              player.lifes -= 1;
              console.log(`[${roomId}] ${player.playerName} chocó con asteroide: -1 vida`);
              break;
            case 'alien':
              player.lifes -= 2;
              console.log(`[${roomId}] ${player.playerName} atacado por alien: -2 vidas`);
              break;
            case 'slowTrap':
              if (Date.now() > player.frozenUntil) {
                player.frozenUntil = Date.now() + 3000;
                console.log(`[${roomId}] ${player.playerName} atrapado en slow trap`);
              }
              break;
          }

          delete room.obstacles[oid];
          break;
        }
      }
    }

    // Respawn
    if (Object.keys(room.powerUps).length < 5) spawnPowerUp(room);
    if (Object.keys(room.obstacles).length < 5) spawnObstacle(room);

    // Emit updates SOLO a esa sala
    io.to(roomId).emit('powerUpsUpdate', room.powerUps);
    io.to(roomId).emit('obstaclesUpdate', room.obstacles);
    io.to(roomId).emit('projectilesUpdate', room.projectiles);
    io.to(roomId).emit('playersUpdate', room.players);
  }
}, 15);

server.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
});
