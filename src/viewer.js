import ML from './ml.js';

class Viewer extends Threelet {
    onCreate(params) {
        const controls = this.setup('mod-controls', THREE.OrbitControls);
        controls.enableRotate = false;
        // controls.enablePan = false;

        this.setup('mod-stats', window.Stats, {panelType: 0}); // 0: fps, 1: ms, 2: mb, 3+: custom
        this.setup('mod-webvr', window.WEBVR);
        this.setup('mod-sky', THREE.Sky);

        const _planeCanvas = Viewer.createPlaneCanvas();
        this.selector = Viewer.createSelector(_planeCanvas);
        this.plane = this.selector.getObjectByName('plane');

        this.selector.add(Viewer.createMarker('commandMarker'));

        const group = this.getInteractiveGroup();
        group.add(this.selector); // for ray not passing ghrough the selector surface
        this.scene.add(group);

        this.scene.add(Threelet.Utils.createTestHemisphereLight());
        this.scene.add(Threelet.Utils.createTestDirectionalLight());
        this.scene.add(new THREE.GridHelper(10, 20));

        this.sigData = Viewer.createSigObjects();

        const inputCallbacks = {
            onClick: (mx, my) => {
                if (this.mlObject3D) {
                    const isec = this.raycastFromMouse(mx, my, [this.mlObject3D,], true);
                    const isects = isec ? [isec,] : [];
                    if (isects.length > 0) {
                        this.ml.onClick(isects);
                        return;
                    }
                }

                const isec = this.mouseToPlaneIntersect(mx, my);
                // console.log('@@ onClick(): isec:', isec);
                if (isec && Viewer.isPointOnLeftSquare(isec.point)) {
                    // console.log('@@ isec.faceIndex:', isec.faceIndex);
                    this.onLeftPlaneClicked(isec.faceIndex);
                }
            },
            onDrag: (mx, my) => {
                const isec = this.mouseToPlaneIntersect(mx, my);
                if (isec && Viewer.isPointOnRightSquare(isec.point)) {
                    // console.log('@@ dragging:', isec.point);
                    this.invokeSigPadCall('_strokeUpdate', isec.point.x, isec.point.y);
                }
            },
            onDragStart: (mx, my) => {
                console.log('@@ onDragStart(): hi');
                const isec = this.mouseToPlaneIntersect(mx, my);
                if (isec && Viewer.isPointOnRightSquare(isec.point)) {
                    console.log('@@ drag start:', isec.point);
                    this.invokeSigPadCall('_strokeBegin', isec.point.x, isec.point.y);
                }
            },
            onDragEnd: (mx, my) => {
                console.log('@@ onDragEnd(): hi');
                this.invokeSigPadCall('_strokeEnd', -1, -1);
            },
        };

        if (1) {
            if (Threelet.isVrSupported()) { // Oculus Go, desktop-firefox
                // KLUDGE - when in desktop mode, Oculus browser triggers
                //   both mouse/touch events at a time.
                //   also, mouse-drag events seems not being fired...
                //   So, enabling only pointer events here
                //   (touch events NG for desktop-firefox).
                this.setupPointerInterface(inputCallbacks);
            } else { // desktop-chrome, desktop-safari
                this.setupMouseInterface(inputCallbacks);
                this.setupTouchInterface(inputCallbacks);
            }
        } else { // requires iOS >= 13
            this.setupPointerInterface(inputCallbacks);
        }


        this._vrPressPlaneStart = [-1, -1]; // faceIndex per controller i
        this.on('vr-trigger-press-start', (i) => {
            if (this.mlObject3D) {
                const isects = this.raycastFromController(i, [this.mlObject3D,], true);
                if (isects.length > 0) {
                    this.ml.onClick(isects);
                    return;
                }
            }

            const isec = this.vrcontrollerToPlaneIntersect(i);
            if (isec) {
                console.log('@@ vr-press-start');
                this._vrPressPlaneStart[i] = isec.faceIndex;
                this.invokeSigPadCall('_strokeBegin', isec.point.x, isec.point.y);
            } else {
                this._vrPressPlaneStart[i] = -1;
            }
        });
        this.on('vr-trigger-press-end', (i) => {
            this.invokeSigPadCall('_strokeEnd', -1, -1);
            if (this._vrPressPlaneStart[i] < 0) return;

            const lastFaceIndex = this._vrPressPlaneStart[i];
            this._vrPressPlaneStart[i] = -1;

            // check vr-click
            const isec = this.vrcontrollerToPlaneIntersect(i);
            if (isec) {
                const faceIndex = isec.faceIndex;
                console.log('@@ vr-press-end; faceIndex:', faceIndex);
                if (Math.floor(faceIndex/2) ===
                    Math.floor(lastFaceIndex/2)) {
                    console.log('@@ vr-click fulfilled for faceIndex:', faceIndex);
                    if (isec && Viewer.isPointOnLeftSquare(isec.point)) {
                        this.onLeftPlaneClicked(isec.faceIndex);
                    }
                }
            }
        });

        this.planeCtx = _planeCanvas.getContext('2d');
        this.update = (t, dt) => {
            if (this.mlObject3D) {
                // update model's topology
                this.ml.update();

                // update model's translation
                for (let i of [0, 1]) {
                    const pad = this.getControllersState().touchpads[i];

                    if (pad) {
                        this.displayControllerEvent(i, 'vr-touchpad-touch', pad.touched);
                        this.updateControllerTouchpad(i, 'vr-touchpad-touch');
                    }

                    if (pad && pad.touched) {
                        const f1 = pad.axes0 - pad.axes1;
                        const f2 = pad.axes0 + pad.axes1;
                        const pos = this.mlObject3D.position;
                        if (f1 > 0 && f2 > 0 && pos.x < 4) {
                            pos.x += 0.1;
                        } else if (f1 > 0 && f2 < 0 && pos.y < 4) {
                            pos.y += 0.1;
                        } else if (f1 < 0 && f2 > 0 && pos.y > -4) {
                            pos.y -= 0.1;
                        } else if (f1 < 0 && f2 < 0 && pos.x > -4) {
                            pos.x -= 0.1;
                        } else { /* nop */ }
                    }
                }
            }

            // generate strokes from vrcontrollers when needed
            for (let i of [0, 1]) {
                if (this._vrPressPlaneStart[i] >= 0) {
                    const isec = this.vrcontrollerToPlaneIntersect(i);
                    if (isec && Viewer.isPointOnRightSquare(isec.point)) {
                        this.invokeSigPadCall('_strokeUpdate', isec.point.x, isec.point.y);
                    }
                }
            }

            // transfer texture from sigPad to 3D canvas
            if (this.sigData.needsUpdate) {
                this.sigData.needsUpdate = false;
                Viewer.clearPaintArea(this.planeCtx);
                this.planeCtx.drawImage(this.sigData.canvas, 256, 0);
                this.plane.material.map.needsUpdate = true;
            }
        };

        if (params.instruction) {
            Threelet.Utils.createCanvasFromImage('./control.png', can => {
                // console.log('@@ can:', can);
                // document.body.appendChild(can); // debug
                this.illustrationCanvas = can;
            });
        }

        this.scene.add(this.getInteractiveGroup());
        this.ml = null;
        this.mlObject3D = null;

    } // end onCreate()

