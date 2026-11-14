# ORBITAL FRONTIER

An educational, browser-based spaceflight game prototype. Design a modular vehicle, run its inspection, launch into a simulated orbit, and complete destination-specific surface or remote-science objectives across nine destinations.

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open the local URL printed by Vite. Create a production build with `npm.cmd run build`.

## Flight controls

- **W / S** — increase / decrease throttle
- **A / D** — yaw the vehicle
- **B** — separate the installed booster stage
- **Mouse drag / wheel** — orbit and zoom the 3D camera
- **Vehicle showcase** — inspect the spacecraft with slow auto-rotation; drag to orbit and scroll to zoom. Customize each component's color in the side panel.
- **EVA controls** — use the on-screen arrows or W / A / S / D to walk

Bindings can be changed in **Settings**. Mission progress, preferences and vehicle colors are saved in this browser's local storage; **Reset all progress** clears that save after confirmation.

## Scope and scientific notes

Complete the Moon mission to unlock Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus and Neptune. The Moon and Mars use crewed surface objectives; the other destinations use remote payload operations suited to their mission profiles. Interplanetary transfer and probe readings are simplified game scenarios. Vehicle parts, engineering statistics, flight dynamics, suit telemetry, scoring and environmental telemetry are simulated for gameplay. Planetary reference values are approximate context, not a live NASA or other agency data feed. This is not a certified flight simulator.

The interface loads independently of the Three.js scene and shows a fallback message if WebGL initialization fails.
