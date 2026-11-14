import "./style.css";
import { DEFAULT_VEHICLE_COLORS, PARTS, getStats, inspection, loadState, saveState } from "./state.js";

const app = document.querySelector("#app");
const state = loadState();
let scene;
let lastTick = performance.now();
let lastPersistTime = 0;
let lastCountdownDisplay = -1;
let yaw = 0;
let keyCapture = "";
let toastTimer;
let renderedScreen = null;
let renderedPhase = null;
let activeVehicleColorPart = "noseCone";
let draggingColorField = null;

const icons = {
  control: "⌂", missions: "◎", engineering: "⌘", inspection: "▣",
  showcase: "◈", flight: "⌁", exploration: "♧", science: "⌬", history: "▤", settings: "⚙", about: "◌"
};
const navItems = [
  ["control", "Mission control"], ["missions", "Missions"],
  ["engineering", "Engineering"], ["inspection", "Pre-flight"], ["showcase", "Vehicle showcase"],
  ["flight", "Flight"], ["exploration", "Exploration"],
  ["science", "Science center"], ["history", "Mission history"],
  ["settings", "Settings"], ["about", "About"]
];
const vehicleColorParts = [
  { id: "noseCone", name: "Nose cone", detail: "Crew capsule fairing" },
  { id: "crewSection", name: "Crew section", detail: "Upper pressure hull" },
  { id: "mainBody", name: "Main body", detail: "Central vehicle structure" },
  { id: "engine", name: "Main engine", detail: "Engine housing and nozzle" },
  { id: "boosters", name: "Boosters", detail: "Solid booster pair" },
  { id: "fuelTank", name: "Fuel tank", detail: "Cryogenic propellant tank" },
  { id: "fins", name: "Stabilizer fins", detail: "Lower flight surfaces" },
  { id: "landingGear", name: "Landing gear", detail: "Surface landing struts" },
  { id: "solarPanels", name: "Solar panels", detail: "Vehicle and payload arrays" },
  { id: "sciencePayload", name: "Science payload", detail: "Instrument housing" },
  { id: "payloadAntenna", name: "Payload antenna", detail: "Orbital communications dish" }
];
const PLANETS = [
  { name: "Moon", code: "LUNA", grav: "1.62 m/s²", temp: "−173 to 127 °C", type: "SURFACE · CREWED", desc: "Our closest neighbor. A first step for science and a giant leap for this crew.", glyph: "◐" },
  { name: "Mercury", code: "MERCURY", grav: "3.70 m/s²", temp: "−180 to 430 °C", type: "ORBITAL SCIENCE", desc: "A high-temperature survey of the innermost rocky world.", glyph: "◕" },
  { name: "Venus", code: "VENUS", grav: "8.87 m/s²", temp: "≈ 465 °C", type: "ATMOSPHERIC PROBE", desc: "Dense atmosphere, crushing pressure and intense surface heat. Science here is best done from orbit or through the clouds.", glyph: "◉" },
  { name: "Earth", code: "TERRA", grav: "9.81 m/s²", temp: "REFERENCE", type: "LAUNCH & RETURN", desc: "Launch from home base, then test guidance, heat-shield and recovery systems.", glyph: "◉" },
  { name: "Mars", code: "ARES", grav: "3.71 m/s²", temp: "−125 to 20 °C", type: "ROVER · SURFACE", desc: "Red dunes, thin air and a crewed rover expedition across a neighboring world.", glyph: "●" },
  { name: "Jupiter", code: "ZEUS", grav: "24.79 m/s²", temp: "CLOUD TOPS ≈ −110 °C", type: "ORBITER · PROBE", desc: "A radiation-aware orbital mission to the gas giant. No solid surface landing is planned.", glyph: "◉" },
  { name: "Saturn", code: "CRONUS", grav: "10.44 m/s²", temp: "CLOUD TOPS ≈ −140 °C", type: "RING OBSERVATION", desc: "Navigate the ring plane and study a distant ice-and-gas giant from orbit.", glyph: "◉" },
  { name: "Uranus", code: "OURANOS", grav: "8.69 m/s²", temp: "≈ −195 °C", type: "DEEP-SPACE OBSERVATION", desc: "A flyby and atmospheric study of a distant ice giant.", glyph: "◉" },
  { name: "Neptune", code: "POSEIDON", grav: "11.15 m/s²", temp: "≈ −200 °C", type: "DEEP-SPACE OBSERVATION", desc: "An atmospheric observation mission at the far edge of the planetary system.", glyph: "◉" }
];
const MISSION_PROFILES = {
  Moon: {
    mode: "surface", payload: "Lunar Scout-01", operationTitle: "Lunar exploration",
    objectives: [
      { id: "repairArray", title: "Repair communications array", detail: "Restore the surface relay link to mission control.", icon: "⌁", science: 2, oxygen: 12, message: "Communications array repaired. Deep-space link restored." },
      { id: "repairRover", title: "Repair Aster science rover", detail: "Replace a damaged wheel coupling and restore mobility.", icon: "▰", science: 2, oxygen: 16, message: "Aster rover repaired. Mobility and science systems restored." },
      { id: "samples", title: "Collect lunar regolith samples", detail: "Secure a science sample for the return container.", icon: "◇", science: 3, oxygen: 8, message: "Lunar regolith sample secured in return container." }
    ]
  },
  Mercury: {
    mode: "remote", payload: "Hermes Thermal Mapper", operationTitle: "Mercury orbital survey",
    objectives: [
      { id: "thermalMap", title: "Calibrate thermal mapper", detail: "Tune the instrument for Mercury's extreme day-night range.", icon: "⌁", science: 2 },
      { id: "polarScan", title: "Map polar craters", detail: "Survey permanently shadowed regions from orbit.", icon: "◕", science: 2 },
      { id: "spectra", title: "Transmit surface spectra", detail: "Downlink the calibrated mineral observations.", icon: "⌬", science: 3 }
    ]
  },
  Venus: {
    mode: "remote", payload: "Aphrodite Atmospheric Probe", operationTitle: "Venus atmosphere study",
    objectives: [
      { id: "cloudChemistry", title: "Analyze cloud chemistry", detail: "Process the probe's simulated cloud-composition readings.", icon: "⌬", science: 2 },
      { id: "windShear", title: "Measure upper-atmosphere winds", detail: "Compare cloud-top drift across the observation window.", icon: "↟", science: 2 },
      { id: "pressureRelay", title: "Relay pressure profile", detail: "Transmit the probe's pressure and temperature log.", icon: "⌁", science: 3 }
    ]
  },
  Earth: {
    mode: "remote", payload: "Terra Recovery Beacon", operationTitle: "Earth return systems test",
    objectives: [
      { id: "guidanceCheck", title: "Verify return guidance", detail: "Run the simulated navigation solution for re-entry.", icon: "⌁", science: 2 },
      { id: "shieldCheck", title: "Validate heat-shield telemetry", detail: "Review the thermal-protection sensor package.", icon: "◈", science: 2 },
      { id: "recoveryBeacon", title: "Confirm recovery beacon", detail: "Transmit a final signal to the recovery zone.", icon: "⌬", science: 3 }
    ]
  },
  Mars: {
    mode: "surface", payload: "Ares Pathfinder Rover", operationTitle: "Mars surface expedition",
    objectives: [
      { id: "repairArray", title: "Restore the surface relay", detail: "Repair the communications link to the Mars orbiter.", icon: "⌁", science: 2, oxygen: 12, message: "Mars surface relay restored. Orbiter link is nominal." },
      { id: "repairRover", title: "Deploy the Ares rover", detail: "Restore rover mobility for the surface survey.", icon: "▰", science: 2, oxygen: 16, message: "Ares rover deployed. Surface mobility restored." },
      { id: "samples", title: "Collect Martian rock cores", detail: "Secure a geological core for the return container.", icon: "◇", science: 3, oxygen: 8, message: "Martian rock core secured for analysis." }
    ]
  },
  Jupiter: {
    mode: "remote", payload: "Galileo Radiation Probe", operationTitle: "Jovian orbital survey",
    objectives: [
      { id: "radiationMap", title: "Map the radiation environment", detail: "Build a simulated exposure map around the target orbit.", icon: "⬟", science: 2 },
      { id: "stormBands", title: "Survey cloud-top storm bands", detail: "Track major atmospheric features from a safe orbit.", icon: "◉", science: 2 },
      { id: "magnetosphere", title: "Transmit magnetosphere readings", detail: "Downlink the probe's magnetic-field observations.", icon: "⌁", science: 3 }
    ]
  },
  Saturn: {
    mode: "remote", payload: "Cronus Ring Observatory", operationTitle: "Saturn ring survey",
    objectives: [
      { id: "ringImager", title: "Calibrate ring imager", detail: "Set exposure for the bright ring plane and dark space.", icon: "◉", science: 2 },
      { id: "ringGaps", title: "Map ring gaps", detail: "Survey selected gaps and ring boundaries from orbit.", icon: "⌬", science: 2 },
      { id: "ringParticles", title: "Relay particle readings", detail: "Transmit the simulated ring-particle analysis.", icon: "⌁", science: 3 }
    ]
  },
  Uranus: {
    mode: "remote", payload: "Ouranos Flyby Sensor", operationTitle: "Uranus flyby science",
    objectives: [
      { id: "flybyCamera", title: "Calibrate flyby camera", detail: "Prepare the instrument for the closest-approach window.", icon: "◉", science: 2 },
      { id: "magneticField", title: "Measure magnetic-field orientation", detail: "Log the unusual magnetic-field geometry.", icon: "⬟", science: 2 },
      { id: "atmosphericSpectra", title: "Downlink atmospheric spectra", detail: "Transmit the ice-giant atmospheric observations.", icon: "⌁", science: 3 }
    ]
  },
  Neptune: {
    mode: "remote", payload: "Poseidon Deep-Space Probe", operationTitle: "Neptune deep-space survey",
    objectives: [
      { id: "cloudImaging", title: "Image Neptune's cloud systems", detail: "Capture a simulated observation set of major cloud features.", icon: "◉", science: 2 },
      { id: "windReadings", title: "Process wind readings", detail: "Analyze atmospheric motion from the flyby data.", icon: "↟", science: 2 },
      { id: "deepSpaceDownlink", title: "Complete deep-space downlink", detail: "Transmit the science package across the long-range link.", icon: "⌁", science: 3 }
    ]
  }
};
const format = (number, digits = 0) => Number(number || 0).toLocaleString("en-US", { maximumFractionDigits: digits });
const inLoadout = (id) => state.loadout.includes(id);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const missionProfile = (destination = state.destination) => MISSION_PROFILES[destination] || MISSION_PROFILES.Moon;
const isDestinationUnlocked = (destination) => state.progression.unlocked.includes(destination);
function isObjectiveComplete(objective) {
  if (state.missionObjectives?.[objective.id] !== undefined) return Boolean(state.missionObjectives[objective.id]);
  if (state.destination !== "Moon") return false;
  if (objective.id === "samples") return state.astronaut.samples > 0;
  if (objective.id === "repairArray") return state.astronaut.repairedArray;
  if (objective.id === "repairRover") return state.astronaut.repairedRover;
  return false;
}

