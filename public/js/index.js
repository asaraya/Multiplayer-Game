const canvas  = document.querySelector('canvas');
const context = canvas.getContext('2d');

const socket = io();

const devicePixelRatio = window.devicePixelRatio || 1;

canvas.width  = window.innerWidth * devicePixelRatio;
canvas.height = window.innerHeight * devicePixelRatio;

const frontendPlayers = {};
const projectiles = {};
const powerUps = {};
const obstacles = {};
const walls = {};
let world = { width: canvas.width, height: canvas.height };
const hudContainer = document.getElementById('hud-players');

// ============================
// WAITING ROOM / LOBBY STATE
// ============================
let roomId = null;
let isHost = false;
let gameStarted = false;

let lobbyState = {
  playerCount: 1,
  maxPlayers: 4,
  minPlayersToStart: 2,
  hostId: null,
  started: false,
};

let lobbyUI = null;
let exitBtn = null;

// Para mostrar mensaje de fin de partida
let lastGameEnd = null;
let lastGameEndAt = 0;

function ensureExitButton() {
  if (exitBtn) return exitBtn;

  const btn = document.createElement('button');
  btn.id = 'exit-game-btn';
  btn.textContent = 'Salir de partida';
  btn.style.position = 'fixed';
  btn.style.top = '12px';
  btn.style.right = '12px';
  btn.style.zIndex = '10000';
  btn.style.padding = '10px 14px';
  btn.style.borderRadius = '10px';
  btn.style.border = '0';
  btn.style.cursor = 'pointer';
  btn.style.fontWeight = '800';
  btn.style.display = 'none';

  btn.addEventListener('click', () => {
    // le avisamos al server para que declare ganador si corresponde
    socket.emit('leaveGame', () => {
      try { socket.disconnect(); } catch (_) {}
      window.location.href = 'menu/menu.html';
    });
  });

  document.body.appendChild(btn);
  exitBtn = btn;
  updateExitButton();
  return btn;
}

function updateExitButton() {
  ensureExitButton();
  exitBtn.style.display = gameStarted ? 'block' : 'none';
}

function ensureLobbyUI() {
  if (lobbyUI) return lobbyUI;

  const overlay = document.createElement('div');
  overlay.id = 'lobby-overlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.gap = '10px';
  overlay.style.background = 'rgba(0,0,0,0.55)';
  overlay.style.color = '#fff';
  overlay.style.fontFamily = 'Segoe UI, sans-serif';
  overlay.style.zIndex = '9999';
  overlay.style.textAlign = 'center';
  overlay.style.padding = '24px';

  const title = document.createElement('div');
  title.id = 'lobby-title';
  title.style.fontSize = '22px';
  title.style.fontWeight = '700';
  title.textContent = 'Sala de espera';

  const info = document.createElement('div');
  info.id = 'lobby-info';
  info.style.fontSize = '14px';
  info.style.opacity = '0.95';

  const role = document.createElement('div');
  role.id = 'lobby-role';
  role.style.fontSize = '14px';
  role.style.opacity = '0.95';

  const hint = document.createElement('div');
  hint.id = 'lobby-hint';
  hint.style.fontSize = '13px';
  hint.style.opacity = '0.85';

  const startBtn = document.createElement('button');
  startBtn.id = 'lobby-start';
  startBtn.textContent = 'Empezar partida';
  startBtn.style.padding = '10px 16px';
  startBtn.style.borderRadius = '10px';
  startBtn.style.border = '0';
  startBtn.style.cursor = 'pointer';
  startBtn.style.fontWeight = '700';
  startBtn.style.display = 'none';
  startBtn.addEventListener('click', () => {
    socket.emit('startGame');
  });

  const error = document.createElement('div');
  error.id = 'lobby-error';
  error.style.fontSize = '13px';
  error.style.color = '#ffcccc';
  error.style.minHeight = '18px';

  overlay.appendChild(title);
  overlay.appendChild(info);
  overlay.appendChild(role);
  overlay.appendChild(hint);
  overlay.appendChild(startBtn);
  overlay.appendChild(error);

  document.body.appendChild(overlay);

  lobbyUI = { overlay, title, info, role, hint, startBtn, error };
  updateLobbyUI();
  return lobbyUI;
}

function setLobbyError(msg) {
  const ui = ensureLobbyUI();
  ui.error.textContent = msg || '';
}

