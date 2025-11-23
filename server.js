const express = require('express');
const app = express();
const port = 3000;

const http = require('http');
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

// Modulo de powerUps 
const powerUps = {};
let projectileId = 0;
let powerUpId = 0;
const POWERUP_TYPES = [
  { type: 'extraLife', radius: 5 },
  { type: 'extraBullets', radius: 5 },
];


function generatePowerUp() {
  const chosen = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];

  return {
    x: 800 * Math.random(),
    y: 600 * Math.random(),
    radius: chosen.radius,
    type: chosen.type
  };
}

io.on('connection', (socket) => {
  console.log('a user connected');
  players[socket.id] = { 
    x: 400 * Math.random(), 
    y: 400 * Math.random(),
    color : `hsl(${360 * Math.random()}, 100%, 50%)`,
    lifes : 30,
    bullets : 10,
    sequence : 0
  };

  io.emit('playersUpdate', players);

  // Inicializar algunos power-ups
  for (let i = 0; i < 10; i++) {
    powerUps[powerUpId] = generatePowerUp();
    powerUpId++;
  }
  
  socket.emit('powerUpsUpdate', powerUps);

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



  socket.on('disconnect', () => {
    console.log('user disconnected');
    delete players[socket.id];
    io.emit('playersUpdate', players);
  });

  socket.on('move', ({key, sequence}) => {
    players[socket.id].sequence = sequence;
    const speed = 5;
    if (key === 'ArrowUp') players[socket.id].y -= speed;
    if (key === 'ArrowDown') players[socket.id].y += speed;
    if (key === 'ArrowLeft') players[socket.id].x -= speed;
    if (key === 'ArrowRight') players[socket.id].x += speed;
  });

  console.log('Current players:', players);

});

setInterval(() => {

  for (const id in projectiles) {
    const projectile = projectiles[id];
    projectile.x += projectile.velocity.x;
    projectile.y += projectile.velocity.y;
    if (projectile.x -5 >= players[projectile.playerId]?.canvas?.width ||
        projectile.x +5 <= 0 ||
        projectile.y -5 >= players[projectile.playerId]?.canvas?.height ||
        projectile.y +5 <= 0) {
          delete projectiles[id];
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
  for (const pid in players) {
    const player = players[pid];
    for (const puid in powerUps) {
      const powerUp = powerUps[puid];
      const dx = powerUp.x - player.x;
      const dy = powerUp.y - player.y;
      const distance = Math.hypot(dx, dy);
      
       if (distance < (powerUp.radius || 10) + (player.radius || 15)) {
        // Aplicar el efecto del power-up
        if (powerUp.type === 'extraLife') {
          player.lifes += 1;
        } else if (powerUp.type === 'extraBullets') {
          player.bullets += 5;
        } 
        // Eliminar el power-up recogido
        delete powerUps[puid];
        console.log(players);
      }
    }
  }
  

  io.emit('powerUpsUpdate', powerUps);
  io.emit('projectilesUpdate', projectiles);
  io.emit('playersUpdate', players);
}, 15); // 15 times per second


server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});