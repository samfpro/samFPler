/* =================================================================== */
/* FILE: /sdcard/DroidScript/samFPler/js/OverviewGrid.js */
/* =================================================================== */

class OverviewGrid {
    constructor(samFPler) {
        this.app = samFPler;
        this.grid = null;
        this.cells = []; // 16x16 grid of cell elements
    }

    init() {
        this.grid = document.getElementById('overview-grid');

        for (let row = 0; row < 16; row++) { // row = part index (0=Part1, top)
            this.cells[row] = [];
            for (let col = 0; col < 16; col++) { // col = local step (0-15)
                const cell = document.createElement('div');
                cell.classList.add('overview-cell');
                cell.dataset.part = row;
                cell.dataset.step = col;
                cell.style.backgroundColor = 'black'; // Default empty
                cell.style.border = 'none'; // No borders
                this.grid.appendChild(cell);
                this.cells[row][col] = cell;
            }
        }

        // Initial update
        this.update();
    }

    update() {
        if (!this.app.barManager) return; // Safety
        const currentBarOffset = this.app.barManager._currentBar * 16;

        this.cells.forEach((rowCells, partIndex) => {
            const part = this.app._parts[partIndex];
            if (!part) return;

            const partColor = part._color.replace('50%', '70%'); // Brighter for visibility

            rowCells.forEach((cell, localStep) => {
                const globalStep = currentBarOffset + localStep;
                let isActive = false;

                // Check if ANY pad in this part has this global step ON
                part._pads.forEach(pad => {
                    const step = pad._steps[globalStep];
                    if (step && step._on) {
                        isActive = true;
                        return; // Short-circuit
                    }
                });

                cell.classList.toggle('active', isActive);
                cell.style.backgroundColor = isActive ? partColor : 'black';
            });
        });
    }
}