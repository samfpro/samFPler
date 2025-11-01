// === FILE: js/PadSelector.js (modified) ===
// === FILE: js/PadSelector.js (2.1 KB) ===
class PadSelector {
    constructor(app) {
        this.app = app;
        this.data = null;
        this.element = null;
        this.padPreviewGrid = null;
    }

    init(section, tempIndex) {
        this.element = document.createElement('div');
        this.element.classList.add('pad-selector', 'selector-button');
        this.element.textContent = tempIndex + 1;
        this.element.addEventListener('click', () => { 
            if (this.app.drawLevelsEnabled) return;
            if (!this.data) return;
            if (this.app.sequencer._isPlaying && this.app.sequencer._isRecording) {
                const localStep = this.app.sequencer.getCurrentLocalStep();
                const offset = this.app.barManager._currentBar * 16;
                const globalIndex = offset + localStep;
                const step = this.data._steps[globalIndex];
                if (step) {
                    step._on = !step._on;
                    this.app.sequencer.update();
                    this.app.selectorGrid.updateStepUIs();
                    this.app.selectorGrid.updatePadPreviews();
                    this.app.selectorGrid.updateGlows();
                    const partUI = this.app.selectorGrid.partUIs.find(ui => ui.data === this.app._currentPart);
                    if (partUI) partUI.partPreviewGrid.update();
                    // Add feedback for toggle
                    this.app.sequencer.stepToggleButtons[localStep].element.classList.add('triggered');
                    setTimeout(() => this.app.sequencer.stepToggleButtons[localStep].element.classList.remove('triggered'), 150);
                    this.app.selectorGrid.stepUIs[localStep].element.classList.add('triggered');
                    setTimeout(() => this.app.selectorGrid.stepUIs[localStep].element.classList.remove('triggered'), 150);
                }
                return;
            }
            this.app.setCurrentPad(this.data);
            this.app.audioProcessor.playSample(this.data);  // Play the pad's sample on click
        });
        section.appendChild(this.element);
      this.padPreviewGrid = new PadPreviewGrid(this);
  this.padPreviewGrid.init();
    }

    update(data) {
        this.data = data;
        this.element._data = data;
        this.element.textContent = data._index + 1;
        this.element.style.borderColor = data._color;
        this.padPreviewGrid.update();
    }

    updateGlow() {
        this.element.style.boxShadow = this.app._currentPad === this.data ? '0 0 8px 2px white' : 'none';
        const hasData = this.data ? this.data._steps.some(step => step._on) : false;
        this.element.style.backgroundColor = hasData ? this.data._color.replace('50%', '70%') : 'black';
    }

    // NEW: Update liquid fill based on current option
    updateFill(option) {
        if (!this.data) return;
        const params = this.app.parameterManager.computeAbsoluteParams(this.data);
        const { height } = this.app.parameterManager.getFillHeight(params, option);
        this.element.style.setProperty('--fill-height', height + '%');
        // Optional: Add 'pouring' class for wave animation on change
        this.element.classList.add('pouring');
        setTimeout(() => this.element.classList.remove('pouring'), 600);
    }
}
// === END: js/PadSelector.js ===