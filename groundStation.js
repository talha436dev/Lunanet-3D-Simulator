/**
 * Adds the Pakistan Ground Station (Mission Control)
 * @param {Cesium.Viewer} viewer 
 */
function setupGroundStation(viewer) {
    const pakistanPos = Cesium.Cartesian3.fromDegrees(69.34, 30.37);

    viewer.entities.add({
        id: "GROUND-STATION-PAKISTAN",
        name: "Pakistan Mission Control",
        position: pakistanPos,
        // A circle on the ground representing the station's range
        ellipse: {
            semiMinorAxis: 100000.0, // 100km radius
            semiMajorAxis: 100000.0,
            material: Cesium.Color.YELLOW.withAlpha(0.3),
            outline: true,
            outlineColor: Cesium.Color.YELLOW,
            height: 0 // Keep it on the ground
        },
        // A point in the center
        point: {
            pixelSize: 10,
            color: Cesium.Color.YELLOW,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2
        }
    });
}