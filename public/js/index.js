
const canvas  = document.querySelector('canvas');
const context = canvas.getContext('2d');

const socket = io();

const devicePixelRatio = window.devicePixelRatio || 1;

canvas.width  = window.innerWidth * devicePixelRatio;
canvas.height = window.innerHeight * devicePixelRatio;

const x = canvas.width / 2;
const y = canvas.height / 2;


const frontendPlayers = {};
projectiles = {};
const powerUps = {};

socket.on('playersUpdate', (backendPlayers) => {
    for (const id in backendPlayers) {

        const p = backendPlayers[id];

        if (!frontendPlayers[id]) {
           
            frontendPlayers[id] = new Player({x: p.x, y: p.y, radius: 15, 
                color: p.color, lifes: p.lifes, bullets: p.bullets });
        
        } else {
            
            if (id === socket.id) {

                frontendPlayers[id].lifes = p.lifes;
                frontendPlayers[id].bullets = p.bullets;
            
                // Corrección de posición del servidor
                frontendPlayers[id].x = p.x;
                frontendPlayers[id].y = p.y;
            
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

    console.log('Frontend players:', frontendPlayers);
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


    for (const id in frontendPlayers) {
        frontendPlayers[id].draw();
    }

    for (const id in projectiles) {
        projectiles[id].draw();
    }

    for (const id in powerUps) {
        powerUps[id].draw();
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
    if (keys.ArrowUp.pressed) {
        sequenceNumber++;
        const dx = 0, dy = -speed;
        playersInputs.push({ sequenceNumber, dx, dy });

        // Predicción inmediata
        frontendPlayers[socket.id].x += dx;
        frontendPlayers[socket.id].y += dy;

        socket.emit('move', { dx, dy, sequence: sequenceNumber });
    }

    if (keys.ArrowDown.pressed) {
        sequenceNumber++;
        const dx = 0, dy = speed;
        playersInputs.push({ sequenceNumber, dx, dy });

        frontendPlayers[socket.id].x += dx;
        frontendPlayers[socket.id].y += dy;

        socket.emit('move', { dx, dy, sequence: sequenceNumber });
    }

    if (keys.ArrowLeft.pressed) {
        sequenceNumber++;
        const dx = -speed, dy = 0;
        playersInputs.push({ sequenceNumber, dx, dy });

        frontendPlayers[socket.id].x += dx;
        frontendPlayers[socket.id].y += dy;

        socket.emit('move', { dx, dy, sequence: sequenceNumber });
    }

    if (keys.ArrowRight.pressed) {
        sequenceNumber++;
        const dx = speed, dy = 0;
        playersInputs.push({ sequenceNumber, dx, dy });

        frontendPlayers[socket.id].x += dx;
        frontendPlayers[socket.id].y += dy;

        socket.emit('move', { dx, dy, sequence: sequenceNumber });
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