import { Game } from './game.js';
import { PuzzleGame } from './puzzle.js';
import { Assets } from './assets.js';
import { AudioManager } from './audio.js';
import {
    registerUser,
    loginUser,
    logoutUser,
    getLeaderboard,
    getPuzzleLeaderboard,
    savePuzzleStats,
    syncPuzzleStats,
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
// const startBtn = document.getElementById('start-btn'); // Removed
const startCatchBtn = document.getElementById('start-catch-btn');
const startPuzzleBtn = document.getElementById('start-puzzle-btn');
const restartBtn = document.getElementById('restart-btn');
const lobbyBtn = document.getElementById('lobby-btn');
const gameOverScreen = document.getElementById('game-over-screen');
const gameOverLeaderboardBtn = document.getElementById('gameover-leaderboard-btn');
const puzzleLeaderboardBtn = document.getElementById('puzzle-leaderboard-btn');

const pauseBtn = document.getElementById('pause-btn');
const resumeBtn = document.getElementById('resume-btn');
const lobbyBtnHud = document.getElementById('lobby-btn-hud');
const pauseLobbyBtn = document.getElementById('pause-lobby-btn');
const uiLayer = document.getElementById('ui-layer'); // Ensure access to toggle HUD mode

// HUD Mode Manager
function updateHUDMode(mode) {
    const catchStats = document.getElementById('catch-stats');
    const puzzleStats = document.getElementById('puzzle-stats');

    if (mode === 'puzzle') {
        catchStats.classList.add('hidden');
        puzzleStats.classList.remove('hidden');
    } else {
        catchStats.classList.remove('hidden');
        puzzleStats.classList.add('hidden');
    }
}

// Global Pause Toggle
function togglePause() {
    if (!startScreen.classList.contains('hidden')) return; // Ignore if in menu

    const isPuzzle = !document.getElementById('puzzle-container').classList.contains('hidden');

    if (isPuzzle && puzzleGame) {
        puzzleGame.togglePause();
    } else if (game) {
        game.togglePause();
    }
}

// Return to Lobby Logic
function returnToLobby() {
    // Hide screens
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('puzzle-container').classList.add('hidden'); // Hide puzzle specifically
    document.getElementById('game-over-screen').classList.add('hidden');

    // Hide Lobby Button HUD
    if (lobbyBtnHud) lobbyBtnHud.classList.add('hidden');

    // Remove game-active classes
    document.body.classList.remove('game-active', 'puzzle-active');

    // Resume audio context if needed
    if (audio.ctx.state === 'suspended') audio.ctx.resume();

    // Show Start Screen changes
    startScreen.classList.remove('hidden');

    // Reset Games
    if (game) game.reset();
    if (puzzleGame) puzzleGame.exit(); // This should stop timer and clean up

    // Close Leaderboard / Reset Sidebar
    if (leaderboardModal) {
        leaderboardModal.classList.add('hidden');
        leaderboardModal.classList.remove('sidebar-mode');
    }
}

// Game State
const audio = new AudioManager();
let game;
let puzzleGame;
let currentUser = null;
let isLoginMode = true;

// Auth Logic
function updateAuthUI() {
    if (isLoginMode) {
        authTitle.innerText = "Login";
        authActionBtn.innerText = "LOGIN";
        toggleAuthBtn.innerText = "No account? Sign up";
        nicknameInput.classList.add('hidden');
    } else {
        authTitle.innerText = "Register";
        authActionBtn.innerText = "CREATE ACCOUNT";
        toggleAuthBtn.innerText = "Already have an account? Login";
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
        authError.innerText = "Processing...";
        const email = emailInput.value;
        const password = passwordInput.value;
        const nickname = nicknameInput.value;

        if (!email || !password) {
            authError.innerText = "Please enter email and password";
            return;
        }

        if (isLoginMode) {
            await loginUser(email, password);
        } else {
            if (!nickname) {
                authError.innerText = "Please enter a nickname";
                return;
            }
            await registerUser(email, password, nickname);
        }
    } catch (error) {
        // Error handled in UI

        let msg = error.message;
        if (msg.includes('auth/invalid-email')) msg = "Invalid email";
        else if (msg.includes('auth/user-not-found')) msg = "User not found";
        else if (msg.includes('auth/wrong-password')) msg = "Incorrect password";
        else if (msg.includes('auth/email-already-in-use')) msg = "Email already in use";
        else if (msg.includes('auth/weak-password')) msg = "Weak password (min 6 chars)";

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

// Shared Leaderboard Loader
async function loadLeaderboard(type = 'main') {
    if (!leaderboardModal || !leaderboardList) return;

    leaderboardModal.classList.remove('hidden');
    leaderboardList.innerHTML = 'Loading...';

    const ribbonTitle = leaderboardModal.querySelector('.ribbon h2');

    try {
        let data = [];
        if (type === 'puzzle') {
            if (ribbonTitle) ribbonTitle.textContent = "PUZZLE MASTERS";
            data = await getPuzzleLeaderboard();
        } else {
            if (ribbonTitle) ribbonTitle.textContent = "TOP 10 FARMERS";
            data = await getLeaderboard();
        }

        if (data.length === 0) {
            leaderboardList.innerHTML = '<p>No data yet.</p>';
            return;
        }

        leaderboardList.innerHTML = '';
        data.forEach((entry, index) => {
            const rank = index + 1;
            const row = document.createElement('div');
            row.className = `leaderboard-entry rank-${rank}`;

            let medal = '';
            if (rank === 1) medal = '🥇 ';
            if (rank === 2) medal = '🥈 ';
            if (rank === 3) medal = '🥉 ';

            let scoreText = '';
            if (type === 'puzzle') {
                // Format time: e.g., 1.5h or 45m
                let timeStr = "";
                const hours = Math.floor(entry.time / 3600);
                const minutes = Math.floor((entry.time % 3600) / 60);

                if (hours > 0) timeStr = `${hours}h ${minutes}m`;
                else timeStr = `${minutes}m`;
                scoreText = `Level ${entry.level} <small>(${timeStr})</small>`;
            } else {
                scoreText = `${entry.score} pts`;
            }

            row.innerHTML = `
                <span>${medal}#${rank} ${entry.nickname}</span>
                <span>${scoreText}</span>
            `;
            leaderboardList.appendChild(row);
        });
    } catch (e) {
        console.error("Error loading leaderboard:", e);
        leaderboardList.innerHTML = '<p style="color:red">Connection error.</p>';
    }
}

// Leaderboard Logic
if (leaderboardBtn) {
    leaderboardBtn.addEventListener('click', async () => {
        // console.log("BOARD: Button clicked");
        leaderboardModal.classList.remove('hidden');

        // Reset Title for Main Game
        const ribbonTitle = leaderboardModal.querySelector('.ribbon h2');
        if (ribbonTitle) ribbonTitle.textContent = "TOP 10 FARMERS";

        leaderboardList.innerHTML = 'Loading...';

        try {
            // console.log("BOARD: Fetching...");
            const data = await getLeaderboard();
            // console.log("BOARD: Data:", data);

            if (data.length === 0) {
                leaderboardList.innerHTML = '<p>No data yet.</p>';
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
            leaderboardList.innerHTML = '<p style="color:red">Connection error.</p>';
        }
    });
}

if (closeLeaderboardBtn) {
    closeLeaderboardBtn.addEventListener('click', () => {
        leaderboardModal.classList.add('hidden');
    });
}

// Game Over Leaderboard Button Handler
if (gameOverLeaderboardBtn) {
    gameOverLeaderboardBtn.addEventListener('click', () => {
        leaderboardModal.classList.remove('sidebar-mode');
        loadLeaderboard('main'); // Shows main score for Catch Game
    });
}

// Function to refresh leaderboard data
async function refreshLeaderboard() {
    // Check which game is active or check title
    const ribbonTitle = leaderboardModal.querySelector('.ribbon h2');
    if (ribbonTitle && ribbonTitle.textContent.includes('PUZZLE')) {
        await loadLeaderboard('puzzle');
    } else {
        await loadLeaderboard('main');
    }
}


// Puzzle Leaderboard Logic
if (puzzleLeaderboardBtn) {
    puzzleLeaderboardBtn.addEventListener('click', async () => {
        leaderboardModal.classList.remove('hidden');
        leaderboardModal.classList.remove('sidebar-mode'); // Always full modal for puzzle
        leaderboardList.innerHTML = 'Loading Records...';

        // Update Title
        const ribbonTitle = leaderboardModal.querySelector('.ribbon h2');
        if (ribbonTitle) ribbonTitle.textContent = "PUZZLE MASTERS";

        try {
            const data = await getPuzzleLeaderboard();

            if (data.length === 0) {
                leaderboardList.innerHTML = '<p>No data yet.</p>';
                return;
            }

            leaderboardList.innerHTML = '';
            data.forEach((entry, index) => {
                const rank = index + 1;
                const row = document.createElement('div');
                row.className = `leaderboard-entry rank-${rank}`;

                let medal = '';
                if (rank === 1) medal = '🥇 ';
                if (rank === 2) medal = '🥈 ';
                if (rank === 3) medal = '🥉 ';

                // Format time: e.g., 1.5h or 45m
                let timeStr = "";
                const hours = Math.floor(entry.time / 3600);
                const minutes = Math.floor((entry.time % 3600) / 60);

                if (hours > 0) timeStr = `${hours}h ${minutes}m`;
                else timeStr = `${minutes}m`;

                row.innerHTML = `
                    <span>${medal}#${rank} ${entry.nickname}</span>
                    <span>Level ${entry.level} <small>(${timeStr})</small></span>
                `;
                leaderboardList.appendChild(row);
            });
        } catch (e) {
            console.error("Error fetching puzzle leaderboard:", e);
            leaderboardList.innerHTML = '<p style="color:red">Connection error.</p>';
        }
    });

    // Reset title when closing? Maybe needed if sharing modal.
    // Yes, the main leaderboard button should reset it.
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
        // Initialize Puzzle Game with Callback
        puzzleGame = new PuzzleGame(audio, async (level, timeElapsed) => {
            if (currentUser && currentUser.uid) {
                // console.log(`Saving Puzzle Stats: Level ${level}, Time ${timeElapsed}s`);
                await savePuzzleStats(currentUser.uid, level, timeElapsed);
            }
        });

        // Sync initial stats (in case they have local progress but no cloud record)
        if (currentUser && currentUser.uid) {
            await syncPuzzleStats(currentUser.uid, puzzleGame.level);
        }

        // Setup Game Event Listeners
        if (startCatchBtn) {
            startCatchBtn.addEventListener('click', () => {
                if (audio.ctx.state === 'suspended') audio.ctx.resume();
                startScreen.classList.add('hidden');

                // Set HUD Mode
                updateHUDMode('catch');

                // Switch to Sidebar Mode for in-game
                if (leaderboardModal) {
                    leaderboardModal.classList.add('sidebar-mode');
                }

                // Auto-open leaderboard ONLY on desktop (screen width > 768px)
                const isMobile = window.innerWidth <= 768;
                if (!isMobile) {
                    loadLeaderboard('main');
                }

                // Show Lobby Button HUD
                if (lobbyBtnHud) lobbyBtnHud.classList.remove('hidden');

                // Add game-active class to hide logo
                document.body.classList.add('game-active');

                game.start();
            });
        }

        if (startPuzzleBtn) {
            startPuzzleBtn.addEventListener('click', () => {
                // Ensure audio context is resume if needed (even though puzzle might be quiet initially)
                if (audio.ctx.state === 'suspended') audio.ctx.resume();

                startScreen.classList.add('hidden');

                // Set HUD Mode
                updateHUDMode('puzzle');

                // Switch to Sidebar Mode for in-game
                if (leaderboardModal) {
                    leaderboardModal.classList.add('sidebar-mode');
                }

                // Auto-open leaderboard ONLY on desktop (screen width > 768px)
                const isMobile = window.innerWidth <= 768;
                if (!isMobile) {
                    loadLeaderboard('puzzle');
                }

                // Show Lobby Button HUD
                if (lobbyBtnHud) lobbyBtnHud.classList.remove('hidden');

                // Add game-active and puzzle-active classes
                document.body.classList.add('game-active', 'puzzle-active');

                // Start Puzzle Mode
                puzzleGame.start();
            });
        }

        restartBtn.addEventListener('click', () => {
            gameOverScreen.classList.add('hidden');

            // Close leaderboard on mobile when restarting
            const isMobile = window.innerWidth <= 768;
            if (isMobile && leaderboardModal && !leaderboardModal.classList.contains('hidden')) {
                closeLeaderboardBtn.click();
            }

            game.restart();
        });

        // Lobby Button Logic
        if (lobbyBtn) {
            lobbyBtn.addEventListener('click', () => {
                gameOverScreen.classList.add('hidden');
                startScreen.classList.remove('hidden');

                // Close leaderboard if open (reset to clean state)
                if (leaderboardModal && !leaderboardModal.classList.contains('hidden')) {
                    closeLeaderboardBtn.click();
                }

                // Ensure sidebar mode is removed so it defaults to modal when opened again in lobby
                if (leaderboardModal) {
                    leaderboardModal.classList.remove('sidebar-mode');
                }
            });
        }

        // Auto-show leaderboard on mobile when game over screen appears
        const gameOverObserver = new MutationObserver(() => {
            const isMobile = window.innerWidth <= 768;
            if (isMobile && !gameOverScreen.classList.contains('hidden') && leaderboardBtn) {
                // Remove sidebar mode for full modal display on game over
                if (leaderboardModal) {
                    leaderboardModal.classList.remove('sidebar-mode');
                }
                leaderboardBtn.click();
            }

            // Refresh leaderboard data whenever game over screen appears
            if (!gameOverScreen.classList.contains('hidden')) {
                refreshLeaderboard();
            }
        });
        gameOverObserver.observe(gameOverScreen, { attributes: true, attributeFilter: ['class'] });

        pauseBtn.addEventListener('click', togglePause);
        resumeBtn.addEventListener('click', togglePause);

        if (lobbyBtnHud) lobbyBtnHud.addEventListener('click', returnToLobby);
        if (pauseLobbyBtn) pauseLobbyBtn.addEventListener('click', returnToLobby);
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
