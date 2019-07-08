import TspAdapter from './tsp-adapter.js';

class ML {
    constructor(model) {
        this._adapter = new TspAdapter();
        this._model = model;
        this._obj = null; // THREE object representing the tsp model
    }
    init(cb=null) {
        this._model.init(() => {
            const obj = this._adapter.setModel(this._model);
            this._obj = obj;
            this._obj.visible = false;
            if (cb) cb(obj);
        });
    }
    getModelUrl() {
        return this._model.loader ? this._model.loader.config.url : '-';
    }
    clear() {
        this._model.clear();
    }
    predict(input) {
        this._model.predict(input);
    }
    async _predictDebug(inputUrl) {
        if (! this._obj) return; // not yet ready to go
        this._obj.visible = true;

        try {
            const resp = await fetch(inputUrl);
            this._model.predict(await resp.json());
        } catch (err) {
            console.log('@@ _predictDebug(): err:', err);
        }
    }

    onClick(isects) {
        this._adapter.onHover(isects); // update lines
        this._adapter.onClick(isects);
    }
    update() {
        this._adapter.onUpdate(); // tween stuff
    }

    static createInput(imgData) {
        if (imgData.width !== 224) return null;
        if (imgData.height !== 224) return null;

        const input = []; // 28 x 28 (=784) alpha values
        // sample alpha values every 8 pixel from imgData
        //   4(rgba) x 8(interval) x 28(cols) = 896 Uint8's
        for (let i = 0; i < 224; i += 8) { // 28 = 224 / 8
            for (let j = 3; j < 896; j += 32) { // 28 = 896 / 32
                input.push(imgData.data[896 * i + j] / 255);
            }
        }
        return input;
    }
}
export default ML;
