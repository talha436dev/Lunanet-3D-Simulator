/**
 * Adds 3 Geostationary Satellites using 3D Box Geometries
 * @param {Cesium.Viewer} viewer 
 */
function setupEarthGateway(viewer) {
    const satelliteConfig = [
        { name: "GEO-GATEWAY-ALPHA", longitude: 69.34 },
        { name: "GEO-GATEWAY-BRAVO", longitude: -50.66 },
        { name: "GEO-GATEWAY-CHARLIE", longitude: 189.34 }
    ];

    const geoAltitude = 35786000; 

    satelliteConfig.forEach((config) => {
        const position = Cesium.Cartesian3.fromDegrees(config.longitude, 0, geoAltitude);

        // 1. The Main Satellite Body
        const satelliteEntity = viewer.entities.add({
            id: config.name,
            name: config.name,
            position: position,
            box: {
                dimensions: new Cesium.Cartesian3(400000.0, 400000.0, 400000.0),
                material: Cesium.Color.WHITE,
                outline: true,
                outlineColor: Cesium.Color.BLACK
            }
        });

        // 2. The Solar Panels
        // Left
        viewer.entities.add({
            parent: satelliteEntity, // Link to body
            position: Cesium.Cartesian3.fromDegrees(config.longitude - 0.15, 0, geoAltitude),
            box: {
                dimensions: new Cesium.Cartesian3(800000.0, 300000.0, 20000.0),
                material: Cesium.Color.DARKBLUE.withAlpha(0.9),
                outline: true,
                outlineColor: Cesium.Color.SKYBLUE
            }
        });

        // Right
        viewer.entities.add({
            parent: satelliteEntity, // Link to body
            position: Cesium.Cartesian3.fromDegrees(config.longitude + 0.15, 0, geoAltitude),
            box: {
                dimensions: new Cesium.Cartesian3(800000.0, 300000.0, 20000.0),
                material: Cesium.Color.DARKBLUE.withAlpha(0.9),
                outline: true,
                outlineColor: Cesium.Color.SKYBLUE
            }
        });
    });
}