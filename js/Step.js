class Step {
    constructor(samFPler, parent, index) {
        this.app = samFPler;
        this._parent = parent;
        this._index = index;
        this._on = false;
        this._sample = null;
        this._params = { pitch: 100, gain: 100, start: 0, end: 1, reverse: parent._params.reverse, repeat: 'off', timeOffset: 0, reverbSend: 100, delaySend: 100, distSend: 100 };
    }

    getSample() {  // Unchanged, but now always inherits due to clears above
        return this._sample || this._parent.getSample();
    }

    resetParams() {
        this._params = { pitch: 100, gain: 100, start: 0, end: 1, reverse: this._parent._params.reverse, repeat: 'off', timeOffset: 0, reverbSend: 100, delaySend: 100, distSend: 100 };
        this._on = false;
        this._sample = null;  // NEW: Explicit clear for full cascade
    }

    updateOption(option, value) {
        if (!(option in this._params)) return;
        if (['pitch', 'gain', 'reverbSend', 'delaySend', 'distSend'].includes(option)) this._params[option] = Math.max(0, Math.min(200, value));
        else if (['start', 'end'].includes(option)) {
            if (option === 'start') this._params[option] = Math.max(0, Math.min(this._params.end - 0.01, value));
            else this._params[option] = Math.min(1, Math.max(this._params.start + 0.01, value));
        } else if (option === 'timeOffset') {
            const localIndex = this._index % 16;
            const min = localIndex === 0 ? 0 : -49;
            const max = localIndex === 15 ? 99 : 49;
            this._params[option] = Math.max(min, Math.min(max, value));
        } else if (option === 'repeat') {
            const options = ['off', '1', '1 up', '1 down', '3', '3 up', '3 down', '3 staggered', '3 reverse staggered'];
            const idx = options.indexOf(this._params[option]);
            this._params[option] = options[(idx + Math.sign(value) + options.length) % options.length];
        } else this._params[option] = value;
        this.app.updateSelection();
    }

    isDefault(option, value) {
        const defaults = { pitch: 100, gain: 100, start: 0, end: 1, reverse: this._parent._params.reverse, repeat: 'off', timeOffset: 0, reverbSend: 100, delaySend: 100, distSend: 100 };
        return value === defaults[option];
    }
}