// === FILE: js/SampleManager.js (removed FileExists check, simplified display regex) ===
class SampleManager {
    constructor(samFPler) { 
        this.app = samFPler; 
        this._sampleCache = new Map(); 
        this._maxSamples = 32;
        this._lastFolderFiles = []; 
        this._currentAuditionSource = null; 
        this._currentFolderUri = null;  // NEW: Store SAF URI directly
        this._displayPath = "/storage/emulated/0/";  // NEW: For UI display only
        this.init(); 
    }

    init() {
        this.samplePickerModal = document.getElementById("sample-picker-modal");
        const changeFolderBtn = document.getElementById("change-folder-btn");
        const closePickerBtn = document.getElementById("close-picker");

        console.log("SampleManager initialized, waiting for user action");

        changeFolderBtn.addEventListener("click", () => {
            this.stopAudition();
            this.requestNewFolderPermission();
        });

        closePickerBtn.addEventListener("click", () => {
            this.stopAudition();
            this.samplePickerModal.style.display = "none";
        });
    }

    // UPDATED: Extract display-friendly path (simplified regex: partial decode, match literal / after)
    extractDisplayPath(uri) {
        try {
            // Partial decode to handle %3A -> : but keep %2F as / for matching
            const partialDecoded = uri.replace(/%3A/g, ':').replace(/%2F/g, '/');
            const match = partialDecoded.match(/primary:([^\/]+?)(\/|$)/);  // FIXED: Use literal / after partial decode
            if (match && match[1]) {
                return `/${match[1]}/`;
            }
            return "/storage/emulated/0/";
        } catch (e) {
            console.warn("Failed to extract display path:", e);
            return "/storage/emulated/0/";
        }
    }

    async requestPermissionAsync() {
    return new Promise((resolve) => {
        app.GetPermission("extsdcard", (uri) => {
            if (uri) {
                console.log("Permission granted, URI:", uri);
                this._currentFolderUri = uri;
                this._displayPath = this.extractDisplayPath(uri);
                resolve({ granted: true, uri });
            } else {
                console.error("Permission denied");
                resolve({ granted: false, uri: null });
            }
        });
    });
}

// UPDATED: checkStoragePermission – now async, no premature callback
async checkStoragePermission() {
    console.log("Checking storage permission...");
    const storageUri = app.CheckPermission("extsdcard");
    if (storageUri) {
        console.log("Storage permission already granted, URI:", storageUri);
        this._currentFolderUri = storageUri;
        this._displayPath = this.extractDisplayPath(storageUri);
        return { granted: true, uri: storageUri };
    } else {
        console.log("No permission yet, requesting...");
        return await this.requestPermissionAsync();  // Await here – no immediate onGranted
    }
}

    async requestNewFolderPermission() {
    console.log("Requesting permission for new folder...");
    const result = await this.requestPermissionAsync();
    if (result.granted) {
        this._lastFolderFiles = this.getFilesInFolder(result.uri);
        this.showSamplePicker();
    } else {
        app.Alert("Permission denied. Using fallback file selection.");
        this.fallbackToChooseFile();
    }
}

    

    fallbackToChooseFile() {
        console.log("Falling back to app.ChooseFile for audio selection");
        app.ChooseFile("audio/*", (fileUri) => {
            if (fileUri) {
                console.log("File selected URI:", fileUri);
                // Infer folder URI if possible (append to current if granted)
                let folderUri = this._currentFolderUri || fileUri.substring(0, fileUri.lastIndexOf('/'));
                this.loadFromUri(fileUri); // Load single file directly
                // Update display if we can extract
                this._displayPath = this.extractDisplayPath(folderUri);
            } else {
                app.Alert("No file selected.");
            }
        });
    }