function hexToHsv(hex) {
  const red = parseInt(hex.slice(1, 3), 16) / 255;
  const green = parseInt(hex.slice(3, 5), 16) / 255;
  const blue = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const difference = max - min;
  let hue = 0;
  if (difference) {
    if (max === red) hue = ((green - blue) / difference) % 6;
    else if (max === green) hue = (blue - red) / difference + 2;
    else hue = (red - green) / difference + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return { hue, saturation: max ? difference / max : 0, value: max };
}

function hsvToHex(hue, saturation, value) {
  const chroma = value * saturation;
  const secondary = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
  const offset = value - chroma;
  const rgb = hue < 60 ? [chroma, secondary, 0]
    : hue < 120 ? [secondary, chroma, 0]
      : hue < 180 ? [0, chroma, secondary]
        : hue < 240 ? [0, secondary, chroma]
          : hue < 300 ? [secondary, 0, chroma]
            : [chroma, 0, secondary];
  return `#${rgb.map((channel) => Math.round((channel + offset) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function setSelectedVehicleColor(color) {
  state.vehicleColors[activeVehicleColorPart] = color;
  if (scene) scene.setVehicleColors(state.vehicleColors);
  const output = document.querySelector("[data-selected-color]");
  const swatch = document.querySelector("[data-color-swatch]");
  const field = document.querySelector("[data-color-field]");
  if (output) output.textContent = color.toUpperCase();
  if (swatch) swatch.style.backgroundColor = color;
  if (field) field.setAttribute("aria-valuetext", color.toUpperCase());
  saveState(state);
}

function updateColorFromPointer(event, field) {
  const bounds = field.getBoundingClientRect();
  const saturation = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
  const value = 1 - clamp((event.clientY - bounds.top) / bounds.height, 0, 1);
  const hue = Number(document.querySelector("[data-picker-hue]")?.value || 0);
  setSelectedVehicleColor(hsvToHex(hue, saturation, value));
}

function getMissionName(destination = state.destination) {
  const missionNames = {
    Moon: "Lunar Frontier",
    Mercury: "Mercury Survey",
    Venus: "Venus Atmosphere",
    Earth: "Terra Return",
    Mars: "Ares Frontier",
    Jupiter: "Jovian Survey",
    Saturn: "Saturn Ring",
    Uranus: "Uranian Survey",
    Neptune: "Poseidon Outbound"
  };
  return `${missionNames[destination] || `${destination} Frontier`} 01`;
}

function shell() {
  app.innerHTML = `
    <header class="topbar">
      <a class="brand" href="#" data-action="navigate" data-screen="control" aria-label="Orbital Frontier mission control">
        <span class="saturn-mark" aria-hidden="true"></span><span class="brand-copy"><b>ORBITAL FRONTIER</b><small>MISSION OPERATIONS</small></span>
      </a>
      <div class="top-center"><span class="live-dot"></span> SYSTEMS NOMINAL <i></i> LOCAL SIM · OFFLINE</div>
      <div class="top-right"><span class="profile-avatar">A</span><span class="profile-name">FLIGHT DIRECTOR<small>CADET · LVL 01</small></span><button class="icon-button" data-action="navigate" data-screen="settings" title="Settings">⚙</button></div>
    </header>
    <aside class="sidebar">
      <div class="nav-label">FLIGHT DECK</div>
      ${navItems.map(([id, title]) => `<button class="nav-item ${state.screen === id ? "active" : ""}" data-action="navigate" data-screen="${id}"><span class="nav-icon">${icons[id]}</span><span>${title}</span>${id === "flight" && ["launch", "flight", "orbit"].includes(state.phase) ? '<span class="nav-live"></span>' : ""}</button>`).join("")}
      <div class="sidebar-bottom"><div class="network-status"><span class="status-ring"></span><span>LOCAL SIM<small>OFFLINE · NO DATA LINK</small></span></div><div class="version">OF · BUILD 0.9.4</div></div>
    </aside>
    <main class="main-area">
      <div id="scene-host"><canvas id="scene-canvas" aria-label="Interactive three-dimensional spacecraft scene"></canvas><div class="scene-loading" id="scene-loading"><span class="loading-ring"></span> INITIALIZING 3D FLIGHT DECK</div><div class="scene-error" id="scene-error"></div><div class="scene-vignette"></div><div class="scene-corner">ORBITAL FRONTIER <span>SIMULATED ENVIRONMENT</span></div></div>
      <section id="screen" class="screen"></section>
    </main>
    <div id="toast" class="toast" role="status" aria-live="polite"></div>
    <div id="modal-root"></div>
  `;
}

function header(eyebrow, title, description = "") {
  const date = new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date()).toUpperCase();
  const time = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }).format(new Date());
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${description ? `<p>${description}</p>` : ""}</div><div class="heading-meta"><span class="mini-status"><b class="live-dot"></b> ${state.phase.toUpperCase()}</span><span>${date} <i>·</i> ${time} UTC</span></div></div>`;
}

function surface(content, extra = "") {
  return `<div class="glass-panel ${extra}">${content}</div>`;
}

function statCard(label, value, unit, icon, tone = "") {
  return `<div class="stat-card"><div class="stat-icon ${tone}">${icon}</div><div class="stat-label">${label}</div><div class="stat-value">${value}<small>${unit}</small></div></div>`;
}

function renderControl() {
  if (state.phase === "complete") {
    const latest = state.progression.missions[state.progression.missions.length - 1];
    const destinationName = state.destination || "Moon";
    const profile = missionProfile(destinationName);
    const unlockedAll = state.progression.unlocked.length === PLANETS.length;
    return `${header("FLIGHT OPERATIONS / DEBRIEF", "Mission accomplished", `${getMissionName(destinationName)} is complete. Your science return is safely logged.`)}
      <div class="results-card glass-panel"><div class="result-seal">✓</div><div class="eyebrow">MISSION DEBRIEF · ${destinationName.toUpperCase()}</div><h2>${profile.mode === "surface" ? "One small step." : "A distant signal."}<br/><em>A whole new frontier.</em></h2><p>${profile.mode === "surface" ? `Pathfinder completed the ${destinationName} surface objectives and secured the science return.` : `${profile.payload} completed its remote science objectives at ${destinationName}.`}</p><div class="result-score"><span>MISSION SCORE</span><b>${format(latest?.score || 0)}<small> PTS</small></b><i>MISSION COMPLETE</i></div><div class="result-grid">${telemetry("OBJECTIVES", `${profile.objectives.length} / ${profile.objectives.length} COMPLETE`)}${telemetry("SCIENCE RETURNED", `${format(state.missionScience)} UNITS`)}${telemetry("FUEL REMAINING", `${format(state.flight.fuel, 1)}%`)}${telemetry(profile.mode === "surface" ? "CREW CONDITION" : "MISSION MODE", profile.mode === "surface" ? `${format(state.astronaut.oxygen)}% O₂ · NOMINAL` : "REMOTE SCIENCE")}</div>${destinationName === "Moon" && unlockedAll ? '<div class="unlock-banner">ALL DESTINATIONS UNLOCKED · YOUR NEXT FRONTIER AWAITS</div>' : ""}<div class="result-actions"><button class="button-primary" data-action="navigate" data-screen="missions">CHOOSE NEXT MISSION <span>↗</span></button><button class="button-quiet" data-action="navigate" data-screen="history">VIEW MISSION LOG →</button></div><div class="science-note"><span>i</span> Flight, score and suit telemetry are simulated for gameplay. Mission record saved locally on this device.</div></div>`;
  }
  const progress = state.phase === "briefing" ? 9 : state.phase === "engineering" ? 24 : state.phase === "inspection" ? 38 : state.phase === "countdown" ? 53 : ["launch", "flight"].includes(state.phase) ? 70 : state.phase === "orbit" ? 82 : state.phase === "complete" ? 100 : 91;
  const phaseLabel = state.phase === "briefing" ? "MISSION BRIEFING" : state.phase === "complete" ? "MISSION COMPLETE" : `${state.phase.toUpperCase()} SEQUENCE`;
  const stats = getStats(state);
  const activeMission = getMissionName();
  return `${header("FLIGHT OPERATIONS / OVERVIEW", "Mission control", `Your next horizon is waiting. ${state.destination} is go for launch.`)}
    <div class="control-grid">
      <div class="control-left">
        <div class="mission-banner"><div class="banner-top"><span class="tag cyan">ACTIVE MISSION</span><span class="mission-id">${state.destination.toUpperCase()} · 2026</span></div><h2>${activeMission.split(" ").slice(0, 2).join("<br/>") || activeMission}<span>01</span></h2><p>Deliver a science payload to ${state.destination}. Deploy, repair, discover.</p><div class="progress-label"><span>${phaseLabel}</span><b>${progress}%</b></div><div class="progress-track"><span style="width:${progress}%"></span></div><button class="button-primary" data-action="continue">CONTINUE MISSION <span>↗</span></button></div>
        <div class="quick-destinations"><div class="section-title">DESTINATIONS <span>${state.progression.unlocked.length} / ${PLANETS.length} UNLOCKED</span></div>${PLANETS.map((planet) => { const unlocked = isDestinationUnlocked(planet.name); return `<button class="destination-mini" data-action="${unlocked ? "select-destination" : "locked-destination"}" data-destination="${planet.name}"><span class="moon-thumb">${planet.glyph}</span><span><b>${planet.name.toUpperCase()}</b><small>${unlocked ? planet.type : "LOCKED · COMPLETE MOON MISSION"}</small></span><span class="arr">${unlocked ? "↗" : "·"}</span></button>`; }).join("")}${state.progression.unlocked.length < PLANETS.length ? '<div class="locked-mini">COMPLETE THE MOON MISSION TO UNLOCK ALL DESTINATIONS</div>' : '<div class="locked-mini">ALL DESTINATIONS AVAILABLE · CHOOSE YOUR NEXT MISSION</div>'}</div>
      </div>
      <div class="control-right">
        ${surface(`<div class="panel-top"><span>VEHICLE STATUS</span><span class="tag ${stats.twr >= 1.1 ? "green" : "amber"}">${stats.twr >= 1.1 ? "GO" : "CHECK"}</span></div><div class="vehicle-name"><span class="vehicle-symbol">▲</span><div><b>PATHFINDER Mk.I</b><small>CREWED EXPLORATION VEHICLE</small></div></div><div class="vehicle-meter"><div class="meter-copy"><span>FLIGHT READINESS</span><b>${stats.twr >= 1.1 ? "86" : "42"}<small>%</small></b></div><div class="meter-line"><i style="width:${stats.twr >= 1.1 ? 86 : 42}%"></i></div></div><div class="vehicle-pairs"><span>STAGE <b>${String(state.flight.stage).padStart(2, "0")}</b></span><span>FUEL <b>${format(state.flight.fuel)}%</b></span></div><button class="button-quiet" data-action="navigate" data-screen="engineering">OPEN VEHICLE ASSEMBLY <span>→</span></button>`)}
        ${surface(`<div class="panel-top"><span>MISSION TIMELINE</span><span class="tag dim">${state.destination.toUpperCase()} · M01</span></div><div class="timeline">${timelineStep("01", "Mission brief", true)}${timelineStep("02", "Vehicle assembly", ["inspection", "countdown", "launch", "flight", "orbit", "operations", "exploration", "complete"].includes(state.phase))}${timelineStep("03", "Launch & transfer", ["launch", "flight", "orbit", "operations", "exploration", "complete"].includes(state.phase))}${timelineStep("04", "Mission science", ["operations", "exploration", "complete"].includes(state.phase))}</div>`)}
      </div>
    </div>
    <div class="bottom-strip">${statCard("TOTAL MASS", `${format(stats.mass, 1)}`, "t", "◧")}${statCard("THRUST / WEIGHT", `${format(stats.twr, 2)}`, "TWR", "↟", "blue")}${statCard("FUEL ONBOARD", `${format(state.flight.fuel)}`, "%", "◉", "amber")}${statCard("MISSION SCORE", `${format(state.progression.score)}`, "PTS", "✧", "violet")}</div>
    <div class="camera-controls"><button data-action="camera-reset" aria-label="Reset camera" title="Reset camera">⊙</button><span>DRAG TO ORBIT · SCROLL TO ZOOM</span><button data-action="camera-mode" title="Switch camera">◫</button></div>`;
}

function timelineStep(number, text, done) {
  return `<div class="timeline-step ${done ? "done" : ""}"><span>${done ? "✓" : number}</span><b>${text}</b><small>${done ? "COMPLETE" : "STANDBY"}</small></div>`;
}

function renderMissions() {
  const destinations = PLANETS.map((world) => ({ ...world, playable: isDestinationUnlocked(world.name) }));
  return `${header("MISSION CATALOG / DESTINATION SELECT", "Choose your horizon", "Read the environment before committing the vehicle. Scientific reference values are shown for context.")}
    <div class="destination-grid">${destinations.map((world, index) => `<article class="planet-card ${state.destination === world.name && world.playable ? "selected" : ""}"><div class="planet-art planet-${world.code.toLowerCase()}"><span>${world.glyph}</span><small>${String(index + 1).padStart(2, "0")} / DESTINATION</small></div><div class="planet-card-body"><div class="planet-title"><h3>${world.name}</h3><span class="tag ${world.playable ? "green" : "dim"}">${world.playable ? "UNLOCKED" : "LOCKED"}</span></div><div class="planet-type">${world.type}</div><p>${world.desc}</p><div class="planet-facts"><span>GRAVITY <b>${world.grav}</b></span><span>TEMPERATURE <b>${world.temp}</b></span></div><button class="button-primary compact" data-action="${world.playable ? "select-destination" : "locked-destination"}" data-destination="${world.name}">${world.playable ? state.destination === world.name ? "SELECTED" : `SELECT ${world.name.toUpperCase()}` : "COMPLETE MOON MISSION"} <span>${world.playable ? "↗" : "·"}</span></button></div></article>`).join("")}</div>
    <div class="science-note"><span>i</span> <b>SCIENTIFIC CONTEXT</b> Planet facts are approximate reference values for educational context, not live mission data. Gameplay telemetry is simulated.</div>`;
}

const categories = ["ALL", "STRUCTURE", "PROPULSION", "SYSTEMS", "LANDING", "PAYLOAD"];
let activeCategory = "ALL";
function renderEngineering() {
  const stats = getStats(state);
  const parts = Object.entries(PARTS).filter(([, part]) => activeCategory === "ALL" || part.category.toUpperCase() === activeCategory);
  return `${header("VEHICLE SYSTEMS / CONFIGURATION", "Engineering workshop", "Every module changes the actual vehicle. Values are an educational gameplay model.")}
    <div class="engineering-grid">
      <div class="component-panel glass-panel"><div class="panel-top"><span>PART CATALOG</span><span class="tag dim">${Object.keys(PARTS).length} MODULES</span></div><div class="category-tabs">${categories.map((category) => `<button data-action="category" data-category="${category}" class="${activeCategory === category ? "active" : ""}">${category}</button>`).join("")}</div><div class="parts-list">${parts.map(([id, part]) => `<button class="part-row ${inLoadout(id) ? "installed" : ""}" data-action="toggle-part" data-part="${id}"><span class="part-glyph">${part.icon}</span><span class="part-info"><b>${part.name}</b><small>${part.description}</small><small class="part-meta">${part.category.toUpperCase()} · ${part.mass} T · SIMULATED</small></span><span class="part-toggle">${inLoadout(id) ? "1" : "0"}</span></button>`).join("")}</div><div class="catalog-foot"><span>MODULE SELECTION</span><b>${state.loadout.length} INSTALLED</b></div></div>
      <div class="assembly-center"><div class="assembly-badge"><span class="live-dot"></span> PATHFINDER Mk.I <small>3D ASSEMBLY VIEW</small></div><div class="assembly-controls"><button data-action="camera-reset" title="Reset camera">⊙</button><button data-action="camera-mode" title="Change camera">◫</button></div><div class="assembly-tip">DRAG · ORBIT <i>SCROLL · ZOOM</i></div></div>
      <div class="stats-panel glass-panel"><div class="panel-top"><span>ENGINEER'S REPORT</span><span class="tag cyan">LIVE</span></div><div class="vehicle-mini"><b>▲ &nbsp; PATHFINDER Mk.I</b><small>CREWED EXPLORATION VEHICLE</small></div><div class="stat-list">${engineeringStat("Total mass", `${format(stats.mass, 1)} t`, "◧")}${engineeringStat("Fuel capacity", `${stats.capacity} t`, "◉")}${engineeringStat("Current fuel", `${format(state.flight.fuel)}%`, "◉")}${engineeringStat("Max thrust", `${format(stats.thrust, 1)} MN`, "↟")}${engineeringStat("Thrust / weight", `${format(stats.twr, 2)}`, "⌁")}${engineeringStat("Est. delta-v", `${format(stats.deltaV)} m/s`, "∆v")}${engineeringStat("Electrical power", `${stats.power} kW`, "ϟ")}${engineeringStat("Thermal protection", `${stats.heat}%`, "◈")}${engineeringStat("Radiation protection", `${stats.radiation}%`, "⬟")}${engineeringStat("Life support", `${stats.life} crew`, "♡")}${engineeringStat("Comm. range", `${stats.comms} kkm`, "⌁")}${engineeringStat("Landing capability", `${stats.landing}%`, "⌑")}</div><div class="stats-disclaimer">SIMULATED VALUES · EDUCATIONAL MODEL</div><button class="button-primary" data-action="to-inspection">RUN PRE-LAUNCH CHECK <span>↗</span></button></div>
    </div>`;
}

function engineeringStat(name, value, icon) {
  return `<div class="engineering-stat"><span>${icon}</span><small>${name}</small><b>${value}</b></div>`;
}

function renderInspection() {
  const result = inspection(state);
  const pass = result.filter((item) => item.ok).length;
  return `${header("FLIGHT READINESS / SYSTEMS TEST", "Pre-launch inspection", "Verify every mission-critical system before the countdown begins.")}
    <div class="inspection-layout"><div class="inspection-summary glass-panel"><div class="summary-icon">${pass === result.length ? "✓" : "!"}</div><div class="eyebrow">VEHICLE READINESS</div><h2>${pass === result.length ? "GO FOR LAUNCH" : "HOLD FOR CHECKS"}</h2><p>${pass} of ${result.length} flight-critical checks passed.</p><div class="progress-track"><span style="width:${pass / result.length * 100}%"></span></div><div class="launch-window"><span>MISSION</span><b>${getMissionName(state.destination)}</b><span>VEHICLE</span><b>PATHFINDER Mk.I</b><span>EST. LIFTOFF</span><b>ON YOUR COMMAND</b></div>${pass === result.length ? '<button class="button-primary" data-action="start-countdown">INITIATE COUNTDOWN <span>↗</span></button>' : '<button class="button-primary disabled" disabled>RESOLVE CRITICAL FAILURES</button>'}<button class="button-quiet" data-action="navigate" data-screen="engineering">← RETURN TO ENGINEERING</button></div><div class="check-list">${result.map((item, index) => `<button class="check-row ${item.ok ? "pass" : "fail"}" data-action="check-detail" data-index="${index}"><span class="check-status">${item.ok ? "✓" : "!"}</span><span><b>${item.name}</b><small>${item.ok ? "System verified · ready for flight" : item.reason}</small></span><span class="check-result">${item.ok ? "PASS" : "FAIL"}</span><span class="check-arrow">›</span></button>`).join("")}<div class="science-note"><span>i</span> Inspection checks are evaluated from the installed spacecraft modules. No launch is allowed while a critical check fails.</div></div></div>`;
}

function renderVehicleShowcase() {
  const selectedColor = state.vehicleColors[activeVehicleColorPart];
  const hsv = hexToHsv(selectedColor);
  return `${header("VEHICLE OBSERVATION / APPEARANCE", "Vehicle showcase", "Inspect Pathfinder from every angle. Drag to orbit, scroll to zoom, or choose a color for each vehicle component.")}
    <div class="showcase-layout">
      <div class="showcase-stage">
        <div class="showcase-readout"><b>PATHFINDER Mk.I</b><span>CREWED LUNAR VEHICLE · 3D ASSEMBLY</span></div>
        <div class="showcase-hint"><span class="live-dot"></span> SLOW AUTO-ROTATION <i>DRAG TO ORBIT · SCROLL TO ZOOM</i></div>
      </div>
      <aside class="showcase-colors glass-panel"><div class="panel-top"><span>VEHICLE FINISH</span><span class="tag cyan">CUSTOM COLOR</span></div><p class="showcase-copy">Select a component, then drag across the color field to choose its finish. Your choices are saved on this device.</p><label class="picker-label" for="vehicle-color-part">COMPONENT</label><select class="component-select" id="vehicle-color-part" data-color-part>${vehicleColorParts.map((part) => `<option value="${part.id}" ${part.id === activeVehicleColorPart ? "selected" : ""}>${part.name}</option>`).join("")}</select><div class="selected-color"><span data-color-swatch style="background-color:${selectedColor}"></span><div><small>SELECTED COLOR</small><output data-selected-color>${selectedColor.toUpperCase()}</output></div></div><div class="color-field" data-color-field style="--picker-hue:${Math.round(hsv.hue)}" role="group" aria-label="Color saturation and brightness" aria-valuetext="${selectedColor.toUpperCase()}" tabindex="0"></div><label class="picker-label hue-label" for="vehicle-color-hue">HUE</label><input class="hue-slider" id="vehicle-color-hue" type="range" min="0" max="359" value="${Math.round(hsv.hue)}" data-picker-hue aria-label="Color hue"/><button class="button-quiet full-width" data-action="reset-vehicle-colors">RESTORE DEFAULT COLORS</button></aside>
    </div>`;
}

function renderFlight() {
  const f = state.flight;
  const stats = getStats(state);
  if (state.phase === "countdown") {
    const remaining = Math.max(0, Math.ceil(f.countdown || 0));
    return `${header("LAUNCH SEQUENCE / L-01", "All stations, go", "Flight director has control. Countdown is live.")}
      <div class="launch-layout"><div class="countdown-card glass-panel"><div class="eyebrow">${getMissionName(state.destination)} · T MINUS</div><div class="count-number">${String(remaining).padStart(2, "0")}</div><div class="count-label">${remaining <= 1 ? "IGNITION SEQUENCE" : "VEHICLE IS GO"}</div><div class="progress-track"><span style="width:${(10 - (f.countdown || 0)) * 10}%"></span></div><div class="count-checks"><span>✓ PROPULSION</span><span>✓ GUIDANCE</span><span>✓ CREW SAFETY</span></div><button class="button-quiet" data-action="abort-countdown">ABORT COUNTDOWN</button></div><div class="launch-stage-spacer" aria-hidden="true"></div><div class="launch-side"><div class="tag amber">SIMULATED LAUNCH</div><h2>PATHFINDER<br/>Mk.I</h2><p>Launch simulation uses a simplified educational flight model. This is not a certified flight simulator.</p></div></div>`;
  }
  if (state.phase === "launch" || state.phase === "flight") {
    return `${header("FLIGHT DYNAMICS / ASCENT", "Powered ascent", "The vehicle is moving. Control throttle and monitor live flight telemetry.")}
      <div class="flight-layout">      <div class="flight-left glass-panel"><div class="panel-top"><span>LIVE TELEMETRY</span><span class="tag green"><i class="live-dot"></i> LIVE</span></div><div class="primary-readout"><span>ALTITUDE</span><b data-flight="altitude"><span>${(f.altitude / 1000).toFixed(1)}</span><small> KM</small></b><div class="altitude-bar"><i style="height:${Math.max(3, Math.min(100, f.altitude / 1000 / 100 * 100))}%"></i></div></div><div class="telemetry-grid">${telemetry("VELOCITY", `${format(f.velocity)} m/s`, "velocity")}${telemetry("ACCELERATION", `${format(f.acceleration, 1)} m/s²`, "acceleration")}${telemetry("FUEL", `${format(f.fuel, 1)}%`, "fuel")}${telemetry("MISSION TIME", `T+ ${format(f.elapsed)} s`, "elapsed")}${telemetry("THROTTLE", `${format(f.throttle * 100)}%`, "throttle")}${telemetry("STAGE", `S-${String(f.stage).padStart(2, "0")}`, "stage")}</div><div class="flight-status"><span class="live-dot"></span><span data-flight="engine-status">${f.fuel > 8 ? "ENGINE NOMINAL" : "LOW FUEL WARNING"}</span><small data-flight="structural">STRUCTURAL LOAD · ${format(Math.max(1, f.acceleration / 9.81), 1)} G</small></div></div><div class="flight-stage-spacer" aria-hidden="true"></div><div class="flight-actions"><div class="tag cyan">MISSION TARGET · ${state.destination.toUpperCase()}</div><h2>${f.altitude >= 100000 ? "ORBITAL INSERTION" : "ASCENT PROFILE"}</h2><p>${f.altitude >= 100000 ? "Target orbit reached. Deploy your science payload." : `Target: 100 km educational orbit for ${state.destination}. Keep the vehicle under control.`}</p><div class="throttle-block"><div><span>ENGINE THROTTLE</span><b data-flight="throttle-control">${format(f.throttle * 100)}%</b></div><input type="range" min="0" max="100" value="${Math.round(f.throttle * 100)}" data-input="throttle" aria-label="Engine throttle"/></div><div class="control-pad"><button data-action="flight-key" data-key="w">▲<small>THROTTLE</small></button><div><button data-action="flight-key" data-key="a">◀</button><button data-action="flight-key" data-key="s">▼</button><button data-action="flight-key" data-key="d">▶</button></div></div><div class="button-row"><button class="button-quiet" data-action="stage">B · SEPARATE STAGE</button><button class="button-quiet" data-action="camera-reset">RESET VIEW</button></div></div></div><div class="flight-key-hint">FLIGHT CONTROLS <b>W</b> THROTTLE <b>A / D</b> YAW <b>S</b> CUT ENGINE <b>B</b> STAGE · MOUSE DRAG / ZOOM CAMERA</div>`;
  }
  if (state.phase === "orbit") {
    const profile = missionProfile();
    return `${header("ORBITAL OPERATIONS / PAYLOAD", "Orbit achieved", "A stable educational orbit. Deploy the destination-specific science payload to continue.")}
      <div class="orbit-layout"><div class="orbit-card glass-panel"><div class="orbit-success"><span>✓</span> ORBIT INSERTION SUCCESSFUL</div><h2>${state.destination}<br/><em>is in reach.</em></h2><p>Pathfinder reached the target orbital band. Deploy ${profile.payload}, then begin ${profile.mode === "surface" ? "the crewed surface mission" : "remote science operations"}.</p><div class="orbit-facts"><span>ORBITAL ALTITUDE<b>${(f.altitude / 1000).toFixed(1)} km</b></span><span>CREW STATUS<b>NOMINAL · 3 / 3</b></span><span>PAYLOAD LINK<b>${f.deployed ? "ACTIVE" : "STANDBY"}</b></span></div>${f.deployed ? `<button class="button-primary" data-action="begin-eva">${profile.mode === "surface" ? "BEGIN SURFACE EVA" : "BEGIN SCIENCE OPS"} <span>↗</span></button>` : '<button class="button-primary" data-action="deploy-payload">DEPLOY SCIENCE PAYLOAD <span>↗</span></button>'}</div><div class="orbit-stage-spacer" aria-hidden="true"></div><div class="orbit-side glass-panel"><div class="panel-top"><span>ORBITAL ASSETS</span><span class="tag cyan">1 SPACECRAFT</span></div><div class="asset-row"><span class="asset-icon">▲</span><span><b>PATHFINDER Mk.I</b><small>CREWED VEHICLE · NOMINAL</small></span><span class="asset-dot green-dot"></span></div><div class="asset-row ${f.deployed ? "" : "muted"}"><span class="asset-icon">▦</span><span><b>${profile.payload.toUpperCase()}</b><small>${f.deployed ? "PAYLOAD · COMMUNICATIONS ACTIVE" : "SCIENCE PAYLOAD · STOWED"}</small></span><span class="asset-dot ${f.deployed ? "green-dot" : ""}"></span></div><div class="science-note"><span>i</span> Payload deployment is a one-way mission event. After deploying, you can focus the camera on the new orbital asset.</div><button class="button-quiet full-width" data-action="camera-mode">◫ &nbsp; SWITCH CAMERA FOCUS</button></div></div>`;
  }
  return `${header("FLIGHT DYNAMICS / ASCENT", "Flight systems standby", "Complete mission selection and engineering before launch.")}
    <div class="empty-state glass-panel"><span class="empty-mark">⌁</span><h2>Flight deck is waiting.</h2><p>Select a destination and configure the spacecraft to begin.</p><button class="button-primary" data-action="navigate" data-screen="missions">SELECT A MISSION <span>↗</span></button></div>`;
}

function telemetry(label, value, field = "") {
  return `<div class="telemetry-cell"><span>${label}</span><b ${field ? `data-flight="${field}"` : ""}>${value}</b></div>`;
}

function renderExploration() {
  const profile = missionProfile();
  const activePhase = profile.mode === "surface" ? "exploration" : "operations";
  if (state.phase !== activePhase) {
    const canBegin = state.phase === "orbit" && state.flight.deployed;
    const operationLabel = profile.mode === "surface" ? "surface expedition" : "remote science operations";
    const message = state.phase === "complete" ? `This ${state.destination} mission is complete. Review your debrief or choose another destination.` : canBegin ? `The payload is deployed and the vehicle is stable in orbit. Begin ${operationLabel}.` : "Complete launch and deploy the science payload before starting mission operations.";
    return `${header(`MISSION OPERATIONS / ${state.destination.toUpperCase()}`, "Mission operations", "Mission activities unlock after successful orbital insertion and payload deployment.")}
      <div class="empty-state glass-panel"><span class="empty-mark">♧</span><h2>${canBegin ? "Mission is go." : state.phase === "complete" ? "Mission complete." : "Awaiting orbital insertion."}</h2><p>${message}</p>${canBegin ? '<button class="button-primary" data-action="begin-eva">BEGIN MISSION OPERATIONS <span>↗</span></button>' : state.phase === "complete" ? '<button class="button-primary" data-action="navigate" data-screen="missions">CHOOSE NEXT MISSION <span>↗</span></button>' : '<button class="button-primary" data-action="navigate" data-screen="flight">OPEN FLIGHT DECK <span>↗</span></button>'}</div>`;
  }
  const completed = profile.objectives.filter(isObjectiveComplete).length;
  const objectiveList = `<div class="panel-top"><span>${profile.mode === "surface" ? "SURFACE OBJECTIVES" : "SCIENCE OBJECTIVES"}</span><span class="tag cyan">${completed} / ${profile.objectives.length} COMPLETE</span></div><div class="objective-list">${profile.objectives.map((item, index) => {
    const done = isObjectiveComplete(item);
    const actionLabel = profile.mode !== "surface" ? "ANALYZE" : item.id === "samples" ? "COLLECT" : item.id === "repairRover" ? "RESTORE" : "REPAIR";
    return `<div class="objective-row ${done ? "done" : ""}"><span class="objective-number">${done ? "✓" : `0${index + 1}`}</span><span class="objective-icon">${item.icon}</span><span class="objective-copy"><b>${item.title}</b><small>${item.detail}</small></span>${done ? '<span class="tag green">DONE</span>' : `<button class="button-small" data-action="mission-objective" data-objective="${item.id}">${actionLabel} ↗</button>`}</div>`;
  }).join("")}</div><div class="objective-footer"><div class="progress-label"><span>MISSION SCIENCE RETURN</span><b>${Math.round(completed / profile.objectives.length * 100)}%</b></div><div class="progress-track"><span style="width:${completed / profile.objectives.length * 100}%"></span></div>${completed === profile.objectives.length ? '<button class="button-primary" data-action="complete-mission">COMPLETE MISSION <span>↗</span></button>' : '<div class="hint-line">Complete all mission objectives to record your science return.</div>'}</div>`;
  if (profile.mode !== "surface") {
    return `${header(`REMOTE SCIENCE / ${state.destination.toUpperCase()}`, profile.operationTitle, `Deploy ${profile.payload} and complete its destination-specific science program.`)}
      <div class="mission-ops-layout"><div class="mission-ops-brief glass-panel"><div class="panel-top"><span>MISSION PAYLOAD</span><span class="tag green">LINK ACTIVE</span></div><div class="mission-ops-symbol">${PLANETS.find((planet) => planet.name === state.destination)?.glyph || "◉"}</div><h2>${profile.payload}</h2><p>${PLANETS.find((planet) => planet.name === state.destination)?.desc || ""}</p><div class="orbit-facts"><span>DESTINATION<b>${state.destination}</b></span><span>GRAVITY<b>${PLANETS.find((planet) => planet.name === state.destination)?.grav || "—"}</b></span><span>PAYLOAD<b>DEPLOYED</b></span></div><div class="science-note"><span>i</span> This is a simplified educational mission scenario. Interplanetary transfer time, environments and probe readings are simulated, not live data.</div></div><div class="objectives-panel glass-panel">${objectiveList}</div></div>`;
  }
  const a = state.astronaut;
  return `${header(`SURFACE OPERATIONS / ${state.destination.toUpperCase()}`, `${state.destination} exploration`, `Walk the surface, complete field objectives and secure a science return. Suit values are game simulations.`)}
    <div class="eva-layout"><div class="eva-left glass-panel"><div class="panel-top"><span>CREW MEMBER · EVA 01</span><span class="tag ${a.oxygen > 20 ? "green" : "amber"}">SUIT ACTIVE</span></div><div class="astronaut-profile"><div class="astronaut-avatar"><span>◉</span><i>OF</i></div><div><div class="eyebrow">MISSION SPECIALIST</div><h2>${state.destination.toUpperCase()} EXPLORER</h2><p>AXIOM-CLASS EXPLORATION SUIT</p></div></div><div class="suit-gauges">${gauge("SUIT OXYGEN", a.oxygen, "%", "cyan")}${gauge("HEALTH", a.health, "%", "green")}${gauge("CABIN LINK", 100, "%", "blue")}</div><div class="eva-controls"><span>WALK THE SURFACE</span><div><button data-action="move-astronaut" data-direction="left">←</button><button data-action="move-astronaut" data-direction="forward">↑</button><button data-action="move-astronaut" data-direction="back">↓</button><button data-action="move-astronaut" data-direction="right">→</button></div></div><button class="button-quiet full-width" data-action="return-to-capsule">RETURN TO SPACECRAFT · RESTORE O₂</button><p class="suit-note">GAME SIMULATION · NOT MEDICAL OR EVA GUIDANCE</p></div><div class="objectives-panel glass-panel">${objectiveList}</div></div>`;
}

function gauge(label, value, unit, color) {
  return `<div class="gauge"><div><span>${label}</span><b>${format(value)}${unit}</b></div><div class="meter-line ${color}"><i style="width:${value}%"></i></div></div>`;
}

function renderScience() {
  const world = PLANETS.find((planet) => planet.name === state.destination) || PLANETS[0];
  const profile = missionProfile();
  const completedObjectives = profile.objectives.filter(isObjectiveComplete).length;
  const environment = {
    Moon: ["Low · vacuum", "Weak local field"],
    Mercury: ["High · solar proximity", "Weak local field"],
    Venus: ["High · atmospheric", "Weak induced field"],
    Earth: ["Low · orbital", "Strong global field"],
    Mars: ["Moderate · surface", "Weak global field"],
    Jupiter: ["Very high · radiation belts", "Strong magnetosphere"],
    Saturn: ["Moderate · ring plane", "Strong magnetosphere"],
    Uranus: ["Moderate · flyby", "Tilted magnetosphere"],
    Neptune: ["Moderate · flyby", "Strong magnetosphere"]
  }[world.name] || ["Scenario data", "Scenario model"];
  const sections = [
    ["SPACE WEATHER", "EDUCATIONAL MODEL", "Local conditions", "SIMULATED", environment[0], "Magnetic field", "SIMULATED", environment[1]],
    ["RADIATION", "EDUCATIONAL MODEL", "Mission exposure index", "SIMULATED", environment[0], "Shielding installed", "VEHICLE CONFIG", `${getStats(state).radiation}% modeled protection`],
    ["PLANET DATABASE", "REFERENCE", `${world.name} gravity`, "REFERENCE", world.grav, "Environment", "MISSION TYPE", profile.mode === "surface" ? "Crewed surface" : profile.operationTitle],
    ["MISSION SCIENCE", "MISSION DATA", "Objectives complete", "MISSION STATE", `${completedObjectives} / ${profile.objectives.length}`, "Payload", "MISSION CONFIG", profile.payload],
    ["ENGINEERING", "LIVE CONFIG", "Vehicle mass", "SIMULATED", `${format(getStats(state).mass, 1)} t`, "Electrical power", "SIMULATED", `${getStats(state).power} kW`],
    ["MISSION NAVIGATION", "SIMULATED", "Destination", "MISSION STATE", state.destination, "Current phase", "MISSION STATE", state.phase.toUpperCase()]
  ];
  return `${header("RESEARCH & TELEMETRY / DATA CENTER", "Science center", "An honest view of reference science and simulated mission telemetry.")}
    <div class="science-grid">${sections.map(([title, status, label1, type1, val1, label2, type2, val2], index) => `<article class="science-card glass-panel"><div class="panel-top"><span>${title}</span><span class="tag ${index < 3 ? "cyan" : "dim"}">${status}</span></div><div class="science-orbit">${["◉", "ϟ", "◐", "⌬", "⌘", "⌁"][index]}</div><div class="science-data-row"><span>${label1}<small>${type1}</small></span><b>${val1}</b></div><div class="science-data-row"><span>${label2}<small>${type2}</small></span><b>${val2}</b></div></article>`).join("")}</div>
    <div class="science-note"><span>i</span> <b>DATA INTEGRITY</b> Planetary reference values are approximate public scientific references. All vehicle, weather and exposure telemetry marked SIMULATED is fictional gameplay data, not NASA measurements. No live external data feed is connected.</div>`;
}

function renderHistory() {
  const missions = [...state.progression.missions].reverse();
  const records = missions.length
    ? `<div class="history-table"><div class="table-head"><span>MISSION</span><span>DESTINATION</span><span>RESULT</span><span>SCORE</span><span>DATE</span></div>${missions.map((mission) => `<div class="table-row"><b>${mission.name}</b><span>${mission.destination}</span><span class="tag green">COMPLETE</span><b>${format(mission.score)} PTS</b><span>${mission.date}</span></div>`).join("")}</div>`
    : `<div class="empty-records"><span>▤</span><b>No flight records yet</b><p>Complete your first mission to create a record.</p><button class="button-quiet" data-action="navigate" data-screen="missions">SELECT A MISSION →</button></div>`;
  return `${header("FLIGHT RECORDS / PLAYER PROGRESSION", "Mission history", "Every completed sortie is saved locally in this browser.")}
    <div class="history-overview">${statCard("MISSIONS FLOWN", `${missions.length}`, "SORTIES", "◎")}${statCard("CAREER SCORE", `${format(state.progression.score)}`, "PTS", "✧", "violet")}${statCard("SCIENCE RETURNED", `${format(state.progression.science)}`, "UNITS", "⌬", "blue")}</div>
    ${surface(`<div class="panel-top"><span>MISSION LOG</span><span class="tag dim">${missions.length} RECORDS</span></div>${records}<div class="save-note">◈ &nbsp; PROGRESS STORED LOCALLY ON THIS DEVICE</div>`)}
  `;
}

function renderSettings() {
  const settings = state.settings;
  return `${header("SYSTEM PREFERENCES / ACCESSIBILITY", "Settings", "Tune the simulation to your system and your play style.")}
    <div class="settings-grid"><div class="settings-main glass-panel"><div class="panel-top"><span>GRAPHICS & AUDIO</span><span class="tag cyan">LOCAL</span></div><div class="setting-row"><span><b>Graphics quality</b><small>Adjust rendering detail and pixel ratio.</small></span><select data-input="quality"><option ${settings.quality === "Low" ? "selected" : ""}>Low</option><option ${settings.quality === "Medium" ? "selected" : ""}>Medium</option><option ${settings.quality === "High" ? "selected" : ""}>High</option><option ${settings.quality === "Ultra" ? "selected" : ""}>Ultra</option></select></div><div class="setting-row"><span><b>Master volume</b><small>Sound effects are generated by the browser.</small></span><div class="range-control"><input type="range" min="0" max="100" value="${settings.volume}" data-input="volume" aria-label="Master volume"/><b>${settings.volume}%</b></div></div><div class="setting-row"><span><b>Audio</b><small>Enable or mute game feedback.</small></span><button class="toggle ${settings.mute ? "" : "on"}" data-action="mute" role="switch" aria-checked="${!settings.mute}"><i></i><span>${settings.mute ? "MUTED" : "ON"}</span></button></div><div class="panel-top second-title"><span>FLIGHT KEY BINDINGS</span><span class="tag dim">CLICK TO REMAP</span></div><div class="keybind-list">${Object.entries(settings.controls).map(([key, value]) => `<div class="keybind-row"><span>${{ pitchUp: "Throttle up", pitchDown: "Throttle down", yawLeft: "Yaw left", yawRight: "Yaw right", stage: "Separate stage" }[key]}</span><button data-action="remap-key" data-binding="${key}" class="keycap">${keyCapture === key ? "PRESS KEY…" : value.toUpperCase()}</button></div>`).join("")}</div></div><div class="settings-side glass-panel"><div class="panel-top"><span>SAVE DATA</span><span class="tag green">LOCAL</span></div><div class="save-emblem">◈</div><h3>Progress is on this device.</h3><p>Your spacecraft, mission state and completed records are saved to this browser automatically.</p><div class="save-details"><span>PROFILE <b>FLIGHT DIRECTOR</b></span><span>DESTINATION <b>${state.destination.toUpperCase()}</b></span><span>MISSIONS <b>${state.progression.missions.length}</b></span><span>STORAGE <b>LOCAL STORAGE</b></span></div><button class="button-danger" data-action="reset">RESET ALL PROGRESS</button><small class="warning-copy">This permanently removes local save data.</small></div></div>`;
}

function renderAbout() {
  return `${header("ABOUT / FLIGHT PROGRAM", "Beyond Earth. Beyond limits.", "A small step into a much larger universe.")}
    <div class="about-card glass-panel"><div class="saturn-mark about-emblem" aria-hidden="true"></div><div class="eyebrow">AN EDUCATIONAL SPACEFLIGHT GAME</div><h2>Design. Build. Launch.<br/><em>Fly. Explore. Discover.</em></h2><p>ORBITAL FRONTIER is a playable browser prototype about the people, engineering and science behind a mission. Complete the Moon expedition to unlock eight more destination-specific surface and remote-science missions.</p><div class="about-pills"><span>THREE.JS 3D</span><span>SIMULATED PHYSICS</span><span>LOCAL SAVE</span><span>9 DESTINATIONS</span></div><div class="science-note"><span>i</span> This is a fictional educational game. Vehicle systems and gameplay telemetry are simulated; planetary reference values are approximate. Interplanetary transfer and remote readings are simplified scenarios, not live data. It is not a professional simulator or real mission-control tool.</div><button class="button-primary" data-action="continue">CONTINUE MISSION <span>↗</span></button></div>`;
}

function render() {
  const screen = document.querySelector("#screen");
  if (!screen) return;
  if (state.screen !== renderedScreen || state.phase !== renderedPhase) screen.scrollTop = 0;
  renderedScreen = state.screen;
  renderedPhase = state.phase;
  const pages = {
    control: renderControl, missions: renderMissions, engineering: renderEngineering,
    inspection: renderInspection, showcase: renderVehicleShowcase, flight: renderFlight, exploration: renderExploration,
    science: renderScience, history: renderHistory, settings: renderSettings, about: renderAbout
  };
  screen.innerHTML = (pages[state.screen] || renderControl)();
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.screen === state.screen));
  document.querySelector("#scene-host")?.classList.toggle("showcase-mode", state.screen === "showcase");
  if (scene) scene.update(state);
  saveState(state);
}

