// === FILE: js/PartSelector.js (modified) ===
// === FILE: js/PartSelector.js (974.0 B) ===
class PartSelector {
    constructor(samFPler, data) {
        this.app = samFPler;
        this.data = data;
        this.element = null;
        this.partPreviewGrid = new PartPreviewGrid(this);
    }

    init(section) {
        this.element = document.createElement('div');
        this.element.classList.add('part-selector', 'selector-button');
        this.element.textContent = `${this.data._index + 1}`;
        this.element.style.borderColor = this.data._color;
        this.element.addEventListener('click', () => {
            if (this.app.drawLevelsEnabled) return;
            this.app.setCurrentPart(this.data);
        });
        section.appendChild(this.element);
        this.partPreviewGrid.init();
        this.element._data = this.data;
    }

    updateGlow() {
        this.element.style.boxShadow = this.app._currentPart === this.data ? '0 0 8px 2px white' : 'none';
        const hasData = this.data._pads.some(pad => pad._steps.some(step => step._on));
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
// === END: js/PartSelector.js ===