    // RENAMED/FIXED: loadFromUri (uses URI directly; skips XHR, always Base64)
    async loadFromUri(fileUri) {
        if (!(this.app._currentSelector instanceof Part)) {
            app.Alert("Select a Part to load sample.");
            return;
        }
        if (this._sampleCache.size >= this._maxSamples) {
            const firstKey = this._sampleCache.keys().next().value;
            this._sampleCache.delete(firstKey);
            console.log(`Evicted oldest cache entry: ${firstKey} to make space`);
        }
        try {
            console.log("Loading file URI:", fileUri);

            // Check cache
            if (this._sampleCache.has(fileUri)) {
                console.log("Using cached buffer");
                const buffer = this._sampleCache.get(fileUri);
                const part = this.app._currentSelector;
                part._sample = buffer;
                part._samplePath = fileUri;  // Store URI
                this.app.waveformRenderer.render();
                console.log(`Loaded from cache: ${fileUri}`);
                return;
            }

            // Direct Base64 read (reliable for SAF URIs)
            let fileData = app.ReadFile(fileUri, "Base64");
            if (!fileData) throw new Error("File not found or invalid URI");  // FIXED: Better error for empty read

            console.log("Base64 data length:", fileData.length);
            const binaryString = atob(fileData);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const arrayBuffer = bytes.buffer;
            if (arrayBuffer.byteLength === 0) throw new Error("Empty audio data");

            const buffer = await this.app.audioProcessor._audioContext.decodeAudioData(arrayBuffer);

            // Cache by URI
            this._sampleCache.set(fileUri, buffer);

            const part = this.app._currentSelector;
            part._sample = buffer;
            part._samplePath = fileUri;
            this.app.waveformRenderer.render();
            console.log(`Loaded sample: ${fileUri}`);
        } catch (e) {
            console.error('Load error:', e);
            app.Alert(`Error loading audio file: ${e.message}`);
        }
    }

    async loadSample() {
    if (!(this.app._currentSelector instanceof Part)) {
        app.Alert("Select a Part to load sample.");
        return;
    }
    if (this._sampleCache.size >= this._maxSamples) {
        app.Alert(`Max samples (${this._maxSamples}) reached. Clear cache or load fewer unique samples.`);
        return;
    }

    const permResult = await this.checkStoragePermission();  // Await resolution
    if (!permResult.granted) {
        app.Alert("Permission denied. Using fallback file selection.");
        this.fallbackToChooseFile();
        return;
    }

    // Now safe to proceed – URI is set
    const files = this.getFilesInFolder(this._currentFolderUri);
    if (files.length === 0) {
        app.Alert("No audio files found. Select a folder or file manually.");
        this.requestNewFolderPermission();  // Re-prompt only if needed
    } else {
        this._lastFolderFiles = files;
        this.showSamplePicker();
    }
}


    // FIXED: getFilesInFolder uses URI directly
    getFilesInFolder(folderUri) {
        try {
            console.log(`Listing files in URI: ${folderUri}`);
            let files = app.ListFolder(folderUri);
            console.log(`Raw app.ListFolder output:`, files);

            let fileArray = [];
            if (typeof files === 'string') {
                fileArray = files.split(",").map(f => f.trim()).filter(f => f);
            } else if (Array.isArray(files)) {
                fileArray = files.map(f => f.trim()).filter(f => f);
            } else if (files === null || files === undefined) {
                console.warn("app.ListFolder returned null/undefined");
                fileArray = [];
            } else {
                console.warn(`Unexpected app.ListFolder output type: ${typeof files}`);
                fileArray = [];
            }
            console.log(`Parsed file array:`, fileArray);

            if (fileArray.length === 0) {
                console.warn(`No files found in ${folderUri}`);
            }

            // Filter for audio
            const audioExtensions = ['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.WAV', '.MP3', '.OGG', '.FLAC', '.M4A'];
            fileArray = fileArray.filter(file => audioExtensions.some(ext => file.toLowerCase().endsWith(ext)));
            console.log(`Filtered audio files:`, fileArray);

            // Map to {name, uri} - FIXED: Use %2F for path separator in SAF URI
            const mappedFiles = fileArray.map(file => ({
                name: file,
                uri: `${folderUri}%2F${encodeURIComponent(file)}`
            }));
            console.log(`Mapped files:`, mappedFiles);

            return mappedFiles;
        } catch (e) {
            console.error(`Error listing files in ${folderUri}:`, e);
            app.Alert(`Error accessing files in ${this._displayPath}. Try a different folder.`);
            this.manualPathInput();
            return [];
        }
    }

