import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const material = (color, metalness = 0.4, roughness = 0.42) => new THREE.MeshStandardMaterial({ color, metalness, roughness });

export class FrontierScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#050b14");
    this.scene.fog = new THREE.FogExp2("#07101b", 0.0013);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 3000);
    this.camera.position.set(13, 14, 22);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 7;
    this.controls.maxDistance = 70;
    this.controls.target.set(0, 3.8, 0);
    this.clock = new THREE.Clock();
    this.frameCount = 0;
    this.fpsTime = performance.now();
    if (import.meta.env.DEV) {
      this.fpsIndicator = document.createElement("div");
      this.fpsIndicator.className = "fps-indicator";
      this.fpsIndicator.textContent = "FPS --";
      canvas.parentElement.append(this.fpsIndicator);
    }
    this.model = new THREE.Group();
    this.scene.add(this.model);
    this.planet = null;
    this.exhaust = null;
    this.rocketY = 0;
    this.current = null;
    this.buildEnvironment();
    this.buildRocket();
    this.buildLaunchSite();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.animate();
  }

  buildEnvironment() {
    this.scene.add(new THREE.HemisphereLight("#9cb8d8", "#10131a", 1.7));
    const key = new THREE.DirectionalLight("#f4f4ff", 4.2);
    key.position.set(-12, 24, 16);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.scene.add(key);
    const rim = new THREE.PointLight("#48d9ff", 22, 90);
    rim.position.set(10, 4, -12);
    this.scene.add(rim);

    const starGeometry = new THREE.BufferGeometry();
    const points = new Float32Array(1800 * 3);
    for (let i = 0; i < points.length; i += 3) {
      points[i] = (Math.random() - 0.5) * 950;
      points[i + 1] = (Math.random() - 0.5) * 700;
      points[i + 2] = (Math.random() - 0.5) * 950;
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(points, 3));
    this.scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: "#b8d9ff", size: 0.65, sizeAttenuation: true })));

    const ground = new THREE.Mesh(new THREE.CircleGeometry(240, 80), material("#1b2630", 0.15, 0.87));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.15;
    ground.receiveShadow = true;
    this.scene.add(ground);
    const grid = new THREE.GridHelper(180, 36, "#1a5262", "#182d3b");
    grid.position.y = -0.12;
    grid.material.transparent = true;
    grid.material.opacity = 0.28;
    this.scene.add(grid);

    this.launchSite = new THREE.Group();
    this.scene.add(this.launchSite);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.9, 0.32, 48), material("#35434b", 0.5, 0.7));
    pad.position.y = 0.03;
    pad.receiveShadow = true;
    pad.castShadow = true;
    this.launchSite.add(pad);
    const padMark = new THREE.Mesh(new THREE.RingGeometry(3.2, 3.35, 48), new THREE.MeshBasicMaterial({ color: "#e5aa4a", side: THREE.DoubleSide }));
    padMark.rotation.x = -Math.PI / 2;
    padMark.position.y = 0.2;
    this.launchSite.add(padMark);

    const tower = new THREE.Group();
    tower.position.set(3.7, 0.18, -0.3);
    const steel = material("#697783", 0.8, 0.38);
    const warning = material("#db9f43", 0.55, 0.5);
    const beam = (x, y, z, width, height, depth, mat = steel) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      tower.add(mesh);
      return mesh;
    };
    for (const x of [-0.32, 0.32]) {
      for (const z of [-0.32, 0.32]) beam(x, 6.2, z, 0.13, 12.4, 0.13);
    }
    for (const y of [0.6, 2.2, 3.8, 5.4, 7, 8.6, 10.2, 11.8]) {
      beam(0, y, 0, 0.82, 0.09, 0.09, y % 3.2 < 0.2 ? warning : steel);
      beam(0, y, 0, 0.09, 0.09, 0.82, steel);
    }
    for (const y of [4.1, 7.3, 10.5]) {
      const arm = beam(-1.25, y, 0.08, 2.3, 0.14, 0.16, warning);
      arm.rotation.z = -0.1;
    }
    this.launchSite.add(tower);

    for (const x of [-5.7, -4.7]) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 2.2, 20), material("#536c78", 0.75, 0.32));
      tank.position.set(x, 1.1, -3.5);
      tank.castShadow = true;
      this.launchSite.add(tank);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 8), material("#89969a", 0.65, 0.32));
      cap.scale.y = 0.38;
      cap.position.set(x, 2.2, -3.5);
      this.launchSite.add(cap);
    }

    this.planet = new THREE.Mesh(new THREE.SphereGeometry(3.2, 48, 36), new THREE.MeshStandardMaterial({
      color: "#62778a", roughness: 0.92, metalness: 0.02,
      bumpMap: this.makeLunarTexture(), bumpScale: 0.22
    }));
    this.planet.position.set(-9, 1.1, -8);
    this.scene.add(this.planet);
    const aura = new THREE.Mesh(new THREE.SphereGeometry(3.32, 48, 36), new THREE.MeshBasicMaterial({ color: "#6ac9ec", transparent: true, opacity: 0.06, side: THREE.BackSide }));
    aura.position.copy(this.planet.position);
    this.scene.add(aura);

    this.exhaust = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.2, 20, 1, true), new THREE.MeshBasicMaterial({ color: "#ff9f45", transparent: true, opacity: 0.72, side: THREE.DoubleSide }));
    this.exhaust.rotation.x = Math.PI;
    this.exhaust.position.y = -5.25;
    this.exhaust.visible = false;
    this.model.add(this.exhaust);
    const innerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.27, 2.5, 16, 1, true), new THREE.MeshBasicMaterial({ color: "#b4f4ff", transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    innerFlame.rotation.x = Math.PI;
    innerFlame.position.y = -4.9;
    innerFlame.name = "innerFlame";
    innerFlame.visible = false;
    this.model.add(innerFlame);
  }

  buildLaunchSite() {
    this.launchSite.position.set(0, -0.16, 0);
  }

  makeLunarTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#777";
    ctx.fillRect(0, 0, 256, 256);
    let seed = 7;
    const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    for (let i = 0; i < 260; i += 1) {
      const r = 1 + random() * 12;
      const x = random() * 256;
      const y = random() * 256;
      ctx.fillStyle = random() > 0.5 ? "rgba(25,30,35,.28)" : "rgba(220,225,230,.12)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  buildRocket() {
    const white = material("#dce8ed", 0.65, 0.27);
    const dark = material("#263d4c", 0.8, 0.28);
    const blue = material("#48d8ed", 0.62, 0.27);
    const gold = material("#d79b45", 0.75, 0.3);
    const addCylinder = (parent, top, bottom, height, mat, y, radiusSegments = 24) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, radiusSegments), mat);
      mesh.position.y = y;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    this.model.add(addCylinder(this.model, 0.9, 1.1, 5.2, white, -0.05));
    this.model.add(addCylinder(this.model, 0.88, 0.94, 1.8, dark, -1.05));
    this.model.add(addCylinder(this.model, 0.76, 0.88, 1.25, white, 2.9));
    const capsule = addCylinder(this.model, 0.04, 0.76, 1.3, blue, 4.15);
    capsule.geometry = new THREE.ConeGeometry(0.76, 1.3, 24);
    const noseWindow = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), material("#182b3d", 0.4, 0.1));
    noseWindow.position.set(0, 4.15, 0.62);
    this.model.add(noseWindow);

    this.boosters = [];
    for (const x of [-1.12, 1.12]) {
      const booster = new THREE.Group();
      booster.position.set(x, -0.35, 0);
      addCylinder(booster, 0.34, 0.39, 3.9, white, 0);
      addCylinder(booster, 0.34, 0.34, 0.35, gold, -1.65);
      this.model.add(booster);
      this.boosters.push(booster);
    }
    this.tank = addCylinder(this.model, 0.75, 0.75, 1.2, gold, -2.0);
    this.solar = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.75), material("#245f93", 0.45, 0.35));
    panel.position.set(2.1, 2.15, 0);
    this.solar.add(panel);
    const panel2 = panel.clone();
    panel2.position.x = -2.1;
    this.solar.add(panel2);
    this.model.add(this.solar);

    this.legs = new THREE.Group();
    for (let i = 0; i < 3; i += 1) {
      const a = i * Math.PI * 2 / 3;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 2.15, 8), dark);
      leg.position.set(Math.sin(a) * 1.05, -2.6, Math.cos(a) * 1.05);
      leg.rotation.z = Math.cos(a) * 0.62;
      leg.rotation.x = Math.sin(a) * 0.62;
      leg.castShadow = true;
      this.legs.add(leg);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.34), gold);
      foot.position.set(Math.sin(a) * 1.55, -3.58, Math.cos(a) * 1.55);
      this.legs.add(foot);
    }
    this.model.add(this.legs);

    const finMat = dark;
    this.fins = new THREE.Group();
    for (let i = 0; i < 3; i += 1) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 1.15), finMat);
      fin.position.set(0, -2.6, 0.95);
      fin.rotation.y = i * Math.PI * 2 / 3;
      fin.rotation.z = -0.22;
      this.fins.add(fin);
    }
    this.model.add(this.fins);

    this.payload = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.66, 0.7), gold);
    body.castShadow = true;
    this.payload.add(body);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), white);
    dish.position.y = 0.36;
    dish.rotation.x = Math.PI;
    this.payload.add(dish);
    const payloadPanel = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.06, 0.64), material("#245f93", 0.45, 0.35));
    payloadPanel.position.set(1.48, 0, 0);
    this.payload.add(payloadPanel);
    const payloadPanel2 = payloadPanel.clone();
    payloadPanel2.position.x = -1.48;
    this.payload.add(payloadPanel2);
    this.payload.position.set(1.7, 5, 0);
    this.payload.visible = false;
    this.scene.add(this.payload);

    this.astronaut = new THREE.Group();
    const suit = material("#e8edf0", 0.15, 0.8);
    const visor = new THREE.MeshStandardMaterial({ color: "#71d9f6", metalness: 0.75, roughness: 0.13, emissive: "#123d54", emissiveIntensity: 0.3 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.82, 5, 10), suit);
    torso.position.y = 1.25;
    this.astronaut.add(torso);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.44, 0.12), material("#e8793d", 0.22, 0.7));
    chest.position.set(0, 1.45, 0.34);
    this.astronaut.add(chest);
    const insignia = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.035), material("#3289bd", 0.35, 0.48));
    insignia.position.set(0, 1.2, 0.405);
    this.astronaut.add(insignia);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), suit);
    helmet.position.y = 2.15;
    this.astronaut.add(helmet);
    const faceplate = new THREE.Mesh(new THREE.SphereGeometry(0.31, 16, 12, 0, Math.PI * 2, 0.3, 1.25), visor);
    faceplate.position.set(0, 2.18, 0.18);
    this.astronaut.add(faceplate);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.35), dark);
    pack.position.set(0, 1.3, -0.43);
    this.astronaut.add(pack);
    const packPanel = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.62, 0.035), material("#2879ac", 0.38, 0.42));
    packPanel.position.set(0, 1.35, -0.625);
    this.astronaut.add(packPanel);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.7, 4, 8), suit);
      arm.position.set(side * 0.53, 1.35, 0);
      arm.rotation.z = side * -0.25;
      this.astronaut.add(arm);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.72, 4, 8), dark);
      leg.position.set(side * 0.2, 0.38, 0);
      this.astronaut.add(leg);
    }
    this.astronaut.position.set(4, -3.5, 0);
    this.astronaut.visible = false;
    this.scene.add(this.astronaut);
  }

  update(state) {
    this.current = state;
    const has = (id) => state.loadout.includes(id);
    this.boosters.forEach((booster) => { booster.visible = has("booster") && state.flight.stage === 1; });
    this.tank.visible = has("tank");
    this.solar.visible = has("panels") && !state.flight.deployed;
    this.legs.visible = has("legs");
    this.fins.visible = has("core");
    const ignition = state.phase === "flight" || state.phase === "launch" || (state.phase === "countdown" && state.flight.countdown <= 1);
    this.exhaust.visible = ignition && state.flight.throttle > 0;
    const innerFlame = this.model.getObjectByName("innerFlame");
    innerFlame.visible = this.exhaust.visible;
    this.payload.visible = state.flight.deployed;
    this.astronaut.visible = state.phase === "eva" || state.phase === "exploration" || state.phase === "complete";
    const ascending = state.phase === "launch" || state.phase === "flight";
    const visualRise = ascending ? Math.min(state.flight.altitude / 1000, 72) : 0;
    this.model.position.y = 3.8 + visualRise;
    this.rocketY = this.model.position.y;
    if (state.phase === "eva" || state.phase === "exploration" || state.phase === "complete") {
      this.planet.position.set(0, -6.5, -12);
      this.planet.scale.setScalar(1.8);
      this.camera.position.set(9, 6, 16);
      this.controls.target.set(0, -1, 0);
    } else {
      this.planet.position.set(-9, 1.1, -8);
      this.planet.scale.setScalar(1);
    }
    if (state.phase === "orbit") {
      this.camera.position.set(13, this.model.position.y + 10, 18);
      this.controls.target.set(0, this.model.position.y, 0);
    } else if (state.phase === "flight" || state.phase === "launch") {
      const follow = 0.35 + Math.min(visualRise / 18, 1) * 0.57;
      const targetY = 3.8 + visualRise * follow;
      this.controls.target.y += (targetY - this.controls.target.y) * 0.18;
      this.camera.position.y += (this.controls.target.y + 10 - this.camera.position.y) * 0.18;
    } else if (state.screen === "engineering" || state.screen === "inspection" || state.screen === "control") {
      this.controls.target.set(0, 3.8, 0);
    }
    const throttle = state.flight.throttle;
    const flicker = 0.85 + Math.sin(performance.now() * 0.035) * 0.12;
    this.exhaust.scale.set(0.7 + throttle * 0.45, Math.max(0.08, throttle) * flicker, 0.7 + throttle * 0.45);
    innerFlame.scale.y = Math.max(0.08, throttle) * flicker;
    this.exhaust.material.opacity = 0.28 + throttle * 0.5;
    this.launchSite.visible = !["eva", "exploration", "complete", "orbit"].includes(state.phase) && state.flight.altitude < 70000;
    this.payload.position.x = state.flight.deployed ? 3.3 + Math.sin(performance.now() * 0.0007) * 0.3 : 1.7;
    this.astronaut.position.x = state.astronaut.x ?? 3.6;
    this.astronaut.position.z = state.astronaut.z ?? 0;
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const width = Math.max(parent.clientWidth, 1);
    const height = Math.max(parent.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  animate() {
    this.frame = requestAnimationFrame(() => this.animate());
    const elapsed = this.clock.getElapsedTime();
    this.frameCount += 1;
    const now = performance.now();
    if (this.fpsIndicator && now - this.fpsTime >= 1000) {
      this.fpsIndicator.textContent = `FPS ${Math.round(this.frameCount * 1000 / (now - this.fpsTime))}`;
      this.frameCount = 0;
      this.fpsTime = now;
    }
    this.model.rotation.y = Math.sin(elapsed * 0.2) * 0.035;
    this.planet.rotation.y += 0.0007;
    if (this.payload.visible) this.payload.rotation.y += 0.005;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
