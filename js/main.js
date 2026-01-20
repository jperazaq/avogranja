import { Game } from './game.js';
import { Assets } from './assets.js';
import { AudioManager } from './audio.js';
import {
    registerUser,
    loginUser,
    logoutUser,
    getLeaderboard,
    subscribeToAuthChanges
} from './firebase-services.js';

// DOM Elements
const loginContainer = document.getElementById('login-container');
const gameContainer = document.getElementById('game-container');
const nicknameInput = document.getElementById('nickname-input'); // Added nickname input
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const authActionBtn = document.getElementById('auth-action-btn');
const toggleAuthBtn = document.getElementById('toggle-auth-btn');
const authTitle = document.getElementById('auth-title');
const authError = document.getElementById('auth-error');
const logoutBtn = document.getElementById('logout-btn');
const leaderboardBtn = document.getElementById('leaderboard-btn');
const leaderboardModal = document.getElementById('leaderboard-modal');
const leaderboardList = document.getElementById('leaderboard-list');
const closeLeaderboardBtn = document.getElementById('close-leaderboard');

const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const gameOverScreen = document.getElementById('game-over-screen');

const pauseBtn = document.getElementById('pause-btn');
const resumeBtn = document.getElementById('resume-btn');

// Game State
const audio = new AudioManager();
let game;
let currentUser = null;
let isLoginMode = true;

// Auth Logic
function updateAuthUI() {
    if (isLoginMode) {
        authTitle.innerText = "Ingresar";
        authActionBtn.innerText = "INGRESAR";
        toggleAuthBtn.innerText = "¿No tienes cuenta? Regístrate";
        nicknameInput.classList.add('hidden');
    } else {
        authTitle.innerText = "Registro";
        authActionBtn.innerText = "CREAR CUENTA";
        toggleAuthBtn.innerText = "¿Ya tienes cuenta? Ingresa";
        nicknameInput.classList.remove('hidden');
    }
    authError.innerText = "";
}

toggleAuthBtn.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    updateAuthUI();
});

authActionBtn.addEventListener('click', async () => {
    try {
        authError.innerText = "Procesando...";
        const email = emailInput.value;
        const password = passwordInput.value;
        const nickname = nicknameInput.value;

        if (!email || !password) {
            authError.innerText = "Por favor ingresa correo y contraseña";
            return;
        }

        if (isLoginMode) {
            await loginUser(email, password);
        } else {
            if (!nickname) {
                authError.innerText = "Por favor ingresa un apodo";
                return;
            }
            await registerUser(email, password, nickname);
        }
    } catch (error) {
        // Error handled in UI

        let msg = error.message;
        if (msg.includes('auth/invalid-email')) msg = "Correo inválido";
        else if (msg.includes('auth/user-not-found')) msg = "Usuario no encontrado";
        else if (msg.includes('auth/wrong-password')) msg = "Contraseña incorrecta";
        else if (msg.includes('auth/email-already-in-use')) msg = "El correo ya está registrado";
        else if (msg.includes('auth/weak-password')) msg = "Contraseña muy débil (min 6 caracteres)";

        authError.innerText = msg;
    }
});

logoutBtn.addEventListener('click', async () => {
    try {
        await logoutUser();
        window.location.reload(); // Force reload to clear game state and go to login
    } catch (error) {
        // Silent fail on logout
    }
});

// Leaderboard Logic
if (leaderboardBtn) {
    leaderboardBtn.addEventListener('click', async () => {
        // console.log("BOARD: Button clicked");
        leaderboardModal.classList.remove('hidden');
        leaderboardList.innerHTML = 'Cargando...';

        try {
            // console.log("BOARD: Fetching...");
            const data = await getLeaderboard();
            // console.log("BOARD: Data:", data);

            if (data.length === 0) {
                leaderboardList.innerHTML = '<p>No hay datos aún.</p>';
                return;
            }

            leaderboardList.innerHTML = '';
            data.forEach((entry, index) => {
                const rank = index + 1;
                const row = document.createElement('div');
                row.className = `leaderboard-entry rank-${rank}`;

                // Add medals for top 3
                let medal = '';
                if (rank === 1) medal = '🥇 ';
                if (rank === 2) medal = '🥈 ';
                if (rank === 3) medal = '🥉 ';

                row.innerHTML = `
                    <span>${medal}#${rank} ${entry.nickname}</span>
                    <span>${entry.score} pts</span>
                `;
                leaderboardList.appendChild(row);
            });
        } catch (e) {
            // console.error("BOARD: Error fetching:", e);
            leaderboardList.innerHTML = '<p style="color:red">Error de conexión.</p>';
        }
    });
}

if (closeLeaderboardBtn) {
    closeLeaderboardBtn.addEventListener('click', () => {
        leaderboardModal.classList.add('hidden');
    });
}

// Resize Handler
window.addEventListener('resize', () => {
    if (game) game.resize();
});

// Game Init
async function initGame(user) {
    if (!game) {
        await Assets.loadAll();
        // Pass user to Game constructor
        game = new Game(audio, user);

        // Setup Game Event Listeners
        startBtn.addEventListener('click', () => {
            if (audio.ctx.state === 'suspended') audio.ctx.resume();
            startScreen.classList.add('hidden');

            // Switch to Sidebar Mode for in-game
            if (leaderboardModal) {
                leaderboardModal.classList.add('sidebar-mode');
            }

            // Auto-open leaderboard if requested (acts as persistent HUD)
            if (leaderboardBtn) leaderboardBtn.click();

            game.start();
        });

        restartBtn.addEventListener('click', () => {
            gameOverScreen.classList.add('hidden');
            game.start();
        });

        pauseBtn.addEventListener('click', () => game.togglePause());
        resumeBtn.addEventListener('click', () => game.togglePause());
    } else {
        // If game exists, just update user (handling potential re-login with different user)
        game.updateUser(user);
    }
}

// Auth State Observer
subscribeToAuthChanges(async (user) => {
    if (user) {
        currentUser = user;
        // Show Game, Hide Login
        loginContainer.classList.add('hidden');
        gameContainer.classList.remove('hidden');

        await initGame(user);
    } else {
        currentUser = null;
        // Show Login, Hide Game
        loginContainer.classList.remove('hidden');
        gameContainer.classList.add('hidden');
    }
});