function navigate(screen) {
  if (screen === "inspection" && !["engineering", "inspection"].includes(state.phase)) {
    showToast("Select an unlocked mission and configure the vehicle before inspection.");
    return;
  }
  if (screen === "flight" && ["briefing", "engineering", "inspection"].includes(state.phase)) {
    state.notice = "Complete pre-launch checks before entering the flight deck.";
    showToast(state.notice);
    return;
  }
  state.screen = screen;
  render();
}

function beginMission(destination = state.destination || "Moon") {
  const target = PLANETS.find((planet) => planet.name === destination) || PLANETS[0];
  if (!isDestinationUnlocked(target.name)) {
    showToast("Complete the Moon mission to unlock all destinations.");
    return;
  }
  state.destination = target.name;
  state.phase = "engineering";
  state.screen = "engineering";
  state.flight = { altitude: 0, velocity: 0, fuel: 100, throttle: 0, elapsed: 0, stage: 1, acceleration: 0, deployed: false, countdown: 10 };
  state.astronaut = { oxygen: 100, health: 100, fatigue: 0, repairedArray: false, repairedRover: false, samples: 0, x: 3.6, z: 0 };
  state.missionObjectives = {};
  state.missionScience = 0;
  activeCategory = "ALL";
  const missionLabel = getMissionName(target.name);
  showToast(`${missionLabel} initialized. Configure your vehicle.`);
  render();
}

