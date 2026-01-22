import { Player, Avocado, FloatingText } from './entities.js';
import { Assets } from './assets.js';
import { getUserStats, saveUserHighScore } from './firebase-services.js';

export class Game {
    constructor(audioManager, user) {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.audio = audioManager;
        this.user = user;

        this.width = 0;
        this.height = 0;

        this.player = null;
        this.avocados = [];
        this.particles = []; // Floating texts

        this.score = 20;
        this.maxScore = 20; // Track the highest score reached
        this.highScore = 0;

        if (this.user) {
            this.fetchHighScore();
        }

        this.isRunning = false;
        this.isPaused = false;
        this.gameOver = false;

        this.lastTime = 0;
        this.spawnTimer = 0;
        this.spawnInterval = 770; // 30% faster - 0.77s between spawns
        this.difficultyTimer = 0;
        this.speedMultiplier = 1.64; // 30% faster (was 1.26)

        // Combo system
        this.comboCount = 0;
        this.comboTimer = 0;

        this.scoreDisplay = document.getElementById('score-display');
        this.finalScoreDisplay = document.getElementById('final-score');
        this.highScoreDisplay = document.getElementById('high-score');
        this.hudHighScoreDisplay = document.getElementById('hud-high-score');
        this.gameOverScreen = document.getElementById('game-over-screen');
        this.pauseScreen = document.getElementById('pause-screen');

        this.setupInput();
        this.resize();
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        if (this.player) {
            this.player.y = this.height - this.player.height - 20;
            this.player.gameWidth = this.width;
        } else {
            this.player = new Player(this.width, this.height);
        }
    }

    setupInput() {
        // Mouse & Touch handling
        const updatePlayerPos = (clientX) => {
            if (this.player && this.isRunning && !this.isPaused && !this.gameOver) {
                this.player.updateInput(clientX);
            }
        };

        window.addEventListener('mousemove', e => updatePlayerPos(e.clientX));
        window.addEventListener('touchmove', e => {
            e.preventDefault();
            updatePlayerPos(e.touches[0].clientX);
        }, { passive: false });

        window.addEventListener('touchstart', e => {
            updatePlayerPos(e.touches[0].clientX);
        }, { passive: false });

        // Add keyboard pause
        window.addEventListener('keydown', e => {
            if (e.key === 'Escape' || e.key === 'p') {
                this.togglePause();
            }
        });
    }

    togglePause() {
        if (!this.isRunning || this.gameOver) return;
        this.isPaused = !this.isPaused;

        if (this.isPaused) {
            this.pauseScreen.classList.remove('hidden');
            this.audio.stopBackgroundMusic(); // Pause music
        } else {
            this.pauseScreen.classList.add('hidden');
            this.audio.startBackgroundMusic(); // Resume music
            this.lastTime = performance.now(); // Prevent large dt jump
            requestAnimationFrame(t => this.loop(t));
        }
    }

    async fetchHighScore() {
        if (!this.user) return;
        try {
            const data = await getUserStats(this.user.uid);
            this.highScore = data.highScore || 0;
            // Update display
            if (this.highScoreDisplay) this.highScoreDisplay.innerText = this.highScore;
            if (this.hudHighScoreDisplay) this.hudHighScoreDisplay.innerText = this.highScore;
            if (this.user) {
                // High score loaded
            }
        } catch (e) {
            // Error fetching high score
        }
    }

    async saveHighScore() {
        if (!this.user) return;
        try {
            await saveUserHighScore(this.user.uid, this.highScore);
            await saveUserHighScore(this.user.uid, this.highScore);
            // High score saved
        } catch (e) {
            // Error saving high score
        }
    }

    updateUser(user) {
        this.user = user;
        this.fetchHighScore();
    }

    restart() {
        this.start();
    }

    start() {
        this.score = 20;
        this.maxScore = 20; // Reset max score for this session
        this.updateScoreUI();
        this.avocados = [];
        this.particles = [];
        this.speedMultiplier = 1.64; // 30% faster (was 1.26)
        this.speedBoostApplied = false;
        this.spawnInterval = 770; // 30% faster - 0.77s between spawns
        this.isRunning = true;
        this.isPaused = false;
        this.gameOver = false;
        this.lastTime = performance.now();
        this.pauseScreen.classList.add('hidden');

        // Start background music
        this.audio.startBackgroundMusic();

        // Reset player
        this.player.x = this.width / 2 - this.player.width / 2;

        requestAnimationFrame(t => this.loop(t));
    }

    loop(timestamp) {
        if (!this.isRunning) return;
        if (this.isPaused) return; // Stop loop

        const dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        if (!this.gameOver) {
            requestAnimationFrame(t => this.loop(t));
        }
    }

