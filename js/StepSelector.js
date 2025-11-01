// === FILE: js/StepSelector.js (modified) ===
// === FILE: js/StepSelector.js (1.1 KB) ===
class StepSelector {
    constructor(samFPler) {
        this.app = samFPler;
        this.data = null;
        this.element = null;
    }

    init(section, tempIndex) {
        this.element = document.createElement('div');
        this.element.classList.add('step-selector', 'selector-button');
        this.element.textContent = tempIndex + 1;
        this.element.addEventListener('click', () => {
            if (this.app.drawLevelsEnabled) return;
            if (this.data) {
                this.app.setCurrentSelector(this.data);
                this.app.audioProcessor.playSample(this.data);
            }
        });
        section.appendChild(this.element);
    }

    update(data) {
        this.data = data;
        this.element._data = data;
        if (data) {
            this.element.style.borderColor = data._parent._color;
        } else {
            this.element.textContent = '';
        }
    }

    updateGlow() {
        this.element.style.boxShadow = this.app._currentSelector === this.data ? '0 0 8px 2px white' : 'none';
        const hasData = this.data ? this.data._on : false;
        this.element.style.backgroundColor = hasData ? this.data._parent._color.replace('50%', '70%') : 'black';
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
// === END: js/StepSelector.js ===