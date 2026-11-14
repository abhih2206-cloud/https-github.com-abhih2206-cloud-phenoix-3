export const PARTS = {
  core: { name: "Command core", category: "Structure", mass: 12, icon: "◉", description: "Crew-rated central structure" },
  engine: { name: "Meridian engine", category: "Propulsion", mass: 8, thrust: 4.8, fuelRate: 165, icon: "✦", description: "High-efficiency ascent engine" },
  tank: { name: "Cryogenic fuel tank", category: "Propulsion", mass: 15, capacity: 100, icon: "▤", description: "Extended-range propellant storage" },
  booster: { name: "Solid booster pair", category: "Propulsion", mass: 10, thrust: 2.2, fuelRate: 95, icon: "⇧", description: "Additional launch thrust" },
  capsule: { name: "Crew capsule", category: "Systems", mass: 7, life: 3, icon: "⬡", description: "Pressurized crew return vehicle" },
  life: { name: "Life-support unit", category: "Systems", mass: 3, life: 2, icon: "♡", description: "Oxygen and cabin regulation" },
  comms: { name: "Deep-space comms", category: "Systems", mass: 2, comms: 120, icon: "⌁", description: "Long-range mission antenna" },
  shield: { name: "Thermal shield", category: "Structure", mass: 4, heat: 85, icon: "◈", description: "Atmospheric-entry protection" },
  legs: { name: "Lunar landing gear", category: "Landing", mass: 3, landing: 80, icon: "⌑", description: "Shock-absorbing surface struts" },
  panels: { name: "Solar array", category: "Payload", mass: 2, power: 45, icon: "▦", description: "Deployable orbital power panels" },
  rover: { name: "Aster rover", category: "Payload", mass: 6, science: 2, icon: "▰", description: "Two-seat lunar science rover" },
  shield2: { name: "Radiation liner", category: "Structure", mass: 5, radiation: 40, icon: "⬟", description: "Crew radiation shielding" }
};

const initialState = {
  screen: "control",
  destination: "Moon",
  phase: "briefing",
  loadout: ["core", "engine", "tank", "booster", "capsule", "life", "comms", "shield", "legs", "panels", "rover"],
  flight: { altitude: 0, velocity: 0, fuel: 100, throttle: 0, elapsed: 0, stage: 1, acceleration: 0, deployed: false },
  astronaut: { oxygen: 100, health: 100, fatigue: 0, repairedArray: false, repairedRover: false, samples: 0, x: 3.6, z: 0 },
  missionScience: 0,
  progression: { missions: [], score: 0, unlocked: ["Moon", "Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"], science: 0 },
  settings: { quality: "High", volume: 35, mute: false, controls: { pitchUp: "w", pitchDown: "s", yawLeft: "a", yawRight: "d", stage: "b" } },
  notice: ""
};

export function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem("orbital-frontier-save"));
    if (!saved || typeof saved !== "object") return initialState;
    return {
      ...initialState, ...saved,
      flight: { ...initialState.flight, ...saved.flight },
      astronaut: { ...initialState.astronaut, ...saved.astronaut },
      missionScience: Number.isFinite(saved.missionScience) ? saved.missionScience : 0,
      progression: { ...initialState.progression, ...saved.progression },
      settings: { ...initialState.settings, ...saved.settings, controls: { ...initialState.settings.controls, ...(saved.settings?.controls || {}) } },
      loadout: Array.isArray(saved.loadout) ? saved.loadout : initialState.loadout
    };
  } catch (error) {
    console.warn("Save data could not be loaded; starting with a fresh mission.", error);
    return initialState;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem("orbital-frontier-save", JSON.stringify(state));
  } catch (error) {
    console.warn("Progress could not be saved in this browser.", error);
  }
}

export function getStats(state) {
  const parts = state.loadout.map((id) => PARTS[id]).filter(Boolean);
  const mass = parts.reduce((sum, part) => sum + part.mass, 0);
  const thrust = parts.reduce((sum, part) => sum + (part.thrust || 0), 0);
  const capacity = state.loadout.includes("tank") ? 100 : 0;
  const engine = state.loadout.includes("engine");
  return {
    mass, thrust, capacity,
    twr: mass ? thrust * 1000 / (mass * 9.81) : 0,
    deltaV: mass && capacity ? Math.round((thrust * 1000 / Math.max(mass, 1)) * 20) : 0,
    power: parts.reduce((sum, part) => sum + (part.power || 0), 0),
    heat: parts.reduce((sum, part) => sum + (part.heat || 0), 0),
    radiation: parts.reduce((sum, part) => sum + (part.radiation || 0), 0),
    life: parts.reduce((sum, part) => sum + (part.life || 0), 0),
    comms: parts.reduce((sum, part) => sum + (part.comms || 0), 0),
    landing: parts.reduce((sum, part) => sum + (part.landing || 0), 0),
    fuelRate: parts.reduce((sum, part) => sum + (part.fuelRate || 0), 0),
    engine
  };
}

export function inspection(state) {
  const checks = [
    ["Fuel tank", state.loadout.includes("tank"), "Install a cryogenic fuel tank to supply the engines."],
    ["Main engine", state.loadout.includes("engine"), "Install a main engine before attempting launch."],
    ["Crew capsule", state.loadout.includes("capsule"), "The crew capsule is required for a crewed Moon mission."],
    ["Life support", state.loadout.includes("life"), "Install a life-support unit for the crew."],
    ["Communications", state.loadout.includes("comms"), "Deep-space communications are required for navigation."],
    ["Thermal shield", state.loadout.includes("shield"), "A thermal shield is required for safe return."],
    ["Landing system", state.loadout.includes("legs"), "Lunar landing gear is required for the surface objective."],
    ["Science rover", state.loadout.includes("rover"), "Install the Aster rover to support lunar surface science."],
    ["Solar array", state.loadout.includes("panels"), "Install solar panels for the orbital science payload."],
    ["Launch thrust", getStats(state).twr >= 1.1, "Current thrust-to-weight is too low. Add an engine or booster."]
  ];
  return checks.map(([name, ok, reason]) => ({ name, ok, reason }));
}
