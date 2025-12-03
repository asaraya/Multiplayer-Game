class MenuManager {
    constructor() {
        this.playerName = '';
        this.selectedShip = '../images/naves/spaceship.png';
        this.ships = [];
        this.currentMenu = 'main';
        this.initializeMenu();
        this.loadAvailableShips();
    }

    initializeMenu() {
        this.setupEventListeners();
        this.showMenu('main');
    }

    setupEventListeners() {
        document.getElementById('play-btn').addEventListener('click', () => this.handlePlay());
        document.getElementById('custom-btn').addEventListener('click', () => this.showMenu('customization'));
        document.getElementById('rank-btn').addEventListener('click', () => this.showRankings());
        
        document.getElementById('back-custom-btn').addEventListener('click', () => this.showMenu('main'));
        document.getElementById('back-rank-btn').addEventListener('click', () => this.showMenu('main'));
        document.getElementById('confirm-ship-btn').addEventListener('click', () => this.confirmShipSelection());

        document.getElementById('player-name').addEventListener('input', (e) => {
            this.playerName = e.target.value.trim();
        });
    }

    loadAvailableShips() {
        this.ships = [];
        
        const defaultShip = {
            id: 'default',
            name: 'Nave Estándar',
            path: '../images/naves/spaceship.png'
        };
        this.ships.push(defaultShip);

        for (let i = 2; i <= 14; i++) {
            this.ships.push({
                id: `nave${i}`,
                name: `Nave ${i}`,
                path: `../images/naves/nave${i}.png`
            });
        }

        this.renderShipSelection();
    }

    renderShipSelection() {
        const shipGrid = document.getElementById('ship-grid');
        shipGrid.innerHTML = '';

        this.ships.forEach((ship, index) => {
            const shipItem = document.createElement('div');
            shipItem.className = `ship-item ${ship.path === this.selectedShip ? 'selected' : ''}`;
            shipItem.innerHTML = `
                <img src="${ship.path}" alt="${ship.name}" onerror="this.src='../images/naves/spaceship.png'">
                <div class="ship-name">${ship.name}</div>
            `;
            
            shipItem.addEventListener('click', () => this.selectShip(ship.path, index));
            shipGrid.appendChild(shipItem);
        });
    }

    selectShip(shipPath, index) {
        this.selectedShip = shipPath;
        this.renderShipSelection();
    }

    confirmShipSelection() {
        this.showMenu('main');
    }

    showMenu(menuType) {
        document.querySelectorAll('.menu-section').forEach(section => {
            section.classList.add('hidden');
        });

        switch(menuType) {
            case 'main':
                document.getElementById('main-menu').classList.remove('hidden');
                this.currentMenu = 'main';
                break;
            case 'customization':
                document.getElementById('customization-menu').classList.remove('hidden');
                this.currentMenu = 'customization';
                break;
            case 'rankings':
                document.getElementById('rankings-menu').classList.remove('hidden');
                this.currentMenu = 'rankings';
                break;
        }
    }

    validatePlayerInfo() {
        if (!this.playerName) {
            this.showError('Por favor ingresa un nombre de jugador');
            return false;
        }
        
        if (this.playerName.length < 2) {
            this.showError('El nombre debe tener al menos 2 caracteres');
            return false;
        }

        return true;
    }

    showError(message) {
        let errorDiv = document.querySelector('.error-message');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            document.getElementById('main-menu').appendChild(errorDiv);
        }
        errorDiv.textContent = message;

        setTimeout(() => {
            if (errorDiv) {
                errorDiv.remove();
            }
        }, 3000);
    }

    handlePlay() {
        if (!this.validatePlayerInfo()) {
            return;
        }

        const playerConfig = {
            name: this.playerName,
            ship: this.selectedShip
        };

        sessionStorage.setItem('playerConfig', JSON.stringify(playerConfig));
        
        // Redirigir al juego principal
        window.location.href = '../index.html';
    }

    startGame(playerConfig) {
        localStorage.setItem('playerConfig', JSON.stringify(playerConfig));
        
        // Redirigir al juego principal
        window.location.href = '../index.html';
    }

    showRankings() {
        this.showMenu('rankings');
        this.loadRankings();
    }

    // ================================
    //   CONEXIÓN REAL CON EL BACKEND
    // ================================
    async loadRankings() {
        const container = document.getElementById('rankings-container');
        container.innerHTML = '<div class="loading">Cargando clasificaciones...</div>';

        try {
            const response = await fetch('/api/rankings', {
                method: 'GET'
            });

            if (!response.ok) {
                throw new Error('Respuesta no OK del servidor');
            }

            const data = await response.json();

            // Adaptar el formato del backend a lo que usa displayRankings
            // Backend envía: { playerName, games, wins, kills, deaths, score }
            const rankings = data.map(item => ({
                name: item.playerName || item.name || 'Jugador',
                score: item.score || 0
            }));

            this.displayRankings(rankings);
        } catch (error) {
            console.error('Error cargando rankings:', error);
            container.innerHTML = '<div class="error-message">No se pudieron cargar las clasificaciones</div>';
        }
    }

    displayRankings(rankings) {
        const container = document.getElementById('rankings-container');
        container.innerHTML = '';

        rankings.forEach((player, index) => {
            const rankItem = document.createElement('div');
            rankItem.className = `ranking-item ${player.name === this.playerName ? 'current-player' : ''}`;
            rankItem.innerHTML = `
                <div class="rank-position">#${index + 1}</div>
                <div class="rank-name">${player.name}</div>
                <div class="rank-score">${player.score} pts</div>
            `;
            container.appendChild(rankItem);
        });

        if (rankings.length === 0) {
            container.innerHTML = '<div class="error-message">No hay datos de clasificación disponibles</div>';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MenuManager();
});
