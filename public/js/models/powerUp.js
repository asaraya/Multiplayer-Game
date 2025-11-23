class PowerUp {
    constructor({ x, y, radius, type }) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.type = type; 
    }
    draw() {
        context.beginPath();
        context.arc(this.x, this.y, this.radius * window.devicePixelRatio, 0, Math.PI * 2, false);
        if (this.type === 'extraLife') {
            context.fillStyle = 'green';
        } else if (this.type === 'extraBullets') {
            context.fillStyle = 'orange'; 
        }
        context.fill();
    }
}