    showSamplePicker() {
        const modal = document.getElementById("sample-picker-modal");
        const sampleList = document.getElementById("sample-list");
        sampleList.innerHTML = "";

        console.log("showSamplePicker, _lastFolderFiles:", this._lastFolderFiles);
        const modalTitle = modal.querySelector("h3");
        if (modalTitle) {
            modalTitle.textContent = `Load Sample from ${this._displayPath}`;
        }

        if (!this._lastFolderFiles || this._lastFolderFiles.length === 0) {
            sampleList.innerHTML = `<p>No audio files found in ${this._displayPath}. Select a different folder or file.</p>`;
            modal.style.display = "block";
            return;
        }

        // Already filtered in getFilesInFolder
        const files = [...this._lastFolderFiles].sort((a, b) => a.name.localeCompare(b.name));

        files.forEach((file, index) => {
            const item = document.createElement("div");
            item.classList.add("sample-item");
            item.dataset.fileName = file.name;
            item.id = `sample-item-${index}`;

            const fileNameSpan = document.createElement("span");
            fileNameSpan.textContent = file.name;
            fileNameSpan.style.cursor = "pointer";
            fileNameSpan.style.flex = "1";
            fileNameSpan.addEventListener("click", () => this.auditionSample(file));
            item.appendChild(fileNameSpan);

            const auditionBtn = document.createElement("button");
            auditionBtn.classList.add("audition");
            auditionBtn.addEventListener("click", () => this.auditionSample(file));
            item.appendChild(auditionBtn);
const playIcon =document.createElement("img");
playIcon.src = 'img/play_symbol.svg';
playIcon.alt = 'Play symbol'; // For accessibility
playIcon.style.width = '20px'; // Optional: Size the icon
playIcon.style.height = '20px';
playIcon.style.marginRight = '5px'; // Optional: Spacing from text
auditionBtn.appendChild(playIcon);
            const stopBtn = document.createElement("button");
            stopBtn.classList.add("stop");
            stopBtn.addEventListener("click", () => this.stopAudition());
            item.appendChild(stopBtn);
const stopIcon =document.createElement("img");
stopIcon.src = 'img/stop_symbol.svg';
stopIcon.alt = 'Stop symbol'; // For accessibility
stopIcon.style.width = '20px'; // Optional: Size the icon
stopIcon.style.height = '20px';
stopIcon.style.marginRight = '5px'; // Optional: Spacing from text
stopBtn.appendChild(stopIcon);
   
            const loadBtn = document.createElement("button");
            loadBtn.classList.add("load");
            loadBtn.addEventListener("click", async () => {
                await this.loadFromUri(file.uri);
                modal.style.display = "none";
            });
            item.appendChild(loadBtn);
const loadIcon = document.createElement("img");
loadIcon.src = 'img/load_symbol.svg';
loadIcon.alt = 'Load symbol'; // For accessibility
loadIcon.style.width = '20px'; // Optional: Size the icon
loadIcon.style.height = '20px';
loadIcon.style.marginRight = '5px'; // Optional: Spacing from text
loadBtn.appendChild(loadIcon);
   
            sampleList.appendChild(item);
        });
        modal.style.display = "block";
    }