function updateLobbyUI() {
  const ui = ensureLobbyUI();
  ensureExitButton();
  updateExitButton();

  // sincronizar isHost también con roomState (por si el host cambia)
  if (lobbyState.hostId) {
    isHost = (lobbyState.hostId === socket.id);
  }

  const rid = roomId ? `(${roomId})` : '';
  ui.info.textContent = `Jugadores: ${lobbyState.playerCount}/${lobbyState.maxPlayers} ${rid}`;

  const roleText = isHost ? 'Sos el anfitrión (host).' : 'Sos invitado.';
  ui.role.textContent = roleText;

  // Si acaba de terminar una partida, mostrar el resultado unos segundos
  const showEnd = lastGameEnd && (Date.now() - lastGameEndAt) < 8000 && !gameStarted && !lobbyState.started;

  if (showEnd) {
    ui.title.textContent = 'Partida terminada';
    if (lastGameEnd.winnerId && lastGameEnd.winnerId === socket.id) {
      ui.hint.textContent = `🏆 Ganaste.`;
    } else if (lastGameEnd.winnerName) {
      ui.hint.textContent = `Ganador: ${lastGameEnd.winnerName}`;
    } else {
      ui.hint.textContent = `La partida terminó.`;
    }
  } else {
    ui.title.textContent = 'Sala de espera';

    const needs = Math.max(0, lobbyState.minPlayersToStart - lobbyState.playerCount);
    if (lobbyState.started || gameStarted) {
      ui.hint.textContent = 'Partida iniciada.';
    } else if (needs > 0) {
      ui.hint.textContent = `Esperando ${needs} jugador(es) más para poder iniciar...`;
    } else {
      ui.hint.textContent = 'Listo para iniciar.';
    }
  }

  const canStart =
    isHost &&
    !lobbyState.started &&
    !gameStarted &&
    lobbyState.playerCount >= lobbyState.minPlayersToStart;

  ui.startBtn.style.display = canStart ? 'inline-block' : 'none';

  // Mostrar/ocultar overlay
  ui.overlay.style.display = (gameStarted || lobbyState.started) ? 'none' : 'flex';
}

// ============================

function circleIntersectsRect(px, py, radius, rect) {
  const closestX = Math.min(Math.max(px, rect.x - rect.width / 2), rect.x + rect.width / 2);
  const closestY = Math.min(Math.max(py, rect.y - rect.height / 2), rect.y + rect.height / 2);
  const dx = px - closestX;
  const dy = py - closestY;
  return dx * dx + dy * dy < radius * radius;
}

function renderHud(backendPlayers) {
  if (!hudContainer) return;
  hudContainer.innerHTML = '';
  Object.keys(backendPlayers).forEach((id) => {
    const p = backendPlayers[id];
    const row = document.createElement('div');
    row.className = `hud-row${id === socket.id ? ' me' : ''}`;

    const color = document.createElement('div');
    color.className = 'hud-color';
    color.style.background = p.color;

    const name = document.createElement('div');
    name.className = 'hud-name';
    name.textContent = p.playerName || `P-${id.slice(0, 4)}`;

    const hp = document.createElement('div');
    hp.className = 'hud-stat';
    hp.textContent = `HP ${p.lifes}`;

    const ammo = document.createElement('div');
    ammo.className = 'hud-stat';
    ammo.textContent = `Ammo ${p.bullets}`;

    row.appendChild(color);
    row.appendChild(name);
    row.appendChild(hp);
    row.appendChild(ammo);
    hudContainer.appendChild(row);
  });
}

function drawNameplates() {
  context.save();
  context.font = '12px Segoe UI, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'bottom';
  context.fillStyle = '#ffffff';
  context.strokeStyle = 'rgba(0,0,0,0.6)';
  context.lineWidth = 3;

  for (const id in frontendPlayers) {
    const p = frontendPlayers[id];
    const label = p.playerName || `P-${id.slice(0, 4)}`;
    const textX = p.x;
    const textY = p.y - p.radius - 8;
    context.strokeText(label, textX, textY);
    context.fillText(label, textX, textY);
  }
  context.restore();
}

// ============================
// CONNECT
// ============================
socket.on('connect', () => {
  ensureLobbyUI();
  ensureExitButton();
  updateLobbyUI();

  socket.emit('initCanvas', {
    width: canvas.width,
    height: canvas.height,
    devicePixelRatio
  });

  const playerConfig = JSON.parse(sessionStorage.getItem('playerConfig') || '{}');
  if (playerConfig.name && playerConfig.ship) {
    socket.emit('playerConfig', playerConfig);
    sessionStorage.removeItem('playerConfig');
  } else {
    window.location.href = 'menu/menu.html';
  }
});

