// === FILE: js/StateManager.js (updated for URI-based sample keys) ===
class StateManager {
    constructor(samFPler) {
        this.app = samFPler;
    }

    saveState() {
        const fileName = prompt("Enter filename (e.g., myproject):", "samFPler_state");
        if (!fileName) return app.Alert('No filename entered.');
        const statePath = "/sdcard/samFPler/" + fileName + ".json";
        const state = {
            numBars: this.app.barManager._numBars,  // FIXED: Use barManager._numBars
            currentBar: this.app.barManager._currentBar,  // FIXED: Use barManager._currentBar
            parts: this.app._parts.map(part => ({
                params: { ...part._params },
                sampleKey: part._samplePath || null,  // FIXED: Use _samplePath (URI) as key
                pads: part._pads.map(pad => ({
                    params: { ...pad._params },
                    sampleKey: pad._samplePath || null,  // FIXED: Use _samplePath (URI)
                    steps: pad._steps.map(step => ({
                        params: { ...step._params },
                        on: step._on,
                        sampleKey: step._samplePath || null  // FIXED: Use _samplePath (URI)
                    }))
                }))
            })),
            currentPartIndex: this.app._currentPart._index,
            currentPadIndex: this.app._currentPad?._index ?? 0,
            currentSelectorType: this.app._currentSelector instanceof Part ? 'part' : this.app._currentSelector instanceof Pad ? 'pad' : 'step',
            currentSelectorIndex: this.app._currentSelector._index,
            currentOption: this.app._currentOption,
            bpm: this.app.sequencer._bpm,
            scale: this.app.scaleManager._currentScale,  // FIXED: Use scaleManager._currentScale
            timingOffsets: [...this.app.samFPshift._timingOffsets]
        };
        app.WriteTextFile(statePath, JSON.stringify(state, null, 2));
        app.Alert(`State saved to ${statePath}`);
    }

    loadStateFile() {
        app.ChooseFile("/sdcard/", "*.json", (filePath) => {
            if (!filePath) return app.Alert('No file selected.');
            const content = app.ReadTextFile(filePath);
            if (!content) return app.Alert('Failed to read state file.');
            const state = JSON.parse(content);
            this.loadState(state);
        });
    }

    async loadState(state) {
        this.app.barManager.setNumBars(state.numBars || 1);  // FIXED: Use setNumBars
        this.app.barManager._currentBar = state.currentBar || 0;  // FIXED: Set via barManager
        this.app.barManager.updateCurrentBarDisplay();
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
            part._params = this.app.parameterManager.validateParams(partState.params);  // FIXED: Use parameterManager.validateParams
            part._sample = partState.sampleKey ? this.app.sampleManager.getCachedSample(partState.sampleKey) : null;
            part._samplePath = partState.sampleKey;  // FIXED: Restore URI
            partState.pads.forEach((padState, j) => {
                const pad = part._pads[j];
                pad._params = this.app.parameterManager.validateParams(padState.params);  // FIXED: Use parameterManager
                pad._sample = padState.sampleKey ? this.app.sampleManager.getCachedSample(padState.sampleKey) : null;
                pad._samplePath = padState.sampleKey;  // FIXED: Restore URI
                const numStepsToLoad = Math.min(padState.steps.length, pad._steps.length);
                for (let k = 0; k < numStepsToLoad; k++) {
                    const stepState = padState.steps[k];
                    const step = pad._steps[k];
                    step._params = this.app.parameterManager.validateParams(stepState.params);  // FIXED: Use parameterManager
                    step._on = stepState.on;
                    step._sample = stepState.sampleKey ? this.app.sampleManager.getCachedSample(stepState.sampleKey) : null;
                    step._samplePath = stepState.sampleKey;  // FIXED: Restore URI
                }
            });
        });
        this.app.sequencer._bpm = state.bpm || 120;
        if (this.app.sequencer._bpmInput) this.app.sequencer._bpmInput.value = this.app.sequencer._bpm;
        this.app.scaleManager._currentScale = state.scale || this.app.scaleManager._scales[0]?.name || 'Major';  // FIXED: Use scaleManager
        this.app.scaleManager.initScaleSelector();  // Re-init to update UI
        this.app.samFPshift._timingOffsets = state.timingOffsets || Array(16).fill(0);
        this.app.samFPshift.updateGrid();
        let selector;
        const part = this.app._parts[state.currentPartIndex];
        if (state.currentSelectorType === 'part') selector = part;
        else if (state.currentSelectorType === 'pad') selector = part._pads[state.currentPadIndex];
        else selector = part._pads[state.currentPadIndex]?._steps[state.currentSelectorIndex];
        this.app.setCurrentSelector(selector);
        this.app._currentOption = state.currentOption || 'pitch';
        this.app.selectorGrid.updatePadUIs();
        this.app.selectorGrid.updateStepUIs();
        this.app.optionsGrid.update();
        this.app.display.update();
        this.app.sequencer.update();
        this.app.waveformRenderer.updateWaveformView();  // FIXED: Use waveformRenderer
        this.app.selectorGrid.updateAllPreviewsAndGlows();
        this.app.overviewGrid.update();
    }

    async loadSampleKey(key) {
        if (this.app.sampleManager.getCachedSample(key)) return;  // Already cached
        app.Alert(`Sample ${key} missing; please reload manually via Load button.`);
        app.ChooseFile("/sdcard/", "*.wav;*.mp3;*.ogg;*.flac;*.m4a", async (fileUri) => {
            if (fileUri) {
                await this.app.sampleManager.loadFromUri(fileUri);  // FIXED: Use loadFromUri
                // Update all selectors that used this key to the new URI
                // (Optional: For simplicity, re-render waveform; full sync would scan/reassign)
                this.app.waveformRenderer.render();
            }
        });
    }
}
// === END: js/StateManager.js ===