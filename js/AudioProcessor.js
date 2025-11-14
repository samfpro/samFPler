// === FILE: js/AudioProcessor.js (fixed async init) ===
class AudioProcessor {
    constructor(samFPler) {
        this.app = samFPler;
        this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.masterDist = null;
        this.masterComp = null;
        this.masterLim = null;
        this.masterChain = null;
        this.delayBus = null;
        this.delayLowpass = null;
        this.delayFeedbackGain = null;
        this.delayWetGain = null;
        this.distBus = null;
        this.distToneFilter = null;
        this.distDriveGain = null;
        this.distNoiseSource = null;
        this.distNoiseGain = null;
        this.distFeedbackDelay = null;
        this.distFeedbackGain = null;
        this.reverbBus = null;
        this.reverbGain = null;
    }

    async initAudioContext() {
        if (this._audioContext.state === 'suspended') {
            await this._audioContext.resume();
        }

        this.masterDist = this._audioContext.createWaveShaper();
        const distCurve = new Float32Array(65536);
        for (let i = 0; i < 65536; i++) {
            const x = (i - 32768) / 32768;
            distCurve[i] = Math.tanh(x * 2);
        }
        this.masterDist.curve = distCurve;
        this.masterComp = this._audioContext.createDynamicsCompressor();
        this.masterComp.threshold.value = -24;
        this.masterComp.knee.value = 30;
        this.masterComp.ratio.value = 2.5;
        this.masterComp.attack.value = 0.003;
        this.masterComp.release.value = 0.25;
        this.masterLim = this._audioContext.createDynamicsCompressor();
        this.masterLim.threshold.value = -4;
        this.masterLim.knee.value = 0;
        this.masterLim.ratio.value = 20;
        this.masterLim.attack.value = 0.003;
        this.masterLim.release.value = 0.25;
        this.masterChain = this._audioContext.createGain();
        this.masterChain.connect(this.masterDist);
        this.masterDist.connect(this.masterComp);
        this.masterComp.connect(this.masterLim);
        this.masterLim.connect(this._audioContext.destination);

        // Delay setup with separate feedback and wet, and lowpass
        this.delayBus = this._audioContext.createDelay(1);
        this.delayBus.delayTime.value = 0.25;
        this.delayLowpass = this._audioContext.createBiquadFilter();
        this.delayLowpass.type = 'lowpass';
        this.delayLowpass.frequency.value = 5000;
        this.delayFeedbackGain = this._audioContext.createGain();
        this.delayFeedbackGain.gain.value = 0.3; // default feedback
        this.delayWetGain = this._audioContext.createGain();
        this.delayWetGain.gain.value = 1; // wet full, mix via send
        this.delayBus.connect(this.delayLowpass);
        this.delayLowpass.connect(this.delayFeedbackGain);
        this.delayFeedbackGain.connect(this.delayBus);
        this.delayLowpass.connect(this.delayWetGain);
        this.delayWetGain.connect(this.masterChain);

        // Distortion setup with drive, tone, noise, and feedback
        this.distBus = this._audioContext.createWaveShaper();
        const hardCurve = new Float32Array(65536);
        for (let i = 0; i < 65536; i++) {
            const x = (i - 32768) / 32768;
            hardCurve[i] = Math.sign(x) * Math.min(1, Math.abs(x * 3));
        }
        this.distBus.curve = hardCurve;
        this.distToneFilter = this._audioContext.createBiquadFilter();
        this.distToneFilter.type = 'lowpass';
        this.distToneFilter.frequency.value = 8000;

        // Drive gain (pre-dist boost)
        this.distDriveGain = this._audioContext.createGain();
        this.distDriveGain.gain.value = 1;

        // Noise source (looping white noise)
        this.distNoiseSource = this._audioContext.createBufferSource();
        const noiseBufferSize = this._audioContext.sampleRate; // 1 second loop
        const noiseBuffer = this._audioContext.createBuffer(1, noiseBufferSize, this._audioContext.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseBufferSize; i++) {
            noiseData[i] = Math.random() * 2 - 1;
        }
        this.distNoiseSource.buffer = noiseBuffer;
        this.distNoiseSource.loop = true;
        this.distNoiseGain = this._audioContext.createGain();
        this.distNoiseGain.gain.value = 0;
        this.distNoiseSource.connect(this.distNoiseGain);
        this.distNoiseGain.connect(this.distDriveGain); // Mix noise pre-drive/dist

        // Feedback delay (short loop for grit)
        this.distFeedbackDelay = this._audioContext.createDelay(0.1);
        this.distFeedbackGain = this._audioContext.createGain();
        this.distFeedbackGain.gain.value = 0;

        // Connections: input -> distDriveGain -> distBus -> distToneFilter -> masterChain
        // Feedback: distToneFilter -> distFeedbackGain -> distFeedbackDelay -> distDriveGain (pre-dist)
        this.distDriveGain.connect(this.distBus);
        this.distBus.connect(this.distToneFilter);
        this.distToneFilter.connect(this.masterChain);
        this.distToneFilter.connect(this.distFeedbackGain);
        this.distFeedbackGain.connect(this.distFeedbackDelay);
        this.distFeedbackDelay.connect(this.distDriveGain);

        this.distNoiseSource.start(); // Start noise loop immediately

        // Reverb setup
        this.reverbBus = this._audioContext.createConvolver();
        this.reverbGain = this._audioContext.createGain();
        this.reverbGain.gain.value = 1; // full wet, mix via send
        this.reverbBus.connect(this.reverbGain);
        this.reverbGain.connect(this.masterChain);

        // Initial IR generation (will be updated by FXManager)
        this.updateReverbIR({ predelay: 50, size: 50, damping: 50 });
    }

