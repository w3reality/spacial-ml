// aframe-loop-component.js - https://github.com/w3reality
// An aframe-component to control the loop fps (MIT License)

AFRAME.registerComponent('loop', {
    init: function () {
        // console.log('this:', this);

        //======== ======== ======== ========
        // render loop hack -- ref: aframe-master-j.js:75705
        // https://stackoverflow.com/questions/39515840/how-can-i-get-a-renderer-in-a-frame
        // TODO the above article tells how to reliably get the camera as well
        const as = this.el;
        // console.log('as:', as); // a-scene; FIXME how to inspect as above?

        // suspend render looping by replacing with a nop func
        const renderOrig = as.render;
        as.render = () => {}; // disable the default render loop starter

        // https://stackoverflow.com/questions/39515840/how-can-i-get-a-renderer-in-a-frame
        // FIXME why 'camera-set-active' not triggered in this file????????; not reliable...
        // as.addEventListener('camera-set-active', this.initRenderCustom.bind(this));
        this.initRenderCustom();
        //======== ======== ======== ========
    },
    initRenderCustom: function() {
        console.log('do-something initRenderCustom');
        const as = this.el;
        // console.log(as.renderer); // OK
        // console.log(as.camera); // OK

        // v0.8.2 is based on old API; so polyfill...
        if (! as.renderer.setAnimationLoop) {
            as.renderer.setAnimationLoop = as.renderer.animate;
        }

        // render stuff --------
        const stats = (1 && Stats) ? new Stats() : null;
        if (stats) {
            stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
            document.body.appendChild(stats.dom);
        }

        const renderCustom = () => {
            // FIXME webxr support: (RAF is in window and device)
            // how to incorporate setAnimationLoop() stuff
            // https://github.com/mrdoob/three.js/issues/13594

            // console.log('custom render!!');
            as.delta = as.clock.getDelta() * 1000;
            as.time = as.clock.elapsedTime * 1000;
            if (as.isPlaying) { as.tick(as.time, as.delta); }
            // atomic render part
            if (stats) { stats.update(); }
            as.renderer.render(as.object3D, as.camera, as.renderTarget);
        };

        //---- test controling render looping
        // as.renderer.setAnimationLoop(() => console.log('hi'));
        // setTimeout(() => {
        //     // https://threejs.org/docs/#api/en/renderers/WebGLRenderer.setAnimationLoop
        //     as.renderer.setAnimationLoop(null); // stop the loop
        // }, 500);
        //---- test atomic rendering only once
        // as.renderer.render(as.object3D, as.camera, as.renderTarget);
        //---- looping with custom render
        // as.renderer.setAnimationLoop(renderCustom);
        //---- wc-like looping with fps; FIXME webxr support (RAF is in both window and device)
        // const fps = 0.5;
        // const fps = 60;
        // const fps = 12; // 10 -> key controls broken with vibration...
        const fps = 12; // 10 fine with aframe v0.9.0
        console.log('custom render loop with fps:', fps);
        let iid = setInterval(() => {
            requestAnimationFrame(renderCustom);
        }, 1.0/fps*1000);

        if (1) {
            const clearSec = 180;
            console.log(`!!!! will clear loop after ${clearSec} sec`);
            setTimeout(() => {
                clearInterval(iid);
                console.log(`!!!! loop cleared (${clearSec} sec passed)`);
            }, clearSec*1000);
        }
        //----
    },
});
