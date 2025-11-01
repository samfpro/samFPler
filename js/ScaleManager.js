class ScaleManager {
    constructor(samFPler) {
        this.app = samFPler;
        this._scales = [];
        this._currentScale = 'Major';
    }

    async loadScales() {
        return new Promise((resolve, reject) => {
            const path = "/sdcard/samFPler/scales.txt";
            const content = app.ReadTextFile(path);
            if (content) {
                this._scales = content.trim().split('\n').map(line => {
                    const [name, ...semitones] = line.split(',');
                    return { name, semitones: semitones.map(Number) };
                });
                resolve();
            } else {
                reject(new Error("scales.txt not found"));
            }
        });
    }

    setFallbackScales() {
        this._scales = [
            { name: 'Major', semitones: [0, 2, 4, 5, 7, 9, 11] },
            { name: 'Minor', semitones: [0, 2, 3, 5, 7, 8, 10] },
            { name: 'Pentatonic', semitones: [0, 2, 4, 7, 9] },
            { name: 'Blues', semitones: [0, 3, 5, 6, 7, 10] }
        ];
    }

    initScaleSelector() {
        const scaleDiv = document.getElementById('scale');
        scaleDiv.innerHTML = '';
        const select = document.createElement('select');
        this._scales.forEach(scale => {
            const option = document.createElement('option');
            option.value = scale.name;
            option.textContent = scale.name;
            select.appendChild(option);
        });
        select.value = this._currentScale;
        select.addEventListener('change', e => {
            this._currentScale = e.target.value;
            this.app._parts.forEach(part => { if (part._params.mode === 'pitched') part.setPitchedMode(); });
            this.app.sequencer.update();
        });
        scaleDiv.appendChild(select);
    }
}