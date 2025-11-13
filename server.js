const express = require('express');
const app = express();
const port = 3000;

const http = require('http');
const server = http.createServer(app);
const  { Server } = require("socket.io");
const io = new Server(server, {pingInterval: 2000, pingTimeout: 5000});


app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
} );

const players = {}

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

  socket.on('updateBullets', (bullets) => {
    if (players[socket.id]) {
      players[socket.id].bullets = bullets;
      io.emit('playersUpdate', players);
    }
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
  io.emit('playersUpdate', players);
}, 100); // 15 times per second


server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});