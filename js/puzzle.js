
export class PuzzleGame {
    constructor(audioManager, onLevelComplete) {
        this.audio = audioManager;
        this.onLevelComplete = onLevelComplete;
        this.container = document.getElementById('puzzle-container');
        this.gridElement = document.getElementById('puzzle-grid');
        this.levelDisplay = document.getElementById('hud-puzzle-level');
        this.timerDisplay = document.getElementById('hud-puzzle-timer');
        this.countdownDisplay = document.getElementById('puzzle-countdown');
        this.referenceModal = document.getElementById('reference-modal');
        this.referenceImg = document.getElementById('reference-img');

        // Load saved level or default to 1
        this.level = parseInt(localStorage.getItem('avocash_puzzle_level')) || 1;
        this.gridSize = 3;
        this.pieces = [];
        this.emptyPieceIndex = -1;
        this.isPlaying = false;
        this.isPaused = false;
        this.levelStartTime = 0;

        this.timerInterval = null;
        this.timeRemaining = 0;

        // Populate with actual assets (Add timestamp to force refresh)
        this.images = [];
        const cacheBuster = Date.now();
        for (let i = 1; i <= 10; i++) {
            this.images.push(`assets/nivel${i}.png?v=${cacheBuster}`);
        }

        this.setupEventListeners();
    }
    // ... (lines 33-219 skipped, target runStartSequence)
    runStartSequence() {
        let count = 3;
        this.countdownDisplay.textContent = count;
        this.countdownDisplay.classList.remove('hidden');

        if (this.audio) this.audio.playTick();

        const countInterval = setInterval(() => {
            count--;
            if (count > 0) {
                this.countdownDisplay.textContent = count;
                if (this.audio) this.audio.playTick();
            } else {
                clearInterval(countInterval);
                this.countdownDisplay.classList.add('hidden');

                // START GAME
                if (this.audio) {
                    this.audio.playStart();
                    this.audio.startBackgroundMusic();
                }
                this.shuffle();
                this.render();
                this.isPlaying = true; // Enable clicks
                this.levelStartTime = Date.now(); // Track start time

                // Start Level Timer
                this.startCountdown(60 + (this.level * 15));
            }
        }, 1000);
    }
    // ... (lines 228-414 skipped, target handleWin)
    handleWin() {
        this.stopTimer();
        this.isPlaying = false;

        // Calculate time spent
        const timeElapsed = (Date.now() - this.levelStartTime) / 1000;

        // Notify Main App to save stats
        if (this.onLevelComplete) {
            this.onLevelComplete(this.level, timeElapsed);
        }

        alert(`¡Nivel ${this.level} Completado!`);

        this.level++;
        localStorage.setItem('avocash_puzzle_level', this.level);

        // Reload next level
        this.loadLevel();
    }

    setupEventListeners() {
        // Global pointer up to catch loose drags
        document.addEventListener('pointerup', () => this.handlePointerUp());
        document.addEventListener('pointercancel', () => this.handlePointerUp());
        // For dragging outside grid
        document.addEventListener('pointermove', (e) => this.handlePointerMove(e));

        this.dragState = null;
    }

    // ... (rest of methods)

    handlePointerDown(e, index, tileElement) {
        if (!this.isPlaying) return;

        // Prevent default touch actions (scrolling) if inside grid?
        // Maybe risky. Better: e.preventDefault() if it's a valid tile.

        const neighbors = this.getNeighbors(this.emptyPieceIndex);
        if (!neighbors.includes(index)) return;

        // Determine valid axis
        const emptyX = this.emptyPieceIndex % this.gridSize;
        const emptyY = Math.floor(this.emptyPieceIndex / this.gridSize);
        const tileX = index % this.gridSize;
        const tileY = Math.floor(index / this.gridSize);

        let axis = ''; // 'x' or 'y'
        let direction = 0; // 1 or -1

        if (tileY === emptyY) {
            axis = 'x';
            direction = (emptyX > tileX) ? 1 : -1; // Move right or left
        } else if (tileX === emptyX) {
            axis = 'y';
            direction = (emptyY > tileY) ? 1 : -1; // Move down or up
        }

        this.dragState = {
            index: index,
            element: tileElement,
            startX: e.clientX,
            startY: e.clientY,
            axis: axis,
            direction: direction,
            tileSize: tileElement.offsetWidth
        };

        tileElement.setPointerCapture(e.pointerId);
    }

