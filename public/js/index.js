
const canvas  = document.querySelector('canvas');
const context = canvas.getContext('2d');

const socket = io();

const devicePixelRatio = window.devicePixelRatio || 1;

canvas.width  = window.innerWidth * devicePixelRatio;
canvas.height = window.innerHeight * devicePixelRatio;

const x = canvas.width / 2;
const y = canvas.height / 2;


const frontendPlayers = {};

socket.on('playersUpdate', (backendPlayers) => {
    for (const id in backendPlayers) {
        if (!frontendPlayers[id]) {
            const p = backendPlayers[id];
            frontendPlayers[id] = new Player({x: p.x, y: p.y, radius: 15, 
                color: p.color, lifes: p.lifes, bullets: p.bullets });
        } else {
            const p = backendPlayers[id];
            frontendPlayers[id].x = p.x;
            frontendPlayers[id].y = p.y;
            frontendPlayers[id].lifes = p.lifes;
            frontendPlayers[id].bullets = p.bullets;
        }
    }
    for (const id in frontendPlayers) {
        if (!backendPlayers[id]) {
            delete frontendPlayers[id];
        }
    }

    console.log('Frontend players:', frontendPlayers);
});

let animationId;
function animate() {
    animationId = requestAnimationFrame(animate);
    context.fillStyle = 'rgba(0, 0, 0, 0.1)';
    context.fillRect(0, 0, canvas.width, canvas.height);


    for (const id in frontendPlayers) {
        frontendPlayers[id].draw();
    }
}

animate();

window.addEventListener('keydown', (event) => {
    if (!frontendPlayers[socket.id]) return;
    switch(event.key) {
        case 'ArrowUp':
            
            socket.emit('move', 'ArrowUp');
            break;
        case 'ArrowDown':
            
            socket.emit('move', 'ArrowDown');
            break;
        case 'ArrowLeft':
           
            socket.emit('move', 'ArrowLeft');
            break;
        case 'ArrowRight':
            
            socket.emit('move', 'ArrowRight');
            break;
    }
});