function launchCountdown() {
  if (state.phase !== "inspection") {
    showToast("Select and configure a mission before starting the countdown.");
    return;
  }
  if (!state.loadout.includes("panels")) {
    showToast("Install a solar array before deploying the orbital science payload.");
    return;
  }
  const failures = inspection(state).filter((item) => !item.ok);
  if (failures.length) {
    showToast(`Launch hold: ${failures.map((item) => item.name).join(", ")}.`);
    return;
  }
  state.phase = "countdown";
  state.screen = "flight";
  state.flight.countdown = 10;
  playTone(440, 0.12);
  render();
}

function startFlight() {
  state.phase = "flight";
  state.flight.throttle = 0.88;
  state.flight.elapsed = 0;
  state.screen = "flight";
  playTone(110, 0.65);
  showToast("LIFTOFF — Pathfinder is climbing.");
  render();
}

function tick() {
  const now = performance.now();
  const dt = Math.min((now - lastTick) / 1000, 0.3);
  lastTick = now;
  if (state.phase === "countdown") {
    state.flight.countdown = Math.max(0, state.flight.countdown - dt);
    if (state.flight.countdown === 0) startFlight();
    else if (Math.ceil(state.flight.countdown) !== lastCountdownDisplay) {
      lastCountdownDisplay = Math.ceil(state.flight.countdown);
      render();
    }
    return;
  }
  if (state.phase !== "flight" && state.phase !== "launch") return;
  const stats = getStats(state);
  if (state.flight.fuel <= 0 || !stats.engine) {
    state.flight.throttle = 0;
    state.flight.acceleration = -1.62;
    state.flight.velocity = Math.max(0, state.flight.velocity + state.flight.acceleration * dt);
  } else {
    const actualThrust = stats.thrust * (state.flight.stage === 1 ? 1 : (inLoadout("engine") ? 1 : 0)) * state.flight.throttle;
    state.flight.acceleration = actualThrust / Math.max(stats.mass, 10) * 1000 - 9.81;
    state.flight.velocity = Math.max(0, state.flight.velocity + state.flight.acceleration * dt);
    state.flight.fuel = Math.max(0, state.flight.fuel - Math.max(stats.fuelRate, 30) / 1000 * dt);
  }
  state.flight.altitude = Math.max(0, state.flight.altitude + state.flight.velocity * dt);
  state.flight.elapsed += dt;
  updateFlightHUD();
  if (scene) scene.update(state);
  if (now - lastPersistTime >= 1000) {
    lastPersistTime = now;
    saveState(state);
  }
  if (state.flight.altitude >= 100000) {
    state.flight.altitude = Math.max(100000, state.flight.altitude);
    state.phase = "orbit";
    state.flight.throttle = 0;
    state.screen = "flight";
    showToast("Target orbital band reached. Payload operations are go.");
    playTone(680, 0.25);
    render();
  }
}

