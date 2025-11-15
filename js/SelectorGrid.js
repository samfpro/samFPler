// === FILE: js/SelectorGrid.js (modified) ===
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

    // NEW: Update throbbing for current selector and its parents
    // NEW: Update throbbing for current selector and its parents
updateThrobbing() {
    // Clear all overlays (removes throbbing visuals)
    [...document.querySelectorAll('.throb-overlay')].forEach(overlay => overlay.remove());

    // Traverse up the hierarchy from current selector and add throbbing overlay
    let current = this.app._currentSelector;
    while (current) {
        let ui = null;
        if (current instanceof Part) {
            ui = this.partUIs.find(u => u.data === current);
        } else if (current instanceof Pad) {
            ui = this.padUIs.find(u => u.data === current);
        } else if (current instanceof Step) {
            const localIndex = current._index % 16;
            ui = this.stepUIs[localIndex];
        }

        if (ui && ui.element && !ui.element.querySelector('.throb-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'throb-overlay';
            overlay.style.position = 'absolute';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.backgroundColor = 'white';
            overlay.style.zIndex = '200';
            overlay.style.pointerEvents = 'none';
            ui.element.appendChild(overlay);
        }

        current = current?._parent;
    }
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