    // FIXED: auditionSample uses URI + Base64 (mirrors loadFromUri) - REMOVED FileExists check
    async auditionSample(file) {
        this.stopAudition();
        const sampleItems = document.querySelectorAll("#sample-list .sample-item");
        sampleItems.forEach((item) => {
            item.classList.toggle("playing", item.dataset.fileName === file.name);
            item.classList.toggle("loading", item.dataset.fileName === file.name);
        });

        const auditionUri = file.uri;
        let isCachedBeforePlay = this._sampleCache.has(auditionUri);
        let bufferToEvict = null;

        try {
            console.log("Auditioning URI:", auditionUri);

            // REMOVED: app.FileExists check (doesn't support URIs; let ReadFile handle)

            let arrayBuffer;

            // Cache check
            if (this._sampleCache.has(auditionUri)) {
                console.log("Using cached buffer for audition");
                bufferToEvict = this._sampleCache.get(auditionUri);
                const source = this.app.audioProcessor._audioContext.createBufferSource();
                source.buffer = bufferToEvict;
                const gain = this.app.audioProcessor._audioContext.createGain();
                gain.gain.value = 0.5;
                source.connect(gain);
                gain.connect(this.app.audioProcessor.masterChain);
                source._gainNode = gain;
                this._currentAuditionSource = source;

                source.start(0);
                source.onended = () => this.handleAuditionEnd(auditionUri, bufferToEvict, isCachedBeforePlay);
                return;
            }

            // Base64 read
            let fileData = app.ReadFile(auditionUri, "Base64");
            if (!fileData) throw new Error("File not found or invalid URI");  // FIXED: Better error
            const binaryString = atob(fileData);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            arrayBuffer = bytes.buffer;
            if (arrayBuffer.byteLength === 0) throw new Error("Empty audio data");

            const buffer = await this.app.audioProcessor._audioContext.decodeAudioData(arrayBuffer);
            bufferToEvict = buffer;

            // Temp cache
            this._sampleCache.set(auditionUri, buffer);

            const source = this.app.audioProcessor._audioContext.createBufferSource();
            source.buffer = buffer;
            const gain = this.app.audioProcessor._audioContext.createGain();
            gain.gain.value = 0.5;
            source.connect(gain);
            gain.connect(this.app.audioProcessor.masterChain);
            source._gainNode = gain;
            this._currentAuditionSource = source;

            source.start(0);
            source.onended = () => this.handleAuditionEnd(auditionUri, bufferToEvict, isCachedBeforePlay);
        } catch (e) {
            app.Alert(`Error auditioning audio file: ${e.message}`);
            console.error('Audition error:', e);
            sampleItems.forEach((item) => item.classList.remove("playing", "loading"));
        }
    }

    handleAuditionEnd(path, buffer, wasCachedBefore) {
        this._currentAuditionSource = null;
        const sampleItems = document.querySelectorAll("#sample-list .sample-item");
        sampleItems.forEach((item) => item.classList.remove("playing", "loading"));

        const isInUse = this.isBufferInUse(buffer);
        if (!isInUse && !wasCachedBefore) {
            this._sampleCache.delete(path);
            console.log(`Evicted audition-only cache entry: ${path}`);
        }
    }

    isBufferInUse(buffer) {
        for (const part of this.app._parts) {
            if (part._sample === buffer) return true;
            for (const pad of part._pads) {
                if (pad._sample === buffer) return true;
                for (const step of pad._steps) {
                    if (step._sample === buffer) return true;
                }
            }
        }
        return false;
    }

    stopAudition() {
        if (this._currentAuditionSource) {
            try {
                this._currentAuditionSource.stop(0);
                this._currentAuditionSource = null;
            } catch (e) {
                console.error('Error stopping audition:', e);
            }
        }
        const sampleItems = document.querySelectorAll("#sample-list .sample-item");
        sampleItems.forEach((item) => item.classList.remove("playing", "loading"));
    }

    getCachedSample(uri) {  // Updated to uri
        return this._sampleCache.get(uri);
    }

    clearCache() {
        this._sampleCache.clear();
        this._lastFolderFiles = [];
        this._currentFolderUri = null;
        this._displayPath = "/storage/emulated/0/";
    }
} 
// === END: js/SampleManager.js ===