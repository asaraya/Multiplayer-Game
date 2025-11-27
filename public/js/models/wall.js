class Wall {
    constructor({ x, y, width, height }) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    draw() {
        const halfW = this.width / 2;
        const halfH = this.height / 2;
        context.save();
        context.fillStyle = 'rgba(120, 150, 255, 0.35)';
        context.strokeStyle = 'rgba(180, 210, 255, 0.8)';
        context.lineWidth = 4;
        context.fillRect(this.x - halfW, this.y - halfH, this.width, this.height);
        context.strokeRect(this.x - halfW, this.y - halfH, this.width, this.height);
        context.restore();
    }
}