// ============================
// EVENTOS DE SALA
// ============================
socket.on('roomInfo', (info) => {
  roomId = info.roomId;
  isHost = !!info.isHost;
  lobbyState.minPlayersToStart = info.minPlayersToStart ?? lobbyState.minPlayersToStart;
  lobbyState.maxPlayers = info.maxPlayers ?? lobbyState.maxPlayers;

  setLobbyError('');
  updateLobbyUI();
});

socket.on('roomState', (state) => {
  lobbyState = {
    playerCount: state.playerCount ?? lobbyState.playerCount,
    maxPlayers: state.maxPlayers ?? lobbyState.maxPlayers,
    minPlayersToStart: state.minPlayersToStart ?? lobbyState.minPlayersToStart,
    hostId: state.hostId ?? lobbyState.hostId,
    started: !!state.started,
  };

  // si la sala ya empezó, nos alineamos
  if (lobbyState.started) gameStarted = true;

  setLobbyError('');
  updateLobbyUI();
});

socket.on('gameStarted', () => {
  gameStarted = true;
  lobbyState.started = true;

  // limpiar mensaje final anterior
  lastGameEnd = null;
  lastGameEndAt = 0;

  setLobbyError('');
  updateLobbyUI();
});

socket.on('gameEnded', (payload) => {
  // payload: { roomId, winnerId, winnerName, reason }
  lastGameEnd = payload || null;
  lastGameEndAt = Date.now();

  gameStarted = false;
  lobbyState.started = false;

  // limpiar bullets locales por estética
  for (const id in projectiles) delete projectiles[id];

  // limpiar inputs pendientes
  playersInputs.length = 0;

  updateLobbyUI();
});

socket.on('errorMessage', (msg) => {
  setLobbyError(msg);
});

// ============================

socket.on('playersUpdate', (backendPlayers) => {
  for (const id in backendPlayers) {
    const p = backendPlayers[id];

    if (!frontendPlayers[id]) {
      frontendPlayers[id] = new Player({
        x: p.x,
        y: p.y,
        radius: 15,
        color: p.color,
        lifes: p.lifes,
        bullets: p.bullets,
        ship: p.ship,
        angle: p.angle,
        playerName: p.playerName
      });
    } else {
      frontendPlayers[id].lifes = p.lifes;
      frontendPlayers[id].bullets = p.bullets;
      frontendPlayers[id].playerName = p.playerName;

      if (frontendPlayers[id].ship !== p.ship) {
        frontendPlayers[id].ship = p.ship;
        frontendPlayers[id].image.src = p.ship;
      }

      frontendPlayers[id].angle = p.angle;

      if (id === socket.id) {
        frontendPlayers[id].x = p.x;
        frontendPlayers[id].y = p.y;
        frontendPlayers[id].frozenUntil = p.frozenUntil;

        const index = playersInputs.findIndex(input => input.sequenceNumber === p.sequence);
        if (index > -1) {
          playersInputs.splice(0, index + 1);
        }

        if (gameStarted) {
          playersInputs.forEach(input => {
            frontendPlayers[id].x += input.dx;
            frontendPlayers[id].y += input.dy;
          });
        } else {
          playersInputs.length = 0;
        }
      } else {
        gsap.to(frontendPlayers[id], {
          x: p.x,
          y: p.y,
          angle: p.angle,
          duration: 0.015,
          ease: "linear"
        });
      }
    }
  }

  for (const id in frontendPlayers) {
    if (!backendPlayers[id]) {
      delete frontendPlayers[id];
    }
  }

  renderHud(backendPlayers);
});

socket.on('mapInit', (map) => {
  world = map;
  for (const id in powerUps) delete powerUps[id];
  for (const id in obstacles) delete obstacles[id];
  for (const id in walls) delete walls[id];
});

socket.on('projectilesUpdate', (backendProjectiles) => {
  for (const id in backendProjectiles) {
    const p = backendProjectiles[id];

    if (!projectiles[id]) {
      projectiles[id] = new Projectile({
        x: p.x,
        y: p.y,
        radius: p.radius,
        color: frontendPlayers[p.playerId] ? frontendPlayers[p.playerId].color : 'white',
        velocity: p.velocity
      });
    } else {
      projectiles[id].x += p.velocity.x;
      projectiles[id].y += p.velocity.y;
    }
  }
  for (const id in projectiles) {
    if (!backendProjectiles[id]) {
      delete projectiles[id];
    }
  }
});