function updateFlightHUD() {
  const screen = document.querySelector("#screen");
  if (!screen) return;
  const value = (field, text) => {
    const element = screen.querySelector(`[data-flight="${field}"]`);
    if (element) {
      if (field === "altitude") element.querySelector("span").textContent = text;
      else element.textContent = text;
    }
  };
  const flight = state.flight;
  value("altitude", (flight.altitude / 1000).toFixed(1));
  value("velocity", `${format(flight.velocity)} m/s`);
  value("acceleration", `${format(flight.acceleration, 1)} m/s²`);
  value("fuel", `${format(flight.fuel, 1)}%`);
  value("elapsed", `T+ ${format(flight.elapsed)} s`);
  value("throttle", `${format(flight.throttle * 100)}%`);
  value("throttle-control", `${format(flight.throttle * 100)}%`);
  value("stage", `S-${String(flight.stage).padStart(2, "0")}`);
  value("engine-status", flight.fuel > 8 ? "ENGINE NOMINAL" : "LOW FUEL WARNING");
  value("structural", `STRUCTURAL LOAD · ${format(Math.max(1, flight.acceleration / 9.81), 1)} G`);
  const altitude = screen.querySelector(".altitude-bar i");
  if (altitude) altitude.style.height = `${Math.max(3, Math.min(100, flight.altitude / 1000))}%`;
}

