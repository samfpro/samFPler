class ParameterManager {
    constructor(app) {
        this.app = app;
    }

    computeAbsoluteParams(selector) {
        if (!selector || !selector._params) {
            console.warn('computeAbsoluteParams: Invalid selector (_params missing); returning defaults.');
            return {
                pitch: 100, gain: 100, start: 0, end: 1, reverse: false, repeat: 'off',
                reverbSend: 0, delaySend: 0, distSend: 0
            };
        }

        let params = { ...selector._params };
        let parent = selector._parent;

        while (parent) {
            if (!parent || !parent._params) {
                console.warn('computeAbsoluteParams: Parent missing _params; stopping cascade:', parent);
                break;
            }

            for (let key in params) {
                if (!(key in parent._params)) continue;

                try {
                    if (['pitch', 'gain', 'reverbSend', 'delaySend', 'distSend'].includes(key)) {
                        params[key] = params[key] * parent._params[key] / 100;
                    } else if (key === 'start') {
                        params[key] = parent._params.start + (parent._params.end - parent._params.start) * params[key];
                    } else if (key === 'end') {
                        params[key] = parent._params.start + (parent._params.end - parent._params.start) * params[key];
                    } else if (key === 'reverse') {
                        params[key] = params[key] || parent._params.reverse;
                    } else if (key === 'repeat') {
                        params[key] = params[key] === 'off' ? parent._params.repeat : params[key]; // Updated: Proper inheritance
                    }
                } catch (err) {
                    console.warn(`computeAbsoluteParams: Error cascading key "${key}":`, err);
                }
            }
            parent = parent._parent;
        }

        params.pitch = Math.max(10, Math.min(200, params.pitch || 100));
        params.gain = Math.max(0, Math.min(200, params.gain || 100));
        params.reverbSend = Math.max(0, Math.min(200, params.reverbSend || 0));
        params.delaySend = Math.max(0, Math.min(200, params.delaySend || 0));
        params.distSend = Math.max(0, Math.min(200, params.distSend || 0));
        params.start = Math.max(0, Math.min((params.end || 1) - 0.01, params.start || 0));
        params.end = Math.min(1, Math.max((params.start || 0) + 0.01, params.end || 1));
        params.reverse = !!params.reverse;
        params.repeat = params.repeat || 'off';

        return params;
    }
    
    // Add this method to the ParameterManager class
getFillHeight(params, option) {
    let value = params[option];
    if (value === undefined) return { height: 0 };

    if (typeof value === 'boolean') {
        return { height: value ? 100 : 0 };
    }

    if (typeof value === 'string') { // e.g., repeat
        const repeats = ['off', '1', '1 up', '1 down', '3', '3 up', '3 down', '3 staggered', '3 reverse staggered'];
        const idx = repeats.indexOf(value);
        return { height: Math.max(0, (idx / (repeats.length - 1)) * 100) };
    }

    // Normalize numerics
    let normalizedValue = value;
    let max = 100; // Default
    switch (option) {
        case 'pitch':
        case 'gain':
        case 'reverbSend':
        case 'delaySend':
        case 'distSend':
            max = 200;
            break;
        case 'start':
        case 'end':
            max = 1;
            normalizedValue = value * 100; // Convert to %
            break;
        case 'voices':
            max = 8;
            break;
        case 'timeOffset':
            // Normalize -49..49 to 0..100% (0% at min, 100% at max)
            normalizedValue = ((value + 49) / 98) * 100;
            max = 100;
            break;
        default:
            return { height: 0 };
    }

    const height = Math.max(0, Math.min(100, (normalizedValue / max) * 100));
    return { height };
}

    validateParams(params) {
        return {
            pitch: Math.max(0, Math.min(200, params.pitch)),
            gain: Math.max(0, Math.min(200, params.gain)),
            reverbSend: Math.max(0, Math.min(200, params.reverbSend || 0)),
            delaySend: Math.max(0, Math.min(200, params.delaySend || 0)),
            distSend: Math.max(0, Math.min(200, params.distSend || 0)),
            start: Math.max(0, Math.min(params.end - 0.01, params.start)),
            end: Math.min(1, Math.max(params.start + 0.01, params.end)),
            reverse: !!params.reverse,
            repeat: ['off', '1', '1 up', '1 down', '3', '3 up', '3 down', '3 staggered', '3 reverse staggered'].includes(params.repeat) ? params.repeat : 'off',
            timeOffset: Math.max(-49, Math.min(99, params.timeOffset)),
            mode: ['sliced', 'pitched'].includes(params.mode) ? params.mode : 'sliced',
            voices: Math.max(1, Math.min(8, Math.round(params.voices || 1)))
        };
    }

    adjustCurrentOption(delta) {
        if (!this.app._currentSelector || !this.app._currentOption) return;
        const option = this.app._currentOption;
        let value = this.app._currentSelector._params[option];
        if (['pitch', 'gain', 'reverbSend', 'delaySend', 'distSend', 'timeOffset', 'voices'].includes(option)) value += delta;
        else if (['start', 'end'].includes(option)) value += delta * 0.01;
        else if (option === 'reverse') value = !value;
        else if (option === 'repeat') {
            const options = ['off', '1', '1 up', '1 down', '3', '3 up', '3 down', '3 staggered', '3 reverse staggered'];
            const idx = options.indexOf(value);
            value = options[(idx + Math.sign(delta) + options.length) % options.length];
        } else if (option === 'mode') value = value === 'pitched' ? 'sliced' : 'pitched';
        this.app._currentSelector.updateOption(option, value);
    }
}