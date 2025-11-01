class SampleManager {
 constructor(samFPler) { 
this.app = samFPler; 
this._sampleCache = new Map(); 
this._maxSamples = 32;
 this._lastFolderFiles = []; 
this._currentAuditionSource = null; 
this._currentFolderPath = "/storage/emulated/0/";
 // Default path 
this._storageUri = null; // Store permission URI 
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

checkStoragePermission(onGranted) {
    console.log("Checking storage permission...");
    const storageUri = app.CheckPermission("extsdcard");
    if (storageUri) {
        console.log("Storage permission already granted, URI:", storageUri);
        this._storageUri = storageUri;
        this._currentFolderPath = this.myUri2Path(storageUri);
        console.log("Resolved path:", this._currentFolderPath);
        if (onGranted) onGranted();
    } else {
        console.log("No permission yet, waiting for user to trigger");
        if (onGranted) onGranted();
    }
}

requestNewFolderPermission() {
    console.log("Requesting permission for new folder...");
    app.GetPermission("extsdcard", (uri) => {
        if (uri) {
            console.log("Permission granted, URI:", uri);
            this._storageUri = uri;
            this._currentFolderPath = this.myUri2Path(uri);
            console.log("Resolved path:", this._currentFolderPath);
            this._lastFolderFiles = this.getFilesInFolder(this._currentFolderPath);
            this.showSamplePicker();
        } else {
            console.error("Permission denied");
            app.Alert("Permission denied. Using default path or select a file.");
            this.fallbackToChooseFile();
        }
    });
}

myUri2Path(uri) {
    try {
        const decoded = decodeURIComponent(uri);
        console.log("Decoded URI:", decoded);
        const split = decoded.split(":");
        console.log("URI segments:", split);
        const folder = split[split.length - 1];
        console.log("Extracted folder:", folder);
        
        let storageRoot;
        try {
            const internalFolder = app.GetInternalFolder ? app.GetInternalFolder() : null;
            if (internalFolder) {
                const realPath = app.RealPath ? app.RealPath(internalFolder) : null;
                if (realPath) {
                    storageRoot = realPath.split("/Android/data")[0];
                } else {
                    throw new Error("RealPath returned null");
                }
            } else {
                throw new Error("GetInternalFolder returned null");
            }
        } catch (e) {
            console.warn(`Error getting storage root: ${e.message}, falling back to /storage/emulated/0`);
            storageRoot = "/storage/emulated/0";
        }
        
        const resolvedPath = `${storageRoot}/${folder}`;
        console.log(`Resolved path: ${resolvedPath}`);
        return resolvedPath.endsWith("/") ? resolvedPath : resolvedPath + "/";
    } catch (e) {
        console.error(`Error parsing URI ${uri}:`, e);
        console.warn(`Falling back to /storage/emulated/0/`);
        return "/storage/emulated/0/";
    }
}

manualPathInput() {
    console.log("Prompting for manual path input");
    app.ShowTextDialog("Enter folder path (e.g., /storage/emulated/0/Music/):", this._currentFolderPath, (path) => {
        if (path) {
            this._currentFolderPath = path.endsWith("/") ? path : path + "/";
            console.log("Manual path entered:", this._currentFolderPath);
            this._lastFolderFiles = this.getFilesInFolder(this._currentFolderPath);
            this.showSamplePicker();
        } else {
            app.Alert("No path entered, using default or select a file.");
            this.fallbackToChooseFile();
        }
    });
}

fallbackToChooseFile() {
    console.log("Falling back to app.ChooseFile for audio selection");
    app.ChooseFile("audio/*", (fileUri) => {
        if (fileUri) {
            console.log("File selected:", fileUri);
            const decodedFileUri = decodeURIComponent(fileUri);
            console.log("Decoded file URI:", decodedFileUri);
            const pathMatch = decodedFileUri.match(/primary%3A([^\/]+\/[^\/]+)$/);
            if (pathMatch && pathMatch[1]) {
                const folderPath = `/storage/emulated/0/${pathMatch[1].substring(0, pathMatch[1].lastIndexOf("/"))}/`;
                console.log("Inferred folder path:", folderPath);
                this._currentFolderPath = folderPath;
                this._lastFolderFiles = this.getFilesInFolder(this._currentFolderPath);
                this.showSamplePicker();
            } else {
                console.log("Could not infer folder, loading single file");
                this.loadFromPath(fileUri);
            }
        } else {
            app.Alert("No file selected.");
        }
    });
}

async loadFromPath(path) {
    if (!(this.app._currentSelector instanceof Part)) {
        app.Alert("Select a Part to load sample.");
        return;
    }
    if (this._sampleCache.size >= this._maxSamples) {
        app.Alert(`Max samples (${this._maxSamples}) reached.`);
        return;
    }
    try {
        console.log("Loading file:", path);

        // Check if file is already cached
        if (this._sampleCache.has(path)) {
            console.log("Using cached buffer for loading");
            const buffer = this._sampleCache.get(path);
            const part = this.app._currentSelector;
            part._sample = buffer;
            part._samplePath = path;
            this.app.waveformRenderer.render();
            console.log(`Loaded sample from cache: ${path}`);
            return;
        }

        // Use XMLHttpRequest to load the file
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `file://${path}`, true);
        xhr.responseType = 'arraybuffer';
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

        xhr.onprogress = (event) => {
            if (event.lengthComputable) {
                console.log(`Download progress: ${(event.loaded / event.total * 100).toFixed(2)}%`);
            }
        };

        const arrayBuffer = await new Promise((resolve, reject) => {
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    console.log("XHR success, response byteLength:", xhr.response.byteLength);
                    if (xhr.response.byteLength === 0) {
                        reject(new Error("Empty audio data received"));
                    } else {
                        resolve(xhr.response);
                    }
                } else {
                    reject(new Error(`HTTP error: ${xhr.status} ${xhr.statusText}`));
                }
            };
            xhr.onerror = () => reject(new Error("Network or file access error"));
            xhr.send();
        });

        // Decode the audio data
        const buffer = await this.app.audioProcessor._audioContext.decodeAudioData(arrayBuffer);

        // Cache the buffer
        this._sampleCache.set(path, buffer);

        // Assign to the current part
        const part = this.app._currentSelector;
        part._sample = buffer;
        part._samplePath = path;
        this.app.waveformRenderer.setBuffer(buffer);
        console.log(`Loaded sample: ${path}`);
    } catch (e) {
        console.error('Load error:', e);
        app.Alert(`Error loading audio file: ${e.message}`);
    }
}
loadSample() {
    if (!(this.app._currentSelector instanceof Part)) {
        app.Alert("Select a Part to load sample.");
        return;
    }
    if (this._sampleCache.size >= this._maxSamples) {
        app.Alert(`Max samples (${this._maxSamples}) reached.`);
        return;
    }
    this.checkStoragePermission(() => {
        this._lastFolderFiles = this.getFilesInFolder(this._currentFolderPath);
        this.showSamplePicker();
    });
}