socket.on('powerUpsUpdate', (backendPowerUps) => {
  for (const id in backendPowerUps) {
    const p = backendPowerUps[id];

    if (!powerUps[id]) {
      powerUps[id] = new PowerUp({
        x: p.x,
        y: p.y,
        radius: p.radius,
        type: p.type
      });
    } else {
      powerUps[id].x = p.x;
      powerUps[id].y = p.y;
    }
  }
  for (const id in powerUps) {
    if (!backendPowerUps[id]) {
      delete powerUps[id];
    }
  }
});

socket.on('obstaclesUpdate', (backendObstacles) => {
  for (const id in backendObstacles) {
    const o = backendObstacles[id];
    if (!obstacles[id]) {
      obstacles[id] = new Obstacle(o.x, o.y, o.radius, o.type);
    } else {
      obstacles[id].x = o.x;
      obstacles[id].y = o.y;
    }
  }
  for (const id in obstacles) {
    if (!backendObstacles[id]) {
      delete obstacles[id];
    }
  }
});

socket.on('wallsUpdate', (backendWalls) => {
  for (const id in backendWalls) {
    const w = backendWalls[id];
    if (!walls[id]) {
      walls[id] = new Wall(w);
    } else {
      walls[id].x = w.x;
      walls[id].y = w.y;
      walls[id].width = w.width;
      walls[id].height = w.height;
    }
  }
  for (const id in walls) {
    if (!backendWalls[id]) {
      delete walls[id];
    }
  }
});

let animationId;
function animate() {
  animationId = requestAnimationFrame(animate);

  context.fillStyle = 'rgba(0, 0, 0, 0.1)';
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (const id in walls) walls[id].draw();
  for (const id in frontendPlayers) frontendPlayers[id].draw();
  drawNameplates();
  for (const id in projectiles) projectiles[id].draw();
  for (const id in powerUps) powerUps[id].draw();
  for (const id in obstacles) obstacles[id].draw();

  updateLobbyUI();
}
animate();

const keys = {
  ArrowUp: { pressed: false },
  ArrowDown: { pressed: false },
  ArrowLeft: { pressed: false },
  ArrowRight: { pressed: false }
};

const speed = 5;
const playersInputs = [];
let sequenceNumber = 0;

setInterval(() => {
  if (!frontendPlayers[socket.id]) return;

  // BLOQUEO: no mover si la partida no empezó
  if (!gameStarted) return;

  if (frontendPlayers[socket.id].frozenUntil > Date.now()) return;

  const tryMove = (dx, dy) => {
    const player = frontendPlayers[socket.id];
    const nextX = player.x + dx;
    const nextY = player.y + dy;

    const hitsWall = Object.values(walls).some((wall) =>
      circleIntersectsRect(nextX, nextY, player.radius, wall)
    );
    if (hitsWall) return;

    sequenceNumber++;
    playersInputs.push({ sequenceNumber, dx, dy });

    player.x = nextX;
    player.y = nextY;

    socket.emit('move', { dx, dy, sequence: sequenceNumber });
  };

  if (keys.ArrowUp.pressed) tryMove(0, -speed);
  if (keys.ArrowDown.pressed) tryMove(0, speed);
  if (keys.ArrowLeft.pressed) tryMove(-speed, 0);
  if (keys.ArrowRight.pressed) tryMove(speed, 0);
}, 15);

window.addEventListener('keydown', (event) => {
  if (!frontendPlayers[socket.id]) return;
  switch (event.key) {
    case 'ArrowUp': keys.ArrowUp.pressed = true; break;
    case 'ArrowDown': keys.ArrowDown.pressed = true; break;
    case 'ArrowLeft': keys.ArrowLeft.pressed = true; break;
    case 'ArrowRight': keys.ArrowRight.pressed = true; break;
  }
});

window.addEventListener('keyup', (event) => {
  if (!frontendPlayers[socket.id]) return;
  switch (event.key) {
    case 'ArrowUp': keys.ArrowUp.pressed = false; break;
    case 'ArrowDown': keys.ArrowDown.pressed = false; break;
    case 'ArrowLeft': keys.ArrowLeft.pressed = false; break;
    case 'ArrowRight': keys.ArrowRight.pressed = false; break;
  }
});
