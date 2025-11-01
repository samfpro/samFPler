// === FILE: js/PadPreviewGrid.js (1017.0 B) ===
class PadPreviewGrid {
    constructor(padSelector) {
        this.padSelector = padSelector;
        this.element = null;
        this.cells = [];
    }

    init() {
        this.element = document.createElement('div');
        this.element.classList.add('pad-preview-grid');
        for (let i = 0; i < 16; i++) {
            const cell = document.createElement('div');
            cell.classList.add('pad-preview-cell');
            this.element.appendChild(cell);
            this.cells.push(cell);
        }
        this.padSelector.element.appendChild(this.element);
    }

    update() {
    const barOffset = this.padSelector.app.barManager._currentBar * 16;
    for (let i = 0; i < 16; i++) {
        const globalI = barOffset + i;
        const step = this.padSelector.data._steps[globalI];
        this.cells[i].classList.toggle('filled', step ? step._on : false);
        this.cells[i].style.backgroundColor = step && step._on ? this.padSelector.data._color.replace('50%', '70%') : '';
    }
}
}
// === END: js/PadPreviewGrid.js ===