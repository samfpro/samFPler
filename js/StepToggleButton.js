// === FILE: js/StepToggleButton.js (1.0 KB) ===
const SEQ_TOGGLE_STATE_OFF = 0;
const SEQ_TOGGLE_STATE_ON = 1;

class StepToggleButton {
    constructor(samFPler, index) {
        this.app = samFPler;
        this.index = index;
        this.element = null;
        this._state = SEQ_TOGGLE_STATE_OFF;
    }

    init(grid) {
        this.element = document.createElement('div');
        this.element.classList.add('step-toggle-button');
        this.element.textContent = this.index + 1;
        this.element.addEventListener('click', () => {
            if (!this.app.sequencer._isRecording) {
                this.app.sequencer.toggleStep(this.index);
            }
        });
        grid.appendChild(this.element);
    }

    updateState() {
        const offset = this.app.barManager._currentBar * 16;
        const globalIndex = offset + this.index;
        const on = this.app._currentPad?._steps[globalIndex]?._on ?? false;
        this._state = on ? SEQ_TOGGLE_STATE_ON : SEQ_TOGGLE_STATE_OFF;
        this.element.classList.toggle('seq-toggle-state-on', this._state === SEQ_TOGGLE_STATE_ON);
    }
}
// === END: js/StepToggleButton.js ===