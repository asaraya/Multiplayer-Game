class Player {
    constructor({x , y , radius, color, ship, angle, playerName}) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.lifes = 0;
        this.bullets = 0;
        this.image = new Image();
        
        // Usar valores del servidor con valores por defecto robustos
        this.ship = ship || '../images/naves/spaceship.png';
        this.playerName = playerName || `Jugador-${Math.random().toString(36).substr(2, 4)}`;
        this.angle = angle || 0;
        
        this.loadImage();
    }
    
    loadImage() {
        this.image = new Image();
        this.image.onload = () => {
            console.log(`Nave cargada: ${this.ship}`);
        };
        this.image.onerror = () => {
            console.warn(`No se pudo cargar la nave: ${this.ship}, usando nave por defecto`);
            this.image.src = '../images/naves/spaceship.png';
        };
        this.image.src = this.ship;
    }

    draw() {
        const size = this.radius * 2;
        const half = size / 2;
    
        //Verificar si la imagen está cargada
        if (!this.image.complete || this.image.naturalHeight === 0) {
            // Dibujar círculo temporal mientras carga la imagen
            context.save();
            context.fillStyle = this.color;
            context.beginPath();
            context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            context.fill();
            context.restore();
            return;
        }
    
        context.save();
        context.translate(this.x, this.y);
        context.rotate(this.angle);
        context.rotate(Math.PI / 2);
        context.drawImage(this.image, -half, -half, size, size);
        context.restore();
    }
}