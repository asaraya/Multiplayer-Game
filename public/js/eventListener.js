addEventListener('click', (event) => {
    const player = frontendPlayers[socket.id];
    if (!player) return;

    const angle = Math.atan2(
        (event.clientY * window.devicePixelRatio)- player.y,
        (event.clientX * window.devicePixelRatio) - player.x
    );
    const velocity = {
        x: Math.cos(angle) * 5,
        y: Math.sin(angle) * 5
    };
    
    if (player.bullets <= 0) return;

   projectiles.push(new Projectile({
        x: player.x,
        y: player.y,
        radius: 5,
        color: 'white',
        velocity
    }));
    player.bullets -= 1;
    socket.emit('updateBullets', player.bullets);
    console.log(projectiles);
});