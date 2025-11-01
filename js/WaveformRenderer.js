class WaveformRenderer {
    constructor(samFPler) {
        this.app = samFPler;
        this.canvas = document.getElementById('waveform');
        this.ctx = this.canvas.getContext('2d');
        this.zoom = 1;
        this.offset = 0;
        this.dragging = null;
        this.init();
    }

    init() {
        this.canvas.addEventListener('mousedown', e => {
            if (!this.app._currentSelector) return;
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const params = this.app.parameterManager.computeAbsoluteParams(this.app._currentSelector);
            const start = params.start;
            const end = params.end;
            const startX = start * rect.width;
            const endX = end * rect.width;
            const handleWidth = 5;
            if (Math.abs(x * rect.width - startX) < handleWidth) {
                this.dragging = 'start';
            } else if (Math.abs(x * rect.width - endX) < handleWidth) {
                this.dragging = 'end';
            }
            this.render();
        });
        this.canvas.addEventListener('mousemove', e => {
            if (this.dragging && this.app._currentSelector) {
                const rect = this.canvas.getBoundingClientRect();
                let x = (e.clientX - rect.left) / rect.width;
                x = Math.max(0, Math.min(1, x));
                this.app._currentSelector.updateOption(this.dragging, x);
            }
        });
        this.canvas.addEventListener('mouseup', () => {
            this.dragging = null;
            this.render();
        });
        this.canvas.addEventListener('wheel', e => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoom *= delta;
            this.zoom = Math.max(1, Math.min(10, this.zoom));
            this.offset = Math.max(0, Math.min(1 - 1 / this.zoom, this.offset));
            this.render();
        });
    }

    render() {
        // Updated: Added null check for selector and sample
        const selector = this.app._currentSelector;
        const sample = selector ? selector.getSample() : null;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (!sample) return;

        const buffer = sample.getChannelData(0);
        const params = this.app.parameterManager.computeAbsoluteParams(selector);
        const step = Math.ceil(buffer.length / this.canvas.width / this.zoom);
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#fff';
        const startSample = Math.floor(this.offset * buffer.length);
        for (let i = 0; i < this.canvas.width; i++) {
            let min = 1, max = -1;
            const sampleIdx = Math.floor(startSample + i * step);
            for (let j = 0; j < step && sampleIdx + j < buffer.length; j++) {
                const v = buffer[sampleIdx + j];
                min = Math.min(min, v);
                max = Math.max(max, v);
            }
            const x = i;
            const yMin = (1 - min) * this.canvas.height / 2;
            const yMax = (1 - max) * this.canvas.height / 2;
            this.ctx.moveTo(x, yMin);
            this.ctx.lineTo(x, yMax);
        }
        this.ctx.stroke();

        const startX = params.start * this.canvas.width;
        const endX = params.end * this.canvas.width;
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, startX, this.canvas.height);
        this.ctx.fillRect(endX, 0, this.canvas.width - endX, this.canvas.height);
        this.ctx.fillStyle = '#f00';
        this.ctx.fillRect(startX - 2, 0, 4, this.canvas.height);
        this.ctx.fillRect(endX - 2, 0, 4, this.canvas.height);
    }

    animatePlayhead(start, end, duration, isRepeating) {
        // Updated: Clarified comment on animation timing
        // Animation synchronized with audio context time
        const startTime = this.app.audioProcessor._audioContext.currentTime;
        const animate = () => {
            const elapsed = this.app.audioProcessor._audioContext.currentTime - startTime;
            let progress = elapsed / duration;
            if (!isRepeating && progress >= 1) return;
            progress = isRepeating ? progress % 1 : Math.min(progress, 1);
            this.render();
            const playheadX = (start + (end - start) * progress) * this.canvas.width;
            this.ctx.fillStyle = '#0f0';
            this.ctx.fillRect(playheadX - 1, 0, 2, this.canvas.height);
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }

    updateWaveformView() {
        this.render();
    }
}