    // Method to update reverb impulse response
    updateReverbIR(params) {
        const sr = this._audioContext.sampleRate;
        const predelayMs = params.predelay / 100 * 50; // 0-50ms
        const predelaySamples = Math.floor(sr * predelayMs / 1000);
        const decaySec = params.size / 100 * 2; // 0-2s
        const decaySamples = Math.floor(sr * decaySec);
        const totalSamples = predelaySamples + decaySamples;
        const buffer = this._audioContext.createBuffer(2, totalSamples, sr);
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);

        // Predelay silence
        for (let i = 0; i < predelaySamples; i++) {
            left[i] = right[i] = 0;
        }

        // Damping lowpass coefficient
        const damping = params.damping / 100;
        const fc = 200 + (1 - damping) * 9800; // 200-10000 Hz
        const alpha = 1 - Math.exp(-2 * Math.PI * fc / sr);

        let zLeft = 0, zRight = 0;
        for (let i = predelaySamples; i < totalSamples; i++) {
            const noiseL = Math.random() * 2 - 1;
            const noiseR = Math.random() * 2 - 1;
            const progress = (i - predelaySamples) / decaySamples;
            const env = Math.pow(1 - progress, 2); // quadratic decay
            const inputL = noiseL * env * 0.1;
            const inputR = noiseR * env * 0.1;

            const yLeft = alpha * inputL + (1 - alpha) * zLeft;
            zLeft = yLeft;
            left[i] = yLeft;

            const yRight = alpha * inputR + (1 - alpha) * zRight;
            zRight = yRight;
            right[i] = yRight;
        }

