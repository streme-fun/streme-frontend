import * as THREE from "three";

/** Visual identity of a bubble: a Streme token's image and ticker symbol. */
export interface CoinSkin {
  image: HTMLImageElement | null;
  symbol: string;
}

export interface CoinEvent {
  symbol: string;
  total: number;
}

export interface SurfCallbacks {
  onStart?: () => void;
  onProgress?: (distance: number) => void;
  onCoin?: (event: CoinEvent) => void;
  onMilestone?: (distance: number) => void;
  onChallengePassed?: (challenge: number) => void;
  onGameOver?: (distance: number, coins: number) => void;
  /** Called when a bubble run spawns; return the token logo to float in it. */
  getCoinSkin?: () => CoinSkin | null;
}

interface Obstacle {
  mesh: THREE.Mesh;
  x: number;
  z: number;
  radius: number;
}

interface Coin {
  mesh: THREE.Mesh;
  x: number;
  z: number;
  symbol: string;
  taken: boolean;
}

interface Spray {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  active: boolean;
}

interface PopRing {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  life: number;
  active: boolean;
}

interface Streak {
  mesh: THREE.Mesh;
  factor: number;
}

const LANE_HALF = 5.4; // playable half-width
const WATER_WIDTH = 26;
const WATER_LENGTH = 150;
const SPAWN_Z = -120;
const DESPAWN_Z = 12;
const BASE_SPEED = 15;
const MAX_SPEED = 33;
const ACCEL = 0.32; // units/s gained per second
const MILESTONE_EVERY = 500; // meters
const STEER_RATE = 16; // max lateral units/s
const SURFER_Z = 0;
const FOG_COLOR = 0x2b1758;
const TRAIL_POINTS = 26;
const STREAK_COUNT = 24;
const CHECKER_TILE = 2.6; // world units per checker square

// The three bars of the Streme logo
const STREME_COLORS = [0x6366f1, 0xec4899, 0x2dd4bf];

export class SurfGameEngine {
  private container: HTMLElement;
  private callbacks: SurfCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private rafId: number | null = null;
  private lastTime: number | null = null;
  private disposed = false;

  private state: "idle" | "playing" | "over" = "idle";
  private distance = 0;
  private coinsCollected = 0;
  private elapsed = 0;
  private speed = BASE_SPEED;
  private bonusSpeed = 0;
  private nextSpawnAt = 20;
  private nextMilestoneAt = MILESTONE_EVERY;

  private challengeAt: number | null = null;
  private challengePassed = false;
  private gate: THREE.Group | null = null;
  private gateGlow: THREE.MeshBasicMaterial | null = null;

  private targetX = 0;
  private surferX = 0;
  private surfer!: THREE.Group;
  private rider!: THREE.Mesh;
  private wipeoutT = 0;

  private water!: THREE.Mesh;
  private waterGeo!: THREE.PlaneGeometry;
  private waterUniforms!: {
    uTime: { value: number };
    uFlow: { value: number };
    uSurge: { value: number };
  };
  private railMat!: THREE.MeshBasicMaterial;
  private waveTime = 0;
  private surgePulse = 0; // water glow burst on milestones

  private obstacles: Obstacle[] = [];
  private coins: Coin[] = [];
  private sprayPool: Spray[] = [];
  private sprayCursor = 0;
  private ringPool: PopRing[] = [];
  private ringCursor = 0;
  private streaks: Streak[] = [];
  private trails: { line: THREE.Line; positions: Float32Array }[] = [];

  /** Diagnostics for dev: real-time vs game-time accounting. */
  public debug = { frames: 0, dtSum: 0, lastSpeed: 0, drawCalls: 0 };

  private rockGeo = new THREE.IcosahedronGeometry(1, 0);
  // Amethyst crystals: facets catch the light so hazards read instantly
  private rockMat = new THREE.MeshPhongMaterial({
    color: 0x7163b8,
    emissive: 0x231345,
    specular: 0x9f8fff,
    shininess: 60,
    flatShading: true,
  });
  private bubbleGlowMat!: THREE.SpriteMaterial;
  private softGlowTexture!: THREE.CanvasTexture;
  private riderPulse = 0;
  private lastBank = 0;
  private speedNorm = 0; // smoothed 0..1 pace for FOV/streak intensity
  private coinGeo: THREE.CylinderGeometry;
  private coinEdgeMat = new THREE.MeshLambertMaterial({ color: 0x67e8f9 });
  private coinMatCache = new Map<string, THREE.MeshLambertMaterial>();
  private sprayGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  private sprayMat = new THREE.MeshBasicMaterial({
    color: 0xbfefff,
    transparent: true,
  });
  private streakGeo = new THREE.BoxGeometry(0.05, 0.05, 1.9);

