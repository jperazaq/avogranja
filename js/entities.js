import { Assets } from './assets.js';

export class Entity {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.markedForDeletion = false;
    }

    draw(ctx) {
        // Override
    }

    update(dt) {
        // Override
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
}

export class Player extends Entity {
    constructor(gameWidth, gameHeight) {
        // Fixed size for player
        const size = 145; // Increased by another 10% (was 132)
        super(gameWidth / 2 - size / 2, gameHeight - size - 20, size, size);
        this.gameWidth = gameWidth;
        this.image = Assets.get('player');
        this.targetX = this.x;
    }

    updateInput(inputX) {
        // inputX is center of mouse/touch
        this.targetX = inputX - this.width / 2;
    }

    update(dt) {
        // Smooth lerp for movement
        const speed = 15;
        this.x += (this.targetX - this.x) * speed * dt;

        // Clamp to screen
        if (this.x < 0) this.x = 0;
        if (this.x > this.gameWidth - this.width) this.x = this.gameWidth - this.width;
    }

    draw(ctx) {
        if (!this.logOnce) {
            // console.log('Player Draw:', this.image, 'X:', this.x, 'Y:', this.y, 'W:', this.width, 'H:', this.height);
            this.logOnce = true;
        }
        if (this.image) {
            try {
                ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
            } catch (e) {
                // console.error('Error drawing player:', e);
            }
        } else {
            // Draw fallback red box if image missing
            ctx.fillStyle = 'red';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
}

export class Avocado extends Entity {
    constructor(x, speedMultiplier = 1) {
        const size = 77; // Increased by another 10% (was 70)
        super(x, -size, size, size); // Start above screen

        this.isPowerUp = Math.random() > 0.95; // 5% chance
        this.image = this.isPowerUp ? Assets.get('powerup') : Assets.get('avocado');

        // Base speed + variance - Faster and more random
        this.speed = (350 + Math.random() * 250) * speedMultiplier;
        if (this.isPowerUp) this.speed *= 1.5; // Power ups fall faster

        this.rotation = 0;
        this.rotationSpeed = (Math.random() - 0.5) * 4;
    }

    update(dt) {
        this.y += this.speed * dt;
        this.rotation += this.rotationSpeed * dt;
    }

    draw(ctx) {
        if (!this.image) return;

        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.rotation);
        ctx.drawImage(this.image, -this.width / 2, -this.height / 2, this.width, this.height);
        ctx.restore();
    }
}

export class FloatingText extends Entity {
    constructor(x, y, type) { // type: 'plus', 'minus', 'plus20', 'minus20', 'minus40'
        const size = 80;
        super(x, y, size, size);
        this.type = type;

        // Map types to images if they exist
        if (type === 'plus') this.image = Assets.get('scorePlus');
        else if (type === 'minus') this.image = Assets.get('scoreMinus');
        else this.image = null; // Will use text for others

        this.life = 1.0; // 1 second
        this.vy = -100; // Moves up
    }

    update(dt) {
        this.y += this.vy * dt;
        this.life -= dt;
        if (this.life <= 0) this.markedForDeletion = true;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);

        if (this.image) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        } else {
            // Text Fallback for +20 / -20 / -40
            ctx.font = 'bold 40px Arial';
            ctx.textAlign = 'center';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'black';

            if (this.type === 'plus20') {
                ctx.fillStyle = '#FFD700'; // Gold
                ctx.strokeText('+20', this.x + this.width / 2, this.y + this.height / 2);
                ctx.fillText('+20', this.x + this.width / 2, this.y + this.height / 2);
            } else if (this.type === 'minus20') {
                ctx.fillStyle = '#FF4444'; // Red
                ctx.strokeText('-20', this.x + this.width / 2, this.y + this.height / 2);
                ctx.fillText('-20', this.x + this.width / 2, this.y + this.height / 2);
            } else if (this.type === 'minus40') {
                ctx.fillStyle = '#FF0000'; // Bright Red for higher penalty
                ctx.strokeText('-40', this.x + this.width / 2, this.y + this.height / 2);
                ctx.fillText('-40', this.x + this.width / 2, this.y + this.height / 2);
            }
        }

        ctx.restore();
    }
}
