class Pad {
    constructor(samFPler, parent, index) {
        this.app = samFPler;
        this._parent = parent;
        this._index = index;
        // Color logic based on parent part’s hue
        const hueOffset = index % 2 === 0 ? 5 : -5;
        const parentHue = this._parent._index * 22.5;
        this._color = `hsl(${parentHue + hueOffset}, 70%, 50%)`;
        this._params = { pitch: 100, gain: 100, start: 0, end: 1, reverse: parent._params.reverse, repeat: parent._params.repeat, reverbSend: 100, delaySend: 100, distSend: 100 };
        this._sample = null;
        // Updated: Use app.barManager.numBars with fallback
        const numBars = (this.app.barManager && this.app.barManager._numBars > 0) ? this.app.barManager._numBars : (console.warn('Pad constructor: app.barManager.numBars is invalid; defaulting to 1'), 1);
        this._steps = Array.from({ length: numBars * 16 }, (_, i) => new Step(this.app, this, i));
    }

    getSample() {
        return this._sample || this._parent.getSample();
    }

    cascadeSample() {  // Force full cascade: clear all steps
        this._sample = null;  // Clear own sample too (full inheritance from part)
        this._steps.forEach(step => step._sample = null);
    }

    cascadeParams() {
        // Resets step parameters to defaults, may override step-specific tweaks
        this._steps.forEach(step => {
            step._params.pitch = 100;  // Always reset to 100% multiplier
            step._params.gain = 100;
            step._params.start = 0;
            step._params.end = 1;
            step._params.reverse = this._params.reverse;  // Absolute inherit (not multiplicative)
            step._params.repeat = this._params.repeat;
            step._params.reverbSend = 100;
            step._params.delaySend = 100;
            step._params.distSend = 100;
        });
    }

    cascadeStartEnd() {
        this._steps.forEach(step => {
            step._params.start = 0;
            step._params.end = 1;
        });
    }

    cascadeAbsolute(option) {
        this._steps.forEach(step => {
            step._params[option] = this._params[option];
        });
    }

    updateOption(option, value) {
        if (!(option in this._params)) return;
        if (['pitch', 'gain', 'reverbSend', 'delaySend', 'distSend'].includes(option)) {
            this._params[option] = Math.max(0, Math.min(200, value));
            this.cascadeParams();
        } else if (['start', 'end'].includes(option)) {
            if (option === 'start') this._params[option] = Math.max(0, Math.min(this._params.end - 0.01, value));
            else if (option === 'end') this._params[option] = Math.min(1, Math.max(this._params.start + 0.01, value));
            this.cascadeStartEnd();
        } else if (['reverse', 'repeat'].includes(option)) {
            this._params[option] = value;
            this.cascadeAbsolute(option);
        } else {
            this._params[option] = value;
        }
        this.app.updateSelection();
    }

    resetParams() {
        this._params = { pitch: 100, gain: 100, start: 0, end: 1, reverse: this._parent._params.reverse, repeat: this._parent._params.repeat, reverbSend: 100, delaySend: 100, distSend: 100 };
        this._sample = null;
        this._steps.forEach(step => step.resetParams());
    }

    isDefault(option, value) {
        const defaults = { pitch: 100, gain: 100, start: 0, end: 1, reverse: this._parent._params.reverse, repeat: this._parent._params.repeat, reverbSend: 100, delaySend: 100, distSend: 100 };
        return value === defaults[option];
    }
}