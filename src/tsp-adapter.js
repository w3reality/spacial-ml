// tsp-adapter.js - https://github.com/w3reality/spacial-ml
// An adapter for TensorSpace models to be used in WebVR (MIT License)

class __AframeModelComponent {
    constructor() {
        Object.assign(this, {
            schema: {
                axes: {type: 'boolean', default: false},
            },
            init: function () {
                if (this.data.axes) {
                    const scene = this.el.object3D;
                    const scale = 1;

                    const fixRotScaleMesh = (obj, scale=1.0) => {
                        obj.rotation.z = Math.PI;
                        obj.rotation.x = -Math.PI/2; // now: +Z == Green == North
                        obj.scale.set(scale, scale, scale);
                        obj.updateMatrixWorld(); // reflect the change immediately
                        return obj;
                    };
                    const createWalls = (size=[1,1,1], color=0xcccccc) => {
                        return new THREE.LineSegments(
                            new THREE.EdgesGeometry(new THREE.BoxBufferGeometry(...size)),
                            new THREE.LineBasicMaterial({color: color}));
                    };

                    const walls = createWalls();
                    walls.position.set(0, 0, 0);
                    scene.add(fixRotScaleMesh(walls, scale));

                    const axes = new THREE.AxesHelper(2);
                    scene.add(fixRotScaleMesh(axes, scale));
                }
            },
        });
    }
}

class __AframeColliderComponent {
    constructor(adapter) {
        Object.assign(this, {
            dependencies: ['raycaster'],
            tick: function () { adapter.onUpdate(); },
            init: function () {
                // console.log('@@ this:', this);

                // cf. https://github.com/supermedium/superframe/tree/master/components/event-set/
                // this 'click' event just works for desktop; and for WebVR, use laser-controls
                // https://stackoverflow.com/questions/44645668/async-interactions-between-a-frame-components
                //   "A-Frame master build, soon 0.6.0, has a laser-controls component you can use
                //   https://aframe.io/docs/master/components/laser-controls.html
                //   so all you have to do is listen for click rather than having to
                //   listen for both raycaster intersection and trigger down. And you
                //   get all controller support for free."
                this.el.addEventListener('click', evt => { // ok for both desktop/WebVR
                // this.el.addEventListener('touchstart', evt => { // No need this way; see above
                // this.el.addEventListener('triggerdown', evt => { // No need this way; see above
                    // console.log('@@ click - evt:', evt);

                    // console.log('@@ detail:', evt.detail);
                    // console.log('@@ isec:', evt.detail.intersection);
                    if (evt.detail.intersection) {
                        const isects = [evt.detail.intersection,];
                        adapter.onHover(isects);

                        adapter.onClick(isects);
                        setTimeout(() => {
                            // for raycaster after model topology change (e.g. close buttons)
                            adapter._refreshAframeModel();
                        }, 3000); // need this delay for anim to complete
                    }
                });
                this.el.addEventListener('raycaster-intersection', evt => {
                    // console.log('@@ raycaster-intersection - evt:', evt);

                    // this data to be cleared by aframe immediately
                    // for inspection, use .slice() first!!!!
                    // console.log('@@ detail:', evt.detail);
                    // const els = evt.detail.els.slice();
                    const isects = evt.detail.intersections.slice();
                    // console.log('@@ els, isects', els, isects, this);
                    adapter.onHover(isects);
                });
                this.el.addEventListener('raycaster-intersection-cleared', evt => {
                    // console.log('@@ raycaster-intersection-cleared - evt:', evt);
                    adapter.onHover([]);
                });
                //---- unused callbacks, thus far
                // this.el.addEventListener('raycaster-intersected', evt => {
                //     console.log('@@ raycaster-intersected - evt:', evt);
                // });
                // this.el.addEventListener('raycaster-intersected-cleared', evt => {
                //     console.log('@@ raycaster-intersected-cleared - evt:', evt);
                // });
            },
        });
    }
}

class TspAdapter {
    constructor(opts={}) {
        this.modelContext = null;
        this.onUpdate = () => {};
        this.onHover = isects => {};
        this.onClick = isects => {};
        this.aframeModelComponentName = opts.aframeModelComponentName;
    }
    setModel(model, opts={}) {
        console.log('@@ adapter: model:', model);
        const mr = model.modelRenderer;
        if (! mr) {
            console.log('@@ TspAdapter: error: model.modelRenderer not found; model.init() not called yet?');
            throw 'TspAdapter: error: [hint] setModel() must be called after model.init()'
        }

        const mc = model.modelContext;
        this.modelContext = mc;

        if (this.aframeModelComponentName) {
            const el = this._getAframeModelElement();
            if (el) {
                // ?? FIXME use emit() for better communication ??
                el.object3D.add(mc);
            }

            this._refreshAframeModel(); // for raycaster
        }

        mc.position.set(0, 0, 0);
        mc.rotation.x = -Math.PI/2;
        mc.rotation.z = Math.PI/2;
        mc.scale.set(0.01, 0.01, 0.01);

        // disable the original anim loop
        mr.animate = () => { console.log('@@ nop'); };

        this.onUpdate = () => {
            window.TWEEN.update();
        };
        this.onHover = (isects) => {
            mr.handlers.handleHover(isects);
        };
        this.onClick = (isects) => {
            for (const isec of isects) {
                if (isec && isec.object.type === "Mesh" &&
                    isec.object.clickable === true) {
                    mr.handlers.handleClick(isec.object);
                    break;
                }
            }
        };
        return mc;
    }

    // optional utils for Aframe
    createAframeModelComponent() { return new __AframeModelComponent(); }
    createAframeColliderComponent() { return new __AframeColliderComponent(this); }
    _getAframeModelElement() {
        const comName = this.aframeModelComponentName;
        // [attr=value]
        return comName ? document.querySelectorAll(`[${comName}]`)[0] : null;
    }
    _refreshAframeModel() { // for raycaster
        const el = this._getAframeModelElement();
        const mc = this.modelContext;
        if (el && mc) {
            // need this explicit setObject3D() for the raycaster
            el.setObject3D(`mc-${mc.uuid}`, mc);
        }
    }
}

export default TspAdapter;