    update(dt) {
        this.player.update(dt);

        // Spawning
        this.spawnTimer += dt * 1000;
        if (this.spawnTimer > this.spawnInterval) {
            this.spawnTimer = 0;
            const spawnX = this.treeBounds ?
                this.treeBounds.x + Math.random() * this.treeBounds.width :
                Math.random() * (this.width - 64);

            this.avocados.push(new Avocado(spawnX, this.speedMultiplier));
        }

        // Difficulty Increase
        this.difficultyTimer += dt;
        if (this.difficultyTimer > 10) { // Every 10 seconds
            this.difficultyTimer = 0;
            this.speedMultiplier += 0.1;
            this.spawnInterval = Math.max(500, this.spawnInterval - 100);
        }

        // Combo Decay
        if (this.comboCount > 0) {
            this.comboTimer += dt;
            if (this.comboTimer > 2.0) {
                this.comboCount = 0; // Reset combo if too slow
            }
        }

        // Avocados
        for (let i = this.avocados.length - 1; i >= 0; i--) {
            const avo = this.avocados[i];
            avo.update(dt);

            // Collision
            if (this.checkCollision(this.player, avo)) {
                this.handleCatch(avo);
                this.avocados.splice(i, 1);
                continue;
            }

            // Missed
            if (avo.y > this.height) {
                this.handleDrop(avo);
                this.avocados.splice(i, 1);
            }
        }

        // Particles
        this.particles = this.particles.filter(p => !p.markedForDeletion);
        this.particles.forEach(p => p.update(dt));
    }

    checkCollision(rect1, rect2) {
        const b1 = rect1.getBounds();
        const b2 = rect2.getBounds();

        // AABB Collision with a bit of forgiveness (inset)
        const padding = 20;
        return (
            b1.x + padding < b2.x + b2.width - padding &&
            b1.x + b1.width - padding > b2.x + padding &&
            b1.y + padding < b2.y + b2.height - padding &&
            b1.y + b1.height - padding > b2.y + padding
        );
    }

    handleCatch(avo) {
        if (avo.isPowerUp) {
            this.score += 20; // Requested +20
            this.audio.playCatchPowerUp();
            this.particles.push(new FloatingText(this.player.x, this.player.y - 50, 'plus20'));
        } else {
            this.score += 10;
            this.audio.playCatch();
            this.particles.push(new FloatingText(this.player.x, this.player.y - 50, 'plus'));

            // Combo Logic
            this.comboCount++;
            this.comboTimer = 0;
            if (this.comboCount >= 3) {
                this.audio.playCombo();
            }

            // Speed Increase at 250 points
            if (this.score >= 250 && !this.speedBoostApplied) {
                this.speedMultiplier *= 1.5; // Increase by 50%
                this.speedBoostApplied = true;
                this.particles.push(new FloatingText(this.width / 2, this.height / 2, 'plus')); // Optional visual cue? better not confuse.
                // console.log('Speed Boost applied! Multiplier:', this.speedMultiplier);
            }
        }

        this.updateScoreUI();
    }

    handleDrop(avo) {
        if (avo.isPowerUp) {
            this.score -= 40; // Lose 40 for missed powerup
            this.particles.push(new FloatingText(avo.x, this.height - 100, 'minus40'));
        } else {
            this.score -= 20; // Lose 20 for missed avocado
            this.particles.push(new FloatingText(avo.x, this.height - 100, 'minus20'));
        }

        this.comboCount = 0;
        this.audio.playDrop();

        if (this.score <= 0) {
            this.triggerGameOver();
        }
        this.updateScoreUI();
    }

    updateScoreUI() {
        this.scoreDisplay.innerText = this.score;

        // Track max score reached
        if (this.score > this.maxScore) {
            this.maxScore = this.score;
        }

        // Check for new record dynamically
        if (this.maxScore > this.highScore) {
            if (this.hudHighScoreDisplay) this.hudHighScoreDisplay.innerText = this.maxScore;
        }

        // Simple animation
        this.scoreDisplay.style.transform = 'scale(1.5)';
        setTimeout(() => this.scoreDisplay.style.transform = 'scale(1)', 100);
    }

    triggerGameOver() {
        this.gameOver = true;
        this.isRunning = false;
        this.audio.stopBackgroundMusic(); // Stop background music
        this.audio.playGameOver();

        // Update high score if needed
        if (this.maxScore > this.highScore) {
            this.highScore = this.maxScore;
            this.saveHighScore();
        }

        // Display final score (max reached) and high score
        this.finalScoreDisplay.innerText = this.maxScore;
        this.highScoreDisplay.innerText = this.highScore;

        this.gameOverScreen.classList.remove('hidden');
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw Tree (Centered at top)
        const treeImg = Assets.get('tree');
        if (treeImg) {
            // Scale tree to fit nicely
            const treeScale = Math.min(this.width / treeImg.width, 0.8);
            const tW = treeImg.width * treeScale;
            const tH = treeImg.height * treeScale;
            this.ctx.drawImage(treeImg, this.width / 2 - tW / 2, -50, tW, tH); // Slightly up

            // Store tree bounds for spawning
            this.treeBounds = {
                x: this.width / 2 - tW / 2 + 50, // inner buffer
                width: tW - 100
            };
        } else {
            this.treeBounds = { x: 0, width: this.width };
        }

        // Draw Player
        this.player.draw(this.ctx);

        // Draw Avocados
        this.avocados.forEach(a => a.draw(this.ctx));

        // Draw Particles
        this.particles.forEach(p => p.draw(this.ctx));

        // Note: Background is CSS.
    }
}
