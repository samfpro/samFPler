// === FILE: js/SamFPler.js (14.3 KB) ===
// === FILE: js/SamFPler.js (added loadFromPath method) ===
function OnStart() {
    // Ensure app is the DroidScript global
    if (typeof app !== 'object') {
        console.error('DroidScript app object not available');
        alert('Failed to initialize DroidScript runtime');
        return;
    }
    // Instantiate the app
    new SamFPler();
}

class SamFPler {
    constructor() {
        this._parts = [];
        this._currentPart = null;
        this._currentPad = null;
        this._currentSelector = null;
        this._currentOption = 'pitch';
        this._metronomeOn = false;
        this._activeSources = [];
        this.drawLevelsEnabled = false;
        this.audioProcessor = new AudioProcessor(this);
        this.sampleManager = new SampleManager(this);
        this.waveformRenderer = new WaveformRenderer(this);
        this.barManager = new BarManager(this);
        this.scaleManager = new ScaleManager(this);
        this.parameterManager = new ParameterManager(this);
        this.optionsGrid = new OptionsGrid(this);
        this.selectorGrid = new SelectorGrid(this);
        this.overviewGrid = new OverviewGrid(this);
        this.sequencer = new Sequencer(this);
        this.samFPshift = new SamFPshift(this);
        this.display = new Display(this);
        this.optionsKnob = new Knob(this, 'options-knob', (delta) => this.parameterManager.adjustCurrentOption(delta));
        this.samFPshiftKnob = new Knob(this, 'samFPshift-knob', (delta) => this.samFPshift.adjust(delta));
        this.stateManager = new StateManager(this);
        this.fxManager = new FXManager(this);
       
        this.scaleManager.loadScales().then(() => this.init()).catch(() => {
            this.scaleManager.setFallbackScales();
            this.init();
        });
    }

    // ADDED: Proxy method for loading samples
    async loadFromPath(path) {
        return await this.sampleManager.loadFromPath(path);
    }

    init() {
        this.audioProcessor.initAudioContext();
        this.waveformRenderer.init();
        this.barManager.initBarsControls();
        this.scaleManager.initScaleSelector();
        this.initBpmInput();
        this.optionsGrid.init();
        this.selectorGrid.init();
        this.overviewGrid.init();
        this.sequencer.init();
        this.samFPshift.init();
        this.display.init();
        this.optionsKnob.init();
        this.samFPshiftKnob.init();
        document.getElementById('copy-bar').addEventListener('click', () => this.barManager.copyCurrentBar());
        document.getElementById('paste-bar').addEventListener('click', () => this.barManager.pasteToCurrentBar());
        document.getElementById('tap-bpm').addEventListener('click', () => this.sequencer.tapBPM());
        document.getElementById('play-button').addEventListener('click', () => this.sequencer.start());
        document.getElementById('pause-button').addEventListener('click', () => this.sequencer.pause());
        document.getElementById('stop-button').addEventListener('click', () => this.sequencer.stop());
        document.getElementById('record-button').addEventListener('click', () => this.sequencer.toggleRecording());
        document.getElementById('metronome-toggle').addEventListener('click', () => {
            this._metronomeOn = !this._metronomeOn;
            document.getElementById('metronome-toggle').classList.toggle('metronome-glow', this._metronomeOn);
        });
        document.getElementById('save-button').addEventListener('click', () => this.stateManager.saveState());
        document.getElementById('load-button').addEventListener('click', () => this.stateManager.loadStateFile());
        document.getElementById('export-button').addEventListener('click', () => this.exportMixdown());
        document.getElementById('new-button').addEventListener('click', () => this.resetAll());
        const resume = async () => { if (this.audioProcessor._audioContext.state === 'suspended') await this.audioProcessor._audioContext.resume(); };
        document.addEventListener('click', resume);
        document.addEventListener('touchstart', resume);
        const drawToggle = document.getElementById('drawlevels-toggle');
        if (drawToggle) {
            drawToggle.addEventListener('click', () => {
                this.drawLevelsEnabled = !this.drawLevelsEnabled;
                drawToggle.classList.toggle('selected-option', this.drawLevelsEnabled);
            });
        }
        this.setCurrentPart(this._parts[0]);
        this.barManager.updateCurrentBarDisplay();
        this.barManager.updateBarsDisplay();
        this.barManager.updateClipboardIndicator();
        this.fxManager.updateAll();
        this.initDrawListeners();
    }