        if (this.reverbBus) {
            this.reverbBus.buffer = buffer;
        } else {
            console.warn('Reverb bus not available; skipping IR update');
        }
    }

    // Method to update delay parameters
    updateDelayParams(params) {
        if (this.delayBus) this.delayBus.delayTime.value = params.time / 100 * 1; // 0-1s
        if (this.delayFeedbackGain) this.delayFeedbackGain.gain.value = params.feedback / 100;
        if (this.delayLowpass) this.delayLowpass.frequency.value = params.damping / 100 * 10000; // 0-10kHz
    }

    // Method to update distortion parameters (drive, tone, grit)
    updateDistParams(params) {
        if (this.distDriveGain) this.distDriveGain.gain.value = 1 + params.drive / 100 * 20;  // 1x to 21x
        if (this.distToneFilter) this.distToneFilter.frequency.value = 200 + params.tone / 100 * 8800;  // 200-9100 Hz
        if (params.grit <= 50) {
            // Noise mode
            if (this.distNoiseGain) this.distNoiseGain.gain.value = params.grit / 50 * 0.1;  // 0 to 0.1 wet
            if (this.distFeedbackGain) this.distFeedbackGain.gain.value = 0;
        } else {
            // Feedback mode
            if (this.distNoiseGain) this.distNoiseGain.gain.value = 0;
            if (this.distFeedbackGain) this.distFeedbackGain.gain.value = (params.grit - 50) / 50 * 0.5;  // 0 to 0.5 (avoid explosion)
            if (this.distFeedbackDelay) this.distFeedbackDelay.delayTime.value = 0.01 + (params.grit - 50) / 50 * 0.09;  // 10-100ms
        }
    }

    playSample(selector, useTimeOffset = false, when = 0, isSequencer = false) {
        if (this._audioContext.state !== 'running') this._audioContext.resume();
        if (!selector._sample && !selector.getSample()) return this.playTestTone();

        let part = selector;
        while (part && !(part instanceof Part)) {
            part = part._parent;
        }
        if (!part) return;

        const voices = part._params.voices;
        const partActiveSources = part._activeSources;
        if (partActiveSources.length >= voices) {
            const oldest = partActiveSources.shift();
            if (oldest) {
                try {
                    oldest.stop(when);
                } catch (e) {}
            }
        }
        const buffer = selector.getSample();
        const params = this.app.parameterManager.computeAbsoluteParams(selector);
        const duration = (params.end - params.start) * buffer.duration;
        if (duration <= 0) return;

        const repeatCount = this.app.getRepeatCount(params.repeat);
        const repeatGains = this.app.getRepeatGains(params.repeat, params.gain / 100);
        const stepDuration = isSequencer ? (60 / this.app.sequencer._bpm / 4) : duration;

        for (let i = 0; i < repeatCount; i++) {
            const source = this._audioContext.createBufferSource();
            source.buffer = buffer;
            source.playbackRate.value = params.pitch / 100;
            const startTime = when + (i * stepDuration);
            source.start(startTime, params.start * buffer.duration, duration);

            const overallGain = this._audioContext.createGain();
            overallGain.gain.value = repeatGains[i];
            source.connect(overallGain);
            source._gainNode = overallGain;

            const maxSend = Math.max(params.reverbSend || 0, params.delaySend || 0, params.distSend || 0) / 100;
            const dryGain = this._audioContext.createGain();
            dryGain.gain.value = 1 - maxSend;
            overallGain.connect(dryGain);
            dryGain.connect(this.masterChain);

            if ((params.reverbSend || 0) > 0) {
                const revSend = this._audioContext.createGain();
                revSend.gain.value = (params.reverbSend || 0) / 100;
                overallGain.connect(revSend).connect(this.reverbBus);
            }
            if ((params.delaySend || 0) > 0) {
                const delSend = this._audioContext.createGain();
                delSend.gain.value = (params.delaySend || 0) / 100;
                overallGain.connect(delSend).connect(this.delayBus);
            }
            if ((params.distSend || 0) > 0) {
                const disSend = this._audioContext.createGain();
                disSend.gain.value = (params.distSend || 0) / 100;
                overallGain.connect(disSend).connect(this.distDriveGain);  // Connect to drive input
            }

            source.onended = () => {
                this.app._activeSources = this.app._activeSources.filter(s => s !== source);
                part._activeSources = part._activeSources.filter(s => s !== source);
            };

            this.app._activeSources.push(source);
            part._activeSources.push(source);
        }

        if (!useTimeOffset) {
            this.app.waveformRenderer.animatePlayhead(params.start, params.end, duration * repeatCount, params.repeat !== 'off');
        }
    }

    playTestTone() {
        const oscillator = this._audioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = 440;
        const gain = this._audioContext.createGain();
        gain.gain.value = 0.1;
        oscillator.connect(gain).connect(this.masterChain);
        oscillator.start();
        oscillator.stop(this._audioContext.currentTime + 0.5);
    }

    scheduleSampleOffline(selector, when, offlineCtx, offlineMaster) {
        const buffer = selector.getSample();
        if (!buffer) return;
        const params = this.app.parameterManager.computeAbsoluteParams(selector);
        const duration = (params.end - params.start) * buffer.duration;
        if (duration <= 0) return;
        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;
        const gainNode = offlineCtx.createGain();
        gainNode.gain.value = params.gain / 100;
        source.playbackRate.value = params.pitch / 100;
        source.start(when, params.start * buffer.duration, duration);
        source.connect(gainNode);
        gainNode.connect(offlineMaster);
    }

    // Robust AudioBuffer to WAV encoder
audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const numFrames = buffer.length;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = numFrames * blockAlign;
    const bufferLength = 44 + dataSize; // header + data

    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    // Helper to write ASCII strings
    function writeString(offset, s) {
        for (let i = 0; i < s.length; i++) {
            view.setUint8(offset + i, s.charCodeAt(i));
        }
    }

    // RIFF header
    writeString(0, 'RIFF');
    view.setUint32(4, bufferLength - 8, true); // file size - 8
    writeString(8, 'WAVE');

    // fmt chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // bits per sample

    // data chunk
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Write interleaved PCM samples
    let offset = 44;
    for (let i = 0; i < numFrames; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
            let sample = buffer.getChannelData(ch)[i];
            // Clamp and scale
            sample = Math.max(-1, Math.min(1, sample));
            // Convert to 16-bit PCM (round for safety)
            view.setInt16(offset, Math.round(sample * 32767), true);
            offset += 2;
        }
    }
    return arrayBuffer;
}
}
// === END: js/AudioProcessor.js ===