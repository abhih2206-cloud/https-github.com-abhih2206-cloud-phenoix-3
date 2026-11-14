import "./style.css";
import { PARTS, getStats, inspection, loadState, saveState } from "./state.js";

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

const icons = {
  control: "⌂", missions: "◎", engineering: "⌘", inspection: "▣",
  flight: "⌁", exploration: "♧", science: "⌬", history: "▤", settings: "⚙", about: "◌"
};
const navItems = [
  ["control", "Mission control"], ["missions", "Missions"],
  ["engineering", "Engineering"], ["inspection", "Pre-flight"],
  ["flight", "Flight"], ["exploration", "Exploration"],
  ["science", "Science center"], ["history", "Mission history"],
  ["settings", "Settings"], ["about", "About"]
];
const format = (number, digits = 0) => Number(number || 0).toLocaleString("en-US", { maximumFractionDigits: digits });
const inLoadout = (id) => state.loadout.includes(id);

function shell() {
  app.innerHTML = `
    <header class="topbar">
      <a class="brand" href="#" data-action="navigate" data-screen="control" aria-label="Orbital Frontier mission control">
        <span class="brand-mark">OF<span>+</span></span><span class="brand-copy"><b>ORBITAL FRONTIER</b><small>MISSION OPERATIONS</small></span>
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
    return `${header("FLIGHT OPERATIONS / DEBRIEF", "Mission accomplished", "Lunar Frontier 01 is complete. Your science return is safely logged.")}
      <div class="results-card glass-panel"><div class="result-seal">✓</div><div class="eyebrow">MISSION DEBRIEF · MOON</div><h2>One small step.<br/><em>A whole new frontier.</em></h2><p>Pathfinder delivered its payload, restored both surface systems and returned a lunar sample.</p><div class="result-score"><span>MISSION SCORE</span><b>${format(latest?.score || 0)}<small> PTS</small></b><i>MISSION COMPLETE</i></div><div class="result-grid">${telemetry("OBJECTIVES", "3 / 3 COMPLETE")}${telemetry("SCIENCE RETURNED", `${format(state.progression.science)} UNITS`)}${telemetry("FUEL REMAINING", `${format(state.flight.fuel, 1)}%`)}${telemetry("CREW CONDITION", `${format(state.astronaut.oxygen)}% O₂ · NOMINAL`)}</div><div class="result-actions"><button class="button-primary" data-action="select-moon">FLY ANOTHER SORTIE <span>↗</span></button><button class="button-quiet" data-action="navigate" data-screen="history">VIEW MISSION LOG →</button></div><div class="science-note"><span>i</span> Flight, score and suit telemetry are simulated for gameplay. Mission record saved locally on this device.</div></div>`;
  }
  const progress = state.phase === "briefing" ? 9 : state.phase === "engineering" ? 24 : state.phase === "inspection" ? 38 : state.phase === "countdown" ? 53 : ["launch", "flight"].includes(state.phase) ? 70 : state.phase === "orbit" ? 82 : state.phase === "complete" ? 100 : 91;
  const phaseLabel = state.phase === "briefing" ? "MISSION BRIEFING" : state.phase === "complete" ? "MISSION COMPLETE" : `${state.phase.toUpperCase()} SEQUENCE`;
  const stats = getStats(state);
  return `${header("FLIGHT OPERATIONS / OVERVIEW", "Mission control", "Your next horizon is waiting. The Moon is go for launch.")}
    <div class="control-grid">
      <div class="control-left">
        <div class="mission-banner"><div class="banner-top"><span class="tag cyan">ACTIVE MISSION</span><span class="mission-id">OF-M01 · 2026</span></div><h2>Lunar<br/>Frontier <span>01</span></h2><p>Deliver a science payload to the lunar surface. Deploy, repair, discover.</p><div class="progress-label"><span>${phaseLabel}</span><b>${progress}%</b></div><div class="progress-track"><span style="width:${progress}%"></span></div><button class="button-primary" data-action="continue">CONTINUE MISSION <span>↗</span></button></div>
        <div class="quick-destinations"><div class="section-title">DESTINATIONS <span>01 / 09 AVAILABLE</span></div><button class="destination-mini" data-action="navigate" data-screen="missions"><span class="moon-thumb">◐</span><span><b>MOON</b><small>384,400 KM · SURFACE MISSION</small></span><span class="arr">↗</span></button><div class="locked-mini">＋ 8 destinations locked <span>VIEW ALL</span></div></div>
      </div>
      <div class="control-right">
        ${surface(`<div class="panel-top"><span>VEHICLE STATUS</span><span class="tag ${stats.twr >= 1.1 ? "green" : "amber"}">${stats.twr >= 1.1 ? "GO" : "CHECK"}</span></div><div class="vehicle-name"><span class="vehicle-symbol">▲</span><div><b>PATHFINDER Mk.I</b><small>CREWED LUNAR VEHICLE</small></div></div><div class="vehicle-meter"><div class="meter-copy"><span>FLIGHT READINESS</span><b>${stats.twr >= 1.1 ? "86" : "42"}<small>%</small></b></div><div class="meter-line"><i style="width:${stats.twr >= 1.1 ? 86 : 42}%"></i></div></div><div class="vehicle-pairs"><span>STAGE <b>${String(state.flight.stage).padStart(2, "0")}</b></span><span>FUEL <b>${format(state.flight.fuel)}%</b></span></div><button class="button-quiet" data-action="navigate" data-screen="engineering">OPEN VEHICLE ASSEMBLY <span>→</span></button>`)}
        ${surface(`<div class="panel-top"><span>MISSION TIMELINE</span><span class="tag dim">MOON · M01</span></div><div class="timeline">${timelineStep("01", "Mission brief", true)}${timelineStep("02", "Vehicle assembly", ["inspection", "countdown", "launch", "flight", "orbit", "eva", "exploration", "complete"].includes(state.phase))}${timelineStep("03", "Launch & transfer", ["launch", "flight", "orbit", "eva", "exploration", "complete"].includes(state.phase))}${timelineStep("04", "Lunar science", ["exploration", "complete"].includes(state.phase))}</div>`)}
      </div>
    </div>
    <div class="bottom-strip">${statCard("TOTAL MASS", `${format(stats.mass, 1)}`, "t", "◧")}${statCard("THRUST / WEIGHT", `${format(stats.twr, 2)}`, "TWR", "↟", "blue")}${statCard("FUEL ONBOARD", `${format(state.flight.fuel)}`, "%", "◉", "amber")}${statCard("MISSION SCORE", `${format(state.progression.score)}`, "PTS", "✧", "violet")}</div>
    <div class="camera-controls"><button data-action="camera-reset" aria-label="Reset camera" title="Reset camera">⊙</button><span>DRAG TO ORBIT · SCROLL TO ZOOM</span><button data-action="camera-mode" title="Switch camera">◫</button></div>`;
}

function timelineStep(number, text, done) {
  return `<div class="timeline-step ${done ? "done" : ""}"><span>${done ? "✓" : number}</span><b>${text}</b><small>${done ? "COMPLETE" : "STANDBY"}</small></div>`;
}

function renderMissions() {
  const destinations = [
    { name: "Moon", code: "LUNA", state: "AVAILABLE", grav: "1.62 m/s²", temp: "−173 to 127 °C", type: "SURFACE · CREWED", desc: "Our closest neighbor. A first step for science and a giant leap for this crew.", glyph: "◐", open: true },
    { name: "Mars", code: "ARES", state: "LOCKED", grav: "3.71 m/s²", temp: "−125 to 20 °C", type: "ROVER · SURFACE", desc: "Red dunes, thin air and a world of questions. A future mission; the Moon is playable now.", glyph: "●" },
    { name: "Mercury", code: "HERMES", state: "LOCKED", grav: "3.70 m/s²", temp: "−180 to 430 °C", type: "ORBITAL SCIENCE", desc: "A high-temperature orbital survey of the innermost rocky world.", glyph: "◕" },
    { name: "Venus", code: "APHRODITE", state: "LOCKED", grav: "8.87 m/s²", temp: "≈ 465 °C", type: "ATMOSPHERIC PROBE", desc: "A robotic atmospheric study. No surface landing is planned.", glyph: "◉" },
    { name: "Jupiter", code: "ZEUS", state: "LOCKED", grav: "24.79 m/s²", temp: "CLOUD TOPS ≈ −110 °C", type: "ORBITER · PROBE", desc: "A radiation-aware orbital mission to the gas giant. Not a solid-surface destination.", glyph: "◉" },
    { name: "Saturn", code: "CRONUS", state: "LOCKED", grav: "10.44 m/s²", temp: "CLOUD TOPS ≈ −140 °C", type: "RING OBSERVATION", desc: "Navigate the ring plane and study this distant gas giant from orbit.", glyph: "◉" },
    { name: "Uranus", code: "OURANOS", state: "LOCKED", grav: "8.69 m/s²", temp: "≈ −195 °C", type: "DEEP-SPACE OBSERVATION", desc: "A flyby and atmospheric study of the ice giant. No solid landing.", glyph: "◉" },
    { name: "Neptune", code: "POSEIDON", state: "LOCKED", grav: "11.15 m/s²", temp: "≈ −200 °C", type: "DEEP-SPACE OBSERVATION", desc: "An atmospheric observation mission at the edge of the planetary system.", glyph: "◉" },
    { name: "Earth", code: "TERRA", state: "HOME", grav: "9.81 m/s²", temp: "REFERENCE", type: "LAUNCH & RETURN", desc: "Home base and launch site. Earth is your point of departure.", glyph: "◉" }
  ];
  return `${header("MISSION CATALOG / DESTINATION SELECT", "Choose your horizon", "Read the environment before committing the vehicle. Scientific reference values are shown for context.")}
    <div class="destination-grid">${destinations.map((world, index) => `<article class="planet-card ${world.open ? "selected" : ""} ${world.state === "LOCKED" ? "locked" : ""}"><div class="planet-art planet-${world.code.toLowerCase()}"><span>${world.glyph}</span><small>${String(index + 1).padStart(2, "0")} / DESTINATION</small></div><div class="planet-card-body"><div class="planet-title"><h3>${world.name}</h3><span class="tag ${world.open ? "green" : "dim"}">${world.state}</span></div><div class="planet-type">${world.type}</div><p>${world.desc}</p><div class="planet-facts"><span>GRAVITY <b>${world.grav}</b></span><span>TEMPERATURE <b>${world.temp}</b></span></div>${world.open ? `<button class="button-primary compact" data-action="select-moon">SELECT MOON <span>↗</span></button>` : `<button class="button-quiet compact" ${world.state === "HOME" ? 'data-action="navigate" data-screen="control"' : 'data-action="locked-destination"'}>${world.state === "HOME" ? "LAUNCH SITE" : "VIEW REQUIREMENTS"} <span>→</span></button>`}</div></article>`).join("")}</div>
    <div class="science-note"><span>i</span> <b>SCIENTIFIC CONTEXT</b> Planet facts are approximate reference values for educational context, not live mission data. Gameplay telemetry is simulated.</div>`;
}

const categories = ["ALL", "STRUCTURE", "PROPULSION", "SYSTEMS", "LANDING", "PAYLOAD"];
let activeCategory = "ALL";
function renderEngineering() {
  const stats = getStats(state);
  const parts = Object.entries(PARTS).filter(([, part]) => activeCategory === "ALL" || part.category.toUpperCase() === activeCategory);
  return `${header("VEHICLE SYSTEMS / CONFIGURATION", "Engineering workshop", "Every module changes the actual vehicle. Values are an educational gameplay model.")}
    <div class="engineering-grid">
      <div class="component-panel glass-panel"><div class="panel-top"><span>PART CATALOG</span><span class="tag dim">${Object.keys(PARTS).length} MODULES</span></div><div class="category-tabs">${categories.map((category) => `<button data-action="category" data-category="${category}" class="${activeCategory === category ? "active" : ""}">${category}</button>`).join("")}</div><div class="parts-list">${parts.map(([id, part]) => `<button class="part-row ${inLoadout(id) ? "installed" : ""}" data-action="toggle-part" data-part="${id}"><span class="part-glyph">${part.icon}</span><span class="part-info"><b>${part.name}</b><small>${part.description}</small><small class="part-meta">${part.category.toUpperCase()} · ${part.mass} T · SIMULATED</small></span><span class="part-toggle">${inLoadout(id) ? "−" : "+"}</span></button>`).join("")}</div><div class="catalog-foot"><span>MODULE SELECTION</span><b>${state.loadout.length} INSTALLED</b></div></div>
      <div class="assembly-center"><div class="assembly-badge"><span class="live-dot"></span> PATHFINDER Mk.I <small>3D ASSEMBLY VIEW</small></div><div class="assembly-controls"><button data-action="camera-reset" title="Reset camera">⊙</button><button data-action="camera-mode" title="Change camera">◫</button></div><div class="assembly-tip">DRAG · ORBIT <i>SCROLL · ZOOM</i></div></div>
      <div class="stats-panel glass-panel"><div class="panel-top"><span>ENGINEER'S REPORT</span><span class="tag cyan">LIVE</span></div><div class="vehicle-mini"><b>▲ &nbsp; PATHFINDER Mk.I</b><small>CREWED LUNAR ASCENT VEHICLE</small></div><div class="stat-list">${engineeringStat("Total mass", `${format(stats.mass, 1)} t`, "◧")}${engineeringStat("Fuel capacity", `${stats.capacity} t`, "◉")}${engineeringStat("Current fuel", `${format(state.flight.fuel)}%`, "◉")}${engineeringStat("Max thrust", `${format(stats.thrust, 1)} MN`, "↟")}${engineeringStat("Thrust / weight", `${format(stats.twr, 2)}`, "⌁")}${engineeringStat("Est. delta-v", `${format(stats.deltaV)} m/s`, "∆v")}${engineeringStat("Electrical power", `${stats.power} kW`, "ϟ")}${engineeringStat("Thermal protection", `${stats.heat}%`, "◈")}${engineeringStat("Radiation protection", `${stats.radiation}%`, "⬟")}${engineeringStat("Life support", `${stats.life} crew`, "♡")}${engineeringStat("Comm. range", `${stats.comms} kkm`, "⌁")}${engineeringStat("Landing capability", `${stats.landing}%`, "⌑")}</div><div class="stats-disclaimer">SIMULATED VALUES · EDUCATIONAL MODEL</div><button class="button-primary" data-action="to-inspection">RUN PRE-LAUNCH CHECK <span>↗</span></button></div>
    </div>`;
}

function engineeringStat(name, value, icon) {
  return `<div class="engineering-stat"><span>${icon}</span><small>${name}</small><b>${value}</b></div>`;
}

function renderInspection() {
  const result = inspection(state);
  const pass = result.filter((item) => item.ok).length;
  return `${header("FLIGHT READINESS / SYSTEMS TEST", "Pre-launch inspection", "Verify every mission-critical system before the countdown begins.")}
    <div class="inspection-layout"><div class="inspection-summary glass-panel"><div class="summary-icon">${pass === result.length ? "✓" : "!"}</div><div class="eyebrow">VEHICLE READINESS</div><h2>${pass === result.length ? "GO FOR LAUNCH" : "HOLD FOR CHECKS"}</h2><p>${pass} of ${result.length} flight-critical checks passed.</p><div class="progress-track"><span style="width:${pass / result.length * 100}%"></span></div><div class="launch-window"><span>MISSION</span><b>LUNAR FRONTIER 01</b><span>VEHICLE</span><b>PATHFINDER Mk.I</b><span>EST. LIFTOFF</span><b>ON YOUR COMMAND</b></div>${pass === result.length ? '<button class="button-primary" data-action="start-countdown">INITIATE COUNTDOWN <span>↗</span></button>' : '<button class="button-primary disabled" disabled>RESOLVE CRITICAL FAILURES</button>'}<button class="button-quiet" data-action="navigate" data-screen="engineering">← RETURN TO ENGINEERING</button></div><div class="check-list">${result.map((item, index) => `<button class="check-row ${item.ok ? "pass" : "fail"}" data-action="check-detail" data-index="${index}"><span class="check-status">${item.ok ? "✓" : "!"}</span><span><b>${item.name}</b><small>${item.ok ? "System verified · ready for flight" : item.reason}</small></span><span class="check-result">${item.ok ? "PASS" : "FAIL"}</span><span class="check-arrow">›</span></button>`).join("")}<div class="science-note"><span>i</span> Inspection checks are evaluated from the installed spacecraft modules. No launch is allowed while a critical check fails.</div></div></div>`;
}

function renderFlight() {
  const f = state.flight;
  const stats = getStats(state);
  if (state.phase === "countdown") {
    const remaining = Math.max(0, Math.ceil(f.countdown || 0));
    return `${header("LAUNCH SEQUENCE / L-01", "All stations, go", "Flight director has control. Countdown is live.")}
      <div class="launch-layout"><div class="countdown-card glass-panel"><div class="eyebrow">LUNAR FRONTIER 01 · T MINUS</div><div class="count-number">${String(remaining).padStart(2, "0")}</div><div class="count-label">${remaining <= 1 ? "IGNITION SEQUENCE" : "VEHICLE IS GO"}</div><div class="progress-track"><span style="width:${(10 - (f.countdown || 0)) * 10}%"></span></div><div class="count-checks"><span>✓ PROPULSION</span><span>✓ GUIDANCE</span><span>✓ CREW SAFETY</span></div><button class="button-quiet" data-action="abort-countdown">ABORT COUNTDOWN</button></div><div class="launch-side"><div class="tag amber">SIMULATED LAUNCH</div><h2>PATHFINDER<br/>Mk.I</h2><p>Launch simulation uses a simplified educational flight model. This is not a certified flight simulator.</p></div></div>`;
  }
  if (state.phase === "launch" || state.phase === "flight") {
    return `${header("FLIGHT DYNAMICS / ASCENT", "Powered ascent", "The vehicle is moving. Control throttle and monitor live flight telemetry.")}
      <div class="flight-layout">      <div class="flight-left glass-panel"><div class="panel-top"><span>LIVE TELEMETRY</span><span class="tag green"><i class="live-dot"></i> LIVE</span></div><div class="primary-readout"><span>ALTITUDE</span><b data-flight="altitude"><span>${(f.altitude / 1000).toFixed(1)}</span><small> KM</small></b><div class="altitude-bar"><i style="height:${Math.max(3, Math.min(100, f.altitude / 1000 / 100 * 100))}%"></i></div></div><div class="telemetry-grid">${telemetry("VELOCITY", `${format(f.velocity)} m/s`, "velocity")}${telemetry("ACCELERATION", `${format(f.acceleration, 1)} m/s²`, "acceleration")}${telemetry("FUEL", `${format(f.fuel, 1)}%`, "fuel")}${telemetry("MISSION TIME", `T+ ${format(f.elapsed)} s`, "elapsed")}${telemetry("THROTTLE", `${format(f.throttle * 100)}%`, "throttle")}${telemetry("STAGE", `S-${String(f.stage).padStart(2, "0")}`, "stage")}</div><div class="flight-status"><span class="live-dot"></span><span data-flight="engine-status">${f.fuel > 8 ? "ENGINE NOMINAL" : "LOW FUEL WARNING"}</span><small data-flight="structural">STRUCTURAL LOAD · ${format(Math.max(1, f.acceleration / 9.81), 1)} G</small></div></div><div class="flight-actions"><div class="tag cyan">MISSION TARGET · MOON</div><h2>${f.altitude >= 100000 ? "ORBITAL INSERTION" : "ASCENT PROFILE"}</h2><p>${f.altitude >= 100000 ? "Target orbit reached. Deploy your science payload." : "Target: 100 km educational orbit. Keep the vehicle under control."}</p><div class="throttle-block"><div><span>ENGINE THROTTLE</span><b data-flight="throttle-control">${format(f.throttle * 100)}%</b></div><input type="range" min="0" max="100" value="${Math.round(f.throttle * 100)}" data-input="throttle" aria-label="Engine throttle"/></div><div class="control-pad"><button data-action="flight-key" data-key="w">▲<small>THROTTLE</small></button><div><button data-action="flight-key" data-key="a">◀</button><button data-action="flight-key" data-key="s">▼</button><button data-action="flight-key" data-key="d">▶</button></div></div><div class="button-row"><button class="button-quiet" data-action="stage">B · SEPARATE STAGE</button><button class="button-quiet" data-action="camera-reset">RESET VIEW</button></div></div></div><div class="flight-key-hint">FLIGHT CONTROLS <b>W</b> THROTTLE <b>A / D</b> YAW <b>S</b> CUT ENGINE <b>B</b> STAGE · MOUSE DRAG / ZOOM CAMERA</div>`;
  }
  if (state.phase === "orbit") {
    return `${header("ORBITAL OPERATIONS / PAYLOAD", "Orbit achieved", "A stable educational orbit. Your payload and astronaut science objectives are next.")}
      <div class="orbit-layout"><div class="orbit-card glass-panel"><div class="orbit-success"><span>✓</span> ORBIT INSERTION SUCCESSFUL</div><h2>The Moon is<br/><em>in reach.</em></h2><p>Pathfinder reached the target orbital band. Deploy the science payload, then begin your surface mission.</p><div class="orbit-facts"><span>ORBITAL ALTITUDE<b>${(f.altitude / 1000).toFixed(1)} km</b></span><span>CREW STATUS<b>NOMINAL · 3 / 3</b></span><span>PAYLOAD LINK<b>${f.deployed ? "ACTIVE" : "STANDBY"}</b></span></div>${f.deployed ? '<button class="button-primary" data-action="begin-eva">BEGIN LUNAR EVA <span>↗</span></button>' : '<button class="button-primary" data-action="deploy-payload">DEPLOY SCIENCE PAYLOAD <span>↗</span></button>'}</div><div class="orbit-side glass-panel"><div class="panel-top"><span>ORBITAL ASSETS</span><span class="tag cyan">1 SPACECRAFT</span></div><div class="asset-row"><span class="asset-icon">▲</span><span><b>PATHFINDER Mk.I</b><small>CREWED VEHICLE · NOMINAL</small></span><span class="asset-dot green-dot"></span></div><div class="asset-row ${f.deployed ? "" : "muted"}"><span class="asset-icon">▦</span><span><b>LUNAR SCOUT-01</b><small>${f.deployed ? "PAYLOAD · COMMUNICATIONS ACTIVE" : "SCIENCE PAYLOAD · STOWED"}</small></span><span class="asset-dot ${f.deployed ? "green-dot" : ""}"></span></div><div class="science-note"><span>i</span> Payload deployment is a one-way mission event. After deploying, you can focus the camera on the new orbital asset.</div><button class="button-quiet full-width" data-action="camera-mode">◫ &nbsp; SWITCH CAMERA FOCUS</button></div></div>`;
  }
  return `${header("FLIGHT DYNAMICS / ASCENT", "Flight systems standby", "Complete mission selection and engineering before launch.")}
    <div class="empty-state glass-panel"><span class="empty-mark">⌁</span><h2>Flight deck is waiting.</h2><p>Select a destination and configure the spacecraft to begin.</p><button class="button-primary" data-action="navigate" data-screen="missions">SELECT A MISSION <span>↗</span></button></div>`;
}

function telemetry(label, value, field = "") {
  return `<div class="telemetry-cell"><span>${label}</span><b ${field ? `data-flight="${field}"` : ""}>${value}</b></div>`;
}

function renderExploration() {
  if (state.phase !== "exploration") {
    const canBegin = state.phase === "orbit" && state.flight.deployed;
    const message = state.phase === "complete" ? "This lunar sortie is complete. Review your mission debrief or launch a new sortie." : canBegin ? "Your payload is deployed and the vehicle is stable in orbit. Suit up to begin the surface mission." : "Complete launch and payload deployment before starting the lunar EVA.";
    return `${header("SURFACE OPERATIONS / LUNAR EVA", "Exploration bay", "Surface operations unlock after a successful orbital insertion.")}
      <div class="empty-state glass-panel"><span class="empty-mark">♧</span><h2>${canBegin ? "Surface mission is go." : state.phase === "complete" ? "Mission complete." : "Awaiting orbital insertion."}</h2><p>${message}</p>${canBegin ? '<button class="button-primary" data-action="begin-eva">BEGIN LUNAR EVA <span>↗</span></button>' : state.phase === "complete" ? '<button class="button-primary" data-action="navigate" data-screen="history">VIEW MISSION LOG <span>↗</span></button>' : '<button class="button-primary" data-action="navigate" data-screen="flight">OPEN FLIGHT DECK <span>↗</span></button>'}</div>`;
  }
  const a = state.astronaut;
  const objectives = [
    { key: "repairedArray", title: "Repair communications array", detail: "Restore the surface relay link to mission control.", icon: "⌁", action: "repair-array", done: a.repairedArray },
    { key: "repairedRover", title: "Repair Aster science rover", detail: "Replace a damaged wheel coupling and restore mobility.", icon: "▰", action: "repair-rover", done: a.repairedRover },
    { key: "samples", title: "Collect lunar regolith samples", detail: "Secure a science sample for the return container.", icon: "◇", action: "collect-sample", done: a.samples > 0 }
  ];
  const complete = objectives.every((item) => item.done);
  return `${header("SURFACE OPERATIONS / LUNAR EVA", "Lunar exploration", "Walk the surface, restore mission hardware and collect a science sample. Suit values are game simulations.")}
    <div class="eva-layout">    <div class="eva-left glass-panel"><div class="panel-top"><span>CREW MEMBER · EVA 01</span><span class="tag ${a.oxygen > 20 ? "green" : "amber"}">SUIT ACTIVE</span></div><div class="astronaut-profile"><div class="astronaut-avatar"><span>◉</span><i>OF</i></div><div><div class="eyebrow">MISSION SPECIALIST</div><h2>LUNAR EXPLORER</h2><p>AXIOM-CLASS EXPLORATION SUIT</p></div></div><div class="suit-gauges">${gauge("SUIT OXYGEN", a.oxygen, "%", "cyan")}${gauge("HEALTH", a.health, "%", "green")}${gauge("CABIN LINK", 100, "%", "blue")}</div><div class="eva-controls"><span>WALK THE SURFACE</span><div><button data-action="move-astronaut" data-direction="left">←</button><button data-action="move-astronaut" data-direction="forward">↑</button><button data-action="move-astronaut" data-direction="back">↓</button><button data-action="move-astronaut" data-direction="right">→</button></div></div><button class="button-quiet full-width" data-action="return-to-capsule">RETURN TO SPACECRAFT · RESTORE O₂</button><p class="suit-note">GAME SIMULATION · NOT MEDICAL OR EVA GUIDANCE</p></div><div class="objectives-panel glass-panel"><div class="panel-top"><span>SURFACE OBJECTIVES</span><span class="tag cyan">${objectives.filter((item) => item.done).length} / 3 COMPLETE</span></div><div class="objective-list">${objectives.map((item, index) => `<div class="objective-row ${item.done ? "done" : ""}"><span class="objective-number">${item.done ? "✓" : `0${index + 1}`}</span><span class="objective-icon">${item.icon}</span><span class="objective-copy"><b>${item.title}</b><small>${item.detail}</small></span>${item.done ? '<span class="tag green">DONE</span>' : `<button class="button-small" data-action="${item.action}">${item.action === "collect-sample" ? "COLLECT" : "REPAIR"} ↗</button>`}</div>`).join("")}</div><div class="objective-footer"><div class="progress-label"><span>MISSION SCIENCE RETURN</span><b>${objectives.filter((item) => item.done).length * 33}%</b></div><div class="progress-track"><span style="width:${objectives.filter((item) => item.done).length * 33}%"></span></div>${complete ? '<button class="button-primary" data-action="complete-mission">COMPLETE MISSION <span>↗</span></button>' : '<div class="hint-line">Complete all three objectives to return your mission results.</div>'}</div></div></div>`;
}

function gauge(label, value, unit, color) {
  return `<div class="gauge"><div><span>${label}</span><b>${format(value)}${unit}</b></div><div class="meter-line ${color}"><i style="width:${value}%"></i></div></div>`;
}

function renderScience() {
  const sections = [
    ["SPACE WEATHER", "QUIET", "Solar wind conditions", "SIMULATED", "Nominal", "4.2 km/s", "Planetary magnetic field", "REFERENCE", "Lunar surface · weak"],
    ["RADIATION", "EDUCATIONAL MODEL", "Mission exposure index", "SIMULATED", "Low · in orbit", "12 / 100", "Shielding installed", "VEHICLE CONFIG", `${getStats(state).radiation}% modeled protection`],
    ["PLANET DATABASE", "REFERENCE", "Lunar gravity", "REAL REFERENCE", "1.62 m/s²", "Surface environment", "REFERENCE", "Regolith · vacuum"],
    ["ASTRONAUT SCIENCE", "MISSION DATA", "Samples collected", "MISSION STATE", `${state.astronaut.samples}`, "Array repaired", "MISSION STATE", state.astronaut.repairedArray ? "Yes" : "Not yet"],
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
    <div class="about-card glass-panel"><div class="about-emblem">OF<span>+</span></div><div class="eyebrow">AN EDUCATIONAL SPACEFLIGHT GAME</div><h2>Design. Build. Launch.<br/><em>Fly. Explore. Discover.</em></h2><p>ORBITAL FRONTIER is a playable browser prototype about the people, engineering and science behind a mission. Assemble a modular vehicle, fly a simplified launch profile, and take your crew to the lunar surface.</p><div class="about-pills"><span>THREE.JS 3D</span><span>SIMULATED PHYSICS</span><span>LOCAL SAVE</span><span>MOON MISSION · PLAYABLE</span></div><div class="science-note"><span>i</span> This is a fictional educational game. Vehicle systems and gameplay telemetry are simulated; planetary reference data is approximate. It is not a professional simulator or real mission-control tool.</div><button class="button-primary" data-action="continue">CONTINUE MISSION <span>↗</span></button></div>`;
}

