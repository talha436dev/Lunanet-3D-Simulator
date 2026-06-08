const activeLines = {};
window.receivedGroundBundles = window.receivedGroundBundles || [];

function updateLunanetNetwork(viewer, moonPosProp) {
    const time = viewer.clock.currentTime;
    const earthPos = Cesium.Cartesian3.ZERO;
    const moonPos = moonPosProp.getValue(time);
    if (!moonPos) return;

    const ground = viewer.entities.getById("GROUND-STATION-PAKISTAN");
    const geoSats = ["GEO-GATEWAY-ALPHA", "GEO-GATEWAY-BRAVO", "GEO-GATEWAY-CHARLIE"].map(id => viewer.entities.getById(id)).filter(Boolean);
    const lunarSats = ["HALO-L1", "HALO-L2", "HALO-POLAR", "DRO-1", "DRO-2"].map(id => viewer.entities.getById(id)).filter(Boolean);

    [...geoSats, ...lunarSats].forEach(sat => {
        if (!sat.dtnBuffer) sat.dtnBuffer = [];
    });

    // --- SIMULATION-TIME SENSOR BUNDLE GENERATOR ---
    if (typeof window.moonBases !== 'undefined') {
        window.moonBases.forEach(base => {
            base.activeRovers.forEach((rover, index) => {
                if (!rover.lastGenerationTime) {
                    rover.lastGenerationTime = Cesium.JulianDate.clone(time);
                }
                
                const diffSeconds = Cesium.JulianDate.secondsDifference(time, rover.lastGenerationTime);
                
                if (Math.abs(diffSeconds) >= 60.0) {
                    const tempSim = (-130 + Math.random() * 40).toFixed(1);
                    const radSim = (12 + Math.random() * 5).toFixed(2);
                    const pwrSim = Math.floor(80 + Math.random() * 20);
                    
                    rover.currentTelemetry = { temp: tempSim, rad: radSim, pwr: pwrSim };

                    const simDateTime = Cesium.JulianDate.toDate(time);
                    const simTimeStr = simDateTime.toUTCString().split(' ')[4] + " UTC";

                    rover.dtnBuffer.push({
                        id: `BNDL-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
                        origin: `${base.id}-R${index + 1}`,
                        generationTime: simTimeStr, 
                        transmissionTime: null,     
                        hopHistory: [`R-${index + 1}`], // Initialize history starting at the Rover Node
                        payload: { temp: tempSim, rad: radSim, pwr: pwrSim }
                    });

                    rover.lastGenerationTime = Cesium.JulianDate.clone(time);
                    
                    if (rover.dtnBuffer.length > 50) rover.dtnBuffer.shift();
                }
            });
        });
    }

    // 1. Earth Radio Uplink
    let bestGeo = findClosestVisible(time, ground, geoSats, earthPos, 6371000);
    manageLink(viewer, ground, bestGeo, Cesium.Color.YELLOW, "RADIO_UPLINK", true);

    // 2. Cross-link mesh for Gateways
    if (geoSats.length === 3) {
        connectIfClear(viewer, geoSats[0], geoSats[1], earthPos, 6371000, "GEO_M1");
        connectIfClear(viewer, geoSats[1], geoSats[2], earthPos, 6371000, "GEO_M2");
        connectIfClear(viewer, geoSats[2], geoSats[0], earthPos, 6371000, "GEO_M3");
    }

    // 3. Earth-to-Moon Interplanetary Bridge
    let occupiedLunarIds = new Set();
    geoSats.forEach(geo => {
        const pGeo = geo.position.getValue(time);
        const bridgeKey = `BRIDGE_${geo.id}`;
        let targetLunar = null;
        if (pGeo) {
            let candidates = lunarSats.map(l => ({ ent: l, pos: l.position.getValue(time), dist: l.position.getValue(time) ? Cesium.Cartesian3.distance(pGeo, l.position.getValue(time)) : Infinity })).sort((a, b) => a.dist - b.dist);
            for (let cand of candidates) {
                if (!occupiedLunarIds.has(cand.ent.id)) {
                    if (!isBlocked(pGeo, cand.pos, earthPos, 6371000) && !isBlocked(pGeo, cand.pos, moonPos, 1737400)) {
                        targetLunar = cand.ent; break;
                    }
                }
            }
        }
        if (targetLunar) {
            manageLink(viewer, geo, targetLunar, Cesium.Color.LIME, bridgeKey);
            occupiedLunarIds.add(targetLunar.id);
        } else {
            if (activeLines[bridgeKey]) activeLines[bridgeKey].show = false;
        }
    });

    // 4. Lunar Orbital Mesh Topology Setup
    lunarSats.forEach(sat => {
        let neighbors = findLunarNeighbors(time, sat, lunarSats, moonPos);
        if (neighbors[0]) connectIfClear(viewer, sat, neighbors[0], moonPos, 1737400, `LUN_A_${sat.id}`);
        if (neighbors[1]) connectIfClear(viewer, sat, neighbors[1], moonPos, 1737400, `LUN_B_${sat.id}`);
    });

    const currentSimTimeStr = Cesium.JulianDate.toDate(time).toUTCString().split(' ')[4] + " UTC";

    // 5. DTN HOP CALCULATIONS WITH SIMULATION TIMESTAMPS
    if (typeof window.moonBases !== 'undefined') {
        window.moonBases.forEach(base => {
            const linkKey = `BASE_LINK_${base.id}`;
            let bestSat = findClosestVisible(time, base.entity, lunarSats, moonPos, 1737400);
            
            if (bestSat) {
                manageLink(viewer, base.entity, bestSat, Cesium.Color.LIME, linkKey, true);
                
                if (base.dtnBuffer.length > 0 && bestSat.dtnBuffer) {
                    while (base.dtnBuffer.length > 0) {
                        let bundle = base.dtnBuffer.shift();
                        if (!bundle.transmissionTime) {
                            bundle.transmissionTime = currentSimTimeStr;
                        }
                        // Append next orbital node ID hop destination
                        if (bundle.hopHistory) bundle.hopHistory.push(bestSat.id.replace("HALO-", "").replace("GEO-GATEWAY-", "GEO-"));
                        bestSat.dtnBuffer.push(bundle);
                    }
                }
            } else {
                if (activeLines[linkKey]) {
                    activeLines[linkKey].show = false;
                    activeLines[linkKey]._currentS = null;
                    activeLines[linkKey]._currentE = null;
                }
            }
            
            base.activeRovers.forEach(rover => {
                const roverLinkKey = `LINK_${rover.id}`;
                const pBase = base.entity.position.getValue(time);
                const pRover = rover.position.getValue(time);
                
                let lineOfSightToBase = false;
                if (pBase && pRover) {
                    const vectorMoonToBase = Cesium.Cartesian3.subtract(pBase, moonPos, new Cesium.Cartesian3());
                    Cesium.Cartesian3.normalize(vectorMoonToBase, vectorMoonToBase);
                    const vectorBaseToRover = Cesium.Cartesian3.subtract(pRover, pBase, new Cesium.Cartesian3());
                    Cesium.Cartesian3.normalize(vectorBaseToRover, vectorBaseToRover);
                    if (Cesium.Cartesian3.dot(vectorMoonToBase, vectorBaseToRover) > -0.12) { 
                        lineOfSightToBase = true;
                    }
                }
                
                if (lineOfSightToBase) {
                    rover.customStatus = "DIRECT_LINK";
                    manageLink(viewer, rover, base.entity, Cesium.Color.YELLOW, roverLinkKey, true);
                    
                    if (rover.dtnBuffer && rover.dtnBuffer.length > 0) {
                        while (rover.dtnBuffer.length > 0) {
                            let bundle = rover.dtnBuffer.shift();
                            bundle.transmissionTime = currentSimTimeStr; 
                            if (bundle.hopHistory) bundle.hopHistory.push(base.id);
                            base.dtnBuffer.push(bundle);
                        }
                    }
                } else {
                    let bestRelaySatellite = findClosestVisible(time, rover, lunarSats, moonPos, 1737400);
                    
                    if (bestRelaySatellite) {
                        rover.customStatus = `RELAY via ${bestRelaySatellite.id.replace("HALO-", "")}`;
                        manageLink(viewer, rover, bestRelaySatellite, Cesium.Color.YELLOW, roverLinkKey, true);
                        
                        if (rover.dtnBuffer && rover.dtnBuffer.length > 0 && bestRelaySatellite.dtnBuffer) {
                            while (rover.dtnBuffer.length > 0) {
                                let bundle = rover.dtnBuffer.shift();
                                bundle.transmissionTime = currentSimTimeStr;
                                if (bundle.hopHistory) bundle.hopHistory.push(bestRelaySatellite.id.replace("HALO-", "").replace("GEO-GATEWAY-", "GEO-"));
                                bestRelaySatellite.dtnBuffer.push(bundle);
                            }
                        }
                    } else {
                        rover.customStatus = "HOLDING DATA (LOS Occluded)";
                    }
                }
            });
        });
    }

    // 6. Lunar Mesh Orbital Hopping
    lunarSats.forEach(sat => {
        if (sat.dtnBuffer && sat.dtnBuffer.length > 0) {
            let targetGeoSat = null;
            geoSats.forEach(geo => {
                const bridgeKey = `BRIDGE_${geo.id}`;
                if (activeLines[bridgeKey] && activeLines[bridgeKey].show && activeLines[bridgeKey]._currentE === sat) {
                    targetGeoSat = geo;
                }
            });

            if (targetGeoSat && targetGeoSat.dtnBuffer) {
                while (sat.dtnBuffer.length > 0) {
                    let bundle = sat.dtnBuffer.shift();
                    if (bundle.hopHistory) bundle.hopHistory.push(targetGeoSat.id.replace("GEO-GATEWAY-", "GEO-"));
                    targetGeoSat.dtnBuffer.push(bundle);
                }
            } else {
                let neighbors = findLunarNeighbors(time, sat, lunarSats, moonPos);
                let meshRelay = neighbors[0];
                if (meshRelay && meshRelay.dtnBuffer) {
                    while (sat.dtnBuffer.length > 0) {
                        let bundle = sat.dtnBuffer.shift();
                        if (bundle.hopHistory) bundle.hopHistory.push(meshRelay.id.replace("HALO-", "").replace("GEO-GATEWAY-", "GEO-"));
                        meshRelay.dtnBuffer.push(bundle);
                    }
                }
            }
        }
    });

    // 7. Gateway Mesh routing out to Earth Ground Node Terminal
    geoSats.forEach(geo => {
        if (geo.dtnBuffer && geo.dtnBuffer.length > 0) {
            if (geo.id === "GEO-GATEWAY-ALPHA") {
                if (activeLines["RADIO_UPLINK"] && activeLines["RADIO_UPLINK"].show && activeLines["RADIO_UPLINK"]._currentE === geo) {
                    while (geo.dtnBuffer.length > 0) {
                        let groundReceivedBundle = geo.dtnBuffer.shift();
                        if (groundReceivedBundle.hopHistory) {
                            groundReceivedBundle.hopHistory.push("GS-PAKISTAN");
                        }
                        window.receivedGroundBundles.unshift(groundReceivedBundle);
                        if (window.receivedGroundBundles.length > 6) window.receivedGroundBundles.pop();
                    }
                }
            } else {
                let alphaNode = viewer.entities.getById("GEO-GATEWAY-ALPHA");
                if (alphaNode && alphaNode.dtnBuffer) {
                    while (geo.dtnBuffer.length > 0) {
                        let bundle = geo.dtnBuffer.shift();
                        if (bundle.hopHistory) bundle.hopHistory.push("GEO-ALPHA");
                        alphaNode.dtnBuffer.push(bundle);
                    }
                }
            }
        }
    });
    
    if (typeof refreshDashboard === 'function') {
        refreshDashboard(viewer);
    }
}

function isBlocked(p1, p2, bodyCenter, radius) {
    if (!p1 || !p2 || !bodyCenter) return true;
    let ray = Cesium.Cartesian3.subtract(p2, p1, new Cesium.Cartesian3());
    let length = Cesium.Cartesian3.magnitude(ray);
    let dir = Cesium.Cartesian3.normalize(ray, new Cesium.Cartesian3());
    let v = Cesium.Cartesian3.subtract(bodyCenter, p1, new Cesium.Cartesian3());
    let proj = Cesium.Cartesian3.dot(v, dir);
    if (proj < 0 || proj > length) return false;
    let closest = Cesium.Cartesian3.add(p1, Cesium.Cartesian3.multiplyByScalar(dir, proj, new Cesium.Cartesian3()), new Cesium.Cartesian3());
    return Cesium.Cartesian3.distance(closest, bodyCenter) < (radius * 1.12); 
}

function manageLink(viewer, s, e, color, key, isRadio = false) {
    if (!s || !e) { 
        if (activeLines[key]) {
            activeLines[key].show = false;
            activeLines[key]._currentS = null;
            activeLines[key]._currentE = null;
        }
        return; 
    }
    if (!activeLines[key]) {
        activeLines[key] = viewer.entities.add({
            id: key,
            polyline: {
                positions: new Cesium.CallbackProperty((t) => {
                    const p1 = activeLines[key]._currentS ? activeLines[key]._currentS.position.getValue(t) : null;
                    const p2 = activeLines[key]._currentE ? activeLines[key]._currentE.position.getValue(t) : null;
                    return (p1 && p2) ? [p1, p2] : [];
                }, false),
                width: isRadio ? 1.5 : 4.0, 
                material: isRadio ?
                    new Cesium.PolylineDashMaterialProperty({ color: color, dashLength: 12.0, gapColor: Cesium.Color.TRANSPARENT }) :
                    new Cesium.PolylineGlowMaterialProperty({ color: color, glowPower: 0.1 }),
                arcType: Cesium.ArcType.NONE,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        });
    }
    activeLines[key]._currentS = s;
    activeLines[key]._currentE = e;
    activeLines[key].show = true;
}

function findClosestVisible(time, src, targets, pPos, rad) {
    let best = null; let minD = Infinity;
    const p1 = src.position.getValue(time);
    if (!p1) return null;
    targets.forEach(t => {
        const p2 = t.position.getValue(time);
        if (p2 && !isBlocked(p1, p2, pPos, rad)) {
            let d = Cesium.Cartesian3.distance(p1, p2);
            if (d < minD) { minD = d; best = t; }
        }
    });
    return best;
}

function connectIfClear(viewer, s, e, pPos, rad, key) {
    const time = viewer.clock.currentTime;
    const p1 = s.position.getValue(time);
    const p2 = e.position.getValue(time);
    if (p1 && p2 && !isBlocked(p1, p2, pPos, rad)) {
        manageLink(viewer, s, e, Cesium.Color.LIME, key);
    } else if (activeLines[key]) { 
        activeLines[key].show = false;
        activeLines[key]._currentS = null;
        activeLines[key]._currentE = null;
    }
}

function findLunarNeighbors(time, sat, all, mPos) {
    const p1 = sat.position.getValue(time);
    if (!p1) return [null, null];
    return all.filter(n => n.id !== sat.id).filter(n => {
        const p2 = n.position.getValue(time);
        return p2 && !isBlocked(p1, p2, mPos, 1737400);
    }).sort((a,b) => Cesium.Cartesian3.distance(p1, a.position.getValue(time)) - Cesium.Cartesian3.distance(p1, b.position.getValue(time)));
}

function initDashboardSelector(viewerInstance) {
    const handler = new Cesium.ScreenSpaceEventHandler(viewerInstance.scene.canvas);
    handler.setInputAction(function(movement) {
        const picked = viewerInstance.scene.pick(movement.position);
        if (Cesium.defined(picked) && picked.id && picked.id.id === "GROUND-STATION-PAKISTAN") {
            const panel = document.getElementById('gs-dashboard');
            if (panel) {
                panel.style.display = (panel.style.display === 'none' || panel.style.display === '') ? 'block' : 'none';
                if (panel.style.display === 'block') refreshDashboard(viewerInstance);
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
}

function refreshDashboard(viewer) {
    const panel = document.getElementById('gs-dashboard');
    const content = document.getElementById('dashboard-content');
    if (!panel || !content || panel.style.display === 'none') return;
    
    const time = viewer.clock.currentTime;
    const ground = viewer.entities.getById("GROUND-STATION-PAKISTAN");
    const lunarSats = ["HALO-L1", "HALO-L2", "HALO-POLAR", "DRO-1", "DRO-2"].map(id => viewer.entities.getById(id)).filter(Boolean);
    const geoSats = ["GEO-GATEWAY-ALPHA", "GEO-GATEWAY-BRAVO", "GEO-GATEWAY-CHARLIE"].map(id => viewer.entities.getById(id)).filter(Boolean);
    const all = [...geoSats, ...lunarSats];
    
    let html = "<table style='width:100%; border-collapse:collapse; color:#00ff00; font-family:monospace; font-size:10px; text-align:left;'>";
    html += "<tr style='border-bottom:2px solid #00ff00;'><th>NAME</th><th>ORBIT</th><th>ANG°</th><th>MESH</th><th>PREDICTION</th></tr>";

    all.forEach(sat => {
        const pG = ground ? ground.position.getValue(time) : null;
        const pS = sat.position.getValue(time);
        if (!pG || !pS) return;
        
        const carto = Cesium.Cartographic.fromCartesian(pS);
        const angle = Cesium.Math.toDegrees(carto.longitude).toFixed(1);
        
        let meshLink = "DISCONN";
        for (let key in activeLines) { 
            if (activeLines[key] && activeLines[key].show && key.includes(sat.id)) { 
                meshLink = "<span style='color:#00ff00;'>LINKED</span>"; 
                break; 
            } 
        }

        let prediction = "<span style='color:#00ff00;'>STABLE</span>";
        
        html += `<tr style="height:25px; border-bottom:1px solid #113311;">
            <td>${sat.id.replace("GEO-GATEWAY-", "").replace("HALO-", "")}</td>
            <td>ORBIT</td><td>${angle}°</td><td>${meshLink}</td><td>${prediction}</td>
        </tr>`;
    });

    html += "</table><div style='margin-top:10px; border-top:2px solid #00ff00; font-weight:bold; color:#00ff00;'>LUNAR SURFACE OPS (SIMULATED 60s RATE)</div>";

    if (typeof window.moonBases !== 'undefined' && window.moonBases.length > 0) {
        window.moonBases.forEach(base => {
            const linkKey = `BASE_LINK_${base.id}`;
            let satName = '<span style="color:#ff3333;">NO SIGNAL</span>';

            if (activeLines[linkKey] && activeLines[linkKey].show && activeLines[linkKey]._currentE) {
                satName = activeLines[linkKey]._currentE.id.replace("HALO-", "");
            }

            html += `<div style="border:1px solid #224422; margin-top:5px; padding:5px; background: rgba(0,20,0,0.4); margin-bottom: 5px;">
                <div style="color:cyan; font-family:monospace; font-size:11px; font-weight:bold; margin-bottom:4px;">
                    ${base.id} <span style="color:#aaa;">📡 Uplink:</span> ${satName} <span style="color:#00ff00; font-size:9px;">[Queue: ${base.dtnBuffer.length}]</span>
                </div>`;

            base.activeRovers.forEach((rover, index) => {
                let statusColor = "#ffff00";
                let statusText = rover.customStatus || "DIRECT_LINK";
                const tel = rover.currentTelemetry || { temp: "0.0", rad: "0.0", pwr: "100" };

                if (statusText.includes("RELAY")) {
                    statusColor = "#ffa500"; 
                    statusText += " 🛰️ (Routing)";
                } else if (statusText.includes("HOLDING")) {
                    statusColor = "#ff3333";
                } else {
                    statusText = "DIRECT TO BASE ✔️";
                }

                html += `<div style="color:${statusColor}; font-family:monospace; font-size:10px; padding-left:6px; margin-top:4px; border-left: 2px solid ${statusColor};">
                    <strong>🤖 R-${index + 1} Status:</strong> ${statusText} <span style="color:#aaa;">[Queue: ${rover.dtnBuffer.length}]</span><br/>
                    <span style="color:#aaa; padding-left:8px;">📊 Live Telemetry -> Temp: <span style="color:#fff;">${tel.temp}°C</span> | Rad: <span style="color:#fff;">${tel.rad}mSv</span> | Pwr: <span style="color:#fff;">${tel.pwr}%</span></span>
                </div>`;
            });

            html += `</div>`;
        });
    }

    html += "<div style='margin-top:10px; border-top:2px solid #00ff00; font-weight:bold; color:#00ff00;'>MISSION CONTROL DATA TERMINAL (DTN RX)</div>";
    if (window.receivedGroundBundles && window.receivedGroundBundles.length > 0) {
        window.receivedGroundBundles.forEach(b => {
            const txTimeStr = b.transmissionTime ? `<span style="color:#00ff00;">${b.transmissionTime}</span>` : `<span style="color:#ff3333;">PENDING</span>`;
            
            // Build out the dynamic hop arrow display path
            const operationalPathTrace = (b.hopHistory && b.hopHistory.length > 0) 
                ? b.hopHistory.join(" ➔ ") 
                : "Unknown Path Data Route";

            html += `<div style="font-family:monospace; font-size:9px; color:#00ff00; background:rgba(0,40,0,0.2); margin-top:3px; padding:4px; border:1px dashed #00ff00; line-height:1.3em;">
                📥 <strong>Bundle RX:</strong> ${b.id} | <strong>Origin:</strong> ${b.origin}<br/>
                <span style="color:#99ff99;">⏱️ Ready to Transmit (Generated): ${b.generationTime}</span><br/>
                <span style="color:#99ff99;">🚀 Actually Transmitted: ${txTimeStr}</span><br/>
                <span style="color:#fff; padding-left:5px;">↳ Metrics: Temp=${b.payload.temp}°C, Rad=${b.payload.rad}mSv, Pwr=${b.payload.pwr}%</span><br/>
                <span style="color:#00ffff; padding-left:5px; font-weight:bold;">↳ Route: <span style="color:#ffffff; font-weight:normal; background:rgba(0,255,255,0.15); padding:0px 4px; border-radius:2px;">${operationalPathTrace}</span></span>
            </div>`;
        });
    } else {
        html += `<div style="color:#446644; font-family:monospace; font-size:9px; padding:6px; text-align:center; font-style:italic;">
            Awaiting interplanetary Bundle Protocol frames...
        </div>`;
    }

    content.innerHTML = html;
}