  constructor(container: HTMLElement, callbacks: SurfCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.style.display = "block";
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(FOG_COLOR, 40, 115);

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 300);
    this.camera.position.set(0, 4.4, 7.2);
    this.camera.lookAt(0, 0.4, -6);

    const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x1b1340, 0.85);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(-6, 14, -10);
    this.scene.add(dir);

    this.coinGeo = new THREE.CylinderGeometry(0.58, 0.58, 0.16, 22);
    this.coinGeo.rotateX(Math.PI / 2); // caps face the camera

    // Soft filled glow for the board underglow and monster rim light
    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = 64;
    glowCanvas.height = 64;
    const glowCtx = glowCanvas.getContext("2d");
    if (glowCtx) {
      const gradient = glowCtx.createRadialGradient(32, 32, 4, 32, 32, 32);
      gradient.addColorStop(0, "rgba(165,243,252,0.9)");
      gradient.addColorStop(0.5, "rgba(103,232,249,0.35)");
      gradient.addColorStop(1, "rgba(103,232,249,0)");
      glowCtx.fillStyle = gradient;
      glowCtx.fillRect(0, 0, 64, 64);
    }
    this.softGlowTexture = new THREE.CanvasTexture(glowCanvas);
    this.softGlowTexture.colorSpace = THREE.SRGBColorSpace;

    // Bubble halo is a RING with a clear center so token logos stay legible
    const haloCanvas = document.createElement("canvas");
    haloCanvas.width = 64;
    haloCanvas.height = 64;
    const haloCtx = haloCanvas.getContext("2d");
    if (haloCtx) {
      const ring = haloCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
      ring.addColorStop(0, "rgba(165,243,252,0)");
      ring.addColorStop(0.5, "rgba(165,243,252,0)");
      ring.addColorStop(0.66, "rgba(165,243,252,0.55)");
      ring.addColorStop(0.85, "rgba(103,232,249,0.2)");
      ring.addColorStop(1, "rgba(103,232,249,0)");
      haloCtx.fillStyle = ring;
      haloCtx.fillRect(0, 0, 64, 64);
    }
    const haloTexture = new THREE.CanvasTexture(haloCanvas);
    haloTexture.colorSpace = THREE.SRGBColorSpace;
    this.bubbleGlowMat = new THREE.SpriteMaterial({
      map: haloTexture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.6,
    });

    this.buildWater();
    this.buildBanks();
    this.buildSurfer();
    this.buildTrails();
    this.buildStreaks();
    this.buildEffectPools();

    this.resize(container.clientWidth, container.clientHeight);
    this.rafId = requestAnimationFrame(this.loop);

    if (typeof window !== "undefined") {
      (window as unknown as { __surfDebug?: unknown }).__surfDebug =
        this.debug;
      (window as unknown as { __surfEngine?: unknown }).__surfEngine = this;
    }
  }

  // ---------------------------------------------------------------- public

  /** Starts a run when idle. Steering is via setTarget(). */
  tap() {
    if (this.state === "idle") {
      this.state = "playing";
      this.surfer.visible = true;
      // Prime the wake ribbons at the board so no stray lines flash
      for (const t of this.trails) {
        for (let i = 0; i < TRAIL_POINTS; i++) {
          t.positions[i * 3] = this.surferX;
          t.positions[i * 3 + 1] = 0.3;
          t.positions[i * 3 + 2] = SURFER_Z + 1.0;
        }
      }
      this.callbacks.onStart?.();
    }
  }

  /** Steer toward a normalized x position (-1 .. 1). */
  setTarget(nx: number) {
    this.targetX = THREE.MathUtils.clamp(nx, -1, 1) * LANE_HALF;
  }

  /** Friend's score to beat — renders a glowing gate at that distance. */
  setChallenge(distance: number) {
    if (Number.isFinite(distance) && distance > 0) {
      this.challengeAt = Math.floor(distance);
    }
  }

  reset() {
    for (const o of this.obstacles) this.scene.remove(o.mesh);
    for (const c of this.coins) this.scene.remove(c.mesh);
    for (const s of this.sprayPool) {
      s.active = false;
      s.mesh.visible = false;
    }
    for (const r of this.ringPool) {
      r.active = false;
      r.sprite.visible = false;
    }
    this.removeGate();
    this.obstacles = [];
    this.coins = [];
    this.distance = 0;
    this.coinsCollected = 0;
    this.elapsed = 0;
    this.speed = BASE_SPEED;
    this.bonusSpeed = 0;
    this.nextSpawnAt = 20;
    this.nextMilestoneAt = MILESTONE_EVERY;
    this.challengePassed = false;
    this.targetX = 0;
    this.surferX = 0;
    this.wipeoutT = 0;
    this.surfer.position.set(0, 0.5, SURFER_Z);
    this.surfer.rotation.set(0, 0, 0);
    this.surfer.visible = false; // tap() re-shows when the next run starts
    this.rider.scale.setScalar(1);
    this.rider.rotation.z = 0;
    this.riderPulse = 0;
    this.lastBank = 0;
    this.speedNorm = 0;
    this.surgePulse = 0;
    this.waterUniforms.uSurge.value = 0;
    for (const t of this.trails) t.positions.fill(0);
    this.state = "idle";
  }

  resize(width: number, height: number) {
    if (width <= 0 || height <= 0) return;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    // Pull the camera back on narrow screens so the full lane stays visible
    this.camera.position.z = 7.2 + Math.max(0, (1.1 - width / height) * 3.2);
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.disposed = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.scene.traverse((obj) => {
      if (
        obj instanceof THREE.Mesh ||
        obj instanceof THREE.Points ||
        obj instanceof THREE.Line
      ) {
        obj.geometry?.dispose();
        const materials = Array.isArray(obj.material)
          ? obj.material
          : [obj.material];
        for (const m of materials) {
          if (
            (m instanceof THREE.MeshLambertMaterial ||
              m instanceof THREE.MeshBasicMaterial) &&
            m.map
          ) {
            m.map.dispose();
          }
          m?.dispose();
        }
      }
    });
    this.rockGeo.dispose();
    this.coinGeo.dispose();
    this.sprayGeo.dispose();
    this.streakGeo.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // --------------------------------------------------------------- scenery

  /**
   * Fully GPU water: the same wave function runs in the vertex shader
   * (zero CPU work per frame), and the fragment paints a synthwave river —
   * faceted low-poly shading from screen derivatives, a shimmering sun
   * reflection column, scrolling energy lines, and manual horizon fog.
   */
  private buildWater() {
    this.waterGeo = new THREE.PlaneGeometry(WATER_WIDTH, WATER_LENGTH, 30, 84);
    this.waterGeo.rotateX(-Math.PI / 2);
    this.waterUniforms = {
      uTime: { value: 0 },
      uFlow: { value: 0 },
      uSurge: { value: 0 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms: this.waterUniforms,
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uFlow;
        varying vec3 vWorld;
        varying vec2 vSunD; // x: sun column strength, y: horizon distance

        float waveHeight(float x, float z) {
          float p = z - uFlow;
          return 0.16 * sin(0.5 * x + uTime * 2.1)
               + 0.2 * sin(0.21 * p + 0.4 * sin(x * 0.2))
               + 0.08 * sin(0.53 * p + x * 0.35 + uTime);
        }

        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          wp.y += waveHeight(wp.x, wp.z);
          vWorld = wp.xyz;
          // Sun-reflection factors live in the vertex stage: cheaper, and it
          // sidesteps an ANGLE-Metal miscompile when the same temporaries sit
          // in the fragment shader next to the surge uniform.
          float dist = 1.0 - smoothstep(-95.0, -18.0, wp.z);
          vSunD = vec2(exp(-wp.x * wp.x / 13.0) * dist, dist);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uFlow;
        uniform float uSurge;
        varying vec3 vWorld;
        varying vec2 vSunD;

        void main() {
          // Low-poly facets from screen-space derivatives (forced upward)
          vec3 normal = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
          normal *= sign(normal.y + 0.0001);
          float diffuse = max(dot(normal, normalize(vec3(-0.35, 0.85, 0.4))), 0.0);

          // Base gradient: deep indigo troughs, electric blue crests
          float crest = smoothstep(-0.25, 0.4, vWorld.y);
          float shade = clamp(crest * 0.65 + diffuse * 0.35, 0.0, 1.0);
          vec3 color = mix(vec3(0.09, 0.11, 0.50), vec3(0.27, 0.36, 1.0), shade);

          // Scrolling energy lines riding the flow
          float linePhase = sin((vWorld.z + uFlow) * 0.55) * 0.5 + 0.5;
          color += vec3(0.35, 0.85, 1.0) * smoothstep(0.93, 1.0, linePhase) * 0.22;

          // Synthwave sun reflection: hot shimmering column toward the horizon
          float ripple = 0.55 + 0.45 * sin(vWorld.z * 1.6 + uTime * 3.2 + vWorld.x * 2.0);
          vec3 sunColor = mix(vec3(1.0, 0.32, 0.55), vec3(1.0, 0.72, 0.35), vSunD.y);
          color += sunColor * ripple * vSunD.x * 0.9;

          // Milestone surge: the whole stream charges electric
          color += vec3(0.05, 0.85, 0.70) * uSurge * (0.22 + 0.3 * crest);

          // Manual fog toward the horizon (matches scene fog color)
          float fog = smoothstep(40.0, 112.0, -vWorld.z + 7.0);
          color = mix(clamp(color, 0.0, 1.0), vec3(0.169, 0.090, 0.345), fog);

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    this.water = new THREE.Mesh(this.waterGeo, material);
    this.water.position.set(0, 0, -WATER_LENGTH / 2 + DESPAWN_Z);
    this.scene.add(this.water);
  }

  /** Sonic-2-special-stage checkerboard banks that scroll with the flow. */
  private bankScrollers: {
    texture: THREE.Texture;
    axis: "x" | "y";
    dir: 1 | -1; // sign so every surface's pattern flows toward the camera
  }[] = [];

  private makeCheckerTexture(
    repeatX: number,
    repeatY: number
  ): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#33309c";
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = "#7c83f5";
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillRect(64, 64, 64, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    return texture;
  }

  private buildBanks() {
    const centerZ = -WATER_LENGTH / 2 + DESPAWN_Z;
    for (const side of [-1, 1]) {
      // Bank top: horizontal checker strip
      const topTexture = this.makeCheckerTexture(
        5 / (CHECKER_TILE * 2),
        WATER_LENGTH / (CHECKER_TILE * 2)
      );
      const topGeo = new THREE.PlaneGeometry(5, WATER_LENGTH);
      topGeo.rotateX(-Math.PI / 2);
      const top = new THREE.Mesh(
        topGeo,
        new THREE.MeshBasicMaterial({ map: topTexture })
      );
      top.position.set(side * (LANE_HALF + 4.1), 1.05, centerZ);
      this.scene.add(top);
      this.bankScrollers.push({ texture: topTexture, axis: "y", dir: -1 });

      // Inner wall facing the river
      const wallTexture = this.makeCheckerTexture(
        WATER_LENGTH / (CHECKER_TILE * 2),
        1.6 / (CHECKER_TILE * 2)
      );
      const wallGeo = new THREE.PlaneGeometry(WATER_LENGTH, 1.6);
      wallGeo.rotateY(side > 0 ? -Math.PI / 2 : Math.PI / 2);
      const wall = new THREE.Mesh(
        wallGeo,
        new THREE.MeshBasicMaterial({ map: wallTexture })
      );
      wall.position.set(side * (LANE_HALF + 1.6), 0.25, centerZ);
      this.scene.add(wall);
      this.bankScrollers.push({
        texture: wallTexture,
        axis: "x",
        dir: side > 0 ? 1 : -1,
      });
    }

    // Neon rails along the waterline frame the run like a light circuit
    this.railMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const railGeo = new THREE.BoxGeometry(0.12, 0.12, WATER_LENGTH);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(railGeo, this.railMat);
      rail.position.set(side * (LANE_HALF + 1.55), 1.08, centerZ);
      this.scene.add(rail);
    }
  }

  private buildSurfer() {
    this.surfer = new THREE.Group();

    // A real board silhouette: pointed nose, rounded tail
    const outline = new THREE.Shape();
    outline.moveTo(0, 1.25); // nose
    outline.quadraticCurveTo(0.5, 0.55, 0.47, -0.25);
    outline.quadraticCurveTo(0.45, -0.95, 0, -1.05); // tail
    outline.quadraticCurveTo(-0.45, -0.95, -0.47, -0.25);
    outline.quadraticCurveTo(-0.5, 0.55, 0, 1.25);
    const boardGeo = new THREE.ExtrudeGeometry(outline, {
      depth: 0.1,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.05,
      bevelSegments: 2,
      curveSegments: 10,
    });
    boardGeo.rotateX(-Math.PI / 2); // lay flat, nose toward -z
    const boardMat = new THREE.MeshPhongMaterial({
      color: 0xf8fafc,
      shininess: 90,
    });
    this.surfer.add(new THREE.Mesh(boardGeo, boardMat));

    const stripeGeo = new THREE.BoxGeometry(0.16, 0.06, 1.9);
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0x6366f1 });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.y = 0.12;
    this.surfer.add(stripe);

    // Cyan underglow: the board hovers on light
    const underglow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.softGlowTexture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.6,
        color: 0x67e8f9,
      })
    );
    underglow.scale.set(2.6, 1.1, 1);
    underglow.position.set(0, -0.1, 0);
    this.surfer.add(underglow);

    // Soft rim light behind the monster
    const riderGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.softGlowTexture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.35,
        color: 0x8be9fd,
      })
    );
    riderGlow.scale.set(2.4, 2.4, 1);
    riderGlow.position.set(0, 0.95, 0.04);
    this.surfer.add(riderGlow);

    // The monster rides the board
    const riderGeo = new THREE.PlaneGeometry(1.6, 1.6);
    const riderMat = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
    });
    this.rider = new THREE.Mesh(riderGeo, riderMat);
    this.rider.position.set(0, 0.92, 0.1);
    this.surfer.add(this.rider);

    new THREE.TextureLoader().load("/surf/monster.png", (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter; // keep the pixel art crisp
      const material = this.rider.material as THREE.MeshBasicMaterial;
      material.map = texture;
      material.needsUpdate = true;
    });

    this.surfer.position.set(0, 0.5, SURFER_Z);
    this.surfer.visible = false; // start-screen key art stands in until play
    this.scene.add(this.surfer);
  }

  /** Three thin wake ribbons in the Streme logo colors. */
  private buildTrails() {
    for (let i = 0; i < 3; i++) {
      const positions = new Float32Array(TRAIL_POINTS * 3);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );
      const material = new THREE.LineBasicMaterial({
        color: STREME_COLORS[i],
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(geometry, material);
      line.frustumCulled = false;
      this.scene.add(line);
      this.trails.push({ line, positions });
    }
  }

  /** Flowing light streaks above the water — the Streme hero animation. */
  private buildStreaks() {
    for (let i = 0; i < STREAK_COUNT; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: STREME_COLORS[i % 3],
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.streakGeo, material);
      this.resetStreak(mesh, true);
      this.scene.add(mesh);
      this.streaks.push({ mesh, factor: 1.1 + Math.random() * 0.5 });
    }
  }

  /** Fixed pools for splash cubes and pop rings — zero allocation during play. */
  private buildEffectPools() {
    for (let i = 0; i < 48; i++) {
      const material = this.sprayMat.clone();
      const mesh = new THREE.Mesh(this.sprayGeo, material);
      mesh.visible = false;
      this.scene.add(mesh);
      this.sprayPool.push({
        mesh,
        material,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        active: false,
      });
    }

    const ringCanvas = document.createElement("canvas");
    ringCanvas.width = 128;
    ringCanvas.height = 128;
    const ctx = ringCanvas.getContext("2d");
    if (ctx) {
      ctx.strokeStyle = "rgba(165,243,252,1)";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(64, 64, 52, 0, Math.PI * 2);
      ctx.stroke();
    }
    const ringTexture = new THREE.CanvasTexture(ringCanvas);
    ringTexture.colorSpace = THREE.SRGBColorSpace;
    for (let i = 0; i < 8; i++) {
      const material = new THREE.SpriteMaterial({
        map: ringTexture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      this.scene.add(sprite);
      this.ringPool.push({ sprite, material, life: 0, active: false });
    }
  }

  private spawnRing(x: number, y: number, z: number) {
    const ring = this.ringPool[this.ringCursor++ % this.ringPool.length];
    ring.active = true;
    ring.life = 0;
    ring.sprite.visible = true;
    ring.sprite.position.set(x, y, z);
    ring.sprite.scale.setScalar(0.4);
    ring.material.opacity = 0.95;
  }

  private resetStreak(mesh: THREE.Mesh, anywhere = false) {
    mesh.position.set(
      (Math.random() * 2 - 1) * (LANE_HALF + 2.5),
      0.3 + Math.random() * 1.6,
      anywhere
        ? SPAWN_Z + Math.random() * (DESPAWN_Z - SPAWN_Z)
        : SPAWN_Z + Math.random() * 20
    );
  }

  // --------------------------------------------------------------- helpers

  private waveHeight(x: number, z: number): number {
    const p = z - this.distance; // flow scroll
    return (
      0.16 * Math.sin(0.5 * x + this.waveTime * 2.1) +
      0.2 * Math.sin(0.21 * p + 0.4 * Math.sin(x * 0.2)) +
      0.08 * Math.sin(0.53 * p + x * 0.35 + this.waveTime)
    );
  }

  private coinMaterial(skin: CoinSkin): THREE.MeshLambertMaterial {
    const cached = this.coinMatCache.get(skin.symbol);
    if (cached) return cached;
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    let material: THREE.MeshLambertMaterial;
    if (!ctx) {
      material = new THREE.MeshLambertMaterial({ color: 0xfde68a });
    } else {
      ctx.fillStyle = "#67e8f9";
      ctx.beginPath();
      ctx.arc(64, 64, 64, 0, Math.PI * 2);
      ctx.fill();
      if (skin.image) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(64, 64, 56, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(skin.image, 8, 8, 112, 112);
        ctx.restore();
      } else {
        ctx.fillStyle = "#1e1b4b";
        ctx.font = "bold 30px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`$${skin.symbol.slice(0, 6)}`, 64, 64);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      material = new THREE.MeshLambertMaterial({ map: texture });
    }
    this.coinMatCache.set(skin.symbol, material);
    return material;
  }

  // ----------------------------------------------------------- challenge

  private buildGate() {
    const group = new THREE.Group();
    const glow = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.9,
    });
    this.gateGlow = glow;

    const postGeo = new THREE.BoxGeometry(0.2, 2.6, 0.2);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, glow);
      post.position.set(side * (LANE_HALF + 0.6), 1.3, 0);
      group.add(post);
    }
    const barGeo = new THREE.BoxGeometry((LANE_HALF + 0.7) * 2, 0.16, 0.16);
    const bar = new THREE.Mesh(barGeo, glow);
    bar.position.set(0, 2.6, 0);
    group.add(bar);

    // Banner: "BEAT {d}m"
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "rgba(30, 27, 75, 0.85)";
      ctx.fillRect(0, 0, 512, 96);
      ctx.strokeStyle = "#67e8f9";
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, 506, 90);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 56px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`BEAT ${this.challengeAt}m`, 256, 50);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 1.3),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
      })
    );
    banner.position.set(0, 3.6, 0);
    group.add(banner);

    this.gate = group;
    this.scene.add(group);
  }

  private removeGate() {
    if (!this.gate) return;
    this.scene.remove(this.gate);
    this.gate.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const m = obj.material as THREE.MeshBasicMaterial;
        if (m.map) m.map.dispose();
        m.dispose();
      }
    });
    this.gate = null;
    this.gateGlow = null;
  }

  // -------------------------------------------------------------- spawning

  private difficulty(): number {
    return THREE.MathUtils.clamp(this.distance / 2200, 0, 1);
  }

  private spawnWave() {
    const d = this.difficulty();
    const roll = Math.random();
    if (roll < 0.42 + d * 0.2) this.spawnRockRow();
    else if (roll < 0.78) this.spawnCoinRun();
    else {
      this.spawnRockRow();
      this.spawnCoinRun(-26);
    }
    this.nextSpawnAt = this.distance + 26 - d * 10 + Math.random() * 8;
  }

  private spawnRockRow() {
    const d = this.difficulty();
    const count = 2 + Math.floor(Math.random() * (2 + d * 2));
    // Always leave a surfable gap
    const gapCenter = (Math.random() * 2 - 1) * (LANE_HALF - 1.8);
    const gapHalf = 2.4 - d * 0.6;
    let placed = 0;
    let attempts = 0;
    const usedXs: number[] = [];
    while (placed < count && attempts < 14) {
      attempts++;
      const x = (Math.random() * 2 - 1) * LANE_HALF;
      if (Math.abs(x - gapCenter) < gapHalf + 1.0) continue;
      if (usedXs.some((ux) => Math.abs(ux - x) < 2.2)) continue;
      usedXs.push(x);
      const scale = 0.7 + Math.random() * 0.9;
      const mesh = new THREE.Mesh(this.rockGeo, this.rockMat);
      mesh.scale.setScalar(scale);
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      const z = SPAWN_Z - Math.random() * 6;
      mesh.position.set(x, 0.15 * scale, z);
      this.scene.add(mesh);
      this.obstacles.push({ mesh, x, z, radius: 0.85 * scale });
      placed++;
    }
  }

  private spawnCoinRun(zOffset = 0) {
    const skin = this.callbacks.getCoinSkin?.() ?? {
      image: null,
      symbol: "STREME",
    };
    const material = this.coinMaterial(skin);
    const count = 4 + Math.floor(Math.random() * 3);
    const x0 = (Math.random() * 2 - 1) * (LANE_HALF - 1.2);
    const drift = (Math.random() * 2 - 1) * 0.9; // gentle diagonal
    for (let i = 0; i < count; i++) {
      const x = THREE.MathUtils.clamp(
        x0 + drift * i,
        -LANE_HALF + 0.6,
        LANE_HALF - 0.6
      );
      const z = SPAWN_Z + zOffset - i * 3.4;
      const mesh = new THREE.Mesh(this.coinGeo, [
        this.coinEdgeMat,
        material,
        material,
      ]);
      mesh.position.set(x, 1.05, z);
      const glow = new THREE.Sprite(this.bubbleGlowMat);
      glow.scale.set(2.1, 2.1, 1);
      mesh.add(glow);
      this.scene.add(mesh);
      this.coins.push({ mesh, x, z, symbol: skin.symbol, taken: false });
    }
  }

  // ------------------------------------------------------------- main loop

  private wipeout() {
    this.state = "over";
    this.wipeoutT = 0;
    this.spawnSplash(this.surfer.position.x, this.surfer.position.z, 26);
    this.callbacks.onGameOver?.(Math.floor(this.distance), this.coinsCollected);
  }

  private spawnSplash(x: number, z: number, count: number, colorful = false) {
    for (let i = 0; i < count; i++) {
      const s = this.sprayPool[this.sprayCursor++ % this.sprayPool.length];
      s.material.color.setHex(
        colorful
          ? STREME_COLORS[Math.floor(Math.random() * STREME_COLORS.length)]
          : 0xbfefff
      );
      s.mesh.visible = true;
      s.mesh.position.set(x, 0.4, z);
      const angle = Math.random() * Math.PI * 2;
      const power = 2 + Math.random() * 4;
      s.vx = Math.cos(angle) * power;
      s.vy = 2.5 + Math.random() * 3.5;
      s.vz = Math.sin(angle) * power;
      s.maxLife = 0.5 + Math.random() * 0.4;
      s.life = s.maxLife;
      s.active = true;
    }
  }

  private updateTrails(move: number) {
    const offsets = [-0.3, 0, 0.3];
    for (let t = 0; t < 3; t++) {
      const { line, positions } = this.trails[t];
      // Shift history back one slot
      for (let i = TRAIL_POINTS - 1; i > 0; i--) {
        positions[i * 3] = positions[(i - 1) * 3];
        positions[i * 3 + 1] = positions[(i - 1) * 3 + 1];
        positions[i * 3 + 2] = positions[(i - 1) * 3 + 2] + move;
      }
      positions[0] = this.surferX + offsets[t];
      positions[1] = Math.max(this.surfer.position.y - 0.1, 0.12);
      positions[2] = SURFER_Z + 1.0;
      (line.geometry.getAttribute("position") as THREE.BufferAttribute)
        .copyArray(positions)
        .needsUpdate = true;
      line.visible = this.state === "playing";
    }
  }

  private loop = (now: number) => {
    if (this.disposed) return;
    const dt =
      this.lastTime === null
        ? 0.016
        : Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.waveTime += dt;
    this.debug.frames++;
    this.debug.dtSum += dt;

    if (this.state === "playing") {
      this.elapsed += dt;
      this.speed = Math.min(
        BASE_SPEED + this.elapsed * ACCEL + this.bonusSpeed,
        MAX_SPEED
      );
      this.debug.lastSpeed = this.speed;
      this.distance += this.speed * dt;
      this.callbacks.onProgress?.(Math.floor(this.distance));

      if (this.distance >= this.nextMilestoneAt) {
        this.nextMilestoneAt += MILESTONE_EVERY;
        this.bonusSpeed += 1.2;
        this.surgePulse = 1;
        this.callbacks.onMilestone?.(Math.floor(this.distance));
      }
      if (this.distance >= this.nextSpawnAt) this.spawnWave();

      // Challenge gate appears as you approach a friend's score
      if (
        this.challengeAt !== null &&
        !this.gate &&
        !this.challengePassed &&
        this.challengeAt - this.distance < 110 &&
        this.challengeAt > this.distance
      ) {
        this.buildGate();
      }
      if (
        this.challengeAt !== null &&
        !this.challengePassed &&
        this.distance >= this.challengeAt
      ) {
        this.challengePassed = true;
        this.spawnSplash(this.surferX, SURFER_Z, 32, true);
        this.spawnRing(this.surferX, 1.4, SURFER_Z);
        this.surgePulse = 1;
        this.callbacks.onChallengePassed?.(this.challengeAt);
      }

      // Steering
      const dx = this.targetX - this.surferX;
      const maxStep = STEER_RATE * dt;
      this.surferX += THREE.MathUtils.clamp(dx, -maxStep, maxStep);
      const bank = THREE.MathUtils.clamp(dx, -2.5, 2.5);
      this.lastBank = bank;
      this.surfer.position.x = this.surferX;
      this.surfer.rotation.z = -bank * 0.14;
      this.surfer.rotation.y = -bank * 0.1;

      // Ride the wave surface
      const h = this.waveHeight(this.surferX, SURFER_Z);
      this.surfer.position.y = 0.42 + h;
      this.surfer.rotation.x =
        (this.waveHeight(this.surferX, SURFER_Z - 1.2) - h) * 0.5;

      // Monster leans into turns and pops when a bubble bursts
      this.rider.rotation.z = bank * 0.06;
      if (this.riderPulse > 0) {
        this.riderPulse = Math.max(this.riderPulse - dt * 4, 0);
      }
      this.rider.scale.setScalar(1 + 0.15 * this.riderPulse);

      // Wake spray
      if (Math.random() < 0.6) {
        this.spawnSplash(
          this.surferX + (Math.random() - 0.5) * 0.7,
          SURFER_Z + 1.1,
          1
        );
      }
    }

    if (this.state === "over" && this.surfer.visible) {
      // Tumble animation
      this.wipeoutT += dt;
      this.surfer.rotation.x += 7 * dt;
      this.surfer.position.y = Math.max(
        this.surfer.position.y - 0.9 * dt,
        -0.5
      );
      if (this.wipeoutT > 1.1) this.surfer.visible = false;
    }

    // Scroll world objects toward the camera
    const move = this.state === "playing" ? this.speed * dt : 0;
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.z += move;
      o.mesh.position.z = o.z;
      o.mesh.position.y =
        0.15 * o.mesh.scale.x + this.waveHeight(o.x, o.z) * 0.4;
      if (o.z > DESPAWN_Z) {
        this.scene.remove(o.mesh);
        this.obstacles.splice(i, 1);
        continue;
      }
      if (
        this.state === "playing" &&
        Math.abs(o.z - SURFER_Z) < 1.0 &&
        Math.abs(o.x - this.surferX) < o.radius + 0.55
      ) {
        this.wipeout();
      }
    }

    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.z += move;
      c.mesh.position.z = c.z;
      c.mesh.rotation.y += 2.6 * dt;
      c.mesh.position.y = 1.05 + Math.sin(this.waveTime * 2 + c.x) * 0.12;
      if (c.z > DESPAWN_Z) {
        this.scene.remove(c.mesh);
        this.coins.splice(i, 1);
        continue;
      }
      if (
        this.state === "playing" &&
        !c.taken &&
        Math.abs(c.z - SURFER_Z) < 1.3 &&
        Math.abs(c.x - this.surferX) < 1.15
      ) {
        c.taken = true;
        this.coinsCollected++;
        this.scene.remove(c.mesh);
        this.coins.splice(i, 1);
        this.spawnSplash(c.x, SURFER_Z, 8, true);
        this.spawnRing(c.x, 1.05, SURFER_Z);
        this.riderPulse = 1;
        this.callbacks.onCoin?.({
          symbol: c.symbol,
          total: this.coinsCollected,
        });
      }
    }

    // Challenge gate rides the same flow
    if (this.gate && this.challengeAt !== null) {
      this.gate.position.z = SURFER_Z - (this.challengeAt - this.distance);
      if (this.gateGlow) {
        this.gateGlow.opacity = 0.65 + 0.35 * Math.sin(this.waveTime * 5);
      }
      if (this.gate.position.z > DESPAWN_Z) this.removeGate();
    }

    // Checkerboard banks scroll with the flow
    if (move > 0) {
      const scroll = move / (CHECKER_TILE * 2);
      for (const b of this.bankScrollers) {
        b.texture.offset[b.axis] =
          (b.texture.offset[b.axis] - b.dir * scroll + 1) % 1;
      }
    }

    // Streme streaks flow past, burning brighter at speed
    const streakOpacity = 0.25 + this.speedNorm * 0.35;
    for (const s of this.streaks) {
      s.mesh.position.z +=
        (this.state === "playing" ? this.speed * s.factor : 4) * dt;
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = streakOpacity;
      if (s.mesh.position.z > DESPAWN_Z) this.resetStreak(s.mesh);
    }

    this.updateTrails(move);

    // Spray particles (pooled)
    const sprayDrift = this.state === "playing" ? this.speed : 0;
    for (const s of this.sprayPool) {
      if (!s.active) continue;
      s.vy -= 12 * dt;
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += (s.vz + sprayDrift) * dt;
      s.life -= dt;
      s.material.opacity = Math.max(s.life / s.maxLife, 0);
      if (s.life <= 0) {
        s.active = false;
        s.mesh.visible = false;
      }
    }

    // Bubble pop rings (pooled)
    for (const r of this.ringPool) {
      if (!r.active) continue;
      r.life += dt;
      const k = r.life / 0.35;
      r.sprite.scale.setScalar(0.4 + k * 2.2);
      r.material.opacity = Math.max(0.95 * (1 - k), 0);
      if (k >= 1) {
        r.active = false;
        r.sprite.visible = false;
      }
    }

    // Water lives on the GPU — just feed the uniforms
    if (this.surgePulse > 0) {
      this.surgePulse = Math.max(this.surgePulse - dt * 1.4, 0);
    }
    this.waterUniforms.uTime.value = this.waveTime;
    this.waterUniforms.uFlow.value = this.distance;
    this.waterUniforms.uSurge.value = this.surgePulse;

    // Neon rails and crystals breathe
    this.railMat.opacity = 0.55 + 0.25 * Math.sin(this.waveTime * 2.4);
    this.rockMat.emissiveIntensity = 0.9 + 0.5 * Math.sin(this.waveTime * 2.1);

    // Speed feel: widen the FOV as the stream accelerates
    const speedNormTarget =
      this.state === "playing"
        ? (this.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED)
        : 0;
    this.speedNorm += (speedNormTarget - this.speedNorm) * Math.min(dt * 2, 1);
    const targetFov = 62 + this.speedNorm * 7;
    if (Math.abs(this.camera.fov - targetFov) > 0.03) {
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }

    // Camera gently follows the surfer; rolls into turns; shakes on wipeout
    const shake =
      this.state === "over" && this.wipeoutT < 0.5
        ? (0.5 - this.wipeoutT) * 0.5
        : 0;
    if (this.state !== "playing") this.lastBank *= Math.max(1 - dt * 3, 0);
    this.camera.position.x =
      this.surferX * 0.35 + (Math.random() - 0.5) * shake;
    this.camera.position.y = 4.4 + (Math.random() - 0.5) * shake;
    this.camera.lookAt(this.surferX * 0.5, 0.4, -6);
    this.camera.rotateZ(-this.lastBank * 0.018);

    this.renderer.render(this.scene, this.camera);
    this.debug.drawCalls = this.renderer.info.render.calls;
    this.rafId = requestAnimationFrame(this.loop);
  };
}