    async loadML(name, model, debug=false) {
        this.ml = new ML(model);
        this.drawInfo([
            `model: ${name} - ${this.ml.getModelUrl()}`, ``, ``, ``, ``,
        ]);

        // this.ml.init(obj => {
        const obj = await this.ml.init();
        const group = this.getInteractiveGroup();

        if (this.mlObject3D) {
            const objLast = this.mlObject3D;
            group.remove(objLast);
            Threelet.freeChildObjects(objLast, objLast.children);
            // console.log('@@ objLast:', objLast);
        }
        group.add(obj);
        this.mlObject3D = obj;
        console.log('@@ group:', group.children);

        Threelet.hasVrDisplay(tf => obj.position.set(0, 1, tf ? -1.5 : 1));

        if (debug) {
            obj.visible = true;
            if (name === 'lenet') {
                this.ml._predictDebug('../data/lenet/5.json');
            } else if (name === 'acgan') {
                this.ml.predict([tf.randomNormal([1, 100]).dataSync(), [0]]);
            } else {
                console.log('@@ woops');
            }
        }
    }

    invokeSigPadCall(method, px, py) {
        try {
            this.sigData.pad[method](
                Viewer.createSigPadEvent(px, py, this.sigData.canvas));
        } catch (e) {
            // FIXME errors observed when using OrbitControls's panning
            console.warn('@@ woops: e:', e);
            return;
        }
        this.sigData.needsUpdate = true;
    }
    static createSigPadEvent(px, py, sigCanvas, width=256, height=256) {
        const x = Math.floor(px / 2 * width);
        const y = Math.floor(py / 2 * height);
        const rect = sigCanvas.getBoundingClientRect();
        // console.log('@@ rect:', rect);
        return {
            clientX: x + rect.left,
            clientY: height - y + rect.top,
        };
    }

