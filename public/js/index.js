
const canvas  = document.querySelector('canvas');
const context = canvas.getContext('2d');

const socket = io();

canvas.width  = window.innerWidth;
canvas.height = window.innerHeight;

const x = canvas.width / 2;
const y = canvas.height / 2;

const player = new Player(x, y, 30, 'blue');

let animationId;
function animate() {
    animationId = requestAnimationFrame(animate);
    context.fillStyle = 'rgba(0, 0, 0, 0.1)';
    context.fillRect(0, 0, canvas.width, canvas.height);


    player.draw();
}

animate();