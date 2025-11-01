// === FILE: js/Sequencer.js (10.7 KB) ===
class Sequencer {
    constructor(samFPler) {
        this.app = samFPler;
        // Initialize _audioContext later in init if not available
        this._audioContext = app.audioProcessor && app.audioProcessor._audioContext ? app.audioProcessor._audioContext : null;
        this.stepToggleButtons = [];
        this._bpm = 120;
        this._bpmInput = null;
        this._tapTimes = [];
        this._isPlaying = false;
        this._isPaused = false;
        this._isRecording = false;
        this._currentStep = 0;
        this._nextStepTime = 0;
        this._startTime = 0;
        this._lookahead = 0.2;
        this._scheduleInterval = 0.025;
        this._prevGlobalStep = -1;
        this.clickBuffer = null;
    }

    init() {
        // Ensure _audioContext is available
        if (!this._audioContext) {
            if (!this.app.audioProcessor || !this.app.audioProcessor._audioContext) {
                console.error('Sequencer.init: AudioContext not available. Ensure AudioProcessor is initialized.');
                return;
            }
            this._audioContext = this.app.audioProcessor._audioContext;
        }

        const grid = document.getElementById('sequencer-grid');
        for (let i = 0; i < 16; i++) {
            const toggle = new StepToggleButton(this.app, i);
            toggle.init(grid);
            this.stepToggleButtons.push(toggle);
        }
        // Create metronome click buffer
        const duration = 0.02;
        const bufferSize = Math.floor(this._audioContext.sampleRate * duration);
        const buffer = this._audioContext.createBuffer(1, bufferSize, this._audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        const freq = 1000;
        let phase = 0;
        const phaseIncrement = 2 * Math.PI * freq / this._audioContext.sampleRate;
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.sin(phase) * (1 - i / bufferSize);
            phase += phaseIncrement;
        }
        this.clickBuffer = buffer;
    }

    

    update() {
        this.stepToggleButtons.forEach((toggle, i) => {
            toggle.element.textContent = i + 1;
            toggle.updateState();
        });
    }

    toggleStep(localIndex) {
        const offset = this.app.barManager._currentBar * 16;
        const globalIndex = offset + localIndex;
        const step = this.app._currentPad._steps[globalIndex];
        if (!step) return;
        step._on = !step._on;
        // Add feedback for toggle
        this.stepToggleButtons[localIndex].element.classList.add('triggered');
        setTimeout(() => this.stepToggleButtons[localIndex].element.classList.remove('triggered'), 150);
        this.update();
        this.app.selectorGrid.updateStepUIs();
        this.app.selectorGrid.updatePadPreviews();
        const partUI = this.app.selectorGrid.partUIs.find(ui => ui.data === this.app._currentPart);
        if (partUI) partUI.partPreviewGrid.update();
        this.app.selectorGrid.updateGlows();
    }

    getCurrentLocalStep() {
        const elapsed = this._audioContext.currentTime - this._startTime;
        const stepDuration = 60 / this._bpm / 4;
        const totalSteps = this.app.barManager._numBars * 16;
        const globalStep = Math.floor(elapsed / stepDuration) % totalSteps;
        return globalStep % 16;
    }

    playClick(when) {
        const source = this._audioContext.createBufferSource();
        source.buffer = this.clickBuffer;
        const gain = this._audioContext.createGain();
        gain.gain.value = 0.3;
        source.connect(gain);
        gain.connect(this.app.audioProcessor.masterChain);
        source.start(when);
    }

    toggleRecording() {
        const recordBtn = document.getElementById('record-button');
        if (this._isRecording) {
            this._isRecording = false;
            recordBtn.classList.remove('recording');
        } else {
            this._isRecording = true;
            if (!this._isPlaying) this.start();
            recordBtn.classList.add('recording');
        }
    }

    start() {
        if (this._isPlaying) return;
        this._isPlaying = true;
        this._isPaused = false;
        const stepDuration = 60 / this._bpm / 4;
        this._startTime = this._audioContext.currentTime - (this._currentStep * stepDuration);
        this._nextStepTime = this._startTime + stepDuration;
        this.schedule();
        this.animationLoop();
    }

    pause() {
        if (!this._isPlaying) return;
        this._isPlaying = false;
        this._isPaused = true;
        this.app._activeSources.forEach(source => source.stop());
        this.app._activeSources = [];
        this.app._parts.forEach(part => part._activeSources = []);
        this.app.selectorGrid.padUIs.forEach(ui => ui.element.classList.remove('triggered'));
        this.app.selectorGrid.stepUIs.forEach(ui => ui.element.classList.remove('triggered'));
        this.stepToggleButtons.forEach(t => t.element.classList.remove('triggered'));
       
    }

    stop() {
        this._isPlaying = false;
        this._isPaused = false;
        this._isRecording = false;
        this._currentStep = 0;
        document.getElementById('record-button').classList.remove('recording');
        this.app._activeSources.forEach(source => source.stop());
        this.app._activeSources = [];
        this.app._parts.forEach(part => part._activeSources = []);
        this.app.selectorGrid.padUIs.forEach(ui => ui.element.classList.remove('triggered'));
        this.app.selectorGrid.stepUIs.forEach(ui => ui.element.classList.remove('triggered'));
        this.stepToggleButtons.forEach(t => t.element.classList.remove('triggered'));
        this.animationLoop(); // to clear highlight
  
    }

