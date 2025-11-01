// === FILE: js/SelectorGrid.js (1.9 KB) ===
class SelectorGrid {
    constructor(samFPler) {
        this.app = samFPler;
        this.partUIs = [];
        this.padUIs = [];
        this.stepUIs = [];
    }

    init() {
        const partSection = document.getElementById('part-section');
        for (let i = 0; i < 16; i++) {
            const part = new Part(this.app, i);
            this.app._parts.push(part);
            const partUI = new PartSelector(this.app, part);
            partUI.init(partSection);
            this.partUIs.push(partUI);
        }
        const padSection = document.getElementById('pad-section');
        for (let i = 0; i < 16; i++) {
            const padUI = new PadSelector(this.app);
            padUI.init(padSection, i);
            this.padUIs.push(padUI);
        }
        const stepSection = document.getElementById('step-section');
        for (let i = 0; i < 16; i++) {
            const stepUI = new StepSelector(this.app);
            stepUI.init(stepSection, i);
            this.stepUIs.push(stepUI);
        }
    }

    updatePadUIs() {
        this.padUIs.forEach((ui, i) => ui.update(this.app._currentPart._pads[i]));
    }

    updateStepUIs() {
        const pad = this.app._currentPad;
        if (!pad) return;
        const offset = this.app.barManager._currentBar * 16;
        this.stepUIs.forEach((ui, i) => {
            const gindex = offset + i;
            const step = pad._steps[gindex];
            ui.update(step);
            ui.element.textContent = i + 1;
        });
    }

    updateGlows() {
        this.partUIs.forEach(ui => ui.updateGlow());
        this.padUIs.forEach(ui => ui.updateGlow());
        this.stepUIs.forEach(ui => ui.updateGlow());
    }

    // NEW: Update fills across all selectors for the current option
    updateFills(option) {
        this.partUIs.forEach(ui => ui.updateFill(option));
        this.padUIs.forEach(ui => ui.updateFill(option));
        this.stepUIs.forEach(ui => ui.updateFill(option));
    }

    updatePadPreviews() {
        this.padUIs.forEach(ui => ui.padPreviewGrid.update());
    }

    updateAllPreviewsAndGlows() {
        this.partUIs.forEach(ui => ui.partPreviewGrid.update());
        this.updatePadPreviews();
        this.updateGlows();
    }
}
// === END: js/SelectorGrid.js ===