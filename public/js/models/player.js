class Player {
    constructor({x , y , radius, color}) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.lifes = 0;
        this.bullets = 0;
    }

    draw() {
        context.beginPath();
        context.arc(this.x, this.y, this.radius * window.devicePixelRatio, 0, Math.PI * 2, false);
        context.fillStyle = this.color;
        context.fill();
    }
}