    // px, py:
    // -2,2    0,2    2,2
    //     left   right
    // -2,0    0,0    2,0
    static isPointOnLeftSquare(pt) {
        return pt.x < 0 && pt.x > -2 && pt.y > 0 && pt.y < 2;
    }
    static isPointOnRightSquare(pt) {
        return pt.x > 0 && pt.x < 2 && pt.y > 0 && pt.y < 2;
    }
    mouseToPlaneIntersect(mx, my) {
        const isec = this.raycastFromMouse(mx, my, [this.plane], false);
        return isec ? isec : null;
    }
    vrcontrollerToPlaneIntersect(i) {
        return this.raycastFromController(i, [this.plane], false)[0];
    };

    onLeftPlaneClicked(faceIndex) {
        console.log('faceIndex:', faceIndex);
        switch (faceIndex) {
            case 32: case 33: this.onSelect('command-predict'); break;
            case 34: case 35: this.onSelect('command-clear'); break;
            case 36: case 37: case 38: case 39: this.onSelect('command-src'); break;
            default: console.log('@@ nop');
        }
    }
    onSelect(what) {
        if (! this.sigData) {
            console.warn('@@ onSelect(): nop; sigPad not ready...');
            return;
        }
        if (what.startsWith('command-')) {
            if (what.endsWith('clear')) {
                this.sigData.pad.clear();
                Viewer.clearPaintArea(this.planeCtx);
                this.updateIllustration(false);

                if (this.mlObject3D) {
                    this.mlObject3D.visible = false;
                    this.ml.clear();
                }
            } else if (what.endsWith('predict')) {
                if (! this.mlObject3D) return;

                this.mlObject3D.visible = true;
                this.updateIllustration(true);

                const ctx = this.sigData.canvas.getContext('2d');
                const imgData = ctx.getImageData(16, 16, 224, 224);
                // console.log('@@ imgData:', imgData); // 224 * 224 * 4(rgba) bytes
                const input = ML.createInput(imgData);
                // console.log('@@ input:', input);
                if (input) {
                    this.ml.predict(input);
                } else {
                    console.warn('@@ failed to get input; nop');
                }
            } else if (what.endsWith('src')) {
                document.location.href = 'https://github.com/w3reality/spacial-ml';
            }
        } else {
            console.log('@@ onSelect(): nop');
            return;
        }
        this.updateMarker(what);
    }
    updateMarker(what) {
        let name = 'invalid';
        let markerPos = null; // relative to the selector group
        if (what.startsWith('command-')) {
            name = 'commandMarker';
            if (what.endsWith('predict')) markerPos = [-2+0.25*1, 0.125+0.25, 0.005];
            if (what.endsWith('clear')) markerPos = [-2+0.25*3, 0.125+0.25, 0.005];
            if (what.endsWith('src')) markerPos = [-2+0.25*6, 0.125+0.25, 0.005];
        } else {
            console.log('@@ updateMarker(): woops'); return;
        }

        const marker = this.selector.getObjectByName(name);
        if (! marker) return;
        marker.position.set(...markerPos);
        marker.visible = true;
        marker.scale.set(what.endsWith('src') ? 2 : 1, 1, 1);
        if (what.startsWith('command-')) {
            setTimeout(() => { marker.visible = false; }, 500);
        }
        this.render();
    }