getFilesInFolder(path) {
    try {
        console.log(`Listing files in: ${path}`);
        let files = app.ListFolder(path);
        console.log(`Raw app.ListFolder output:`, files);

        // Handle different possible outputs from app.ListFolder
        let fileArray = [];
        if (typeof files === 'string') {
            fileArray = files.split(",").filter(f => f.trim());
        } else if (Array.isArray(files)) {
            fileArray = files.filter(f => f.trim());
        } else {
            console.warn(`Unexpected app.ListFolder output type: ${typeof files}`);
            fileArray = [];
        }
        console.log(`Parsed file array:`, fileArray);

        // If no files, try a fallback path or log for debugging
        if (fileArray.length === 0) {
            console.warn(`No files found in ${path}`);
            // Try a fallback path
            if (path !== "/storage/emulated/0/") {
                console.log("Falling back to /storage/emulated/0/");
                fileArray = app.ListFolder("/storage/emulated/0/").split(",").filter(f => f.trim());
            }
        }

        // Filter for audio files
        const audioExtensions = ['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.WAV', '.MP3', '.OGG', '.FLAC', '.M4A'];
        fileArray = fileArray.filter(file => audioExtensions.some(ext => file.toLowerCase().endsWith(ext)));
        console.log(`Filtered audio files:`, fileArray);

        // Map to objects with name and path
        const mappedFiles = fileArray.map(file => ({
            name: file,
            path: path + (path.endsWith("/") ? "" : "/") + file
        }));
        console.log(`Mapped files:`, mappedFiles);

        return mappedFiles;
    } catch (e) {
        console.error(`Error listing files in ${path}:`, e);
        app.Alert(`Error accessing files in ${path}. Try a different folder or file.`);
        this.manualPathInput();
        return [];
    }
}