function deployPayload() {
  if (state.phase !== "orbit" || state.flight.deployed) return;
  state.flight.deployed = true;
  state.progression.science += 1;
  state.missionScience += 1;
  playTone(560, 0.18);
  showToast(`${missionProfile().payload} deployed. Mission link active.`);
  render();
}

function beginEVA() {
  if (!state.flight.deployed) {
    showToast("Deploy the science payload before surface operations.");
    return;
  }
  state.phase = missionProfile().mode === "surface" ? "exploration" : "operations";
  state.screen = "exploration";
  if (missionProfile().mode === "surface") {
    state.astronaut.oxygen = 100;
    showToast("Surface team is go. EVA suit systems nominal.");
  } else {
    showToast(`${missionProfile().operationTitle} is go. Remote science link nominal.`);
  }
  playTone(340, 0.13);
  render();
}

function completeMissionObjective(objectiveId) {
  const profile = missionProfile();
  const activePhase = profile.mode === "surface" ? "exploration" : "operations";
  if (state.phase !== activePhase) {
    showToast("Mission operations are not active.");
    return;
  }
  const objective = profile.objectives.find((item) => item.id === objectiveId);
  if (!objective || isObjectiveComplete(objective)) return;
  if (profile.mode === "surface" && state.astronaut.oxygen < 5) {
    showToast("EVA paused: return to the spacecraft to restore suit oxygen.");
    return;
  }
  state.missionObjectives[objective.id] = true;
  if (profile.mode === "surface") {
    state.astronaut.oxygen = Math.max(0, state.astronaut.oxygen - (objective.oxygen || 0));
    if (objective.id === "repairArray") state.astronaut.repairedArray = true;
    if (objective.id === "repairRover") state.astronaut.repairedRover = true;
    if (objective.id === "samples") state.astronaut.samples = 1;
  }
  state.progression.science += objective.science;
  state.missionScience += objective.science;
  showToast(objective.message || `${objective.title} complete. Science data recorded.`);
  playTone(520, 0.12);
  render();
}

