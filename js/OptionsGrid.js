class OptionsGrid {
    constructor(samFPler) {
        this.app = samFPler;
        this.element = document.getElementById('options-grid');
        this.options = ['pitch', 'gain', 'start', 'end', 'reverse', 'repeat', 'timeOffset', 'reverbSend', 'delaySend', 'distSend', 'mode', 'voices'];
        this.init();
    }

    init() {
        this.element.innerHTML = '';
        this.options.forEach(option => {
            const optionEl = this.createOptionElement(option);
            this.element.appendChild(optionEl);
        });
    }

    createOptionElement(option) {
    const container = document.createElement('div');
    container.classList.add('option', 'options-button', "button")
    container.dataset.option = option; // Add data-option attribute
    const label = document.createElement('div');
    label.className = 'option-label';
    label.textContent = option.charAt(0).toUpperCase() + option.slice(1).replace(/([A-Z])/g, ' $1').trim();
    const value = document.createElement('div');
    value.className = 'option-value';
    value.textContent = '-';
    container.appendChild(label);
    container.appendChild(value);

    container.addEventListener('click', () => {
        this.app._currentOption = option;
        this.update();
    });
    container.addEventListener('wheel', e => {
        e.preventDefault();
        if (this.app._currentSelector) {
            this.app.parameterManager.adjustCurrentOption(e.deltaY > 0 ? -1 : 1);
        }
    });
    container.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        const startY = e.clientY;
        const startValue = this.app._currentSelector ? this.app._currentSelector._params[option] || 0 : 0;
        const onMouseMove = e => {
            const delta = startY - e.clientY;
            if (['pitch', 'gain', 'reverbSend', 'delaySend', 'distSend', 'timeOffset', 'voices'].includes(option)) {
                this.app._currentSelector.updateOption(option, startValue + delta);
            } else if (['start', 'end'].includes(option)) {
                this.app._currentSelector.updateOption(option, startValue + delta * 0.01);
            }
        };
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
    return container;
}
    update() {
    const selector = this.app._currentSelector;
    if (!selector) {
        this.element.querySelectorAll('.option-value').forEach(el => el.textContent = '-');
        this.element.querySelectorAll('.option').forEach(el => el.classList.remove('selected-option', 'default'));
        return;
    }

    this.options.forEach(option => {
        const container = this.element.querySelector(`.option[data-option="${option}"]`);
        const valueEl = container ? container.querySelector('.option-value') : null;

        if (!valueEl || !container || !selector._params.hasOwnProperty(option)) {
            if (valueEl) valueEl.textContent = '-';
            if (container) container.classList.remove('selected-option', 'default');
            return;
        }

        const value = selector._params[option];
        valueEl.textContent = typeof value === 'boolean' ? (value ? 'On' : 'Off') : (typeof value === 'number' ? value.toFixed(2) : value);
        container.classList.toggle('selected-option', option === this.app._currentOption);
        container.classList.toggle('default', selector.isDefault ? selector.isDefault(option, value) : false);
    });
    this.app.display.update();
    this.app.selectorGrid.updateFills(this.app._currentOption);
}
}