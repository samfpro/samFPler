class BarManager {
    constructor(samFPler) {
        this.app = samFPler;
        this._numBars = 1;
        this._currentBar = 0;
        this.clipboard = null;
    }

    initBarsControls() {
        document.getElementById('bars-up').addEventListener('click', () => {
            let n = this._numBars + 1;
            if (n > 8) n = 8;
            this.setNumBars(n);
        });
        document.getElementById('bars-down').addEventListener('click', () => {
            let n = this._numBars - 1;
            if (n < 1) n = 1;
            this.setNumBars(n);
        });
        document.getElementById('bar-up').addEventListener('click', () => {
            this._currentBar = (this._currentBar + 1) % this._numBars;
            this.updateCurrentBarDisplay();
            this.app.selectorGrid.updateStepUIs();
            this.app.selectorGrid.updatePadPreviews();
            this.app.selectorGrid.updateGlows();
            this.app.sequencer.update();
            this.app.display.update();
        });
        document.getElementById('bar-down').addEventListener('click', () => {
            this._currentBar = (this._currentBar + this._numBars - 1) % this._numBars;
            this.updateCurrentBarDisplay();
            this.app.selectorGrid.updateStepUIs();
            this.app.selectorGrid.updatePadPreviews();
            this.app.selectorGrid.updateGlows();
            this.app.sequencer.update();
            this.app.display.update();
        });
        document.getElementById('copy-bar').addEventListener('click', () => this.copyCurrentBar());
        document.getElementById('paste-bar').addEventListener('click', () => this.pasteToCurrentBar());
    }

    updateCurrentBarDisplay() {
        document.getElementById('current-bar').textContent = this._currentBar + 1;
       this.app.overviewGrid.update(); // NEW: Refresh for current bar
 
    }

    updateBarsDisplay() {
        document.getElementById('current-bars').textContent = this._numBars;
    }

    setNumBars(n) {
        if (n === this._numBars) return;
        this._numBars = n;
        this.app._parts.forEach(part => {
            part._pads.forEach(pad => {
                const oldSteps = pad._steps;
                pad._steps = Array.from({length: n * 16}, (_, globalI) => {
                    const oldGlobal = Math.min(globalI, oldSteps.length - 1);
                    const oldStep = oldSteps[oldGlobal];
                    const newStep = new Step(this.app, pad, globalI);
                    if (oldStep) {
                        newStep._params = { ...oldStep._params };
                        newStep._on = oldStep._on;
                        newStep._sample = oldStep._sample;
                    }
                    return newStep;
                });
                pad.cascadeParams();
            });
        });
        for (let local = 0; local < 16; local++) {
            const value = this.app.samFPshift._timingOffsets[local];
            this.app.samFPshift.updateStepTiming(local, value);
        }
        this.app.selectorGrid.updateStepUIs();
        this.app.selectorGrid.updatePadPreviews();
        this.app.selectorGrid.updateGlows();
        this.app.sequencer.update();
        this.app.display.update();
        this.updateBarsDisplay();
        this.app.overviewGrid.update();
    }

    copyCurrentBar() {
        const barOffset = this._currentBar * 16;
        const barData = this.app._parts.map(part =>
            part._pads.map(pad =>
                pad._steps.slice(barOffset, barOffset + 16).map(step => ({
                    on: step._on,
                    params: { ...step._params }
                }))
            )
        );
        this.clipboard = { barData };
        this.updateClipboardIndicator();
    }

    pasteToCurrentBar() {
        if (!this.clipboard || !this.clipboard.barData) return;
        const barOffset = this._currentBar * 16;
        this.app._parts.forEach((part, pIdx) => {
            if (!this.clipboard.barData[pIdx]) return;
            part._pads.forEach((pad, padIdx) => {
                const sourcePadData = this.clipboard.barData[pIdx][padIdx];
                if (!sourcePadData || sourcePadData.length !== 16) return;
                const targetSteps = pad._steps.slice(barOffset, barOffset + 16);
                targetSteps.forEach((target, sIdx) => {
                    const source = sourcePadData[sIdx];
                    if (source) {
                        target._on = source.on;
                        target._params = { ...source.params };
                    }
                });
            });
        });
        this.app.selectorGrid.updateStepUIs();
        this.app.selectorGrid.updatePadPreviews();
        this.app.selectorGrid.updateGlows();
        this.app.sequencer.update();
        this.app.display.update();
        this.app.overviewGrid.update();
    }

    updateClipboardIndicator() {
        const indicator = document.getElementById('clipboard-indicator');
        if (indicator) {
            indicator.classList.toggle('active', !!this.clipboard);
        }
    }
}