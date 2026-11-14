# ORBITAL FRONTIER

An educational, browser-based spaceflight game prototype. Design a modular lunar vehicle, run its inspection, launch into a simulated orbit, deploy a science payload and complete lunar EVA objectives.

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
- **EVA controls** — use the on-screen arrows or W / A / S / D to walk

Bindings can be changed in **Settings**. Mission progress and preferences are saved in this browser's local storage; **Reset all progress** clears that save after confirmation.

## Scope and scientific notes

The Moon is the playable mission. Other destinations are listed as future missions. Vehicle parts, engineering statistics, flight dynamics, suit telemetry, scoring and space-weather values are simulated for gameplay. Planetary reference values are approximate context, not a live NASA or other agency data feed. This is not a certified flight simulator.

The interface loads independently of the Three.js scene and shows a fallback message if WebGL initialization fails.