    handlePointerMove(e) {
        if (!this.dragState) return;
        e.preventDefault(); // Stop scroll

        const dx = e.clientX - this.dragState.startX;
        const dy = e.clientY - this.dragState.startY;

        // Constrain movement to axis towards empty slot
        let tx = 0, ty = 0;

        // Limit movement: can only move towards empty slot (0 to tileSize * direction)
        if (this.dragState.axis === 'x') {
            // If direction is 1 (Right), dx should be 0..size.
            // If direction is -1 (Left), dx should be -size..0.
            if (this.dragState.direction === 1) {
                tx = Math.max(0, Math.min(dx, this.dragState.tileSize));
            } else {
                tx = Math.min(0, Math.max(dx, -this.dragState.tileSize));
            }
        } else {
            if (this.dragState.direction === 1) {
                ty = Math.max(0, Math.min(dy, this.dragState.tileSize));
            } else {
                ty = Math.min(0, Math.max(dy, -this.dragState.tileSize));
            }
        }

        this.dragState.element.style.transform = `translate(${tx}px, ${ty}px)`;
        this.dragState.currentTx = tx;
        this.dragState.currentTy = ty;
    }

    handlePointerUp() {
        if (!this.dragState) return;

        const { index, axis, direction, tileSize, currentTx, currentTy } = this.dragState;

        // Threshold check (30%)
        const movedDist = (axis === 'x') ? Math.abs(currentTx) : Math.abs(currentTy);
        const threshold = tileSize * 0.3;

        // Reset transform immediately? The render will reset it anyway.
        this.dragState.element.style.transform = '';

        if (movedDist > threshold) {
            // Complete move
            this.swap(this.emptyPieceIndex, index);
        } else {
            // Snap back (handled by removing transform)
            // Optional: sound for snap back?
        }

        this.dragState = null;
    }

    // Replace render click handler with pointer events
    render() {
        this.gridElement.innerHTML = '';
        this.pieces.forEach((piece, index) => {
            const tile = document.createElement('div');
            tile.className = 'puzzle-tile';
            tile.style.touchAction = 'none'; // Critical for dragging on mobile

            if (piece) {
                piece.canvas.style.width = '100%';
                piece.canvas.style.height = '100%';
                tile.appendChild(piece.canvas);

                // Attach Pointer Events
                tile.onpointerdown = (e) => this.handlePointerDown(e, index, tile);

            } else {
                tile.className += ' empty';
            }
            this.gridElement.appendChild(tile);
        });
    }
    start() {
        this.container.classList.remove('hidden');
        // Resume level from memory (or default 1)
        this.level = parseInt(localStorage.getItem('avocash_puzzle_level')) || 1;
        this.loadLevel();
    }

    exit() {
        if (this.countdownDisplay) this.countdownDisplay.classList.add('hidden');
        this.container.classList.add('hidden');
        this.stopTimer();
        this.isPlaying = false;
        if (this.audio) this.audio.stopBackgroundMusic();
        document.getElementById('start-screen').classList.remove('hidden');

        // Show main HUD again
        const scorePanel = document.getElementById('score-panel');
        if (scorePanel) scorePanel.classList.remove('hidden');
    }

    async loadLevel() {
        this.stopTimer();
        this.isPlaying = false; // Disable clicks during preview

        // Grid size increases
        this.gridSize = Math.min(6, 3 + Math.floor((this.level - 1) / 2));
        this.levelDisplay.textContent = this.level;

        // Use modulo to cycle images
        const imageSrc = this.images[(this.level - 1) % this.images.length];
        this.referenceImg.src = imageSrc;

        await this.createPieces(imageSrc);

        // Render UNSHUFFLED (Solved state) for preview
        this.render();

        // Start 3-second Countdown
        this.runStartSequence();
    }

    runStartSequence() {
        let count = 3;
        this.countdownDisplay.textContent = count;
        this.countdownDisplay.classList.remove('hidden');

        if (this.audio) this.audio.playTick();

        const countInterval = setInterval(() => {
            count--;
            if (count > 0) {
                this.countdownDisplay.textContent = count;
                if (this.audio) this.audio.playTick();
            } else {
                clearInterval(countInterval);
                this.countdownDisplay.classList.add('hidden');

                // START GAME
                if (this.audio) this.audio.playStart();
                this.shuffle();
                this.render();
                this.isPlaying = true; // Enable clicks

                // Start Level Timer
                this.startCountdown(60 + (this.level * 15));
            }
        }, 1000);
    }

