export class AudioManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.5;
        this.masterGain.connect(this.ctx.destination);

        // Background music variables
        this.bgMusicGain = null;
        this.bgMusicPlaying = false;
        this.bgMusicInterval = null;
    }

    playTone(freq, type, duration, slideTo = null) {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (slideTo) {
            osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + duration);
        }

        gain.gain.setValueAtTime(1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    // Play a background music note (softer volume)
    playBgNote(freq, type, duration) {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        // Softer volume for background music
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    startBackgroundMusic() {
        if (this.bgMusicPlaying) return;

        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        this.bgMusicPlaying = true;

        // Farm melody - peaceful pastoral theme
        const melody = [
            { note: 392, duration: 0.5 }, // G4
            { note: 440, duration: 0.5 }, // A4
            { note: 494, duration: 0.5 }, // B4
            { note: 523, duration: 0.5 }, // C5
            { note: 494, duration: 0.5 }, // B4
            { note: 440, duration: 0.5 }, // A4
            { note: 392, duration: 1.0 }, // G4
            { note: 330, duration: 0.5 }, // E4
            { note: 392, duration: 0.5 }, // G4
            { note: 440, duration: 1.0 }, // A4
        ];

        let noteIndex = 0;

        const playNextNote = () => {
            if (!this.bgMusicPlaying) return;

            const current = melody[noteIndex];
            this.playBgNote(current.note, 'triangle', current.duration);

            noteIndex = (noteIndex + 1) % melody.length;

            this.bgMusicInterval = setTimeout(playNextNote, current.duration * 1000);
        };

        playNextNote();
    }

    stopBackgroundMusic() {
        this.bgMusicPlaying = false;
        if (this.bgMusicInterval) {
            clearTimeout(this.bgMusicInterval);
            this.bgMusicInterval = null;
        }
    }

    playCatch() {
        // High pitched "ding"
        this.playTone(800, 'sine', 0.1, 1200);
        setTimeout(() => this.playTone(1200, 'sine', 0.1), 50);
    }

    playCatchPowerUp() {
        // Magical chime
        this.playTone(600, 'triangle', 0.3, 1200);
        setTimeout(() => this.playTone(900, 'sine', 0.3, 1500), 100);
        setTimeout(() => this.playTone(1200, 'square', 0.3, 2000), 200);
    }

    playDrop() {
        // Low "thud" or "womp"
        this.playTone(200, 'sawtooth', 0.3, 50);
    }

    playGameOver() {
        // Sad sequence
        this.playTone(400, 'triangle', 0.4, 300);
        setTimeout(() => this.playTone(300, 'triangle', 0.4, 200), 400);
        setTimeout(() => this.playTone(200, 'triangle', 0.8, 100), 800);
    }

    playCombo() {
        // Fast ascending Arpeggio
        this.playTone(440, 'sine', 0.1); // A4
        setTimeout(() => this.playTone(554, 'sine', 0.1), 50); // C#5
        setTimeout(() => this.playTone(659, 'sine', 0.1), 100); // E5
    }

    playTick() {
        // Woodblock tick sound
        this.playTone(800, 'square', 0.05, 800);
    }

    playStart() {
        // Positive start sound
        this.playTone(600, 'sine', 0.1, 800);
        setTimeout(() => this.playTone(1000, 'sine', 0.3, 1200), 100);
    }
}