    initDrawListeners() {
        this.allSelectorElements = [
            ...document.querySelectorAll('.part-selector'),
            ...document.querySelectorAll('.pad-selector'),
            ...document.querySelectorAll('.step-selector')
        ];
        let isDrawing = false;
        const startDraw = (e) => {
            if (!this.drawLevelsEnabled) return;
            isDrawing = true;
            e.preventDefault();
        };
        const endDraw = () => {
            isDrawing = false;
        };
        const moveDraw = (e) => {
            if (!isDrawing || !this.drawLevelsEnabled) return;
            e.preventDefault();
            const touch = e.touches ? e.touches[0] : e;
            const x = touch.clientX;
            const y = touch.clientY;
            const elem = document.elementFromPoint(x, y);
            if (elem && this.allSelectorElements.includes(elem)) {
                const selector = elem._data;
                if (!selector) return;
                const rect = elem.getBoundingClientRect();
                // FIXED: Invert localY so top=1 (high value), bottom=0 (low value)
                const rawLocalY = (y - rect.top) / rect.height;
                const localY = 1 - Math.max(0, Math.min(1, rawLocalY));
                const option = this._currentOption;
                const value = this.getDrawValue(option, localY, selector);
                if (value !== null) {
                    selector.updateOption(option, value);
                }
            }
        };
        this.allSelectorElements.forEach(el => {
            el.addEventListener('mousedown', startDraw);
            el.addEventListener('touchstart', startDraw, { passive: false });
        });
        document.addEventListener('mousemove', moveDraw);
        document.addEventListener('mouseup', endDraw);
        document.addEventListener('touchmove', moveDraw, { passive: false });
        document.addEventListener('touchend', endDraw);
    }

    getDrawValue(option, normalized, selector) {
        if (['reverse', 'repeat', 'mode'].includes(option)) return null;
        let min = 0;
        let max = 100;
        switch (option) {
            case 'pitch':
            case 'gain':
            case 'reverbSend':
            case 'delaySend':
            case 'distSend':
                max = 200;
                break;
            case 'start':
            case 'end':
                max = 1;
                break;
            case 'voices':
                min = 1;
                max = 8;
                break;
            case 'timeOffset':
                if (!(selector instanceof Step)) return null;
                const local = selector._index % 16;
                min = local === 0 ? 0 : -49;
                max = local === 15 ? 99 : 49;
                break;
            default:
                return null;
        }
        const value = min + normalized * (max - min);
        return option === 'voices' ? Math.round(value) : value;
    }

    initBpmInput() {
        const bpmDiv = document.getElementById('bpm');
        bpmDiv.innerHTML = '';
        const input = document.createElement('input');
        input.type = 'number';
        input.value = this.sequencer._bpm;
        input.addEventListener('input', () => this.sequencer.updateBPM());
        bpmDiv.appendChild(input);
        this.sequencer._bpmInput = input;
    }

    setCurrentPart(part) {
        this._currentPart = part;
        this._currentPad = part._pads[0];
        this._currentSelector = part;
        this.barManager.updateCurrentBarDisplay();
        this.selectorGrid.updatePadUIs();
        this.selectorGrid.updateStepUIs();
        this.updateSelection();
    }

    setCurrentPad(pad) {
        this._currentPad = pad;
        this._currentSelector = pad;
        this.selectorGrid.updateStepUIs();
        this.updateSelection();
    }

    setCurrentSelector(selector) {
        this._currentSelector = selector;
        this.updateSelection();
    }

    updateSelection() {
        this.optionsGrid.update();
        this.display.update();
        this.selectorGrid.updateFills(this._currentOption); // NEW: Update liquid fills
        this.selectorGrid.updateGlows();
        this.selectorGrid.updateThrobbing(); // NEW: Update throbbing for hierarchy
        this.sequencer.update();
        this.waveformRenderer.updateWaveformView();
        this.fxManager.updateAll();
    }

