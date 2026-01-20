export const Assets = {
    images: {},
    audio: {}, // Placeholder if we had files

    toLoad: {
        bg: 'assets/bg_farm.png',
        tree: 'assets/tree.png',
        player: 'assets/player.jpg', // Renamed and simple
        avocado: 'assets/avocado.png',
        powerup: 'assets/avocado_powerup.png',
        scorePlus: 'assets/score_plus.png',
        scoreMinus: 'assets/score_minus.png',
        // logo is used in HTML, not canvas (mostly)
    },

    async loadAll() {
        // console.log('Starting to load assets:', this.toLoad);
        const promises = [];
        for (const [key, src] of Object.entries(this.toLoad)) {
            promises.push(new Promise((resolve, reject) => {
                const img = new Image();
                // Removed crossOrigin to rely on Same-Origin (localhost)

                // Cache buster
                const finalSrc = src + '?t=' + new Date().getTime();
                img.src = finalSrc;

                img.onload = () => {
                    // console.log(`Loaded successfully: ${key} (${finalSrc})`);
                    // Runtime Transparency Hack for JPG/Checkerboard assets
                    if (key === 'tree' || key === 'player' || key === 'scoreMinus') {
                        this.processTransparency(img).then(processedImg => {
                            this.images[key] = processedImg;
                            resolve();
                        }).catch(err => {
                            // console.error('Transparency processing failed for ' + key, err);
                            this.images[key] = img;
                            resolve();
                        });
                    } else {
                        this.images[key] = img;
                        resolve();
                    }
                };
                img.onerror = (e) => {
                    // console.error(`FAILED to load: ${key} (${finalSrc})`, e);
                    this.images[key] = null; // Set straightforward null
                    resolve();
                };
            }));
        }
        await Promise.all(promises);
        // console.log('All assets loaded. Images:', Object.keys(this.images));
    },

    async processTransparency(img) {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Analysis:
        // Top-left might be white or grey. 
        // We need to nuke ANYTHING that looks like a checkerboard background.
        // Usually: White (255,255,255) and Grey (roughly 204,204,204 or similar).

        const bgR = data[0];
        const bgG = data[1];
        const bgB = data[2];
        const threshold = 40; // Increased threshold for variance

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // 1. Remove Top-Left Color match (e.g. White or the Grey square)
            if (Math.abs(r - bgR) < threshold &&
                Math.abs(g - bgG) < threshold &&
                Math.abs(b - bgB) < threshold) {
                data[i + 3] = 0;
                continue;
            }

            // 2. Remove Pure White / Near White
            if (r > 230 && g > 230 && b > 230) {
                data[i + 3] = 0;
                continue;
            }

            // 3. Remove "Checkerboard Grey"
            // Typical fake PNG grey is neutral (r~=g~=b) and light.
            // Let's target greys between 150 and 230 with low saturation.
            if (r > 150 && r < 230 &&
                g > 150 && g < 230 &&
                b > 150 && b < 230) {

                // Check if it is "grey" (low saturation)
                if (Math.abs(r - g) < 15 && Math.abs(g - b) < 15 && Math.abs(r - b) < 15) {
                    data[i + 3] = 0;
                    continue;
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);

        const newImg = new Image();
        newImg.src = canvas.toDataURL();
        return new Promise(r => {
            newImg.onload = () => r(newImg);
        });
    },

    get(key) {
        const img = this.images[key];
        // if (!img) console.warn('Asset not found:', key);
        return img;
    }
};
