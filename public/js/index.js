
const canvas  = document.querySelector('canvas');
const context = canvas.getContext('2d');

const socket = io();

const devicePixelRatio = window.devicePixelRatio || 1;

canvas.width  = window.innerWidth * devicePixelRatio;
canvas.height = window.innerHeight * devicePixelRatio;

const x = canvas.width / 2;
const y = canvas.height / 2;


const frontendPlayers = {};
projectiles = [];
socket.on('playersUpdate', (backendPlayers) => {
    for (const id in backendPlayers) {

        const p = backendPlayers[id];

        if (!frontendPlayers[id]) {
           
            frontendPlayers[id] = new Player({x: p.x, y: p.y, radius: 15, 
                color: p.color, lifes: p.lifes, bullets: p.bullets });
        
        } else {
            
            if (id === socket.id){
                
               
                frontendPlayers[id].lifes = p.lifes;
                frontendPlayers[id].bullets = p.bullets;
                
                const lastBackendInput = playersInputs.findIndex(input => {
                    return input.sequenceNumber === p.sequence;
                });

                if (lastBackendInput > -1) {
                    playersInputs.splice(0, lastBackendInput + 1);
                }

                playersInputs.forEach(input => {
                    frontendPlayers[id].x += input.dx;
                    frontendPlayers[id].y += input.dy;
                });
            } else {
                
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

let animationId;
function animate() {
    animationId = requestAnimationFrame(animate);
    context.fillStyle = 'rgba(0, 0, 0, 0.1)';
    context.fillRect(0, 0, canvas.width, canvas.height);


    for (const id in frontendPlayers) {
        frontendPlayers[id].draw();
    }

    for (let i = projectiles.length -1; i >=0; i--) {
        const projectile = projectiles[i];
        projectile.update();
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
        playersInputs.push({sequenceNumber, dx : 0, dy: -speed});
        frontendPlayers[socket.id].y -= speed;
        socket.emit('move', {key: 'ArrowUp', sequence : sequenceNumber});
    }
    if (keys.ArrowDown.pressed) {
        sequenceNumber++;
        playersInputs.push({sequenceNumber, dx : 0, dy: speed});
        frontendPlayers[socket.id].y += speed;
        socket.emit('move', {key: 'ArrowDown', sequence : sequenceNumber});
    }
    if (keys.ArrowLeft.pressed) {
        sequenceNumber++;
        playersInputs.push({sequenceNumber, dx : -speed, dy: 0});
        frontendPlayers[socket.id].x -= speed;
        socket.emit('move', {key: 'ArrowLeft', sequence : sequenceNumber});
    }
    if (keys.ArrowRight.pressed) {
        sequenceNumber++;
        playersInputs.push({sequenceNumber, dx : speed, dy: 0});
        frontendPlayers[socket.id].x += speed;
        socket.emit('move', {key: 'ArrowRight', sequence : sequenceNumber});
    }
}, 15); // 15 times per second

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