window.isPlacementMode = false;
window.moonBases = [];

function setupLunarSurface(viewer, moonPosProp) {
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction(function (click) {
        if (!window.isPlacementMode) return;

        const time = viewer.clock.currentTime;
        const moonPos = moonPosProp.getValue(time);
        if (!moonPos) return;

        let cartesian = null;

        if (viewer.scene.pick(click.position)) {
            cartesian = viewer.scene.pickPosition(click.position);
        }

        if (!Cesium.defined(cartesian)) {
            const ray = viewer.camera.getPickRay(click.position);
            const moonSphere = new Cesium.BoundingSphere(moonPos, 1737400); 
            const intersection = Cesium.IntersectionTests.raySphere(ray, moonSphere);
            if (intersection) {
                cartesian = Cesium.Ray.getPoint(ray, intersection.start);
            }
        }

        if (Cesium.defined(cartesian)) {
            const moonTransform = Cesium.Transforms.eastNorthUpToFixedFrame(moonPos);
            const inverseMoonTransform = Cesium.Matrix4.inverse(moonTransform, new Cesium.Matrix4());
            const localOffset = Cesium.Matrix4.multiplyByPoint(inverseMoonTransform, cartesian, new Cesium.Cartesian3());
            
            const baseId = `BASE-${window.moonBases.length + 1}`;
            const baseSurfaceHeight = localOffset.z + 1500;

            const baseEntity = viewer.entities.add({
                id: baseId,
                name: "Lunar Command Base",
                position: new Cesium.CallbackProperty((t) => {
                    const currentMoon = moonPosProp.getValue(t);
                    if (!currentMoon) return Cesium.Cartesian3.ZERO;
                    const currentTransform = Cesium.Transforms.eastNorthUpToFixedFrame(currentMoon);
                    const elevatedPos = new Cesium.Cartesian3(localOffset.x, localOffset.y, baseSurfaceHeight);
                    return Cesium.Matrix4.multiplyByPoint(currentTransform, elevatedPos, new Cesium.Cartesian3());
                }, false),
                box: {
                    dimensions: new Cesium.Cartesian3(6000, 4000, 3000), 
                    material: Cesium.Color.CYAN.withAlpha(0.9),
                    outline: true,
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2
                },
                label: { 
                    text: baseId, 
                    font: '12pt monospace', 
                    fillColor: Cesium.Color.CYAN,
                    pixelOffset: new Cesium.Cartesian2(0, -40),
                    disableDepthTestDistance: Number.POSITIVE_INFINITY 
                }
            });

            const newBaseData = {
                id: baseId,
                entity: baseEntity,
                offset: new Cesium.Cartesian3(localOffset.x, localOffset.y, baseSurfaceHeight),
                roversInBay: 0, 
                activeRovers: [],
                dtnBuffer: [] 
            };

            window.moonBases.push(newBaseData);

            const patrolRadius = 50000; 
            for (let i = 1; i <= 3; i++) {
                const roverId = `${baseId}-ROVER-${i}`;
                const randomPhase = Math.random() * Math.PI * 2;
                const randomSpeed = 0.01 + Math.random() * 0.015; 

                const roverEntity = viewer.entities.add({
                    id: roverId,
                    name: `Rover asset unit ${i}`,
                    position: new Cesium.CallbackProperty((t) => {
                        const currentMoon = moonPosProp.getValue(t);
                        if (!currentMoon) return Cesium.Cartesian3.ZERO;
                        
                        const timeSec = Cesium.JulianDate.secondsDifference(t, viewer.clock.startTime);
                        const driveX = localOffset.x + (Math.sin(timeSec * randomSpeed + randomPhase) * patrolRadius);
                        const driveY = localOffset.y + (Math.cos(timeSec * randomSpeed + randomPhase) * patrolRadius);
                        
                        const localRoverPos = new Cesium.Cartesian3(driveX, driveY, baseSurfaceHeight + 200);
                        const currentTransform = Cesium.Transforms.eastNorthUpToFixedFrame(currentMoon);
                        return Cesium.Matrix4.multiplyByPoint(currentTransform, localRoverPos, new Cesium.Cartesian3());
                    }, false),
                    box: {
                        dimensions: new Cesium.Cartesian3(1600, 1300, 1000),
                        material: Cesium.Color.YELLOW,
                        outline: true,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 1.5
                    },
                    label: {
                        text: `R-${i}`,
                        font: '10pt monospace',
                        fillColor: Cesium.Color.YELLOW,
                        pixelOffset: new Cesium.Cartesian2(0, 25),
                        disableDepthTestDistance: Number.POSITIVE_INFINITY
                    }
                });

                // Initialize internal parameters for Cesium Clock-based generation
                roverEntity.customStatus = "DIRECT_LINK";
                roverEntity.dtnBuffer = []; 
                roverEntity.currentTelemetry = { temp: "0.0", rad: "0.0", pwr: "100" };
                // Track the exact simulation timestamp when it last sampled a packet
                roverEntity.lastGenerationTime = Cesium.JulianDate.clone(viewer.clock.currentTime);

                newBaseData.activeRovers.push(roverEntity);
            }

            window.togglePlacementMode(); 
            if (typeof refreshDashboard === 'function') {
                refreshDashboard(viewer);
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

window.togglePlacementMode = function() {
    window.isPlacementMode = !window.isPlacementMode;
    const btn = document.getElementById('deploy-base-btn');
    if (btn) btn.innerText = window.isPlacementMode ? "CANCEL" : "+ Add Moon Base";
};