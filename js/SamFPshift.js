class SamFPshift {
    constructor(samFPler) {
        this.app = samFPler;
        this._timingOffsets = Array(16).fill(0);
        this._selectedSteps = new Set();
        this.cells = [];
        this.quickSelectButtons = [];
        this.randomizeButton = null;
        this.range = null;
        this.rangeInput = null;
        this.resetButton = null;
 }

    init() {
        this.randomizeButton = document.getElementById("randomizer-button");
        this.randomizeButton.addEventListener("click",() => this.randomize());
       this.resetButton = document.getElementById("samFPshift-reset");
       this.resetButton.addEventListener("click", () => this.reset());
    
  const grid = document.getElementById('samFPshift-grid');
        for (let i = 0; i < 16; i++) {
            const cell = document.createElement('div');
            cell.classList.add('samFPshift-cell');
            const staticLine = document.createElement('div');
            staticLine.classList.add('timing-line');
            if (i === 0){
                staticLine.style.left = "0";
                cell.classList.add('first-samFPshift-cell');
            }else if (i === 15){
                staticLine.style.left = "33.3%";
                cell.classList.add('last-samFPshift-cell');
            }else{
                staticLine.style.left = '50%';
            }
            cell.appendChild(staticLine);
            const dynamicLine = document.createElement('div');
            dynamicLine.classList.add('timing-line', 'dynamic');
            cell.appendChild(dynamicLine);
            cell.addEventListener('click', () => this.toggleSelect(i));
            grid.appendChild(cell);
            this.cells.push(cell);
        }
        const quickGrid = document.getElementById('quick-select-grid');
        const labels = ['All', 'None', 'Dnbt', 'Upbt', 'Even', 'Odd', 'Rndm', 'Invt'];
        labels.forEach((label, i) => {
            const button = document.createElement('div');
            button.classList.add('quick-select-button', 'button');
            button.textContent = label;
            button.addEventListener('click', () => this.quickSelect(label));
            quickGrid.appendChild(button);
            this.quickSelectButtons.push(button);
        });

        // Slider JS setup
        this.range = document.querySelector('#samFPshift-panel .range .range-selected');
        this.rangeInput = document.querySelectorAll('#samFPshift-panel .range-input input');
        const rangeMinGap = 1;  // Enforce min < max by at least 1 unit

        // Helper to update slider visuals
        const updateSlider = () => {
            let minVal = parseInt(this.rangeInput[0].value);
            let maxVal = parseInt(this.rangeInput[1].value);
            const sliderMin = parseInt(this.rangeInput[0].min);
            const sliderMax = parseInt(this.rangeInput[1].max);
            const rangeWidth = sliderMax - sliderMin;
            this.range.style.left = ((minVal - sliderMin) / rangeWidth) * 100 + '%';
            this.range.style.right = (100 - ((maxVal - sliderMin) / rangeWidth) * 100) + '%';
        };

        // Listeners for range inputs (thumbs)
        this.rangeInput.forEach((input) => {
            input.addEventListener("input", (e) => {
                let minRange = parseInt(this.rangeInput[0].value);
                let maxRange = parseInt(this.rangeInput[1].value);
                const sliderMin = parseInt(this.rangeInput[0].min);
                const sliderMax = parseInt(this.rangeInput[1].max);
                const rangeWidth = sliderMax - sliderMin;

                if (maxRange - minRange < rangeMinGap) {
                    if (e.target.className === "min") {
                        this.rangeInput[0].value = maxRange - rangeMinGap;
                        minRange = parseInt(this.rangeInput[0].value);
                    } else {
                        this.rangeInput[1].value = minRange + rangeMinGap;
                        maxRange = parseInt(this.rangeInput[1].value);
                    }
                }
                // Always update visuals
                this.range.style.left = ((minRange - sliderMin) / rangeWidth) * 100 + '%';
                this.range.style.right = (100 - ((maxRange - sliderMin) / rangeWidth) * 100) + '%';
            });
        });

        // Initial update
        updateSlider();

        this.updateGrid();
    }

    toggleSelect(i) {
        if (this._selectedSteps.has(i)) this._selectedSteps.delete(i);
        else this._selectedSteps.add(i);
        this.updateGrid();
    }
   reset() {
    this._timingOffsets = Array(16).fill(0);
    for (let i = 0; i < 16; i++) {
        this.updateStepTiming(i, 0);
    }
    this.updateGrid();
    this.app.sequencer.update();
    console.log("Reset all timing offsets to 0");
} 
    randomize(){
        console.log("registered randomize button click");
        const gMin = parseInt(this.rangeInput[0].value);
        const gMax = parseInt(this.rangeInput[1].value);
        this._selectedSteps.forEach(i => {
            const stepMin = i === 0 ? 0 : -49;
            const stepMax = i === 15 ? 99 : 49;
            const actualMin = Math.max(gMin, stepMin);
            const actualMax = Math.min(gMax, stepMax);
            if (actualMin < actualMax) {
                this._timingOffsets[i] =Math.round(Math.random() * (actualMax - actualMin) + actualMin);
            } else {
                this._timingOffsets[i] = stepMin;  // Fallback to step min if no valid range
            }
            this.updateStepTiming(i, this._timingOffsets[i]);
        });
        this.updateGrid();
    }
        
    quickSelect(label) {
        switch (label) {
            case 'All': this._selectedSteps = new Set(Array.from({length: 16}, (_, i) => i)); break;
            case 'None': this._selectedSteps.clear(); break;
            case 'Dnbt': this._selectedSteps = new Set([0, 4, 8, 12]); break;
            case 'Upbt': this._selectedSteps = new Set([2, 6, 10, 14]); break;
            case 'Even': this._selectedSteps = new Set(Array.from({length: 8}, (_, i) => i * 2)); break;
            case 'Odd': this._selectedSteps = new Set(Array.from({length: 8}, (_, i) => i * 2 + 1)); break;
            case 'Rndm': this._selectedSteps = new Set(Array.from({length: 16}, (_, i) => Math.random() < 0.5 ? i : null).filter(v => v !== null)); break;
            case 'Invt': this._selectedSteps = new Set(Array.from({length: 16}, (_, i) => this._selectedSteps.has(i) ? null : i).filter(v => v !== null)); break;
        }
        this.updateGrid();
    }

    adjust(delta) {
        this._selectedSteps.forEach(i => {
            const min = i === 0 ? 0 : -49;
            const max = i === 15 ? 99 : 49;
            this._timingOffsets[i] = Math.max(min, Math.min(max, this._timingOffsets[i] + Math.round(delta)));
            this.updateStepTiming(i, this._timingOffsets[i]);
        });
        this.updateGrid();
    }

    updateStepTiming(stepIndex, value) {
        for (let b = 0; b < this.app._numBars; b++) {
            const gIndex = b * 16 + stepIndex;
            this.app._parts.forEach(part => {
                part._pads.forEach(pad => {
                    const step = pad._steps[gIndex];
                    if (step) step._params.timeOffset = value;
                });
            });
        }
        this.app.updateSelection();
    }

    updateGrid() {
        this.cells.forEach((cell, i) => {
            cell.classList.toggle('selected', this._selectedSteps.has(i));
            const offset = this._timingOffsets[i];
            const min = i === 0 ? 0 : -49;
            const max = i === 15 ? 99 : 49;
            const position = ((offset - min) / (max - min)) * 100;
            cell.querySelector('.dynamic').style.left = `${position}%`;
        });
    }
}