    startCountdown(seconds) {
        this.timeRemaining = seconds;
        this.updateTimerDisplay(this.timeRemaining);

        this.timerInterval = setInterval(() => {
            this.timeRemaining--;
            this.updateTimerDisplay(this.timeRemaining);

            if (this.timeRemaining <= 0) {
                this.stopTimer();
                this.handleGameOver();
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    togglePause() {
        if (this.isPaused) {
            this.resume();
        } else {
            this.pause();
        }
    }

    pause() {
        if (this.isPaused) return; // Already paused
        this.isPaused = true;
        this.isPlaying = false;
        this.stopTimer();
        if (this.audio) this.audio.stopBackgroundMusic();

        // Show pause screen
        document.getElementById('pause-screen').classList.remove('hidden');
    }

    resume() {
        if (!this.isPaused) return;
        this.isPaused = false;
        this.isPlaying = true;
        if (this.audio) this.audio.startBackgroundMusic();

        // Resume timer with remaining time
        this.startCountdown(this.timeRemaining);

        // Hide pause screen
        document.getElementById('pause-screen').classList.add('hidden');
    }

    updateTimerDisplay(seconds) {
        if (seconds < 0) seconds = 0;
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        if (this.timerDisplay) {
            this.timerDisplay.textContent = `${m}:${s}`;
        }

        // Visual warning
        if (seconds <= 10) {
            this.timerDisplay.style.color = '#ff4444';
        } else {
            this.timerDisplay.style.color = 'white';
        }
    }

    async createPieces(imageSrc) {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = imageSrc;
            img.onload = () => {
                this.pieces = [];
                // Ensure unique canvas elements

                // DPI Scaling
                const dpr = window.devicePixelRatio || 1;
                const pieceWidth = img.width / this.gridSize;
                const pieceHeight = img.height / this.gridSize;

                // Set Grid Aspect Ratio to match Image
                const aspectRatio = img.width / img.height;
                this.gridElement.style.aspectRatio = `${aspectRatio}`;

                this.gridElement.style.gridTemplateColumns = `repeat(${this.gridSize}, 1fr)`;

                for (let y = 0; y < this.gridSize; y++) {
                    for (let x = 0; x < this.gridSize; x++) {
                        // Skip last piece for empty slot
                        if (y === this.gridSize - 1 && x === this.gridSize - 1) {
                            this.pieces.push(null);
                            this.emptyPieceIndex = this.pieces.length - 1;
                            continue;
                        }

                        const canvas = document.createElement('canvas');
                        // Set physical size (resolution)
                        canvas.width = pieceWidth;
                        canvas.height = pieceHeight;

                        // If image is small, maybe scale up canvas resolution? 
                        // Actually, let's ensure canvas is at least displayed size * dpr.
                        // But simpler approach: use original image resolution, which is high (4k).

                        const ctx = canvas.getContext('2d');
                        // High quality smoothing
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';

                        ctx.drawImage(img,
                            x * pieceWidth, y * pieceHeight, pieceWidth, pieceHeight,
                            0, 0, canvas.width, canvas.height
                        );

                        this.pieces.push({
                            correctPos: y * this.gridSize + x,
                            canvas: canvas
                        });
                    }
                }
                resolve();
            };
        });
    }

    shuffle() {
        // Valid shuffle implementation
        let moves = 100;
        let p = this.emptyPieceIndex;
        for (let i = 0; i < moves; i++) {
            const neighbors = this.getNeighbors(p);
            const rand = neighbors[Math.floor(Math.random() * neighbors.length)];
            this.swap(p, rand, false);
            p = rand;
        }
        // Ensure emptyPieceIndex is correct after shuffle
        // swap updates this.emptyPieceIndex automatically
    }

    getNeighbors(index) {
        const neighbors = [];
        const x = index % this.gridSize;
        const y = Math.floor(index / this.gridSize);

        if (x > 0) neighbors.push(index - 1); // Left
        if (x < this.gridSize - 1) neighbors.push(index + 1); // Right
        if (y > 0) neighbors.push(index - this.gridSize); // Up
        if (y < this.gridSize - 1) neighbors.push(index + this.gridSize); // Down

        return neighbors;
    }

    swap(emptyIdx, targetIdx, checkWin = true) {
        // Swap array elements
        const temp = this.pieces[targetIdx];
        this.pieces[targetIdx] = this.pieces[emptyIdx]; // null
        this.pieces[emptyIdx] = temp;

        this.emptyPieceIndex = targetIdx;

        if (checkWin) {
            this.render();
            // Tiny delay to ensure render completes before alert
            setTimeout(() => this.checkWin(), 10);
        }
    }

    handlePointerDown(e, index, tile) {
        if (!this.isPlaying) return;

        // Check if index is a valid neighbor of the empty slot
        const neighbors = this.getNeighbors(this.emptyPieceIndex);
        if (!neighbors.includes(index)) return;

        e.preventDefault(); // Prevent default browser actions
        tile.setPointerCapture(e.pointerId);

        this.dragState = {
            startX: e.clientX,
            startY: e.clientY,
            tileIndex: index,
            tileElement: tile,
            pointerId: e.pointerId,
            startTime: Date.now() // For tap detection
        };
    }

    handlePointerMove(e) {
        if (!this.dragState) return;
        if (e.pointerId !== this.dragState.pointerId) return;

        const deltaX = e.clientX - this.dragState.startX;
        const deltaY = e.clientY - this.dragState.startY;

        // Determine axis based on empty slot relationship
        const emptyRow = Math.floor(this.emptyPieceIndex / this.gridSize);
        const emptyCol = this.emptyPieceIndex % this.gridSize;
        const tileRow = Math.floor(this.dragState.tileIndex / this.gridSize);
        const tileCol = this.dragState.tileIndex % this.gridSize;

        let moveX = 0;
        let moveY = 0;

        // Only allow movement towards empty slot
        if (emptyRow === tileRow) {
            // Horizontal move
            const maxMove = this.dragState.tileElement.offsetWidth;
            if (emptyCol > tileCol) { // Empty is Right
                moveX = Math.min(Math.max(0, deltaX), maxMove);
            } else { // Empty is Left
                moveX = Math.max(Math.min(0, deltaX), -maxMove);
            }
        } else if (emptyCol === tileCol) {
            // Vertical move
            const maxMove = this.dragState.tileElement.offsetHeight;
            if (emptyRow > tileRow) { // Empty is Down
                moveY = Math.min(Math.max(0, deltaY), maxMove);
            } else { // Empty is Up
                moveY = Math.max(Math.min(0, deltaY), -maxMove);
            }
        }

        this.dragState.tileElement.style.transform = `translate(${moveX}px, ${moveY}px)`;
    }

    handlePointerUp(e) {
        if (!this.dragState) return;
        if (e.pointerId !== this.dragState.pointerId) return;

        const { tileElement, tileIndex, startX, startY, startTime } = this.dragState;
        tileElement.releasePointerCapture(e.pointerId);
        tileElement.style.transform = ''; // Reset transform

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const duration = Date.now() - startTime;

        // Thresholds
        const moveThreshold = tileElement.offsetWidth * 0.3; // 30% of size is drag
        const tapThreshold = 10; // 10px jitter allowed for tap
        const tapTime = 300; // ms

        let shouldMove = false;

        // Click/Tap Detection
        if (distance < tapThreshold && duration < tapTime) {
            shouldMove = true;
        }
        // Drag Detection
        else if (distance > moveThreshold) {
            shouldMove = true;
        }

        if (shouldMove) {
            this.swap(this.emptyPieceIndex, tileIndex);
        }

        this.dragState = null;
    }

    render() {
        this.gridElement.innerHTML = '';
        this.pieces.forEach((piece, index) => {
            const tile = document.createElement('div');
            tile.className = 'puzzle-tile';
            tile.style.touchAction = 'none'; // Critical for gesture handling

            if (piece) {
                // Ensure canvas size
                piece.canvas.style.width = '100%';
                piece.canvas.style.height = '100%';
                tile.appendChild(piece.canvas);

                // Attach Pointer Events
                tile.onpointerdown = (e) => this.handlePointerDown(e, index, tile);
                tile.onpointermove = (e) => this.handlePointerMove(e);
                tile.onpointerup = (e) => this.handlePointerUp(e);
                tile.onpointercancel = (e) => this.handlePointerUp(e);
            } else {
                tile.className += ' empty';
            }
            this.gridElement.appendChild(tile);
        });
    }

    checkWin() {
        for (let i = 0; i < this.pieces.length - 1; i++) {
            if (!this.pieces[i] || this.pieces[i].correctPos !== i) {
                return false;
            }
        }
        this.handleWin();
    }

    handleWin() {
        this.stopTimer();
        this.isPlaying = false;
        if (this.audio) this.audio.stopBackgroundMusic();
        alert(`¡Nivel ${this.level} Completado!`);

        this.level++;
        localStorage.setItem('avocash_puzzle_level', this.level);

        // Reload next level
        this.loadLevel();
    }

    handleGameOver() {
        this.isPlaying = false;
        if (this.audio) this.audio.stopBackgroundMusic();
        alert("¡Tiempo agotado! Intenta de nuevo.");
        this.loadLevel(); // Restart same level
    }
}
