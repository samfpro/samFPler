class PartPreviewGrid {
    constructor(partSelector) {
        this.partSelector = partSelector;
        this.element = null;
        this.cells = [];
    }

    init() {
        this.element = document.createElement('div');
        this.element.classList.add('part-preview-grid');
        for (let i = 0; i < 16; i++) {
            const cell = document.createElement('div');
            cell.classList.add('part-preview-cell');
            this.element.appendChild(cell);
            this.cells.push(cell);
        }
        this.partSelector.element.appendChild(this.element);
    }

    update() {
        this.partSelector.data._pads.forEach((pad, i) => {
            const filled = pad._steps.some(step => step._on);
            this.cells[i].classList.toggle('filled', filled);
            this.cells[i].style.backgroundColor = filled ? pad._color : '';
        });
    }
}