    async exportMixdown() {
    // Debug: Log sequence params
    const safeBpm = Math.max(30, Math.min(300, this.sequencer._bpm || 120));
    const totalSteps = this.barManager._numBars * 16;
    const stepDuration = 60 / safeBpm / 4;
    const totalDuration = totalSteps * stepDuration;
    console.log("Export debug: _numBars=" + this.barManager._numBars + ", totalSteps=" + totalSteps + ", safeBpm=" + safeBpm + ", stepDuration=" + stepDuration + ", totalDuration=" + totalDuration);

    if (totalSteps === 0) {
        app.Alert("No bars/steps to export! Set at least 1 bar.");
        return;
    }

    const sampleRate = this.audioProcessor._audioContext.sampleRate;
    const numFrames = Math.ceil(totalDuration * sampleRate);
    // Stereo: 2 channels
    const offlineCtx = new OfflineAudioContext(2, numFrames, sampleRate);

    // Stereo master gain: Duplicate mono sources to both L/R for center pan
    const offlineMasterGainL = offlineCtx.createGain();
    const offlineMasterGainR = offlineCtx.createGain();
    const merger = offlineCtx.createChannelMerger(2);
offlineMasterGainL.connect(merger, 0, 0);
offlineMasterGainR.connect(merger, 0, 1);
merger.connect(offlineCtx.destination);
offlineMasterGainL.gain.value = 1.5;  // Boost for dry mix
    offlineMasterGainR.gain.value = 1.5;

    let triggered = 0;
    for (let globalStep = 0; globalStep < totalSteps; globalStep++) {
        const stepTime = globalStep * stepDuration;
        const localStep = globalStep % 16;
        const offset = this.samFPshift._timingOffsets[localStep] / 100 * stepDuration;
        const clampedWhen = Math.min(stepTime + offset, totalDuration - 0.001);  // Clamp to avoid overflow

        this._parts.forEach(part => {
            part._pads.forEach(pad => {
                const step = pad._steps[globalStep];
                if (step && step._on && step.getSample()) {
                    triggered++;
                    // Schedule to L and duplicate to R
                    this.audioProcessor.scheduleSampleOffline(step, clampedWhen, offlineCtx, offlineMasterGainL);
                    // For true stereo duplicate: Call again for R (connects to same input, but gain routes to R)
                    this.audioProcessor.scheduleSampleOffline(step, clampedWhen, offlineCtx, offlineMasterGainR);
                }
            });
        });
    }
    console.log("Triggered steps with samples: " + triggered);
    if (triggered === 0) {
        app.Alert("No active steps/samples to export! Load a sample and toggle steps on.");
        return;
    }

    const renderedBuffer = await offlineCtx.startRendering();
    // Debug: Check output
    console.log("Rendered: length=" + renderedBuffer.length + ", expected=" + numFrames + ", sr=" + renderedBuffer.sampleRate + ", channels=" + renderedBuffer.numberOfChannels);
    let maxAmp = 0;
    const channelData = renderedBuffer.getChannelData(0);
    for (let i = 0; i < Math.min(1000, renderedBuffer.length); i++) {
        maxAmp = Math.max(maxAmp, Math.abs(channelData[i]));
    }
    console.log("Max amp in first ~1s: " + maxAmp);  // Should be >0.01 if audio present

const wavArrayBuffer = this.audioProcessor.audioBufferToWav(renderedBuffer);
const savePath = "/sdcard/samFPler/samFPler_mixdown.wav";
// Ensure dir exists
const dir = "/sdcard/samFPler/";
if (!app.FileExists(dir)) app.MakeFolder(dir);

// Convert binary to Base64 for DroidScript binary write
const uint8Array = new Uint8Array(wavArrayBuffer);
let binaryString = '';
for (let i = 0; i < uint8Array.byteLength; i++) {
    binaryString += String.fromCharCode(uint8Array[i]);
}
const base64Data = btoa(binaryString);

app.WriteFile(savePath, base64Data, "Base64");
if (app.FileExists(savePath)) {
        const fileSize = app.GetFileSize(savePath);
        app.Alert(`Stereo mixdown saved to ${savePath} (${fileSize} bytes)`);
        console.log("Export complete: File size=" + fileSize);
    } else {
        app.Alert("Write failed—check permissions/path");
    }
}

        

    resetAll() {
        this._parts.forEach(part => part.resetParams());
        this.sampleManager.clearCache(); // FIXED: Call clearCache
        this._activeSources = [];
        this.barManager.clipboard = null;
        this.barManager.updateClipboardIndicator();
        this.updateSelection();
        this.overviewGrid.update();
    }

    getRepeatCount(repeat) {
        switch (repeat) {
            case 'off': return 1;
            case '1': case '1 up': case '1 down': return 2;
            case '3': case '3 up': case '3 down': case '3 staggered': case '3 reverse staggered': return 4;
            default: return 1;
        }
    }

    getRepeatGains(repeat, baseGain) {
        switch (repeat) {
            case '1 up': return [baseGain, baseGain * 0.8];
            case '1 down': return [baseGain, baseGain * 1.2];
            case '3 up': return [baseGain, baseGain * 0.9, baseGain * 0.8, baseGain * 0.7];
            case '3 down': return [baseGain, baseGain * 1.1, baseGain * 1.2, baseGain * 1.3];
            case '3 staggered': return [baseGain, baseGain * 0.8, baseGain * 1.2, baseGain * 0.9];
            case '3 reverse staggered': return [baseGain, baseGain * 0.9, baseGain * 1.2, baseGain * 0.8];
            default: return Array(this.getRepeatCount(repeat)).fill(baseGain);
        }
    }
}
// === END: js/SamFPler.js ===