# LunaNet Extended Mission Control: 3D Space Communications Simulator

A high-fidelity, web-native 3D Space Communications Digital Twin and Delay-Tolerant Networking (DTN) simulator. This platform models dynamic Earth-Moon orbital mechanics, lunar terrain horizon masking, and automated tracking handovers for satellites, mobile rovers, and surface assets in real time. 

<p align="center">
  <img src="simulation_gif1.gif" alt="LunaNet Fault Injection Simulation Demo" width="750">
</p>

Operating over the physical astrodynamics layer is a custom implementation of the **DTN Bundle Protocol stack (RFC 5050 / RFC 9171)** designed to handle multi-second propagation delays and frequent line-of-sight blockages from planetary orbital occlusions.

---

## 🚀 Features

### 1. Spatial Astrodynamics & Occlusion Engine
* **Planetary Ephemeris Modeling:** Tracks dynamic orbital mechanics on a 3D Cartesian grid centered on Earth at origin point `[0, 0, 0]`. Updates the Moon's shifting displacement vector (P{moon}) frame-by-frame based on elapsed time.

* **Rotational Transformations:** Applies a time-varying rotational transformation matrix (R_z) to map real-time coordinates of a terrestrial ground station in Pakistan (69.34° E, 30.37° N), adjusting dynamically for Earth's axis spin.
  
* **Ray-Traced Horizon Masking:** Continuous vector cross-product calculations check for planetary obstructions using true physical radii (R_E = 6,371 \text{ km}$ for Earth horizon masking and R_M = 1,737.4 \text{ km} for lunar surface occlusions).
* **Lunar Polar Terrain Cutoffs:** Evaluates normalized dot-product constraints relative to the Moon’s center to cut direct links instantly when a rover slips past a visible ridge or horizon, automatically triggering an automated handover routine to look for overhead satellite relays.

### 2. Delay-Tolerant Networking (DTN) Stack
* **Store-and-Forward Caching:** Implements self-contained application data blocks ("bundles") that cache data securely in localized memory vaults when physical links go dark, treating intermittent connectivity as an expected operational state rather than an infrastructure failure.
* **Class of Service (CoS) Prioritization:** Strict traffic profiles separating data packets into three clear priority levels matching LunaNet specifications: Critical Telemetry (Priority 2), Standard Logs (Priority 1), and Bulk Scientific Payloads (Priority 0).
* **Preemptive Queue Eviction:** Manages hardware memory limitations with a bounded queue {MAX\_BUFFER\_CAPACITY} = 5 packets. When a packet reaches a completely full buffer, lower-priority packets are preemptively purged from the queue to guarantee delivery pathways for incoming high-priority command data.

### 3. Hot-Swappable Routing Engines
* **Greedy Hierarchical Router:** An opportunistic routing engine that handles packet transfers over immediate visible paths.
* **Contact Graph Routing (CGR):** A schedule-aware routing engine that utilizes contact plans to navigate predictable orbital disruptions.

### 4. Chaos Engineering Subsystem
* **Solar Flare Disruption Loop:** Simulates space weather hazards by injecting a 40% random connection drop probability across active link vectors.
* **Total Node Blackouts:** Allows operators to target and completely deactivate specific satellite relays (e.g., HALO-L1, HALO-Polar), severing all local connection links to force the network to adapt to sudden hardware failures.

## 🛠️ Architecture & Project Structure

The simulator is built entirely on web standards using a highly decoupled, three-tier topology:
* **Spatial Astrodynamics Layer:** Manages orbital positions, coordinate frames, and 3D positioning using a synchronized WebGL rendering loop.
* **Physical Line-of-Sight (LOS) Layer:** Dynamically handles ray-traced blocks and link state verification.
* **Discrete Protocol Layer:** Governs store-and-forward rules, priority queues, and bundle data persistence.

