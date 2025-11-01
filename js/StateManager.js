// File: /sdcard/samFPler/js/StateManager.js
class StateManager {
    constructor(samFPler) {
        this.app = samFPler;
    }

    saveState() {
        const fileName = prompt("Enter filename (e.g., myproject):", "samFPler_state");
        if (!fileName) return app.Alert('No filename entered.');
        const statePath = "/sdcard/samFPler/" + fileName + ".json";
        const state = {
            numBars: this.app._numBars,
            currentBar: this.app._currentBar,
            parts: this.app._parts.map(part => ({
                params: { ...part._params },
                sampleKey: part._sample ? `${part._sample.fileName}_${part._sample.fileSize}` : null,
                pads: part._pads.map(pad => ({
                    params: { ...pad._params },
                    sampleKey: pad._sample ? `${pad._sample.fileName}_${pad._sample.fileSize}` : null,
                    steps: pad._steps.map(step => ({
                        params: { ...step._params },
                        on: step._on,
                        sampleKey: step._sample ? `${step._sample.fileName}_${step._sample.fileSize}` : null
                    }))
                }))
            })),
            currentPartIndex: this.app._currentPart._index,
            currentPadIndex: this.app._currentPad?._index ?? 0,
            currentSelectorType: this.app._currentSelector instanceof Part ? 'part' : this.app._currentSelector instanceof Pad ? 'pad' : 'step',
            currentSelectorIndex: this.app._currentSelector._index,
            currentOption: this.app._currentOption,
            bpm: this.app.sequencer._bpm,
            scale: this.app._currentScale,
            timingOffsets: [...this.app.samFPshift._timingOffsets]
        };
        app.WriteTextFile(statePath, JSON.stringify(state, null, 2));
        app.Alert(`State saved to ${statePath}`);
    }

    loadStateFile() {
    app.ChooseFile("/sdcard/", "*.json", (filePath) => {
        if (!filePath) return app.Alert('No file selected.');
        const content = app.ReadTextFile(filePath);
        if (!content) return app.Alert('Failed to read state file.'); // Fixed: was app.Alert
        const state = JSON.parse(content);
        this.loadState(state);
    });
}

    async loadState(state) {
        this.app._numBars = state.numBars || 1;
        this.app.setNumBars(this.app._numBars);
        this.app._currentBar = state.currentBar || 0;
        this.app.updateCurrentBarDisplay();
        const samplePromises = [];
        state.parts.forEach((partState, i) => {
            if (partState.sampleKey) samplePromises.push(this.loadSampleKey(partState.sampleKey));
            partState.pads.forEach((padState, j) => {
                if (padState.sampleKey) samplePromises.push(this.loadSampleKey(padState.sampleKey));
                padState.steps.forEach((stepState, k) => {
                    if (stepState.sampleKey) samplePromises.push(this.loadSampleKey(stepState.sampleKey));
                });
            });
        });
        await Promise.all(samplePromises);
        state.parts.forEach((partState, i) => {
            const part = this.app._parts[i];
            part._params = this.app.validateParams(partState.params);
            part._sample = partState.sampleKey ? this.app._sampleCache.get(partState.sampleKey) : null;
            partState.pads.forEach((padState, j) => {
                const pad = part._pads[j];
                pad._params = this.app.validateParams(padState.params);
                pad._sample = padState.sampleKey ? this.app._sampleCache.get(padState.sampleKey) : null;
                const numStepsToLoad = Math.min(padState.steps.length, pad._steps.length);
                for (let k = 0; k < numStepsToLoad; k++) {
                    const stepState = padState.steps[k];
                    const step = pad._steps[k];
                    step._params = this.app.validateParams(stepState.params);
                    step._on = stepState.on;
                    step._sample = stepState.sampleKey ? this.app._sampleCache.get(stepState.sampleKey) : null;
                }
            });
        });
        this.app.sequencer._bpm = state.bpm || 120;
        this.app.sequencer._bpmInput.value = this.app.sequencer._bpm;
        this.app._currentScale = state.scale || this.app._scales[0].name;
        this.app.samFPshift._timingOffsets = state.timingOffsets || Array(16).fill(0);
        this.app.samFPshift.updateGrid();
        let selector;
        const part = this.app._parts[state.currentPartIndex];
        if (state.currentSelectorType === 'part') selector = part;
        else if (state.currentSelectorType === 'pad') selector = part._pads[state.currentPadIndex];
        else selector = part._pads[state.currentPadIndex]._steps[state.currentSelectorIndex];
        this.app.setCurrentSelector(selector);
        this.app._currentOption = state.currentOption || 'pitch';
        this.app.selectorGrid.updatePadUIs();
        this.app.selectorGrid.updateStepUIs();
        this.app.optionsGrid.update();
        this.app.display.update();
        this.app.sequencer.update();
        this.app.updateWaveformView();
        this.app.selectorGrid.updateAllPreviewsAndGlows();
    }

    async loadSampleKey(key) {
        if (this.app._sampleCache.has(key)) return;
        app.Alert(`Sample ${key} missing; please reload manually via Load button.`);
        app.ChooseFile("/sdcard/", "*.wav;*.mp3;*.ogg;*.flac;*.m4a", (filePath) => {
            if (filePath) this.app.loadFromPath(filePath);
        });
    }
}