function render() {
  const screen = document.querySelector("#screen");
  if (!screen) return;
  if (state.screen !== renderedScreen || state.phase !== renderedPhase) screen.scrollTop = 0;
  renderedScreen = state.screen;
  renderedPhase = state.phase;
  const pages = {
    control: renderControl, missions: renderMissions, engineering: renderEngineering,
    inspection: renderInspection, flight: renderFlight, exploration: renderExploration,
    science: renderScience, history: renderHistory, settings: renderSettings, about: renderAbout
  };
  screen.innerHTML = (pages[state.screen] || renderControl)();
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.screen === state.screen));
  if (scene) scene.update(state);
  saveState(state);
}

function navigate(screen) {
  if (screen === "inspection" && !["engineering", "inspection"].includes(state.phase)) {
    showToast("Select the Moon mission and configure the vehicle before inspection.");
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

function beginMission() {
  state.destination = "Moon";
  state.phase = "engineering";
  state.screen = "engineering";
  state.flight = { altitude: 0, velocity: 0, fuel: 100, throttle: 0, elapsed: 0, stage: 1, acceleration: 0, deployed: false, countdown: 10 };
  state.astronaut = { oxygen: 100, health: 100, fatigue: 0, repairedArray: false, repairedRover: false, samples: 0, x: 3.6, z: 0 };
  state.missionScience = 0;
  activeCategory = "ALL";
  showToast("Lunar Frontier 01 initialized. Configure your vehicle.");
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
  showToast("Lunar Scout-01 deployed. Solar array and comms link active.");
  render();
}

function beginEVA() {
  if (!state.flight.deployed) {
    showToast("Deploy the science payload before surface operations.");
    return;
  }
  state.phase = "exploration";
  state.screen = "exploration";
  state.astronaut.oxygen = 100;
  showToast("Surface team is go. EVA suit systems nominal.");
  playTone(340, 0.13);
  render();
}

function handleObjective(action) {
  if (state.phase !== "exploration") {
    showToast("Surface operations are not active.");
    return;
  }
  if (state.astronaut.oxygen < 5) {
    showToast("EVA paused: return to the spacecraft to restore suit oxygen.");
    return;
  }
  if (action === "repair-array" && !state.astronaut.repairedArray) {
    state.astronaut.repairedArray = true;
    state.astronaut.oxygen = Math.max(0, state.astronaut.oxygen - 12);
    state.progression.science += 2;
    state.missionScience += 2;
    showToast("Communications array repaired. Deep-space link restored.");
  } else if (action === "repair-rover" && !state.astronaut.repairedRover) {
    state.astronaut.repairedRover = true;
    state.astronaut.oxygen = Math.max(0, state.astronaut.oxygen - 16);
    state.progression.science += 2;
    state.missionScience += 2;
    showToast("Aster rover repaired. Mobility and science systems restored.");
  } else if (action === "collect-sample" && state.astronaut.samples === 0) {
    state.astronaut.samples = 1;
    state.astronaut.oxygen = Math.max(0, state.astronaut.oxygen - 8);
    state.progression.science += 3;
    state.missionScience += 3;
    showToast("Lunar regolith sample secured in return container.");
  }
  playTone(520, 0.12);
  render();
}

function completeMission() {
  const a = state.astronaut;
  if (state.phase !== "exploration") {
    showToast("Mission results have already been recorded.");
    return;
  }
  if (!(a.repairedArray && a.repairedRover && a.samples > 0)) {
    showToast("Complete all surface objectives before closing the mission.");
    return;
  }
  const score = Math.round(1000 + state.flight.fuel * 4 + state.missionScience * 150 + (a.oxygen > 20 ? 300 : 0));
  const record = { name: "Lunar Frontier 01", destination: "Moon", score, date: new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date()) };
  state.progression.missions.push(record);
  state.progression.score += score;
  state.phase = "complete";
  state.screen = "control";
  state.notice = `Mission complete · ${format(score)} points earned.`;
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
function playTone(frequency, duration) {
  if (state.settings.mute || state.settings.volume === 0) return;
  try {
    audioContext = audioContext || new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.value = Math.min(state.settings.volume / 400, 0.08);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
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
    case "locked-destination": showToast("This destination is planned for a future build. The Moon is the currently playable mission."); break;
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
    case "repair-array": case "repair-rover": case "collect-sample": handleObjective(actionName); break;
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
    case "mute": state.settings.mute = !state.settings.mute; render(); break;
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
      const value = event.target.parentElement.querySelector("b");
      if (value) value.textContent = `${state.settings.volume}%`;
      saveState(state);
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
    }
  });
  document.addEventListener("keydown", (event) => {
    if (keyCapture) {
      event.preventDefault();
      state.settings.controls[keyCapture] = event.key.toLowerCase();
      keyCapture = "";
      render();
      return;
    }
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
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
