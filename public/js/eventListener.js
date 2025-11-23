addEventListener('click', (event) => {
    const player = frontendPlayers[socket.id];
    if (!player) return;

    const angle = Math.atan2(
        (event.clientY * window.devicePixelRatio)- player.y,
        (event.clientX * window.devicePixelRatio) - player.x
    );
   
    
    if (player.bullets <= 0) return;

    socket.emit('shootProjectile', {
        x: player.x,
        y: player.y,
        angle
    });


    player.bullets -= 1;
    socket.emit('updateBullets', player.bullets);
    //console.log(projectiles);
});