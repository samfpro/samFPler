class Part {
    constructor(app, index) {
        this.app = app;
        this._index = index;
        this._color = `hsl(${index * 22.5}, 70%, 50%)`;
        this._params = { pitch: 100, gain: 100, start: 0.0, end: 1.0, reverse: false, repeat: 'off', mode: 'pitched', voices: 1, reverbSend: 0, delaySend: 0, distSend: 0 };
        this._sample = null;
        this._activeSources = [];
        this._pads = Array.from({ length: 16 }, (_, i) => new Pad(app, this, i));
        this.setPitchedMode();
    }

    getSample() {
        return this._sample;
    }

    cascadeSample() {  // Force full cascade: clear all children to ensure inheritance
        this._pads.forEach(pad => {
            pad._sample = null;  // Clear pad sample
            pad.cascadeSample();  // This will clear steps
        });
    }

    cascadeParams() {
        this._pads.forEach(pad => pad.cascadeParams());
    }

    cascadeStartEnd() {
        this._pads.forEach(pad => {
            pad._params.start = 0;
            pad._params.end = 1;
            pad.cascadeStartEnd();
        });
    }

    cascadeAbsolute(option) {
        this._pads.forEach(pad => {
            pad._params[option] = this._params[option];
            pad.cascadeAbsolute(option);
        });
    }

    updateOption(option, value) {
        if (!(option in this._params)) return;
        if (option === 'mode') {
            this._params.mode = value;
            value === 'pitched' ? this.setPitchedMode() : this.setSlicedMode();
        } else if (['pitch', 'gain', 'reverbSend', 'delaySend', 'distSend'].includes(option)) {
            this._params[option] = Math.max(0, Math.min(200, value));
            this.cascadeParams();
        } else if (['start', 'end'].includes(option)) {
            if (option === 'start') this._params[option] = Math.max(0, Math.min(this._params.end - 0.01, value));
            else if (option === 'end') this._params[option] = Math.min(1, Math.max(this._params.start + 0.01, value));
            this.cascadeStartEnd();
        } else if (['reverse', 'repeat'].includes(option)) {
            this._params[option] = value;
            this.cascadeAbsolute(option);
        } else if (option === 'voices') {
            this._params[option] = Math.max(1, Math.min(8, Math.round(value)));
        } else {
            this._params[option] = value;
        }
        this.app.updateSelection();
    }

    calculateNotePitch(note, scale) {
        const adjustedNote = note - 8;
        const semitones = scale.semitones;
        let semitone, octaveOffset;
        if (adjustedNote >= 0) {
            semitone = semitones[adjustedNote % semitones.length];
            octaveOffset = Math.floor(adjustedNote / semitones.length);
        } else {
            const totalSemitones = adjustedNote;
            semitone = totalSemitones % 12;
            if (semitone < 0) semitone += 12;
            octaveOffset = Math.floor(totalSemitones / 12);
        }
        return Math.pow(2, (semitone + octaveOffset * 12) / 12) * 100;
    }

    setPitchedMode() {
        // Adjusts pad parameters for pitch-based playback
        const defaultScale = { name: 'Major', semitones: [0, 2, 4, 5, 7, 9, 11] };
        if (!this.app._scales || this.app._scales.length === 0) console.warn('setPitchedMode: this.app._scales is undefined or empty; using default Major scale');
        const scale = (this.app._scales && this.app._scales.length > 0)
            ? (this.app._scales.find(s => s.name === this.app._currentScale) || this.app._scales[0])
            : defaultScale;
        this._pads.forEach((pad, note) => {
            pad._params.start = 0;
            pad._params.end = 1;
            pad._params.pitch = this.calculateNotePitch(note, scale);
            pad.cascadeParams();
        });
    }

    setSlicedMode() {
        this._pads.forEach((pad, i) => {
            pad._params.start = i / 16;
            pad._params.end = (i + 1) / 16;
            pad._params.pitch = 100;  // Explicitly reset to 100% for consistency
            pad.cascadeParams();
        });
    }

    resetParams() {
        this._params = { pitch: 100, gain: 100, start: 0.0, end: 1.0, reverse: false, repeat: 'off', mode: 'pitched', voices: 1, reverbSend: 0, delaySend: 0, distSend: 0 };
        this._sample = null;
        this._activeSources = [];
        this._pads.forEach(pad => pad.resetParams());
        this.setPitchedMode();
    }

    isDefault(option, value) {
        const defaults = { pitch: 100, gain: 100, start: 0.0, end: 1.0, reverse: false, repeat: 'off', mode: 'pitched', voices: 1, reverbSend: 0, delaySend: 0, distSend: 0 };
        return value === defaults[option];
    }
}