function completeMission() {
  const profile = missionProfile();
  const activePhase = profile.mode === "surface" ? "exploration" : "operations";
  if (state.phase !== activePhase) {
    showToast("Mission results have already been recorded.");
    return;
  }
  if (!profile.objectives.every(isObjectiveComplete)) {
    showToast("Complete all mission objectives before closing the mission.");
    return;
  }
  const score = Math.round(1000 + state.flight.fuel * 4 + state.missionScience * 150 + (profile.mode === "surface" && state.astronaut.oxygen > 20 ? 300 : 0));
  const record = { name: getMissionName(state.destination), destination: state.destination, score, date: new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date()) };
  state.progression.missions.push(record);
  state.progression.score += score;
  if (state.destination === "Moon") {
    state.progression.unlocked = PLANETS.map((planet) => planet.name);
  }
  state.phase = "complete";
  state.screen = "control";
  state.notice = state.destination === "Moon"
    ? `Moon mission complete · all destinations unlocked · ${format(score)} points earned.`
    : `${state.destination} mission complete · ${format(score)} points earned.`;
  showToast(state.notice);
  playTone(784, 0.4);
  render();
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3300);
}

let audioContext;
let ambientInterval = null;
let ambientOscillators = [];

function stopAmbientLoop() {
  if (ambientInterval) {
    clearInterval(ambientInterval);
    ambientInterval = null;
  }
  ambientOscillators.forEach((oscillator) => {
    try {
      oscillator.stop();
    } catch (error) {
      // Oscilloscope is already stopped or not running.
    }
  });
  ambientOscillators = [];
}

function startAmbientLoop() {
  if (state.settings.mute || state.settings.volume === 0 || !audioContext || audioContext.state !== "running") return;
  if (ambientInterval) return;

  const notes = [174.61, 220, 261.63, 329.63];
  const master = audioContext.createGain();
  master.gain.value = Math.min(state.settings.volume / 1200, 0.015);
  master.connect(audioContext.destination);

  const oscillators = [
    audioContext.createOscillator(),
    audioContext.createOscillator()
  ];

  oscillators.forEach((oscillator, index) => {
    oscillator.type = "sine";
    oscillator.frequency.value = notes[index];
    oscillator.connect(master);
    oscillator.start();
  });
  ambientOscillators = oscillators;

  let index = 0;
  ambientInterval = window.setInterval(() => {
    if (!audioContext || state.settings.mute || state.settings.volume === 0) return;
    const base = notes[index % notes.length];
    oscillators[0].frequency.setTargetAtTime(base, audioContext.currentTime, 1.2);
    oscillators[1].frequency.setTargetAtTime(base * 2, audioContext.currentTime, 1.2);
    index += 1;
  }, 2600);
}

async function ensureAudio() {
  if (state.settings.mute || state.settings.volume === 0) return;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;
  if (!audioContext) {
    audioContext = new AudioCtor();
  }
  if (audioContext.state === "suspended") {
    try {
      await audioContext.resume();
    } catch (error) {
      console.warn("Audio context could not resume.", error);
    }
  }
  if (audioContext.state === "running") {
    startAmbientLoop();
  }
}

function playTone(frequency, duration) {
  if (state.settings.mute || state.settings.volume === 0) return;
  try {
    ensureAudio();
    const context = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    if (context.state === "suspended") return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.value = Math.min(state.settings.volume / 400, 0.08);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  } catch (error) {
    console.warn("Audio feedback is unavailable.", error);
  }
}

