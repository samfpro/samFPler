// === FILE: js/Display.js (updated loadSample listener) ===
class Display {
    constructor(samFPler) {
        this.app = samFPler;
        this.selectorDisplay = document.getElementById('display-current-selector');
        this.optionDisplay = document.getElementById('display-current-option');
        this.loadSampleButton = document.getElementById("load-sample-button");
    }

    init() {
        this.loadSampleButton.addEventListener('click', () => this.app.sampleManager.loadSample());  // FIXED: Use loadSample() for permission check
    }

    update() {
        let text = `Part ${this.app._currentPart._index + 1}`;
        if (this.app._currentSelector instanceof Pad) {
            text += ` Pad ${this.app._currentSelector._index + 1}`;
        } else if (this.app._currentSelector instanceof Step) {
            text += ` Pad ${this.app._currentSelector._parent._index + 1} Step ${this.app._currentSelector._index % 16 + 1}`;
        }
        this.selectorDisplay.textContent = text;
        const params = this.app.parameterManager.computeAbsoluteParams(this.app._currentSelector);
        let value = params[this.app._currentOption];
        if (Number.isInteger(value)) value = value.toString();
        else if (typeof value === 'number') value = value.toFixed(2);
        this.optionDisplay.textContent = `${this.app._currentOption}: ${value}`;
    }
}
// === END: js/Display.js ===