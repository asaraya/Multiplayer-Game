const express = require('express');
const app = express();
const port = 3000;

const http = require('http');
const { type } = require('os');
const { emit } = require('process');
const server = http.createServer(app);
const  { Server } = require("socket.io");
const io = new Server(server, {pingInterval: 2000, pingTimeout: 5000});


app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
} );

const players = {}

const projectiles = {};
let projectileId = 0;

//Tamaño del mapa
const MAP_WIDTH = 1200;
const MAP_HEIGHT = 700;

const POWERUP_TYPES = [
  { type: 'extraLife', radius: 5 },
  { type: 'extraBullets', radius: 5 },
];

const OBSTACLE_TYPES = [
  {type: 'asteroid', radius: 5},
  {type: 'alien' , radius: 5},
  {type: 'slowTrap', radius: 5}
];

// Variantes de mapa, se pueden poner más si se quiere
const MAP_VARIANTS = [
  { name: 'Cinturon de asteroides', powerUps: 8,  obstacles: 14, walls: 4 },
  { name: 'Anillo helado',          powerUps: 10, obstacles: 10, walls: 5 },
  { name: 'Ruinas alien',           powerUps: 12, obstacles: 12, walls: 6 },
];

function mulberry32(seed) {
  return function() {
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

function randomPointAvoidingWalls(width, height, radius, randFn, wallCollection = null) {
  let attempts = 0;
  const availableWalls = wallCollection || (typeof walls !== 'undefined' ? walls : {});
  while (attempts < 10) {
    const x = randomInMap(width, randFn);
    const y = randomInMap(height, randFn);
    const collides = Object.values(availableWalls || {}).some((wall) =>
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

let activeMap = createMap();
const powerUps = activeMap.powerUps;
const obstacles = activeMap.obstacles;
const walls = activeMap.walls;

console.log(`[MAPA] ${activeMap.name} (seed ${activeMap.seed}) ${activeMap.width}x${activeMap.height}`);

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

function spawnObstacle() {
  const chosen = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
  const point = randomPointAvoidingWalls(activeMap.width, activeMap.height, chosen.radius, Math.random);
  obstacles[activeMap.nextObstacleId] = {
    x: point.x,
    y: point.y,
    radius: chosen.radius,
    type: chosen.type
  };
  activeMap.nextObstacleId++;
}

function spawnPowerUp() {
  const chosen = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  const point = randomPointAvoidingWalls(activeMap.width, activeMap.height, chosen.radius, Math.random);
  powerUps[activeMap.nextPowerUpId] = {
    x: point.x,
    y: point.y,
    radius: chosen.radius,
    type: chosen.type
  };
  activeMap.nextPowerUpId++;
}

// Naves 
const SHIPS = [
  "images/spaceship.png"
];

io.on('connection', (socket) => {
  console.log('a user connected');
  const spawnPoint = randomPointAvoidingWalls(activeMap.width, activeMap.height, 15, Math.random);
  players[socket.id] = { 
    x: spawnPoint.x, 
    y: spawnPoint.y,
    color : `hsl(${360 * Math.random()}, 100%, 50%)`,
    radius : 15,
    lifes : 30,
    bullets : 10,
    sequence : 0,
    ship: SHIPS[Math.floor(Math.random() * SHIPS.length)],
    angle: 0,
    frozenUntil: 0
  };

  io.emit('playersUpdate', players);

  socket.emit('mapInit', {
    id: activeMap.id,
    width: activeMap.width,
    height: activeMap.height,
    name: activeMap.name,
    seed: activeMap.seed
  });
  
  socket.emit('wallsUpdate', walls);
  
  socket.emit('powerUpsUpdate', powerUps);
  socket.emit('obstaclesUpdate', obstacles);


  socket.on('shootProjectile', ({x, y, angle}) => {
    
    projectileId += 1;

     const velocity = {
        x: Math.cos(angle) * 5,
        y: Math.sin(angle) * 5
    };

    projectiles[projectileId] = {
      x,
      y,
      velocity,
      radius: 5,
      playerId : socket.id
    };
    console.log('Projectiles:', projectiles);
  });

  socket.on('updateBullets', (bullets) => {
    if (players[socket.id]) {
      players[socket.id].bullets = bullets;
      io.emit('playersUpdate', players);
    }
  });


  socket.on('initCanvas', ({width, height, devicePixelRatio}) => {
    players[socket.id].canvas = {
      width,
      height
    };

    players[socket.id].radius = 15;

    if (devicePixelRatio > 1)
      players[socket.id].radius = 2 * 15;
  });

  socket.on("updateAngle", (angle) => {
    if (players[socket.id]) {
        players[socket.id].angle = angle;
    }
});

  socket.on('disconnect', () => {
    console.log('user disconnected');
    delete players[socket.id];
    io.emit('playersUpdate', players);
  });

  socket.on('move', ({ dx, dy, sequence }) => {
    const player = players[socket.id];
    if (!player) return;

    

    const targetX = clamp(player.x + dx, player.radius, activeMap.width - player.radius);
    const targetY = clamp(player.y + dy, player.radius, activeMap.height - player.radius);
    const collidesWithWall = Object.values(walls).some(
      (wall) => circleIntersectsRect(targetX, targetY, player.radius, wall)
    );
    if (!collidesWithWall) {
      player.x = targetX;
      player.y = targetY;
    }

    // Guardar la última entrada procesada
    player.sequence = sequence;
});

  console.log('Current players:', players);

});

setInterval(() => {

  for (const id in projectiles) {
    const projectile = projectiles[id];
    projectile.x += projectile.velocity.x;
    projectile.y += projectile.velocity.y;
    if (projectile.x -5 >= activeMap.width ||
        projectile.x +5 <= 0 ||
        projectile.y -5 >= activeMap.height ||
        projectile.y +5 <= 0) {
          delete projectiles[id];
          continue;
    }

    let hitWall = false;
    for (const wid in walls) {
      if (circleIntersectsRect(projectile.x, projectile.y, projectile.radius, walls[wid])) {
        delete projectiles[id];
        hitWall = true;
        break;
      }
    }
    if (hitWall) {
      continue;
    }

    for (const pid in players) {
      const player = players[pid];
      const disatance = Math.hypot
        (projectile.x - player.x, projectile.y - player.y);
      if (disatance < projectile.radius + player.radius &&
          projectile.playerId !== pid
      ) {
        player.lifes -= 1;
        delete projectiles[id];
        console.log('Player hit:', player);
        if (player.lifes <= 0) {
          console.log('Player eliminated:', pid);
          delete players[pid];
        }
      }
    }

  }

 
  // Colisiones de jugadores con power-ups
  for(const puid in powerUps) {
    const powerUp = powerUps[puid];
    for (const pid in players) {
      const player = players[pid];
      const distance = Math.hypot(powerUp.x - player.x, powerUp.y - player.y);
      if (distance < powerUp.radius + player.radius - 10) {
        // Aplicar efecto del power-up
        if (powerUp.type === 'extraLife') {
          console.log(player)
          player.lifes += 5; // Aumenta vidas
        } else if (powerUp.type === 'extraBullets') {
          player.bullets += 5; // Aumenta balas
        }
        // Eliminar el power-up del juego
        delete powerUps[puid];
      }
    }
  }

  // Colisiones de jugadores con obstáculos
  for (const oid in obstacles) {
    const obstacle = obstacles[oid];
    for (const pid in players) {
      const player = players[pid];
      const distance = Math.hypot(obstacle.x - player.x, obstacle.y - player.y);
      if (distance < obstacle.radius + player.radius - 10) {
         switch (obstacle.type) {
          case 'asteroid':
            player.lifes -= 1;
            break;

          case 'alien':
            player.lifes -= 2;
            break;

          case 'slowTrap':
            if (Date.now() > player.frozenUntil) {
              player.frozenUntil = Date.now() + 3000; // 3 segundos
            }
            break;
        }
        // Eliminar el obstáculo del juego
        delete obstacles[oid];
      }
    }
  }

  if (Object.keys(powerUps).length < 5) {
    spawnPowerUp();
  }

  if (Object.keys(obstacles).length < 5) {
    spawnObstacle();
  }

  

  io.emit('powerUpsUpdate', powerUps);
  io.emit('obstaclesUpdate', obstacles);
  io.emit('projectilesUpdate', projectiles);
  io.emit('playersUpdate', players);
}, 15); // 15 times per second


server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