    updateBPM() {
        const value = parseFloat(this._bpmInput.value);
        if (value >= 30 && value <= 300) this._bpm = value;
        this._bpmInput.value = this._bpm;
    }

    tapBPM() {
        const now = Date.now();
        this._tapTimes.push(now);
        if (this._tapTimes.length > 4) this._tapTimes.shift();
        if (this._tapTimes.length >= 2) {
            const intervals = this._tapTimes.slice(1).map((t, i) => (t - this._tapTimes[i]) / 1000);
            const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const bpm = Math.round(60 / avg);
            if (bpm >= 30 && bpm <= 300) {
                this._bpm = bpm;
                this._bpmInput.value = bpm;
            }
        }
    }

    schedule() {
        if (!this._isPlaying) return;
        const currentTime = this._audioContext.currentTime;
        const stepDuration = 60 / this._bpm / 4;
        const totalSteps = this.app.barManager._numBars * 16;
        while (this._nextStepTime < currentTime + this._lookahead) {
            const stepTime = this._nextStepTime;
            const globalStepIndex = this._currentStep;
            const localStepIndex = globalStepIndex % 16;
            const offset = this.app.samFPshift._timingOffsets[localStepIndex] / 100 * stepDuration;
            this.app._parts.forEach(part => {
                part._pads.forEach(pad => {
                    const step = pad._steps[globalStepIndex];
                    if (step && step._on) {
                        this.app.audioProcessor.playSample(step, true, stepTime + offset, true);
                    }
                });
            });
            if (this.app._metronomeOn && localStepIndex % 4 === 0) {
                this.playClick(stepTime);
            }
            this._nextStepTime += stepDuration;
            this._currentStep = (this._currentStep + 1) % totalSteps;
        }
        setTimeout(() => this.schedule(), this._scheduleInterval * 1000);
    }

    animationLoop() {
    if (!this._isPlaying) {
        this.stepToggleButtons.forEach(t => t.element.classList.remove('current-step'));
        this.app.samFPshift.cells.forEach(cell => cell.classList.remove('current-step'));
        return;
    }
    const currentTime = this._audioContext.currentTime;
    const elapsed = currentTime - this._startTime;
    const stepDuration = 60 / this._bpm / 4;
    const totalSteps = this.app.barManager._numBars * 16;
    const globalStep = Math.floor(elapsed / stepDuration) % totalSteps;
    const localStep = globalStep % 16;

    if (globalStep !== this._prevGlobalStep) {
        // Clear previous highlights
        this.app.selectorGrid.padUIs.forEach(ui => ui.element.classList.remove('triggered'));
        this.app.selectorGrid.stepUIs.forEach(ui => ui.element.classList.remove('triggered'));
        this.stepToggleButtons.forEach(t => t.element.classList.remove('triggered'));

        const currentPart = this.app._currentPart;
        if (currentPart) {
            currentPart._pads.forEach((pad, padIndex) => {
                const step = pad._steps[globalStep];
                if (step && step._on) {
                    const padUI = this.app.selectorGrid.padUIs[padIndex];
                    if (padUI.data === pad) {
                        padUI.element.classList.add('triggered');
                        setTimeout(() => padUI.element.classList.remove('triggered'), 150);
                    }
                    if (this.app._currentPad === pad) {
                        const stepUI = this.app.selectorGrid.stepUIs[localStep];
                        if (stepUI.data === step) {
                            stepUI.element.classList.add('triggered');
                            setTimeout(() => stepUI.element.classList.remove('triggered'), 150);
                        }
                    }
                    if (this.app._currentPad === pad) {
                        const barOffset = this.app.barManager._currentBar * 16;
                        if (globalStep >= barOffset && globalStep < barOffset + 16) {
                            const barLocal = globalStep - barOffset;
                            this.stepToggleButtons[barLocal].element.classList.add('triggered');
                            setTimeout(() => this.stepToggleButtons[barLocal].element.classList.remove('triggered'), 150);
                        }
                    }
                }
            });
        }
        this._prevGlobalStep = globalStep;
    }

    // Highlight sequencer steps only for current bar
    const barOffset = this.app.barManager._currentBar * 16;
    if (globalStep >= barOffset && globalStep < barOffset + 16) {
        const barLocal = globalStep - barOffset;
        this.stepToggleButtons.forEach((t, i) => t.element.classList.toggle('current-step', i === barLocal));
    } else {
        this.stepToggleButtons.forEach(t => t.element.classList.remove('current-step'));
    }

    // Highlight samFPshift cell for current local step
    this.app.samFPshift.cells.forEach((cell, i) => cell.classList.toggle('current-step', i === localStep));

    requestAnimationFrame(() => this.animationLoop());
}
}
// === END: js/Sequencer.js ===