/* js/FXManager.js (updated with Drive/Tone/Grit distortion and 3-way switch) */
class FXManager {
    constructor(app) {
        this.app = app;
        this.audioProcessor = app.audioProcessor; // Access to update nodes

        // ------------------------------------------------------------------
        // 1. UI elements
        // ------------------------------------------------------------------
        this.mixerDiv = document.getElementById('fx-mixer');
        this.displays = [
            document.getElementById('fx-dynamic-display-1'),
            document.getElementById('fx-dynamic-display-2'),
            document.getElementById('fx-dynamic-display-3')
        ];
        this.knobs = [
            new Knob(app, 'fx-knob-1', delta => this.adjust(0, delta)),
            new Knob(app, 'fx-knob-2', delta => this.adjust(1, delta)),
            new Knob(app, 'fx-knob-3', delta => this.adjust(2, delta))
        ];

        // ------------------------------------------------------------------
        // 2. State
        // ------------------------------------------------------------------
        this.currentFX = 'reverb';               // which effect we are editing (default: reverb/up)
        this.fxOpen = true;                      // Always open (no toggle)
        this.fxParams = {                        // per-effect extra params (master sends already exist)
            reverb: { size: 50, predelay: 50, damping: 50 },
            delay: { time: 25, feedback: 30, damping: 50 },
            dist: { drive: 50, tone: 50, grit: 0 }
        };

        // ------------------------------------------------------------------
        // 3. Init
        // ------------------------------------------------------------------
        this.initUI();
        this.knobs.forEach(k => k.init());
        this.updateAll();
        this.updateAllEffects(); // Initialize audio nodes with default params
    }

    // ----------------------------------------------------------------------
    // UI wiring (switch only; no toggle or old selector)
    // ----------------------------------------------------------------------
    initUI() {
        // Wire up the 3-way switch
        const fxNames = { up: 'reverb', middle: 'delay', down: 'dist' };
        Object.entries(fxNames).forEach(([pos, fx]) => {
            const switchEl = document.getElementById(`switch-${pos}`);
            const labelEl = document.getElementById(`switch-label-${pos}`);
            if (!switchEl || !labelEl) return; // Safety check

            const clickHandler = () => {
                // Remove active from all switches/labels
                ['up', 'middle', 'down'].forEach(p => {
                    document.getElementById(`switch-${p}`).classList.remove('active');
                    document.getElementById(`switch-label-${p}`).classList.remove('active');
                });

                // Add active to this one
                switchEl.classList.add('active');
                labelEl.classList.add('active');

                // Update FX state
                this.setCurrentFX(fx);
            };

            // Click on switch or label
            switchEl.addEventListener('click', clickHandler);
            labelEl.addEventListener('click', clickHandler);
        });

        // Mixer always visible
        this.mixerDiv.classList.remove('hidden');
    }

    // ----------------------------------------------------------------------
    // Change the effect we are editing
    // ----------------------------------------------------------------------
    setCurrentFX(name) {
        if (!['reverb','delay','dist'].includes(name)) return;
        this.currentFX = name;
        this.updateDisplays();
    }

    // ----------------------------------------------------------------------
    // Knob → parameter
    // ----------------------------------------------------------------------
    adjust(idx, delta) {
        const cfg = this.paramConfig[this.currentFX][idx];
        if (!cfg) return;

        let val = this.fxParams[this.currentFX][cfg.key];
        val = Math.round(val + delta * cfg.step);
        val = Math.max(cfg.min, Math.min(cfg.max, val));

        this.fxParams[this.currentFX][cfg.key] = val;
        this.updateDisplays();
        this.updateAllEffects(); // Update audio nodes
    }

    // ----------------------------------------------------------------------
    // Update audio nodes for all effects
    // ----------------------------------------------------------------------
    updateAllEffects() {
        this.updateEffectParams('reverb');
        this.updateEffectParams('delay');
        this.updateEffectParams('dist');
    }

    // ----------------------------------------------------------------------
    // Update specific effect params in audio nodes
    // ----------------------------------------------------------------------
    updateEffectParams(fx) {
        const params = this.fxParams[fx];
        if (fx === 'delay') {
            this.audioProcessor.updateDelayParams(params);
        } else if (fx === 'reverb') {
            this.audioProcessor.updateReverbIR(params);
        } else if (fx === 'dist') {
            this.audioProcessor.updateDistParams(params);
        }
    }

    // ----------------------------------------------------------------------
    // Lights (removed; switch visuals handle indication)
    // ----------------------------------------------------------------------
    updateLights() {
        // No-op: Switch active classes replace lights
    }

    // ----------------------------------------------------------------------
    // Parameter → display (and optional knob read-out)
    // ----------------------------------------------------------------------
    updateDisplays() {
        const cfg = this.paramConfig[this.currentFX];
        cfg.forEach((c, i) => {
            const val = this.fxParams[this.currentFX][c.key];
            this.displays[i].textContent = `${c.label}: ${val}`;
            // optional numeric read-out on the knob itself
            document.getElementById(`fx-knob-${i+1}`).dataset.val = val;
        });
    }

    // ----------------------------------------------------------------------
    // Called from the main app whenever the current selector changes
    // ----------------------------------------------------------------------
    updateAll() {
        this.updateDisplays();
    }

    // ----------------------------------------------------------------------
    // Parameter definitions – **add / remove / tweak freely**
    // ----------------------------------------------------------------------
    get paramConfig() {
        return {
            reverb: [
                { key:'size',     label:'Size',   min:10, max:90, step:1 },
                { key:'predelay', label:'Pre',    min:0,  max:100,step:1 },
                { key:'damping',  label:'Damp',   min:0,  max:100,step:1 }
            ],
            delay: [
                { key:'time',     label:'Time',   min:5,  max:95, step:1 },
                { key:'feedback', label:'FB',     min:0,  max:90, step:1 },
                { key:'damping',  label:'Damp',   min:0,  max:100,step:1 }
            ],
            dist: [
                { key:'drive',    label:'Drive',  min:0,  max:100,step:1 },
                { key:'tone',     label:'Tone',   min:0,  max:100,step:1 },
                { key:'grit',     label:'Grit',   min:0,  max:100,step:1 }
            ]
        };
    }
}