showSamplePicker() {
    const modal = document.getElementById("sample-picker-modal");
    const sampleList = document.getElementById("sample-list");
    sampleList.innerHTML = "";

    console.log("Entering showSamplePicker, _lastFolderFiles:", this._lastFolderFiles);
    const modalTitle = modal.querySelector("h3");
    if (modalTitle) {
        modalTitle.textContent = `Load Sample from ${this._currentFolderPath}`;
    }

    if (!this._lastFolderFiles || this._lastFolderFiles.length === 0) {
        sampleList.innerHTML = `<p>No audio files found in ${this._currentFolderPath}. Select a different folder, file, or enter a path manually.</p>`;
        modal.style.display = "block";
        console.log("No files to display, showing fallback message");
        return;
    }

    const audioExtensions = ['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.WAV', '.MP3', '.OGG', '.FLAC', '.M4A'];
    const files = this._lastFolderFiles.filter(file => {
        const matches = audioExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
        console.log(`Filtering ${file.name}: ${matches ? 'Included' : 'Excluded'}`);
        return matches;
    });
    console.log("Filtered files:", files);
    files.sort((a, b) => a.name.localeCompare(b.name));

    if (files.length === 0) {
        sampleList.innerHTML = `<p>No audio files found in ${this._currentFolderPath}. Select a different folder, file, or enter a path manually.</p>`;
        console.log("No audio files after filtering");
    } else {
        console.log("Creating DOM elements for files:", files);
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
            auditionBtn.textContent = "Audition";
            auditionBtn.addEventListener("click", () => this.auditionSample(file));
            item.appendChild(auditionBtn);

            const stopBtn = document.createElement("button");
            stopBtn.classList.add("stop");
            stopBtn.textContent = "Stop";
            stopBtn.addEventListener("click", () => this.stopAudition());
            item.appendChild(stopBtn);

            const loadBtn = document.createElement("button");
            loadBtn.classList.add("load");
            loadBtn.textContent = "Load";
            loadBtn.addEventListener("click", () => {
                this.loadFromPath(file.path);
                modal.style.display = "none";
            });
            item.appendChild(loadBtn);

            sampleList.appendChild(item);
            console.log(`Appended sample-item-${index} for ${file.name}, path: ${file.path}`);
        });
    }
    modal.style.display = "block";
    console.log("Modal displayed, sample-list HTML:", sampleList.innerHTML);
}

