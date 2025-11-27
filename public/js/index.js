
const canvas  = document.querySelector('canvas');
const context = canvas.getContext('2d');

const socket = io();

const devicePixelRatio = window.devicePixelRatio || 1;

canvas.width  = window.innerWidth * devicePixelRatio;
canvas.height = window.innerHeight * devicePixelRatio;

const x = canvas.width / 2;
const y = canvas.height / 2;


const frontendPlayers = {};
const projectiles = {};
const powerUps = {};
const obstacles = {};
const walls = {};
let world = { width: canvas.width, height: canvas.height };
const hudContainer = document.getElementById('hud-players');

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
        name.textContent = id === socket.id ? 'Tu nave' : `P-${id.slice(0, 4)}`;

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
        const label = id === socket.id ? 'Tú' : `P-${id.slice(0, 4)}`;
        const textX = p.x;
        const textY = p.y - p.radius - 8;
        context.strokeText(label, textX, textY);
        context.fillText(label, textX, textY);
    }
    context.restore();
}


socket.on('playersUpdate', (backendPlayers) => {
    for (const id in backendPlayers) {

        const p = backendPlayers[id];

        if (!frontendPlayers[id]) {
           
            frontendPlayers[id] = new Player({x: p.x, y: p.y, radius: 15, 
                color: p.color, lifes: p.lifes, bullets: p.bullets, ship: p.ship, angle: p.angle});
        
        } else {
            
            if (id === socket.id) {

                frontendPlayers[id].lifes = p.lifes;
                frontendPlayers[id].bullets = p.bullets;
            
                // Corrección de posición del servidor
                frontendPlayers[id].x = p.x;
                frontendPlayers[id].y = p.y;
                frontendPlayers[id].frozenUntil = p.frozenUntil;
            
                // Remover inputs confirmados
                const index = playersInputs.findIndex(input => input.sequenceNumber === p.sequence);
                if (index > -1) {
                    playersInputs.splice(0, index + 1);
                }
            
                // Reaplicar inputs sin confirmar
                playersInputs.forEach(input => {
                    frontendPlayers[id].x += input.dx;
                    frontendPlayers[id].y += input.dy;
                });
            }else {
                
                frontendPlayers[id].lifes = p.lifes;
                frontendPlayers[id].bullets = p.bullets;

                gsap.to(frontendPlayers[id], {
                    x: p.x,
                    y: p.y,
                    duration: 0.015,
                    ease: "linear"
                }
                )
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
    for (const id in powerUps) {
        delete powerUps[id];
    }
    for (const id in obstacles) {
        delete obstacles[id];
    }
    for (const id in walls) {
        delete walls[id];
    }
    console.log(`Mapa cargado: ${map.name} (seed ${map.seed})`);
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
            obstacles[id] = new Obstacle(
                 o.x, o.y, o.radius, o.type
            );
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

socket.on('connect', () => {
    socket.emit('initCanvas', {width: canvas.width, height: canvas.height, 
        devicePixelRatio
    });
});

let animationId;
function animate() {
    animationId = requestAnimationFrame(animate);
    context.fillStyle = 'rgba(0, 0, 0, 0.1)';
    context.fillRect(0, 0, canvas.width, canvas.height);


    for (const id in walls) {
        walls[id].draw();
    }

    for (const id in frontendPlayers) {
        frontendPlayers[id].draw();
    }

    drawNameplates();

    for (const id in projectiles) {
        projectiles[id].draw();
    }

    for (const id in powerUps) {
        powerUps[id].draw();
    }

    for (const id in obstacles) {
        obstacles[id].draw();
    }
}

animate();

const keys = {
    ArrowUp : {
        pressed: false
    },
    ArrowDown : {
        pressed: false
    },
    ArrowLeft : {
        pressed: false
    },
    ArrowRight : {
        pressed: false
    }
};
const speed = 5;
const playersInputs = [];
let sequenceNumber = 0;
setInterval(() => {

    if (!frontendPlayers[socket.id]) return;

    if (frontendPlayers[socket.id].frozenUntil > Date.now()) {
        return;
    }

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

    if (keys.ArrowUp.pressed) {
        tryMove(0, -speed);
    }

    if (keys.ArrowDown.pressed) {
        tryMove(0, speed);
    }

    if (keys.ArrowLeft.pressed) {
        tryMove(-speed, 0);
    }

    if (keys.ArrowRight.pressed) {
        tryMove(speed, 0);
    }
}, 15);// 15 times per second

window.addEventListener('keydown', (event) => {
    if (!frontendPlayers[socket.id]) return;
    switch(event.key) {
        case 'ArrowUp':
            keys.ArrowUp.pressed = true;
            break;
        case 'ArrowDown':
            keys.ArrowDown.pressed = true;
            break;
        case 'ArrowLeft':
            keys.ArrowLeft.pressed = true;
            break;
        case 'ArrowRight':
            keys.ArrowRight.pressed = true;
            break;
    }
});

window.addEventListener('keyup', (event) => {
    if (!frontendPlayers[socket.id]) return;
    switch(event.key) {
        case 'ArrowUp':
            keys.ArrowUp.pressed = false;
            break;
        case 'ArrowDown':
            keys.ArrowDown.pressed = false;
            break;
        case 'ArrowLeft':
            keys.ArrowLeft.pressed = false;
            break;
        case 'ArrowRight':
            keys.ArrowRight.pressed = false;
            break;
    }
});