### File Layout
```text
├── Index.html                # Core Interface: Sets up DOM layout, WebGL context, & HUD engine
├── lunanetNetwork.js         # Protocol Layer: Line-of-sight math, DTN stack, CGR, & routing rules
├── earthSatellites.js        # Config: Initial positions and orbital parameters for Earth assets
├── lunarSatellites.js        # Config: Orbital elements for cislunar constellation assets
├── groundStation.js          # Config: Geographical and baseline tracking station vectors
└── lunarSurface.js           # Config: Coordinates for localized surface bases and mobile rovers
```
Installation & Quick Start
The software is completely web-native and execution requires no compiler, bundler, or backend server infrastructure.

Prerequisites
Operating System: Cross-platform compatible (Windows, macOS, Linux).

Browser: Any modern web browser supporting WebGL hardware acceleration (Chrome, Edge, Firefox, Safari).

Deployment Steps

Clone or download this repository into a local directory:
git clone [https://github.com/talha436dev/Lunanet-3D-Simulator](https://github.com/yourusername/LunaNet-3D-Simulator.git)

Navigate to the folder and open welcome.html directly in your web browser (or use a lightweight IDE extension like VS Code's Live Server).

To customize default positions, coordinate frames, or node properties, modify the JavaScript files inside the respective configuration files.

#vHow to Use & Simulation Interaction Guide
Once the Mission Control HUD loads in your browser, use the following control workflows to interact with and analyze the network:

1. Viewport Navigation
Camera Focus Toggles: Use the left control HUD panel to click "Focus Earth" or "Focus Moon". The camera tracking matrix will instantly shift its target center point across cislunar space.

3D Manipulation: Use left-click and drag to rotate the orbital perspective, right-click and drag to pan, and the scroll wheel to zoom into specific satellite paths.

2. On-the-Fly Mesh Network Modification
Dynamic Node Deployment: Click the + Add Moon Base option button on the dashboard interface.
<p align="center">
  <img src="simulation_gif2.gif" alt="LunaNet Fault Injection Simulation Demo" width="750">
</p>
Surface Placement: Move your cursor over the 3D rendering of the Moon and left-click on any surface location. The simulation will instantly instantiate a new ground asset, link it into the live topological array, and dynamically include it in routing calculations.

3. Stress Testing via Chaos Injection
Simulate Environmental Hazards: Locate the Chaos Subsystem panel on the dashboard. Turn on the "Solar Flare" switch to instantly inject a 40% connection drop probability. You will see link vector indicators flash and adapt to data drop rates.

Relay Blackouts: Select an operational relay node (e.g., HALO-L1 or DRO Satellite) from the network list and trigger a blackout. The simulator drops its links to test if the bundle traffic falls back smoothly onto remaining paths.

4. Live Protocol & Buffer Tracking
Queue Saturation Monitoring: Keep an eye on the horizontal bar gauges displayed next to each active node on the HUD display. These map the internal 5-packet queue limits (MAX_BUFFER_CAPACITY=5).

Eviction Behavior Observation: When a network pathway drops, watch the queue fill up. Once the limit is breached, the dashboard flashes from Green to Red, showcasing active Class of Service (CoS) queue preemption rules as lower-priority bulk data is dropped to ensure critical command lines survive.

🔮 Engineering Future Extensions
Hardware-in-the-Loop (HIL) Emulation: Integrating microcontroller development boards (e.g., STM32 or ESP32) via WebSockets to serve as physical transceivers, validating true memory limitations and queue timing constraints on real hardware.

Full-Scale Protocol Stack Virtualization: Replacing internal JavaScript queues with a backend running NASA’s reference Interplanetary Overlay Network (ION) software stack, turning the 3D environment into a visual interface for actual spacecraft flight software.

Mechanical Antenna Gimbal Tracking: Integrating closed-loop Proportional-Integral-Derivative (PID) controllers to model physical antenna steering adjustments on surface rovers, requiring real orientation alignment before links establish.

Compliance Note: Architecture rules and data layers are mapped in accordance with specifications detailed in the NASA LunaNet Architecture Definition Document (ADD) and CCSDS Delay-Tolerant Networking Core Standards.
