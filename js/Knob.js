class Knob {
    constructor(samFPler, id, onChange) {
        this.app = samFPler;
        this.element = document.getElementById(id);
        this.onChange = onChange;
        this._isDragging = false;
        this._lastY   = 0;   
    }

    init() {
    this.element.addEventListener('mousedown', e => {
        e.preventDefault();
        this._isDragging = true;
        this._lastY = e.clientY;
    });
    document.addEventListener('mousemove', e => {
        if (this._isDragging) {
            const deltaY = this._lastY - e.clientY;
            const sensitivity = 0.05;  // Adjust this value: <1 for less sensitive, >1 for more
            this.onChange(deltaY * sensitivity);
            this._lastY = e.clientY;
        }
    });
    document.addEventListener('mouseup', () => this._isDragging = false);
    this.element.addEventListener('touchstart', e => {
        e.preventDefault();
        this._isDragging = true;
        this._lastY = e.touches[0].clientY;
    });
    document.addEventListener('touchmove', e => {
        if (this._isDragging) {
            e.preventDefault();
            const deltaY = this._lastY - e.touches[0].clientY;
            const sensitivity = 0.05;  // Adjust this value: <1 for less sensitive, >1 for more
            this.onChange(deltaY * sensitivity);
            this._lastY = e.touches[0].clientY;
        }
    }, { passive: false });
        document.addEventListener('touchend', () => this._isDragging = false);
    }
}