    static createMarker(name) {
        const markerCanvas = document.createElement('canvas');
        markerCanvas.width = 64;
        markerCanvas.height = 32;
        const ctx = markerCanvas.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, -6+32, markerCanvas.width, 2);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, -4+32, markerCanvas.width, 2);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, -2+32, markerCanvas.width, 2);
        const marker = Threelet.Utils.createCanvasPlane(markerCanvas, 0.5, 0.25);
        marker.material.map.magFilter = THREE.NearestFilter;
        marker.material.map.minFilter = THREE.NearestFilter;
        marker.material.transparent = true;
        marker.material.opacity = 0.5;
        marker.name = name;
        marker.visible = false;
        return marker;
    }
    static createSelector(planeCanvas) {
        const selector = new THREE.Group();
        Threelet.hasVrDisplay(tf => selector.position.set(0, 1, tf ? -3.5 : -0.5));

        const plane = Threelet.Utils.createCanvasPlane(planeCanvas, 4, 2, 8, 8);
        if (0) { // control tex opacity
            plane.material.transparent = true;
            plane.material.opacity = 0.9;
        }
        if (1) { // control tex sharpness
            plane.material.map.magFilter = THREE.NearestFilter;
            plane.material.map.minFilter = THREE.NearestFilter;
        }

        plane.name = 'plane';
        selector.add(plane);

        return selector;
    }

    static drawTitle(ctx) {
        ctx.fillStyle = '#cccccc';
        ctx.font = '18px monospace';
        ctx.fillText('🖥 ️examples/lenet', 16, 32+8);
    }
    static drawSelectionCommands(ctx) {
        ctx.fillStyle = '#444444';
        ctx.fillRect(0*64, 2*32, 64, 32);
        ctx.fillRect(1*64, 2*32, 64, 32);
        ctx.fillRect(2*64, 2*32, 64, 32);
        ctx.fillRect(3*64, 2*32, 64, 32);
        ctx.fillStyle = '#cccccc';
        ctx.font = '13px monospace';
        ctx.fillText('Predict', 0*64+8, 2*32+20);
        ctx.fillText('Clear', 1*64+8, 2*32+20);
        ctx.fillText('(source code)', 2*64+8, 2*32+20);
        // ctx.fillText('-', 3*64+8, 2*32+20);
    }
    drawInfo(lines) {
        const ctx = this.planeCtx;
        ctx.fillStyle = '#cccccc';
        ctx.font = '13px monospace';

        let offset = 3;
        for (let line of lines) {
            ctx.fillText(line, 8, (offset++)*32+20);
        }
    }
    updateIllustration(tf) {
        const ctx = this.planeCtx;
        if (tf && this.illustrationCanvas) {
            // draw a 128 x 256 image
            ctx.drawImage(this.illustrationCanvas, 0, 128);
        } else { // 'hide' the illustration
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 128, 256, 128);
        }
    }
    static clearPaintArea(ctx) {
        ctx.fillStyle = '#000';
        ctx.fillRect(256, 0, 256, 256);
        ctx.fillStyle = '#fff';
        ctx.fillRect(256+16, 16, 224, 224);
    }
    static createPlaneCanvas() {
        const planeCanvas = document.createElement('canvas');
        planeCanvas.width = 512;
        planeCanvas.height = 256;

        const planeCtx = planeCanvas.getContext('2d');
        planeCtx.fillStyle = '#222';
        planeCtx.fillRect(0, 0, 256, 256);
        Viewer.clearPaintArea(planeCtx);

        Viewer.drawTitle(planeCtx);
        Viewer.drawSelectionCommands(planeCtx);
        return planeCanvas;
    }

    static createSigObjects() {
        const sigCanvas = document.createElement('canvas');
        sigCanvas.width = 256;
        sigCanvas.height = 256;
        // document.body.appendChild(sigCanvas); // debug

        const penColor = 'rgb(0, 0, 255)';
        const sigPad = new SignaturePad(sigCanvas, {
            minWidth: 10,
            backgroundColor: 'rgba(255, 255, 255, 0)', // ok for predict()
            // backgroundColor: 'rgba(255, 255, 255, 255)', // white
            // backgroundColor: 'rgba(0, 0, 0, 255)', // debug
            penColor: penColor,
            onBegin: (event) => {
                console.log('@@ onBegin(): event:', event);
            },
            onEnd: (event) => {
                console.log('@@ onEnd(): event:', event);
                const data = sigPad.toData();
                console.log('@@ onEnd(): data:', data);

                if (0) { // test restore
                    sigPad.clear();
                    sigPad.fromData(data);
                }
            },
        });
        console.log('@@ sigPad:', sigPad);

        return {pad: sigPad, canvas: sigCanvas, needsUpdate: false};
    }

}
export default Viewer;