function action(actionName, target) {
  switch (actionName) {
    case "navigate": navigate(target.screen); break;
    case "continue":
      if (state.phase === "briefing") navigate("missions");
      else if (state.phase === "complete") navigate("history");
      else navigate(state.phase === "engineering" ? "engineering" : ["countdown", "flight", "orbit"].includes(state.phase) ? "flight" : state.phase === "inspection" ? "inspection" : "exploration");
      break;
    case "select-moon": beginMission(); break;
    case "select-destination": beginMission(target.destination || state.destination); break;
    case "locked-destination": showToast("Complete the Moon mission to unlock all destinations."); break;
    case "category": activeCategory = target.category; render(); break;
    case "toggle-part": {
      if (!["engineering", "inspection", "briefing"].includes(state.phase)) { showToast("Vehicle configuration is locked after countdown begins."); break; }
      const id = target.part;
      state.loadout = inLoadout(id) ? state.loadout.filter((part) => part !== id) : [...state.loadout, id];
      if (state.phase === "inspection") state.phase = "engineering";
      render();
      break;
    }
    case "to-inspection": {
      if (state.phase !== "engineering") {
        showToast("Complete mission selection and engineering first.");
        break;
      }
      state.phase = "inspection"; state.screen = "inspection"; render(); break;
    }
    case "start-countdown": launchCountdown(); break;
    case "abort-countdown": state.phase = "inspection"; state.screen = "inspection"; showToast("Countdown aborted. Vehicle remains ready."); render(); break;
    case "stage":
      if (state.phase !== "flight" || state.flight.stage !== 1) { showToast("No active first-stage hardware to separate."); break; }
      if (!inLoadout("booster")) { showToast("No jettisonable booster pair is installed."); break; }
      state.loadout = state.loadout.filter((id) => id !== "booster");
      state.flight.stage = 2;
      playTone(180, 0.35);
      showToast("Booster pair separated. Core stage continuing.");
      render();
      break;
    case "deploy-payload": deployPayload(); break;
    case "begin-eva": beginEVA(); break;
    case "return-to-capsule":
      if (state.phase !== "exploration") break;
      state.phase = "orbit";
      state.screen = "flight";
      state.astronaut.oxygen = 100;
      showToast("Crew returned to the capsule. Suit oxygen restored.");
      render();
      break;
    case "mission-objective": completeMissionObjective(target.objective); break;
    case "repair-array": completeMissionObjective("repairArray"); break;
    case "repair-rover": completeMissionObjective("repairRover"); break;
    case "collect-sample": completeMissionObjective("samples"); break;
    case "complete-mission": completeMission(); break;
    case "move-astronaut":
      if (state.phase !== "exploration") break;
      state.astronaut.oxygen = Math.max(0, state.astronaut.oxygen - 1);
      showToast(`Explorer moved ${target.direction}. Suit oxygen ${format(state.astronaut.oxygen)}%.`);
      state.astronaut.x = Math.max(-7, Math.min(7, state.astronaut.x + (target.direction === "left" ? -0.5 : target.direction === "right" ? 0.5 : 0)));
      state.astronaut.z = Math.max(-7, Math.min(7, state.astronaut.z + (target.direction === "forward" ? -0.5 : target.direction === "back" ? 0.5 : 0)));
      render();
      break;
    case "camera-reset":
      if (scene) { scene.camera.position.set(13, 9, 20); scene.controls.target.set(0, 0.4, 0); scene.controls.update(); }
      else { showToast("3D camera is still initializing."); break; }
      showToast("Camera view reset.");
      break;
    case "camera-mode":
      if (!scene) { showToast("3D camera is still initializing."); break; }
      const isOrbit = state.phase === "orbit" || state.flight.deployed;
      scene.camera.position.set(isOrbit ? 4 : 15, isOrbit ? 7 : 6, isOrbit ? 11 : 25);
      scene.controls.target.set(isOrbit ? 1.5 : 0, isOrbit ? 4 : 0, 0);
      scene.controls.update();
      showToast("Camera focus changed. Drag to orbit, scroll to zoom.");
      break;
    case "flight-key": handleFlightKey(target.key); break;
    case "check-detail": {
      const item = inspection(state)[Number(target.index)];
      showToast(item.ok ? `${item.name}: pass. System ready.` : `${item.name}: ${item.reason}`);
      break;
    }
    case "reset-vehicle-colors":
      state.vehicleColors = { ...DEFAULT_VEHICLE_COLORS };
      render();
      showToast("Vehicle colors restored to default.");
      break;
    case "mute":
      state.settings.mute = !state.settings.mute;
      if (state.settings.mute) stopAmbientLoop();
      else ensureAudio();
      render();
      break;
    case "remap-key": keyCapture = target.binding; render(); showToast("Press the key you'd like to assign."); break;
    case "reset": {
      if (confirm("Reset all ORBITAL FRONTIER progress on this device? This cannot be undone.")) {
        localStorage.removeItem("orbital-frontier-save");
        window.location.reload();
      }
      break;
    }
  }
}

function handleFlightKey(key) {
  if (state.phase !== "flight" && state.phase !== "launch") {
    showToast("Flight controls are available during powered ascent.");
    return;
  }
  if (key === state.settings.controls.pitchUp) state.flight.throttle = Math.min(1, state.flight.throttle + 0.1);
  if (key === state.settings.controls.pitchDown) state.flight.throttle = Math.max(0, state.flight.throttle - 0.1);
  if (key === state.settings.controls.yawLeft) yaw -= 5;
  if (key === state.settings.controls.yawRight) yaw += 5;
  if (key === state.settings.controls.stage) { action("stage", {}); return; }
  if (scene) scene.model.rotation.z = yaw * Math.PI / 180;
  render();
}

function init() {
  shell();
  render();
  initializeScene();
  app.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (button && !button.disabled) action(button.dataset.action, button.dataset);
  });
  app.addEventListener("input", (event) => {
    if (event.target.dataset.input === "throttle") {
      if (!["flight", "launch"].includes(state.phase)) { showToast("Throttle is available during powered ascent."); render(); return; }
      state.flight.throttle = Number(event.target.value) / 100;
      const value = event.target.parentElement.querySelector("b");
      if (value) value.textContent = `${event.target.value}%`;
      saveState(state);
    } else if (event.target.dataset.input === "volume") {
      state.settings.volume = Number(event.target.value);
      if (state.settings.volume === 0) stopAmbientLoop();
      else ensureAudio();
      const value = event.target.parentElement.querySelector("b");
      if (value) value.textContent = `${state.settings.volume}%`;
      saveState(state);
    } else if (event.target.dataset.pickerHue !== undefined) {
      const current = hexToHsv(state.vehicleColors[activeVehicleColorPart]);
      current.hue = Number(event.target.value);
      setSelectedVehicleColor(hsvToHex(current.hue, current.saturation, current.value));
      const field = document.querySelector("[data-color-field]");
      if (field) field.style.setProperty("--picker-hue", current.hue);
    }
  });
  app.addEventListener("change", (event) => {
    if (event.target.dataset.input === "quality") {
      state.settings.quality = event.target.value;
      if (scene) {
        scene.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, event.target.value === "Low" ? 0.8 : event.target.value === "Medium" ? 1.1 : event.target.value === "High" ? 1.7 : 2));
        scene.resize();
      }
      showToast(`${event.target.value} graphics quality applied.`);
      saveState(state);
    } else if (event.target.dataset.colorPart !== undefined) {
      activeVehicleColorPart = event.target.value;
      render();
    }
  });
  app.addEventListener("pointerdown", (event) => {
    const field = event.target instanceof Element ? event.target.closest("[data-color-field]") : null;
    if (!field) return;
    draggingColorField = field;
    field.setPointerCapture(event.pointerId);
    event.preventDefault();
    updateColorFromPointer(event, field);
  });
  app.addEventListener("pointermove", (event) => {
    if (draggingColorField) updateColorFromPointer(event, draggingColorField);
  });
  app.addEventListener("pointerup", () => { draggingColorField = null; });
  app.addEventListener("pointercancel", () => { draggingColorField = null; });
  document.addEventListener("pointerdown", () => { ensureAudio(); }, { passive: true });
  document.addEventListener("keydown", (event) => {
    ensureAudio();
    if (keyCapture) {
      event.preventDefault();
      state.settings.controls[keyCapture] = event.key.toLowerCase();
      keyCapture = "";
      render();
      return;
    }
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
    const colorField = event.target instanceof Element ? event.target.closest("[data-color-field]") : null;
    if (colorField && ["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      const current = hexToHsv(state.vehicleColors[activeVehicleColorPart]);
      const step = event.shiftKey ? 0.1 : 0.03;
      if (event.key === "ArrowLeft") current.saturation = clamp(current.saturation - step, 0, 1);
      if (event.key === "ArrowRight") current.saturation = clamp(current.saturation + step, 0, 1);
      if (event.key === "ArrowDown") current.value = clamp(current.value - step, 0, 1);
      if (event.key === "ArrowUp") current.value = clamp(current.value + step, 0, 1);
      setSelectedVehicleColor(hsvToHex(current.hue, current.saturation, current.value));
      return;
    }
    const key = event.key.toLowerCase();
    if (["flight", "launch"].includes(state.phase)) {
      const controls = state.settings.controls;
      if ([controls.pitchUp, controls.pitchDown, controls.yawLeft, controls.yawRight, controls.stage].includes(key)) {
        event.preventDefault();
        handleFlightKey(key);
      }
    } else if (state.phase === "exploration" && ["w", "a", "s", "d"].includes(key)) {
      event.preventDefault();
      action("move-astronaut", { direction: ({ w: "forward", a: "left", s: "back", d: "right" })[key] });
    }
  });
  window.setInterval(tick, 100);
}

async function initializeScene() {
  const canvas = document.querySelector("#scene-canvas");
  try {
    const { FrontierScene } = await import("./scene.js");
    if (!canvas?.isConnected) return;
    scene = new FrontierScene(canvas);
    const quality = state.settings.quality;
    scene.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === "Low" ? 0.8 : quality === "Medium" ? 1.1 : quality === "High" ? 1.7 : 2));
    scene.resize();
    scene.update(state);
    document.querySelector("#scene-loading")?.remove();
  } catch (error) {
    console.error("The 3D flight deck could not initialize.", error);
    const fallback = document.querySelector("#scene-error");
    if (fallback) fallback.textContent = "3D VIEW UNAVAILABLE · FLIGHT CONTROLS REMAIN ACCESSIBLE";
    document.querySelector("#scene-loading")?.remove();
    showToast("3D rendering is unavailable in this browser; mission controls remain usable.");
  }
}

init();