async auditionSample(file) {
    this.stopAudition();
    const sampleItems = document.querySelectorAll("#sample-list .sample-item");
    sampleItems.forEach((item) => {
        item.classList.toggle("playing", item.dataset.fileName === file.name);
        item.classList.toggle("loading", item.dataset.fileName === file.name);
    });

    try {
        console.log("Auditioning file:", file.path);

        // Validate file path if possible
        if (typeof app.FileExists === 'function' && !app.FileExists(file.path)) {
            throw new Error(`File does not exist: ${file.path}`);
        }

        let arrayBuffer;

        // Check cache first
        if (this._sampleCache.has(file.path)) {
            console.log("Using cached buffer for audition");
            const buffer = this._sampleCache.get(file.path);
            const source = this.app.audioProcessor._audioContext.createBufferSource();
            source.buffer = buffer;
            const gain = this.app.audioProcessor._audioContext.createGain();
            gain.gain.value = 0.5;
            source.connect(gain);
            gain.connect(this.app.audioProcessor.masterChain);
            source._gainNode = gain;
            this._currentAuditionSource = source;

            source.start(0);
            source.onended = () => {
                this._currentAuditionSource = null;
                sampleItems.forEach((item) => item.classList.remove("playing", "loading"));
            };
            return;
        }

        // Try XMLHttpRequest first
        try {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', `file://${file.path}`, true);
            xhr.responseType = 'arraybuffer';
            xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

            // Progress indicator for large files
            xhr.onprogress = (event) => {
                if (event.lengthComputable) {
                    console.log(`Download progress: ${(event.loaded / event.total * 100).toFixed(2)}%`);
                    // Optionally update UI progress if you add a progress bar element
                }
            };

            arrayBuffer = await new Promise((resolve, reject) => {
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        console.log("XHR success, response byteLength:", xhr.response.byteLength);
                        if (xhr.response.byteLength === 0) {
                            reject(new Error("Empty audio data received"));
                        } else {
                            resolve(xhr.response);
                        }
                    } else {
                        reject(new Error(`HTTP error: ${xhr.status} ${xhr.statusText}`));
                    }
                };
                xhr.onerror = () => reject(new Error("Network or file access error"));
                xhr.send();
            });
        } catch (xhrError) {
            console.warn("XMLHttpRequest failed, falling back to app.ReadFile:", xhrError);
            // Fallback to app.ReadFile
            let fileData;
            if (this._storageUri && file.path.startsWith("/storage/")) {
                const relativePath = file.path.replace(this._currentFolderPath, "");
                const uriPath = this._storageUri + (relativePath.startsWith("/") ? relativePath : "/" + relativePath);
                console.log("Trying URI:", uriPath);
                fileData = app.ReadFile(uriPath);
            } else {
                console.log("Trying direct path:", file.path);
                fileData = app.ReadFile(file.path);
            }
            if (!fileData) throw new Error("Failed to read file data");
            console.log("File data length:", fileData.length);
            arrayBuffer = new Uint8Array(fileData).buffer;
            console.log("ArrayBuffer byteLength:", arrayBuffer.byteLength);
            if (arrayBuffer.byteLength === 0) throw new Error("Empty audio data");
        }

        // Decode the audio data
        const buffer = await this.app.audioProcessor._audioContext.decodeAudioData(arrayBuffer);

        // Cache the buffer for future auditions or loads
        this._sampleCache.set(file.path, buffer);

        const source = this.app.audioProcessor._audioContext.createBufferSource();
        source.buffer = buffer;
        const gain = this.app.audioProcessor._audioContext.createGain();
        gain.gain.value = 0.5;
        source.connect(gain);
        gain.connect(this.app.audioProcessor.masterChain);
        source._gainNode = gain;
        this._currentAuditionSource = source;

        source.start(0);
        source.onended = () => {
            this._currentAuditionSource = null;
            sampleItems.forEach((item) => item.classList.remove("playing", "loading"));
        };
    } catch (e) {
        app.Alert(`Error auditioning audio file: ${e.message}`);
        console.error('Audition error:', e);
        sampleItems.forEach((item) => item.classList.remove("playing", "loading"));
    }
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

getCachedSample(path) {
    return this._sampleCache.get(path);
}

clearCache() {
    this._sampleCache.clear();
    this._lastFolderFiles = [];
    this._currentFolderPath = "/storage/emulated/0/";
}
} 