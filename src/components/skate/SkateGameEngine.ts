// Streme Skate — a 2D, pixel-art, GBA-flavoured one-button endless skater with
// arcade juice borrowed from the greats. The warplet bombs a neon street; TAP
// to jump (hold for bigger air), HOLD IN THE AIR to backflip, then RELEASE to
// stomp the landing upright — a clean landing pays out the combo AND kicks a
// speed boost (the rush). Grind rails (the longer you hold the more it pays),
// grab $STREME, snag a Magnet or Rocket, nail near-misses over the gaps, ride
// the Sonic loop. TRUE ENDLESS, ONE LIFE — one bad gap and you're done — with a
// research-driven difficulty curve that ramps relentlessly. Cycling neon zones,
// chase a high score. Everything draws to one <canvas>; React owns the HUD.

export type SwipeDir = "up" | "down" | "left" | "right";
export type SfxType =
  | "jump"
  | "trick"
  | "land"
  | "perfect"
  | "grind"
  | "crash"
  | "letter"
  | "bubble"
  | "power"
  | "flow"
  | "milestone";

export type CalloutKind =
  | "perfect"
  | "sick"
  | "sloppy"
  | "close"
  | "combo"
  | "power"
  | "milestone";

export interface ComboInfo {
  tricks: string[];
  base: number;
  multiplier: number;
  live: number;
}

export interface SkateResult {
  score: number;
  bestCombo: number;
  letters: number;
  bubbles: number;
  tricks: number;
  distance: number;
  finished: boolean; // always false — endless run, you go till you wipe out
  timedOut: boolean; // ran the countdown clock to zero (vs. wiped out in a pit)
}

export interface SkateCallbacks {
  onStart?: () => void;
  onScore?: (total: number) => void;
  onDistance?: (metres: number) => void;
  onProgress?: (fraction: number) => void; // 0..1 through the current zone (loops)
  onZone?: (name: string, index: number, accent: string) => void;
  onLives?: (lives: number) => void;
  onGrindTick?: (level: number) => void; // rising grind audio (seconds on the rail)
  onTime?: (seconds: number) => void; // countdown clock remaining
  onTimeBonus?: (amount: number) => void; // recharge pop (+X.Xs)
  onCombo?: (info: ComboInfo | null) => void;
  onBank?: (amount: number) => void;
  onBail?: (lostCombo: number) => void;
  onCallout?: (text: string, kind: CalloutKind) => void;
  onLetters?: (collected: boolean[]) => void; // one bool per STREME slot
  onAllLetters?: () => void;
  onFlow?: (active: boolean) => void;
  onSpecial?: (value: number) => void;
  onPower?: (kind: "magnet" | "rocket" | null) => void;
  onSfx?: (type: SfxType) => void;
  onGameOver?: (result: SkateResult) => void;
}

interface Gap {
  x0: number;
  x1: number;
}
interface Rail {
  x0: number;
  x1: number;
  height: number;
}
interface Ramp {
  x0: number;
  xLip: number;
  height: number;
  launch: number;
}
interface Loop {
  x: number; // entry x (bottom of the loop)
  r: number;
  done?: boolean; // already ridden — don't re-trigger (we exit at its centre)
}
type PowerKind = "magnet" | "rocket";
interface Collectible {
  x: number;
  y: number;
  taken: boolean;
}
interface Letter extends Collectible {
  ch: string;
  slot: number; // which STREME slot (0..5) this letter fills
}
interface Power extends Collectible {
  kind: PowerKind;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

/** A recorded run: flat [px,py] pairs sampled every GHOST_DT seconds. */
export interface GhostInput {
  samples: number[];
  color: string;
  name?: string;
}
interface Ghost {
  samples: number[];
  color: string;
  name?: string;
  spin: number; // flip direction (±1) for inferred trick playback
}
const GHOST_DT = 0.15; // seconds between recorded ghost samples
// Ghost recordings only store [px,py], so we infer tricks: once a ghost rises
// clearly above the rails (~64-88px) it's mid-jump, so spin it through whole
// rotations (landing flat) instead of just floating up and down.
const GHOST_AIR_SPIN = 95;
const GHOST_COLORS = ["#fb7185", "#a78bfa", "#34d399", "#fbbf24", "#38bdf8"];

const BASE_SPEED = 300;
const MAX_SPEED = 680;
const GRAVITY = 2150;
const JUMP_V = 820;
const JUMP_HOLD_G = 1150; // lighter gravity while holding + rising → bigger air
const RAIL_POP = 720;
const RAIL_END_POP = 360;
const METRES = 9;

// grind (the longer you hold, the faster the score climbs — OlliOlli/THPS)
const GRIND_BASE = 16; // base points per 50px of rail at multiplier 1
const GRIND_RAMP = 1.5; // multiplier growth per second on the rail
const COYOTE = 0.1; // grace window to still jump after rolling off an edge (Celeste)

// run timer — drains in real time (a touch faster as it gets harder), and
// RECHARGES when you pull off something great (Crazy Taxi / OutRun urgency).
// Hitting zero ends the run, so you must keep skating well, not just survive.
const START_TIME = 18; // seconds on the clock at drop-in
const TIME_CAP = 26; // most time you can ever bank

const SPIN_MAX = 13; // rad/s when flipping
const SPIN_ACCEL = 46;
const FLIP_BASE = 130; // points per completed rotation

const BOOST_PERFECT = 230;
const BOOST_SICK = 90;
const BOOST_DECAY = 150;
const BOOST_CAP = 300;

const MAGNET_T = 6;
const MAGNET_R = 175;
const ROCKET_T = 3.2;
const ROCKET_SPEED = 300;

const C_INDIGO = "#6366f1";
const C_PINK = "#ec4899";
const C_TEAL = "#2dd4bf";
const C_CYAN = "#67e8f9";
const C_GOLD = "#fde68a";
const TRAIL_COLORS = [C_INDIGO, C_PINK, C_TEAL];
const FLOW_COLORS = [C_GOLD, C_PINK, C_CYAN, "#a855f7", C_TEAL];

const STREME_LETTERS = ["S", "T", "R", "E", "M", "E"];
const FLIP_NAMES = ["KICKFLIP", "360 FLIP", "BACKFLIP", "VARIAL", "HARDFLIP"];

// Endless — themed zones cycle forever (~ZONE_LEN px each), each with its own
// sky/sun palette (visual variety) and set-piece weight mix (gameplay variety).
// Later cycles are harder because difficulty rides the run clock, not position.
const ZONE_LEN = 7200; // world px per zone before it transitions to the next
const START_LIVES = 1; // one life — endless, you go till you wipe out

type RGB = [number, number, number];
interface ZonePalette {
  sky: [RGB, RGB, RGB, RGB]; // top → upper-mid → horizon → ground line
  sun: [RGB, RGB, RGB, RGB];
}
interface Zone {
  name: string;
  accent: string; // hud bar colour
  pal: ZonePalette;
  mix: Record<string, number>; // set-piece weights
}
const ZONES: Zone[] = [
  {
    name: "NEON DOWNTOWN",
    accent: "#67e8f9",
    pal: {
      sky: [[12, 6, 38], [36, 17, 96], [109, 31, 158], [122, 42, 134]],
      sun: [[253, 230, 138], [251, 146, 60], [236, 72, 153], [168, 85, 247]],
    },
    mix: { flat: 1.4, kickerAir: 1.4, rail: 1.4, rhythm: 1.1, gap: 0.6, doubleKicker: 0.5 },
  },
  {
    name: "GRIND DISTRICT",
    accent: "#2dd4bf",
    pal: {
      sky: [[5, 16, 28], [8, 36, 52], [14, 92, 110], [20, 74, 92]],
      sun: [[165, 243, 252], [45, 212, 191], [56, 189, 248], [99, 102, 241]],
    },
    mix: { rail: 2.0, stairs: 1.6, railGap: 1.4, kickerRail: 1.4, kickerAir: 0.8, gap: 0.7, flat: 0.8 },
  },
  {
    name: "GAP CITY",
    accent: "#fb923c",
    pal: {
      sky: [[26, 8, 38], [74, 18, 48], [209, 69, 58], [240, 138, 42]],
      sun: [[254, 240, 138], [251, 146, 60], [239, 68, 68], [136, 19, 55]],
    },
    mix: { gap: 1.8, kickerGap: 1.8, doubleKicker: 1.2, kickerAir: 0.9, rail: 0.7, flat: 0.7 },
  },
  {
    name: "VERT HEIGHTS",
    accent: "#c084fc",
    pal: {
      sky: [[12, 6, 38], [42, 13, 84], [122, 31, 174], [192, 38, 160]],
      sun: [[244, 114, 182], [219, 39, 119], [168, 85, 247], [88, 28, 135]],
    },
    mix: { quarter: 1.6, kickerAir: 1.6, kickerRail: 1.4, stairs: 1.2, doubleKicker: 1.2, kickerGap: 1.0, loop: 1.0, flat: 0.6 },
  },
  {
    name: "OVERDRIVE",
    accent: "#fbbf24",
    pal: {
      sky: [[22, 8, 38], [90, 18, 64], [236, 72, 153], [251, 191, 36]],
      sun: [[253, 230, 138], [244, 114, 182], [239, 68, 68], [124, 28, 92]],
    },
    mix: { quarter: 1.4, kickerGap: 1.4, kickerAir: 1.3, rhythm: 1.2, doubleKicker: 1.2, rail: 1.0, gap: 1.2, kickerRail: 1.2, loop: 1.1 },
  },
];

interface TrickDef {
  name: string;
  base: number;
}
const AIR_TRICKS: Record<SwipeDir, TrickDef> = {
  up: { name: "STREME GRAB", base: 140 },
  down: { name: "SHUV-IT", base: 150 },
  left: { name: "BIGSPIN", base: 180 },
  right: { name: "IMPOSSIBLE", base: 190 },
};

const LOOP_DUR = 0.62; // seconds to ride a Sonic loop
const LOOP_R = 72;

type State =
  | "idle"
  | "running"
  | "airborne"
  | "grinding"
  | "loop"
  | "crash"
  | "over";

export class SkateGameEngine {
  private container: HTMLElement;
  private cb: SkateCallbacks;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private W = 0;
  private H = 0;
  private groundY = 0;
  private skaterX = 0;
  private rafId: number | null = null;
  private lastTime: number | null = null;
  private disposed = false;

  private state: State = "idle";
  private holding = false;
  private px = 0;
  private py = 0;
  private vy = 0;
  private speed = BASE_SPEED;
  private boost = 0;
  private score = 0;
  private distance = 0;
  private lastScoreSent = -1;
  private lastDistSent = -1;

  // course
  private gaps: Gap[] = [];
  private rails: Rail[] = [];
  private bubbles: Collectible[] = [];
  private letters: Letter[] = [];
  private powers: Power[] = [];
  private ramps: Ramp[] = [];
  private loops: Loop[] = [];
  private loopActive: Loop | null = null;
  private loopT = 0;
  private cursorX = 0;
  private nextLetterAt = 0;
  private letterIdx = 0;
  private chunksSincePower = 0;
  private powerIdx = 0;
  private currentRail: Rail | null = null;
  private jumpedGap: Gap | null = null;
  private rampUnder: Ramp | null = null; // ramp we're riding (for lip-launch)
  private coyoteT = 0; // grace window to still jump after rolling off an edge
  // pacing state (designed level flow — warm-up → challenge clusters → rest)
  private chunkCount = 0;
  private lastChunk = "";
  private restoreBreather = false;
  private challengeRun = 0; // consecutive HARD chunks (force a breather after a few)
  private chunksSinceReward = 0; // periodic reward corridor cadence
  private lastProgressSent = -1;
  private lastZone = -1;
  private lives = START_LIVES;

  // air / trick
  private spinV = 0;
  private rotAccum = 0;
  private comboFlips = 0;

  // combo
  private comboTricks: string[] = [];
  private comboBase = 0;
  private lastTrickName = "";
  private grindAccrual = 0;
  private grindTime = 0; // seconds on the current rail (drives the escalating payout)
  private grindTier = 0; // 0..3 → GRINDING / ON FIRE / LEGENDARY callout thresholds
  private grindTickT = 0; // countdown to the next rising grind audio tick
  private bankedPoints = 0;
  private bestCombo = 0;
  private trickCount = 0;
  private bubbleCount = 0;
  private lettersGot: boolean[] = [false, false, false, false, false, false];

  // special / flow / power-ups
  private special = 0;
  private flow = false;
  private flowT = 0;
  private magnetT = 0;
  private rocketT = 0;

  // run timer
  private timeLeft = START_TIME;
  private lastTimeSent = -1;
  private sunGlide = START_TIME / TIME_CAP; // eased sun height = time remaining

  // visuals
  private boardRot = 0;
  private crashT = 0;
  private shake = 0;
  private flashT = 0;
  private hitstop = 0;
  private waveT = 0;
  private groundSparkT = 0; // cadence for the rolling-wheel sparkle
  private trail: { x: number; y: number }[] = [];
  private particles: Particle[] = [];
  private speedLines: { y: number; len: number; sp: number }[] = [];
  private stars: { x: number; y: number; s: number }[] = [];
  private city: number[] = [];
  private monster: HTMLImageElement | null = null;
  private coin: HTMLImageElement | null = null;
  private skaterImg: HTMLImageElement | null = null; // warplet PFP override
  private rainbow = false; // secret RAD MODE

  // ghost racing
  private runTime = 0;
  private ghostRec: number[] = [];
  private ghostAccum = 0;
  private ghosts: Ghost[] = [];

  constructor(container: HTMLElement, cb: SkateCallbacks = {}) {
    this.container = container;
    this.cb = cb;
    this.canvas = document.createElement("canvas");
    this.canvas.style.display = "block";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.imageRendering = "pixelated";
    container.appendChild(this.canvas);
    const ctx = this.canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas unsupported");
    this.ctx = ctx;

    for (let i = 0; i < 70; i++) {
      this.stars.push({ x: (i * 97.13) % 1000, y: (i * 53.7) % 100, s: (i % 3) + 1 });
    }
    for (let i = 0; i < 30; i++) this.city.push(14 + ((i * 37) % 30));
    for (let i = 0; i < 14; i++) {
      this.speedLines.push({ y: (i * 71) % 100, len: 40 + ((i * 53) % 120), sp: 1 + (i % 4) * 0.4 });
    }

    this.loadSprites();
    this.resize(container.clientWidth, container.clientHeight);
    this.primeCourse();
    this.rafId = requestAnimationFrame(this.loop);

    if (typeof window !== "undefined") {
      (window as unknown as { __skateEngine?: unknown }).__skateEngine = this;
    }
  }

  private loadSprites() {
    const m = new Image();
    m.onload = () => (this.monster = m);
    m.src = "/surf/monster.png";
    const c = new Image();
    c.onload = () => (this.coin = c);
    c.src = "/icon-transparent.png";
  }

  // ----------------------------------------------------------- public API

  /** Tap/hold = jump on the ground (hold longer = bigger air), backflip in the air. */
  holdStart() {
    if (this.state === "over") return;
    if (this.state === "idle") {
      this.startRun();
      return;
    }
    this.holding = true;
    if (this.state === "running") {
      // a deliberate jump off a ramp lip launches even bigger (but on-screen)
      const rampBoost = this.rampUnder ? this.rampUnder.launch * 0.4 : 0;
      this.rampUnder = null;
      this.coyoteT = 0;
      this.vy = Math.min(JUMP_V + rampBoost, 960);
      this.py = Math.max(this.py, 0.1);
      this.state = "airborne";
      this.spinV = 0;
      this.rotAccum = 0;
      this.comboFlips = 0;
      this.comboTricks.push("AIR");
      this.comboBase += 40;
      this.trickCount++;
      this.emitCombo();
      this.sfx("jump");
    } else if (this.state === "airborne" && this.coyoteT > 0) {
      // coyote time — a late tap after rolling off an edge still jumps, so a
      // one-life death never feels like the button was ignored (Celeste)
      this.coyoteT = 0;
      this.vy = JUMP_V;
      this.comboTricks.push("AIR");
      this.comboBase += 40;
      this.trickCount++;
      this.emitCombo();
      this.sfx("jump");
    } else if (this.state === "grinding") {
      const rail = this.currentRail;
      // perfect-exit: pop off in the last slice of the rail to bank a fat
      // bonus on the whole grind (OlliOlli's perfect dismount)
      if (rail && rail.x1 - this.px < 70 && this.grindTime > 0.25) {
        this.comboBase *= 1.8;
        this.cb.onCallout?.("PERFECT EXIT!", "perfect");
        this.sfx("perfect");
        this.shake = 0.4;
        this.flashT = 0.2;
        this.emitCombo();
        this.addTime(2);
      }
      this.vy = RAIL_POP;
      this.state = "airborne";
      this.currentRail = null;
      this.grindTier = 0;
      this.spinV = 0;
      this.rotAccum = 0;
      this.sfx("jump");
    }
  }

  /** Release = stop flipping / cut the jump — release in the air to land it clean. */
  holdEnd() {
    this.holding = false;
  }

  swipe(dir: SwipeDir) {
    if (this.state === "idle") {
      this.startRun();
      return;
    }
    if (this.state === "airborne") {
      const t = AIR_TRICKS[dir];
      this.addTrick(t.name, t.base);
      this.sfx("trick");
    }
  }

  private startRun() {
    this.resetRun();
    this.state = "running";
    this.holding = true;
    this.cb.onStart?.();
  }

  reset() {
    this.resetRun();
    this.state = "running";
    this.holding = false;
    this.cb.onStart?.();
  }

  /** Return to the title/attract screen (idle auto-scroll), e.g. after a run. */
  toTitle() {
    this.resetRun();
    this.state = "idle";
    this.holding = false;
  }

  private resetRun() {
    this.gaps = [];
    this.rails = [];
    this.ramps = [];
    this.loops = [];
    this.loopActive = null;
    this.loopT = 0;
    this.bubbles = [];
    this.letters = [];
    this.powers = [];
    this.particles = [];
    this.trail = [];
    this.chunkCount = 0;
    this.lastChunk = "";
    this.restoreBreather = false;
    this.challengeRun = 0;
    this.chunksSinceReward = 0;
    this.lastProgressSent = -1;
    this.lastZone = -1;
    this.lives = START_LIVES;
    this.coyoteT = 0;
    this.px = 0;
    this.py = 0;
    this.vy = 0;
    this.speed = BASE_SPEED;
    this.boost = 0;
    this.score = 0;
    this.distance = 0;
    this.lastScoreSent = -1;
    this.lastDistSent = -1;
    this.cursorX = 0;
    this.letterIdx = 0;
    this.nextLetterAt = 1000;
    this.chunksSincePower = 0;
    this.currentRail = null;
    this.jumpedGap = null;
    this.rampUnder = null;
    this.spinV = 0;
    this.rotAccum = 0;
    this.comboFlips = 0;
    this.comboTricks = [];
    this.comboBase = 0;
    this.lastTrickName = "";
    this.grindAccrual = 0;
    this.grindTime = 0;
    this.grindTier = 0;
    this.grindTickT = 0;
    this.bankedPoints = 0;
    this.bestCombo = 0;
    this.trickCount = 0;
    this.bubbleCount = 0;
    this.lettersGot = [false, false, false, false, false, false];
    this.special = 0;
    this.flow = false;
    this.flowT = 0;
    this.magnetT = 0;
    this.rocketT = 0;
    this.timeLeft = START_TIME;
    this.lastTimeSent = -1;
    this.sunGlide = START_TIME / TIME_CAP;
    this.boardRot = 0;
    this.crashT = 0;
    this.shake = 0;
    this.hitstop = 0;
    this.runTime = 0;
    this.ghostRec = [];
    this.ghostAccum = 0;
    this.primeCourse();
    this.cb.onScore?.(0);
    this.cb.onDistance?.(0);
    this.cb.onProgress?.(0);
    this.cb.onZone?.(ZONES[0].name, 0, ZONES[0].accent);
    this.cb.onLives?.(this.lives);
    this.cb.onTime?.(this.timeLeft);
    this.cb.onCombo?.(null);
    this.cb.onSpecial?.(0);
    this.cb.onFlow?.(false);
    this.cb.onPower?.(null);
    this.cb.onLetters?.([...this.lettersGot]);
  }

  /** Race against recorded runs from other players. */
  setGhosts(ghosts: GhostInput[]) {
    this.ghosts = ghosts.slice(0, 5).map((g, i) => ({
      samples: g.samples,
      color: g.color || GHOST_COLORS[i % GHOST_COLORS.length],
      name: g.name,
      spin: i % 2 === 0 ? -1 : 1, // alternate back/front flips for variety
    }));
  }

  /** This run's recording (flat [px,py] pairs every GHOST_DT s). */
  getRecording(): number[] {
    return this.ghostRec;
  }

  /** Swap the rider sprite for a held Warplet NFT (or null to reset). */
  setSkaterImage(img: HTMLImageElement | null) {
    this.skaterImg = img;
  }

  /** Secret RAD MODE — rainbow trails + glow. */
  setRainbow(on: boolean) {
    this.rainbow = on;
  }

  resize(width: number, height: number) {
    if (width <= 0 || height <= 0) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Zoom OUT on small screens so the course isn't cramped: render into a
    // larger logical space and let the (100%-sized) canvas scale it down to the
    // container, so more of the course is visible and the sprites/obstacles are
    // smaller — more room to read and react. Desktop (≥520px) renders 1:1.
    const zoom = Math.max(0.68, Math.min(1, width / 520));
    this.W = Math.round(width / zoom);
    this.H = Math.round(height / zoom);
    this.canvas.width = Math.floor(this.W * this.dpr);
    this.canvas.height = Math.floor(this.H * this.dpr);
    this.groundY = Math.round(this.H * 0.78);
    this.skaterX = Math.round(this.W * 0.28);
  }

  dispose() {
    this.disposed = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.canvas.remove();
  }

  // --------------------------------------------------------- combo / score

  private sfx(t: SfxType) {
    this.cb.onSfx?.(t);
  }

  private comboMultiplier(): number {
    return Math.max(1, this.comboTricks.length);
  }

  private emitCombo() {
    if (this.comboTricks.length === 0) {
      this.cb.onCombo?.(null);
      return;
    }
    const mult = this.comboMultiplier();
    this.cb.onCombo?.({
      tricks: this.comboTricks.slice(-6),
      base: Math.round(this.comboBase),
      multiplier: mult,
      live: Math.round(this.comboBase * mult * (this.flow ? 2 : 1)),
    });
  }

  private addTrick(name: string, base: number) {
    const repeat = name === this.lastTrickName ? 0.34 : 1;
    this.lastTrickName = name;
    this.comboTricks.push(name);
    this.comboBase += base * repeat;
    this.trickCount++;
    this.bumpSpecial(0.08);
    this.emitCombo();
  }

  private bumpSpecial(amount: number) {
    if (this.flow) return;
    this.special = Math.min(1, this.special + amount);
    this.cb.onSpecial?.(this.special);
    if (this.special >= 1) this.enterFlow();
  }

  private enterFlow() {
    this.flow = true;
    this.flowT = 7;
    this.cb.onFlow?.(true);
    this.sfx("flow");
  }

  private addScore(points: number) {
    this.bankedPoints += points;
    this.refreshScore();
  }

  /** Recharge the run clock for a great play (clamped, fires a +Xs pop). */
  private addTime(sec: number) {
    if (this.state === "over" || sec <= 0) return;
    this.timeLeft = Math.min(TIME_CAP, this.timeLeft + sec);
    this.cb.onTimeBonus?.(sec);
    this.emitTime();
  }

  private emitTime() {
    const v = Math.max(0, this.timeLeft);
    if (Math.abs(v - this.lastTimeSent) >= 0.1 || (v === 0 && this.lastTimeSent !== 0)) {
      this.lastTimeSent = v;
      this.cb.onTime?.(v);
    }
  }

  private refreshScore() {
    this.score = Math.floor(this.distance) * 8 + this.bankedPoints;
    if (this.score !== this.lastScoreSent) {
      this.lastScoreSent = this.score;
      this.cb.onScore?.(this.score);
    }
  }

  private bankCombo(landMult: number) {
    if (this.comboTricks.length === 0) return 0;
    const mult = this.comboMultiplier();
    const banked = Math.round(
      this.comboBase * mult * landMult * (this.flow ? 2 : 1)
    );
    if (banked > this.bestCombo) this.bestCombo = banked;
    this.comboTricks = [];
    this.comboBase = 0;
    this.lastTrickName = "";
    this.comboFlips = 0;
    this.cb.onCombo?.(null);
    if (banked > 0) {
      this.addScore(banked);
      this.cb.onBank?.(banked);
    }
    return banked;
  }

  private loseCombo() {
    if (this.comboTricks.length === 0) return 0;
    const lost = Math.round(
      this.comboBase * this.comboMultiplier() * (this.flow ? 2 : 1)
    );
    this.comboTricks = [];
    this.comboBase = 0;
    this.lastTrickName = "";
    this.comboFlips = 0;
    this.cb.onCombo?.(null);
    return lost;
  }

  // ----------------------------------------------------------- course gen

  private rand(n: number): number {
    this.waveSeed = (this.waveSeed * 1103515245 + 12345) & 0x7fffffff;
    return (this.waveSeed / 0x7fffffff) * n;
  }
  private waveSeed = 20240611;

  private difficulty(): number {
    // endless: difficulty rides the run clock, not position. Gentle for the
    // first ~80s, then holds near max while speed + pacing keep ramping.
    return Math.min(this.runTime / 80, 1);
  }

  private zoneIndexAt(worldX: number): number {
    // zones cycle forever; later laps are harder because difficulty() climbs
    return Math.floor(Math.max(0, worldX) / ZONE_LEN) % ZONES.length;
  }

  /** Extra runway before a hazard, scaled by speed so fast = more warning. */
  private lead(base: number): number {
    return base + this.effSpeed() * 0.16;
  }

  private primeCourse() {
    this.waveSeed = 20240611;
    this.cursorX = 760;
    while (this.cursorX < this.px + this.W * 2.5) this.addChunk();
  }

  private generateAhead() {
    while (this.cursorX < this.px + this.W * 2.5) {
      this.addChunk();
    }
    const cull = this.px - this.W;
    this.gaps = this.gaps.filter((g) => g.x1 > cull);
    this.rails = this.rails.filter((r) => r.x1 > cull);
    this.ramps = this.ramps.filter((r) => r.xLip > cull);
    this.loops = this.loops.filter((l) => l.x + 2 * l.r > cull);
    this.bubbles = this.bubbles.filter((b) => b.x > cull && !b.taken);
    this.letters = this.letters.filter((l) => l.x > cull && !l.taken);
    this.powers = this.powers.filter((p) => p.x > cull && !p.taken);
  }

  private bubbleArc(cx: number, baseY: number, peak: number, n = 5, step = 34) {
    const h = (n - 1) / 2;
    for (let i = 0; i < n; i++) {
      const k = i - h;
      this.bubbles.push({ x: cx + k * step, y: baseY + peak * (1 - (k * k) / (h * h)), taken: false });
    }
  }

  private maybeLetter(x: number, y: number) {
    if (this.cursorX < this.nextLetterAt) return;
    const slot = this.letterIdx % STREME_LETTERS.length;
    this.letters.push({ x, y, ch: STREME_LETTERS[slot], slot, taken: false });
    this.letterIdx = (this.letterIdx + 1) % STREME_LETTERS.length;
    this.nextLetterAt = this.cursorX + 2400 + this.rand(800);
  }

  private maybePower(x: number, y: number) {
    this.chunksSincePower++;
    if (this.chunksSincePower < 7) return;
    if (this.rand(1) < 0.55) return;
    this.chunksSincePower = 0;
    const kind: PowerKind = this.powerIdx++ % 2 === 0 ? "magnet" : "rocket";
    this.powers.push({ x, y, kind, taken: false });
  }

  private addRamp(x0: number, size: "small" | "med" | "big"): Ramp {
    const d = this.difficulty();
    let len: number, h: number, launch: number;
    // exaggerated size range: little kickers vs huge launch ramps
    if (size === "small") { len = 76; h = 40 + d * 10; launch = 600 + d * 60; }
    else if (size === "med") { len = 116; h = 84 + d * 16; launch = 880 + d * 90; }
    else { len = 168; h = 150 + d * 26; launch = 1180 + d * 130; }
    const r: Ramp = { x0, xLip: x0 + len, height: h, launch };
    this.ramps.push(r);
    return r;
  }

  private coinLine(x: number, y: number, n: number, step = 44) {
    for (let i = 0; i < n; i++) this.bubbles.push({ x: x + i * step, y, taken: false });
  }

  // ---- set pieces (each lays features from cursorX and advances it) ----

  private spFlat() {
    const x = this.cursorX;
    const len = 230 + this.rand(120);
    this.coinLine(x + 50, 44, 6);
    if (this.rand(1) < 0.4) this.bubbleArc(x + len / 2, 90, 80, 5, 36);
    this.maybeLetter(x + len / 2, 120);
    this.maybePower(x + len / 2, 150);
    this.cursorX = x + len;
  }

  private spKickerAir(size: "small" | "med") {
    const x = this.cursorX;
    const r = this.addRamp(x + 110 + this.rand(50), size);
    this.bubbleArc(r.xLip + 90, r.height + 50, 120, 5, 38);
    this.maybeLetter(r.xLip + 90, r.height + 150);
    this.cursorX = r.xLip + 320 + this.rand(60);
  }

  private spGap() {
    // narrow, jumpable-without-a-ramp gap; coin arc traces the jump
    const x = this.cursorX;
    const d = this.difficulty();
    const w = 90 + d * 80 + this.rand(50);
    const gx = x + this.lead(120) + this.rand(60);
    this.gaps.push({ x0: gx, x1: gx + w });
    this.bubbleArc(gx + w / 2, 120, 70, 5, 34);
    this.maybeLetter(gx + w / 2, 170);
    this.maybePower(gx + w / 2, 200);
    this.cursorX = gx + w + 220 + this.rand(70);
  }

  private spKickerGap() {
    // WIDE gap — always fronted by a ramp so it's clearable (solvability rule)
    const x = this.cursorX;
    const d = this.difficulty();
    const r = this.addRamp(x + this.lead(110) + this.rand(40), "med");
    const w = 170 + d * 200 + this.rand(70);
    const gx = r.xLip + 6;
    this.gaps.push({ x0: gx, x1: gx + w });
    this.bubbleArc(gx + w / 2, r.height + 30, 110, 6, 36);
    this.maybeLetter(gx + w / 2, r.height + 170);
    this.cursorX = gx + w + 260 + this.rand(80);
  }

  private spRail() {
    const x = this.cursorX;
    const len = 220 + this.rand(160);
    const h = 66 + this.rand(22);
    const rx = x + 130 + this.rand(60);
    this.rails.push({ x0: rx, x1: rx + len, height: h });
    this.coinLine(rx + 26, h + 20, 6, len / 6);
    this.maybeLetter(rx + len / 2, h + 52);
    this.maybePower(rx + len / 2, h + 90);
    this.cursorX = rx + len + 200 + this.rand(70);
  }

  private spRailGap() {
    // a gap under a rail — grind across, or jump it from the ground
    const x = this.cursorX;
    const len = 240 + this.rand(140);
    const h = 64 + this.rand(20);
    const rx = x + this.lead(110) + this.rand(50);
    this.rails.push({ x0: rx, x1: rx + len, height: h });
    const gx = rx + len * 0.32;
    this.gaps.push({ x0: gx, x1: gx + Math.min(len * 0.36, 140) });
    this.coinLine(rx + 26, h + 20, 6, len / 6);
    this.maybeLetter(rx + len / 2, h + 52);
    this.cursorX = rx + len + 220 + this.rand(70);
  }

  private spKickerRail() {
    // high line: ramp launches you up to an elevated rail; ground stays clear
    const x = this.cursorX;
    const r = this.addRamp(x + 120 + this.rand(40), "med");
    const rx = r.xLip + 110;
    const len = 200 + this.rand(120);
    const railH = r.height + 58;
    this.rails.push({ x0: rx, x1: rx + len, height: railH });
    this.coinLine(rx + 20, railH + 18, 5, len / 5);
    this.maybeLetter(rx + len / 2, railH + 50);
    this.cursorX = rx + len + 220 + this.rand(70);
  }

  private spDoubleKicker() {
    const x = this.cursorX;
    const r1 = this.addRamp(x + 120 + this.rand(40), "small");
    this.bubbleArc(r1.xLip + 70, r1.height + 40, 90, 4, 34);
    const r2 = this.addRamp(r1.xLip + 220, "small");
    this.bubbleArc(r2.xLip + 70, r2.height + 40, 90, 4, 34);
    this.cursorX = r2.xLip + 280 + this.rand(60);
  }

  private spQuarter() {
    // crescendo set piece — big quarterpipe, huge air, sky-high reward
    const x = this.cursorX;
    const r = this.addRamp(x + 140 + this.rand(40), "big");
    this.bubbleArc(r.xLip + 100, r.height + 60, 160, 6, 40);
    this.maybeLetter(r.xLip + 100, r.height + 220);
    this.powers.push({
      x: r.xLip + 100,
      y: r.height + 150,
      kind: this.powerIdx++ % 2 === 0 ? "magnet" : "rocket",
      taken: false,
    });
    this.chunksSincePower = 0;
    this.cursorX = r.xLip + 440 + this.rand(80);
  }

  private spLoop() {
    // a Sonic-style loop-the-loop: speed run-up, then a ring you ride around
    const x = this.cursorX;
    this.coinLine(x + 40, 44, 4, 50);
    const lx = x + 250;
    this.loops.push({ x: lx, r: LOOP_R });
    this.coinLine(lx + 2 * LOOP_R + 30, 44, 4, 50);
    this.cursorX = lx + 2 * LOOP_R + 300;
  }

  private spRhythm() {
    // a cadence of evenly spaced little kickers — muscle-memory bouncing, the
    // "rhythm game" beat OlliOlli leans on. No gaps, just flow + coins.
    const x = this.cursorX;
    let rx = x + 110;
    const n = 3 + Math.floor(this.rand(1.6));
    for (let i = 0; i < n; i++) {
      const r = this.addRamp(rx, "small");
      this.bubbleArc(r.xLip + 48, r.height + 34, 64, 3, 30);
      rx = r.xLip + 150;
    }
    this.maybeLetter(x + 200, 150);
    this.cursorX = rx + 130;
  }

  private spStairs() {
    // a descending grind staircase — chain three rails stepping down, each
    // landing on solid ground (a satisfying grind line, no pit risk)
    const x = this.cursorX;
    let rx = x + 130;
    let h = 124 + this.rand(20);
    for (let i = 0; i < 3; i++) {
      const len = 116 + this.rand(40);
      this.rails.push({ x0: rx, x1: rx + len, height: h });
      this.coinLine(rx + 16, h + 18, 3, len / 3);
      rx += len + 42;
      h = Math.max(40, h - 34);
    }
    this.maybeLetter(x + 220, 170);
    this.cursorX = rx + 150;
  }

  private spRest() {
    // a forced breather after a challenge cluster — long, safe, coins to grab
    const x = this.cursorX;
    const len = 320 + this.rand(120);
    this.coinLine(x + 50, 44, 8, 52);
    this.maybeLetter(x + len / 2, 110);
    this.cursorX = x + len;
  }

  private spReward() {
    // a no-risk reward corridor before the difficulty climbs (positive surprise)
    const x = this.cursorX;
    const len = 300;
    this.bubbleArc(x + len / 2, 80, 92, 7, 38);
    this.powers.push({
      x: x + len / 2,
      y: 120,
      kind: this.powerIdx++ % 2 === 0 ? "magnet" : "rocket",
      taken: false,
    });
    this.chunksSincePower = 0;
    this.maybeLetter(x + len * 0.82, 150);
    this.cursorX = x + len + 120;
  }

  private readonly HARD = new Set(["kickerGap", "railGap", "kickerRail", "quarter"]);

  private buildChunk(name: string, d: number) {
    switch (name) {
      case "flat": this.spFlat(); break;
      case "kickerAir": this.spKickerAir(d > 0.5 ? "med" : "small"); break;
      case "rail": this.spRail(); break;
      case "gap": this.spGap(); break;
      case "doubleKicker": this.spDoubleKicker(); break;
      case "kickerRail": this.spKickerRail(); break;
      case "kickerGap": this.spKickerGap(); break;
      case "railGap": this.spRailGap(); break;
      case "quarter": this.spQuarter(); break;
      case "loop": this.spLoop(); break;
      case "rhythm": this.spRhythm(); break;
      case "stairs": this.spStairs(); break;
      default: this.spFlat();
    }
  }

  /** Which set pieces are unlocked yet — gradual mechanic introduction. */
  private unlocked(name: string, t: number): boolean {
    switch (name) {
      case "gap": return t > 16;
      case "doubleKicker": return t > 20;
      case "rhythm": return t > 18;
      case "stairs": return t > 26;
      case "railGap": return t > 28;
      case "kickerRail": return t > 30;
      case "kickerGap": return t > 38;
      case "quarter": return t > 46;
      case "loop": return t > 58;
      default: return true; // flat, kickerAir, rail — always available
    }
  }

  /** Bias the weighted pick by difficulty: hard/dense late, flat early. */
  private chunkBias(name: string, d: number): number {
    if (this.HARD.has(name)) return 0.45 + d * 1.25; // rare early → common late
    if (name === "flat") return Math.max(0.25, 1.3 - d * 0.9); // common early
    return 1;
  }

  private addChunk() {
    this.chunkCount++;
    const d = this.difficulty();
    const t = this.runTime;

    // --- opening: orient to speed + teach the mechanics on safe ground ---
    if (this.chunkCount <= 2) { this.spFlat(); this.lastChunk = "flat"; return; }
    if (this.chunkCount <= 4) { this.spKickerAir("small"); this.lastChunk = "kickerAir"; return; }
    if (this.chunkCount === 5) { this.spRail(); this.lastChunk = "rail"; return; }

    // --- forced REST after a challenge cluster (tension → release) ---
    if (this.restoreBreather) {
      this.restoreBreather = false;
      this.challengeRun = 0;
      this.spRest();
      this.lastChunk = "flat";
      return;
    }

    // --- periodic REWARD corridor before the difficulty climbs ---
    if (this.chunksSinceReward >= 6 && this.rand(1) < 0.6) {
      this.chunksSinceReward = 0;
      this.spReward();
      this.lastChunk = "reward";
      return;
    }

    // --- pick from this zone's mix: unlocked, no repeat, no two HARD in a row,
    //     weighted toward harder pieces as difficulty climbs ---
    const zone = ZONES[this.zoneIndexAt(this.cursorX)];
    const lastHard = this.HARD.has(this.lastChunk);
    const choices: [string, number][] = [];
    for (const name in zone.mix) {
      const w = zone.mix[name];
      if (w <= 0) continue;
      if (name === this.lastChunk) continue;
      if (!this.unlocked(name, t)) continue;
      if (lastHard && this.HARD.has(name)) continue;
      choices.push([name, w * this.chunkBias(name, d)]);
    }
    if (choices.length === 0) { this.spFlat(); this.lastChunk = "flat"; return; }

    const total = choices.reduce((s, [, w]) => s + w, 0);
    let r = this.rand(total);
    let pick = choices[0][0];
    for (const [name, w] of choices) {
      if (r < w) { pick = name; break; }
      r -= w;
    }

    this.buildChunk(pick, d);
    this.chunksSinceReward++;
    if (this.HARD.has(pick)) {
      this.challengeRun++;
      // breather after 2 hard chunks early, 3 once the player is warmed up
      if (this.challengeRun >= (d > 0.55 ? 3 : 2)) this.restoreBreather = true;
    } else {
      this.challengeRun = 0;
    }
    this.lastChunk = pick;
  }

  private overGap(worldX: number): boolean {
    for (const g of this.gaps) if (worldX > g.x0 && worldX < g.x1) return true;
    return false;
  }

  private rampAt(worldX: number): Ramp | null {
    for (const r of this.ramps) if (worldX >= r.x0 && worldX < r.xLip) return r;
    return null;
  }

  /** Eased kicker surface (mellow base, steep lip) above the baseline. */
  private rampSurface(r: Ramp, worldX: number): number {
    const t = Math.min(Math.max((worldX - r.x0) / (r.xLip - r.x0), 0), 1);
    return r.height * t * t;
  }

  /** Ground height at a world x — ramp surface, 0 flat, or NaN over a gap. */
  private surfaceAt(worldX: number): number {
    for (const g of this.gaps) if (worldX > g.x0 && worldX < g.x1) return NaN;
    const r = this.rampAt(worldX);
    if (r) return this.rampSurface(r, worldX);
    return 0;
  }

  private railCaptureAt(worldX: number, height: number): Rail | null {
    for (const r of this.rails) {
      if (worldX >= r.x0 - 6 && worldX <= r.x1 && height <= r.height + 22 && height >= r.height - 18) {
        return r;
      }
    }
    return null;
  }

  // ----------------------------------------------------------- main loop

  private loop = (now: number) => {
    if (this.disposed) return;
    const dt =
      this.lastTime === null ? 0.016 : Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.waveT += dt;
    this.update(dt);
    this.render();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private effSpeed(): number {
    return this.speed + this.boost + (this.rocketT > 0 ? ROCKET_SPEED : 0);
  }

  private update(dt: number) {
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return; // freeze for a couple frames on a perfect landing
    }

    if (this.state === "idle" || this.state === "over") {
      this.px += BASE_SPEED * 0.5 * dt;
      this.py = 0;
      this.generateAhead();
      this.advanceVisuals(dt, BASE_SPEED * 0.5);
      return;
    }

    // run clock + ghost recording (the clock keeps ticking through crashes)
    this.runTime += dt;
    this.ghostAccum += dt;
    while (this.ghostAccum >= GHOST_DT) {
      this.ghostAccum -= GHOST_DT;
      this.ghostRec.push(Math.round(this.px), Math.round(this.py));
    }

    // timers
    if (this.flow) {
      this.flowT -= dt;
      this.special = Math.max(0, this.flowT / 7);
      this.cb.onSpecial?.(this.special);
      if (this.flowT <= 0) {
        this.flow = false;
        this.special = 0;
        this.cb.onFlow?.(false);
        this.cb.onSpecial?.(0);
      }
    }
    if (this.magnetT > 0) {
      this.magnetT -= dt;
      if (this.magnetT <= 0) this.cb.onPower?.(this.rocketT > 0 ? "rocket" : null);
    }
    if (this.rocketT > 0) {
      this.rocketT -= dt;
      if (this.rocketT <= 0) this.cb.onPower?.(this.magnetT > 0 ? "magnet" : null);
    }
    if (this.boost > 0) this.boost = Math.max(0, this.boost - BOOST_DECAY * dt);

    if (this.state === "loop") {
      // ride the ring (world frozen) then fire out forward with a boost
      this.loopT += dt / LOOP_DUR;
      if (this.rand(1) < 0.6 && this.loopActive) {
        this.spark(this.skaterX, this.groundY - this.loopActive.r, 1);
      }
      if (this.loopT >= 1) {
        const l = this.loopActive;
        this.loopActive = null;
        this.state = "running";
        // exit at the ring's centre (where the skater already is at the bottom
        // of the loop) so running resumes seamlessly — no forward snap. phi at
        // loopT=1 is 2π ≡ 0, so boardRot=0 is continuous too.
        if (l) { l.done = true; this.px = l.x + l.r; }
        this.py = 0;
        this.vy = 0;
        this.boardRot = 0;
        this.speed = Math.min(MAX_SPEED, this.speed + 90);
        this.boost = Math.min(BOOST_CAP, this.boost + 150);
        this.cb.onCallout?.("LOOP!", "combo");
        this.flashT = 0.3;
        this.sfx("perfect");
        this.addTime(3);
      }
      this.advanceVisuals(dt, 0);
      return;
    }

    if (this.state === "crash") {
      // plunge straight down into the pit (world frozen so the hole stays put
      // under the falling rider), tumbling, until off-screen → game over
      this.crashT += dt;
      this.boardRot += 9 * dt;
      this.vy -= GRAVITY * dt;
      this.py += this.vy * dt;
      this.advanceVisuals(dt, 0);
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.5);
      if (this.py < -this.groundY - 80 || this.crashT > 1.3) {
        this.gameOver(false);
      }
      return;
    }

    // tiered acceleration: climbs fast early, plateaus near the top (Canabalt)
    const accel = 24 * (1 - this.speed / MAX_SPEED) + 2;
    this.speed = Math.min(MAX_SPEED, this.speed + accel * dt);
    const eff = this.effSpeed();
    this.px += eff * dt;
    this.distance += (eff * dt) / METRES;
    const dm = Math.floor(this.distance);
    if (dm !== this.lastDistSent) {
      this.lastDistSent = dm;
      this.cb.onDistance?.(dm);
    }
    this.refreshScore();

    // ---- countdown clock: drains in real time and SPEEDS UP the longer you
    //      last (1× at the drop-in → up to 3.5× deep into a run), so late runs
    //      demand constant trick-chaining — a natural soft cap for an endless
    //      game. Recharged by great plays; zero = the run is over.
    const drainRate = Math.min(3.5, 1 + this.runTime / 90);
    this.timeLeft -= drainRate * dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.emitTime();
      this.cb.onCallout?.("TIME UP!", "sloppy");
      this.gameOver(false, true);
      return;
    }
    this.emitTime();

    // ---- endless progress: a looping bar that fills across each zone, plus a
    //      name callout when a new biome begins
    const zp = this.px / ZONE_LEN;
    const frac = zp - Math.floor(zp); // 0..1 through the current zone
    if (Math.abs(frac - this.lastProgressSent) >= 0.01 || frac < this.lastProgressSent) {
      this.lastProgressSent = frac;
      this.cb.onProgress?.(frac);
    }
    const zi = this.zoneIndexAt(this.px);
    if (zi !== this.lastZone) {
      this.lastZone = zi;
      const z = ZONES[zi];
      this.cb.onZone?.(z.name, zi, z.accent);
      if (this.distance > 5) {
        this.cb.onCallout?.(z.name, "milestone");
        this.sfx("milestone");
      }
    }

    // enter a Sonic loop when we reach its centre (grounded). Triggering at the
    // centre — where we also exit — keeps entry/exit smooth.
    if (this.state === "running" && this.py < 12) {
      const loop = this.loops.find(
        (l) => !l.done && this.px >= l.x + l.r - 30 && this.px <= l.x + l.r + 30
      );
      if (loop) {
        this.state = "loop";
        this.loopActive = loop;
        this.loopT = 0;
        this.px = loop.x + loop.r;
        this.rampUnder = null;
        this.sfx("grind");
        this.advanceVisuals(dt, 0);
        return;
      }
    }

    if (this.state === "running") {
      // turbo (rocket) is pure speed now — you still ride ramps and fall in pits
      const ramp = this.rampAt(this.px);
      if (ramp) {
        // riding up the ramp face
        this.rampUnder = ramp;
        this.py = this.rampSurface(ramp, this.px);
        const slope =
          (this.rampSurface(ramp, this.px + 5) -
            this.rampSurface(ramp, this.px - 5)) /
          10;
        this.boardRot = -Math.atan(slope);
      } else if (this.overGap(this.px)) {
        this.rampUnder = null;
        this.state = "airborne";
        this.vy = -40;
        this.coyoteT = COYOTE; // brief grace to still pop a jump after the edge
      } else if (this.rampUnder && this.px < this.rampUnder.xLip + 90) {
        // crossed the lip (even if a fast frame skipped the exact window) —
        // launch up + forward instead of snapping straight down to the street
        const r = this.rampUnder;
        this.rampUnder = null;
        this.launchFromRamp(r);
      } else {
        this.rampUnder = null;
        this.py = 0;
        this.boardRot *= Math.max(0, 1 - dt * 12);
      }
    } else if (this.state === "airborne") {
      if (this.coyoteT > 0) this.coyoteT = Math.max(0, this.coyoteT - dt);
      const g = this.holding && this.vy > 0 ? JUMP_HOLD_G : GRAVITY;
      this.vy -= g * dt;
      this.py += this.vy * dt;

      // hold to backflip; release to ease the board upright so you can stomp it
      if (this.holding) {
        this.spinV = Math.min(SPIN_MAX, this.spinV + SPIN_ACCEL * dt);
        this.boardRot += this.spinV * dt;
        this.rotAccum += this.spinV * dt;
        while (this.rotAccum >= Math.PI * 2) {
          this.rotAccum -= Math.PI * 2;
          this.comboFlips++;
          const name = FLIP_NAMES[(this.comboFlips - 1) % FLIP_NAMES.length];
          this.comboTricks.push(name);
          this.comboBase += FLIP_BASE;
          this.trickCount++;
          this.bumpSpecial(0.09);
          this.emitCombo();
          this.sfx("trick");
        }
      } else {
        this.spinV = 0;
        const target = Math.round(this.boardRot / (Math.PI * 2)) * (Math.PI * 2);
        this.boardRot += (target - this.boardRot) * Math.min(dt * 11, 1);
      }

      if (this.vy <= 40) {
        const rail = this.railCaptureAt(this.px, this.py);
        if (rail) {
          this.currentRail = rail;
          this.py = rail.height;
          this.vy = 0;
          this.spinV = 0;
          this.state = "grinding";
          this.grindAccrual = 0;
          this.grindTime = 0;
          this.grindTier = 0;
          this.grindTickT = 0;
          this.coyoteT = 0;
          this.boardRot = 0;
          this.addTrick("50-50 GRIND", 120);
          this.sfx("grind");
        }
      }

      if (this.state === "airborne" && this.vy <= 0) {
        const surf = this.surfaceAt(this.px);
        if (Number.isNaN(surf)) {
          if (this.py <= -10) this.crash();
        } else if (this.py <= surf) {
          this.resolveLanding(surf);
        }
      }
    } else if (this.state === "grinding") {
      const rail = this.currentRail;
      if (!rail || this.px > rail.x1) {
        // rode off the end without popping — small hop back to skating
        this.currentRail = null;
        this.state = "airborne";
        this.vy = RAIL_END_POP;
        this.grindTier = 0;
      } else {
        this.py = rail.height;
        this.grindTime += dt;
        // the longer you hold, the faster the score climbs (THPS multiplier)
        const gmult = 1 + this.grindTime * GRIND_RAMP;
        this.grindAccrual += eff * dt;
        while (this.grindAccrual >= 50) {
          this.grindAccrual -= 50;
          this.comboBase += Math.round(GRIND_BASE * gmult);
          this.bumpSpecial(0.012);
          this.emitCombo();
        }
        // sparks get denser as the grind builds; audio ticks rise in pitch
        const sparkN = this.grindTime > 2.5 ? 2 : 1;
        if (this.rand(1) < Math.min(1, 0.45 + this.grindTime * 0.35)) {
          this.spark(this.skaterX, this.groundY - this.py, sparkN);
        }
        this.grindTickT -= dt;
        if (this.grindTickT <= 0) {
          this.grindTickT = Math.max(0.07, 0.2 - this.grindTime * 0.03);
          this.cb.onGrindTick?.(this.grindTime);
        }
        // threshold callouts ratchet the tension
        const tier =
          this.grindTime >= 4 ? 3 : this.grindTime >= 2.5 ? 2 : this.grindTime >= 1 ? 1 : 0;
        if (tier > this.grindTier) {
          this.grindTier = tier;
          this.cb.onCallout?.(
            tier === 3 ? "LEGENDARY!" : tier === 2 ? "ON FIRE!" : "GRINDING!",
            "combo"
          );
          this.shake = Math.max(this.shake, 0.15 + tier * 0.1);
        }
      }
    }

    // rolling-wheel sparkle so the skater never looks static on the ground
    // (denser/brighter the faster you go); skipped on ramps and mid-air
    if (this.state === "running" && this.py < 8) {
      const sn = Math.max(0, Math.min(1, (eff - BASE_SPEED) / (MAX_SPEED - BASE_SPEED)));
      this.groundSparkT -= dt;
      if (this.groundSparkT <= 0) {
        this.groundSparkT = 0.085 - 0.055 * sn;
        this.rollSparkle(sn);
      }
    }

    this.collect();
    this.generateAhead();
    this.advanceVisuals(dt, eff);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.5);
    if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt);
  }

  private launchFromRamp(r: Ramp) {
    this.state = "airborne";
    const norm = Math.max(
      0,
      Math.min(1, (this.effSpeed() - BASE_SPEED) / (MAX_SPEED - BASE_SPEED))
    );
    // cap so even the big ramps keep you on screen (height still varies the feel)
    this.vy = Math.min(700, r.launch * (0.85 + 0.3 * norm));
    this.boost = Math.min(BOOST_CAP, this.boost + 55); // ramps fling you forward
    this.spinV = 0;
    this.rotAccum = 0;
    this.comboFlips = 0;
    this.comboTricks.push("AIR");
    this.comboBase += 40;
    this.trickCount++;
    this.emitCombo();
    this.sfx("jump");
    const sy = this.groundY - this.py;
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x: this.skaterX, y: sy, vx: this.rand(80) - 40, vy: -this.rand(110),
        life: 0.35, maxLife: 0.35, color: C_CYAN, size: 2,
      });
    }
  }

  private resolveLanding(surf: number) {
    this.py = surf;
    this.spinV = 0;
    this.rampUnder = null;
    this.state = "running";

    // how upright is the board? small offset = clean
    let off = Math.abs(((this.boardRot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
    off = Math.min(off, Math.PI * 2 - off);
    const flipped = this.comboFlips > 0;

    // near-miss bonus if we just barely cleared a gap
    let near = false;
    if (this.jumpedGap && this.px - this.jumpedGap.x1 < 55 && this.px > this.jumpedGap.x1) {
      near = true;
    }
    this.jumpedGap = null;

    if (off < 0.38) {
      // CLEAN — boost + payout (PERFECT if you actually flipped)
      this.boardRot = 0;
      const banked = this.bankCombo(flipped ? 1.6 : 1.1);
      this.boost = Math.min(BOOST_CAP, this.boost + (flipped ? BOOST_PERFECT : BOOST_SICK));
      if (flipped) {
        this.cb.onCallout?.("PERFECT!", "perfect");
        this.sfx("perfect");
        this.shake = 0.7;
        this.hitstop = 0.05;
        this.flashT = 0.25;
        this.addTime(2.5); // a stomped flip buys you serious time
      } else {
        this.sfx("land");
        this.shake = 0.3;
        this.addTime(1.4);
      }
      this.landBurst(banked > 800 ? 16 : 9, C_GOLD);
    } else if (off < 0.95) {
      // SICK — clean enough, small boost
      this.boardRot = 0;
      this.bankCombo(1.2);
      this.boost = Math.min(BOOST_CAP, this.boost + BOOST_SICK * 0.6);
      this.cb.onCallout?.("SICK!", "sick");
      this.sfx("land");
      this.shake = 0.35;
      this.landBurst(8, C_CYAN);
      this.addTime(0.9);
    } else {
      // SLOPPY — landed mid-flip: keep some points, lose speed, no boost
      this.boardRot = 0;
      this.bankCombo(0.4);
      this.speed = Math.max(BASE_SPEED, this.speed * 0.8);
      this.cb.onCallout?.("SLOPPY", "sloppy");
      this.sfx("land");
      this.shake = 0.4;
      this.landBurst(6, C_PINK);
    }

    if (near) {
      this.addScore(400);
      this.cb.onBank?.(400);
      this.cb.onCallout?.("CLOSE!", "close");
      this.boost = Math.min(BOOST_CAP, this.boost + 70);
      this.addTime(1.5); // threading a gap is exactly the kind of "great" we reward
    }
  }

  private landBurst(n: number, color: string) {
    const sy = this.groundY;
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: this.skaterX + (this.rand(26) - 13),
        y: sy,
        vx: this.rand(120) - 60,
        vy: -this.rand(150),
        life: 0.45,
        maxLife: 0.45,
        color,
        size: 2 + Math.floor(this.rand(2)),
      });
    }
  }

  private crash() {
    // missed the gap — plunge into the pit. vy is set negative so the rider
    // drops *down* (not the old upward pop); the crash state finishes the fall.
    const lost = this.loseCombo() ?? 0;
    this.lives = Math.max(0, this.lives - 1);
    this.cb.onLives?.(this.lives);
    this.state = "crash";
    this.crashT = 0;
    this.vy = -80;
    this.shake = 0.9;
    this.sfx("crash");
    this.cb.onBail?.(lost);
    // debris kicks up from the lip even as the rider drops away
    const sy = this.groundY - this.py;
    for (let i = 0; i < 18; i++) {
      this.particles.push({
        x: this.skaterX,
        y: sy,
        vx: this.rand(260) - 130,
        vy: -this.rand(240),
        life: 0.7,
        maxLife: 0.7,
        color: i % 2 ? C_PINK : "#ffffff",
        size: 3,
      });
    }
  }

  private collect() {
    const magnet = this.magnetT > 0;
    for (const b of this.bubbles) {
      if (b.taken) continue;
      if (magnet && Math.abs(b.x - this.px) < MAGNET_R && Math.abs(b.y - this.py) < MAGNET_R) {
        const k = Math.min(1, (this.effSpeed() + 200) / 600);
        b.x += (this.px - b.x) * 0.22 * (1 + k);
        b.y += (this.py - b.y) * 0.22 * (1 + k);
      }
      if (Math.abs(b.x - this.px) < 28 && Math.abs(b.y - this.py) < 34) {
        b.taken = true;
        this.bubbleCount++;
        this.comboBase += 60;
        this.comboTricks.push("$STREME");
        this.trickCount++;
        this.bumpSpecial(0.05);
        this.emitCombo();
        this.sfx("bubble");
        this.addTime(0.25); // sips of time keep you alive while you collect
        const sy = this.groundY - b.y;
        for (let i = 0; i < 5; i++) {
          this.particles.push({
            x: this.skaterX, y: sy, vx: this.rand(120) - 60, vy: -this.rand(120),
            life: 0.4, maxLife: 0.4, color: C_TEAL, size: 2,
          });
        }
      }
    }
    for (const p of this.powers) {
      if (p.taken) continue;
      if (Math.abs(p.x - this.px) < 32 && Math.abs(p.y - this.py) < 40) {
        p.taken = true;
        this.sfx("power");
        this.flashT = 0.35;
        this.addTime(1.5);
        if (p.kind === "magnet") {
          this.magnetT = MAGNET_T;
          this.cb.onPower?.("magnet");
          this.cb.onCallout?.("MAGNET!", "power");
        } else {
          this.rocketT = ROCKET_T;
          this.boost = BOOST_CAP;
          this.cb.onPower?.("rocket");
          this.cb.onCallout?.("ROCKET!", "power");
          this.shake = 0.6;
        }
      }
    }
    for (const l of this.letters) {
      if (l.taken) continue;
      if (Math.abs(l.x - this.px) < 34 && Math.abs(l.y - this.py) < 42) {
        l.taken = true;
        // light the exact STREME slot this letter belongs to (so the HUD
        // matches the letter you actually grabbed, even out of order)
        this.lettersGot[l.slot] = true;
        this.cb.onLetters?.([...this.lettersGot]);
        this.comboBase += 250;
        this.comboTricks.push(`LETTER ${l.ch}`);
        this.trickCount++;
        this.bumpSpecial(0.18);
        this.emitCombo();
        this.sfx("letter");
        this.flashT = 0.4;
        this.addTime(1.2);
        if (this.lettersGot.every(Boolean)) {
          this.addScore(5000);
          this.cb.onBank?.(5000);
          this.cb.onAllLetters?.();
          this.cb.onCallout?.("S-T-R-E-M-E!", "combo");
          this.lettersGot = [false, false, false, false, false, false];
          this.cb.onLetters?.([...this.lettersGot]);
          this.addTime(5); // spelling STREME is a big recharge
          this.enterFlow();
        }
      }
    }
    // remember a gap we're flying over for the near-miss check on landing
    for (const g of this.gaps) {
      if (this.px > g.x0 - 10 && this.px < g.x1) this.jumpedGap = g;
    }
  }

  private gameOver(finished: boolean, timedOut = false) {
    this.state = "over";
    this.cb.onGameOver?.({
      score: this.score,
      bestCombo: this.bestCombo,
      letters: this.lettersGot.filter(Boolean).length,
      bubbles: this.bubbleCount,
      tricks: this.trickCount,
      distance: Math.floor(this.distance),
      finished,
      timedOut,
    });
  }

  // ----------------------------------------------------------- visuals

  private advanceVisuals(dt: number, speed: number) {
    // the sun rides the clock — ease its height toward time-remaining so it
    // drifts down as time runs out and lifts back up when you bank a recharge
    const sunTarget = Math.max(0, Math.min(1, this.timeLeft / TIME_CAP));
    this.sunGlide += (sunTarget - this.sunGlide) * Math.min(1, dt * 2.2);
    const feetY = this.groundY - this.py;
    this.trail.unshift({ x: this.skaterX, y: feetY });
    if (this.trail.length > 16) this.trail.pop();
    for (let i = 1; i < this.trail.length; i++) this.trail[i].x -= speed * dt;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x -= speed * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 380 * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  private spark(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x, y, vx: -this.rand(140) - 40, vy: -this.rand(160),
        life: 0.35, maxLife: 0.35, color: this.rand(1) > 0.5 ? C_CYAN : C_PINK, size: 2,
      });
    }
  }

  /** A little sparkle off the rear wheels so the grounded skater feels alive. */
  private rollSparkle(sn: number) {
    const sy = this.groundY - this.py;
    const rad = this.flow || this.rocketT > 0 || this.rainbow;
    const palette = rad ? FLOW_COLORS : [C_CYAN, C_TEAL, "#e2f6ff"];
    const n = sn > 0.5 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const life = 0.32 + this.rand(0.22);
      this.particles.push({
        x: this.skaterX - 12 + this.rand(10),
        y: sy + 1 - this.rand(3),
        vx: -55 - this.rand(150) * (0.5 + sn), // flick back, faster at speed
        vy: -25 - this.rand(85),
        life,
        maxLife: life,
        color: palette[Math.floor(this.rand(palette.length))],
        size: 1 + Math.floor(this.rand(2)),
      });
    }
  }

  private sx(worldX: number): number {
    return worldX - (this.px - this.skaterX);
  }

  private render() {
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const shx = this.shake > 0 ? (this.rand(1) - 0.5) * this.shake * 11 : 0;
    const shy = this.shake > 0 ? (this.rand(1) - 0.5) * this.shake * 11 : 0;
    ctx.save();
    ctx.translate(shx, shy);

    this.drawSky(ctx, W, H);
    this.drawSpeedLines(ctx, W);
    this.drawStreet(ctx, W, H);
    this.drawRamps(ctx);
    this.drawLoops(ctx);
    this.drawRails(ctx);
    this.drawCollectibles(ctx);
    this.drawGhosts(ctx);
    this.drawTrail(ctx);
    this.drawSkater(ctx);

    ctx.restore();

    if (this.rocketT > 0) {
      ctx.fillStyle = `rgba(253,230,138,${0.06 + 0.04 * Math.sin(this.waveT * 14)})`;
      ctx.fillRect(0, 0, W, H);
    } else if (this.flow) {
      ctx.fillStyle = `rgba(103,232,249,${0.04 + 0.03 * Math.sin(this.waveT * 8)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.flashT > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flashT * 0.4})`;
      ctx.fillRect(0, 0, W, H);
    }
    this.drawScanlines(ctx, W, H);
  }

  private drawSpeedLines(ctx: CanvasRenderingContext2D, W: number) {
    const intensity = Math.min(1, (this.boost + (this.rocketT > 0 ? 300 : 0)) / 260);
    if (intensity <= 0.02 && this.state !== "crash") return;
    ctx.strokeStyle = this.rocketT > 0 ? C_GOLD : C_CYAN;
    ctx.lineWidth = 2;
    for (const l of this.speedLines) {
      const y = (l.y / 100) * this.groundY;
      const x = ((-(this.px * l.sp * 1.5) % (W + 200)) + W + 200) % (W + 200);
      ctx.globalAlpha = intensity * 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - l.len * (0.6 + intensity), y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private lerpRGB(a: RGB, b: RGB, t: number): string {
    return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(
      a[1] + (b[1] - a[1]) * t
    )},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
  }

  /** Interpolated zone palette slot (0..3), cycling smoothly between biomes. */
  private skyCol(slot: number): string {
    const p = Math.max(0, this.px) / ZONE_LEN;
    const i = Math.floor(p) % ZONES.length;
    const j = (i + 1) % ZONES.length;
    return this.lerpRGB(ZONES[i].pal.sky[slot], ZONES[j].pal.sky[slot], p - Math.floor(p));
  }
  private sunCol(slot: number): string {
    const p = Math.max(0, this.px) / ZONE_LEN;
    const i = Math.floor(p) % ZONES.length;
    const j = (i + 1) % ZONES.length;
    return this.lerpRGB(ZONES[i].pal.sun[slot], ZONES[j].pal.sun[slot], p - Math.floor(p));
  }

  private drawSky(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const g = ctx.createLinearGradient(0, 0, 0, this.groundY);
    g.addColorStop(0, this.skyCol(0));
    g.addColorStop(0.45, this.skyCol(1));
    g.addColorStop(0.78, this.skyCol(2));
    g.addColorStop(1, this.skyCol(3));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, this.groundY);

    ctx.fillStyle = "#ffffff";
    const starScroll = (this.px * 0.04) % 1000;
    for (const s of this.stars) {
      let x = (((s.x - starScroll) % 1000) + 1000) % 1000;
      x = (x / 1000) * W;
      const y = (s.y / 100) * (this.groundY * 0.7);
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.waveT * 2 + s.x);
      ctx.fillRect(Math.round(x), Math.round(y), s.s, s.s);
    }
    ctx.globalAlpha = 1;

    const sunX = W * 0.62;
    const sunR = Math.min(W, H) * 0.16;
    // sun-as-clock: high (near noon) when time is full, sinking below the
    // horizon as it runs out. Smoothed via sunGlide so it glides, not jumps.
    const sunY = this.groundY + sunR - this.sunGlide * (H * 0.42 + sunR);
    const sg = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
    sg.addColorStop(0, this.sunCol(0));
    sg.addColorStop(0.45, this.sunCol(1));
    sg.addColorStop(0.75, this.sunCol(2));
    sg.addColorStop(1, this.sunCol(3));
    ctx.save();
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = sg;
    ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);
    ctx.fillStyle = this.skyCol(1);
    for (let i = 0; i < 7; i++) {
      const yy = sunY + i * (sunR / 5) - 2;
      ctx.fillRect(sunX - sunR, yy, sunR * 2, Math.max(2, i));
    }
    ctx.restore();

    const bw = 34;
    const span = this.city.length * bw;
    const cityScroll = (this.px * 0.1) % span;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#150a33";
    for (let i = 0; i < this.city.length; i++) {
      let x = i * bw - cityScroll;
      x = ((x % span) + span) % span;
      const bh = this.city[i] + 8;
      ctx.fillRect(Math.round(x) - bw, this.groundY - bh, bw - 5, bh);
    }
    ctx.globalAlpha = 1;
    const haze = ctx.createLinearGradient(0, this.groundY - 64, 0, this.groundY);
    haze.addColorStop(0, "rgba(12,6,28,0)");
    haze.addColorStop(1, "rgba(12,6,28,0.55)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, this.groundY - 64, W, 64);
  }

  private drawStreet(ctx: CanvasRenderingContext2D, W: number, H: number) {
    ctx.fillStyle = "#140a2e";
    ctx.fillRect(0, this.groundY, W, H - this.groundY);

    ctx.strokeStyle = "rgba(45,212,191,0.3)";
    ctx.lineWidth = 1;
    const gridScroll = (this.px * 0.6) % 60;
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      const y = this.groundY + Math.pow(t, 1.7) * (H - this.groundY);
      ctx.globalAlpha = 0.12 + t * 0.28;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (let i = -1; i < 24; i++) {
      const bx = i * 60 - gridScroll;
      ctx.globalAlpha = 0.16;
      ctx.beginPath();
      ctx.moveTo(W / 2 + (bx - W / 2) * 0.55, this.groundY);
      ctx.lineTo(bx, H);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // glowing street edge — broken by gaps
    ctx.fillStyle = C_TEAL;
    ctx.shadowColor = C_TEAL;
    ctx.shadowBlur = 8;
    let cx = 0;
    const edges: [number, number][] = [];
    for (const gap of this.gaps) {
      const g0 = this.sx(gap.x0);
      const g1 = this.sx(gap.x1);
      if (g1 < 0 || g0 > W) continue;
      edges.push([g0, g1]);
    }
    edges.sort((a, b) => a[0] - b[0]);
    for (const [g0, g1] of edges) {
      if (g0 > cx) ctx.fillRect(cx, this.groundY - 2, g0 - cx, 3);
      cx = Math.max(cx, g1);
    }
    if (cx < W) ctx.fillRect(cx, this.groundY - 2, W - cx, 3);
    ctx.shadowBlur = 0;

    for (const gap of this.gaps) {
      const g0 = this.sx(gap.x0);
      const g1 = this.sx(gap.x1);
      if (g1 < -20 || g0 > W + 20) continue;
      ctx.fillStyle = "#05030f";
      ctx.fillRect(g0, this.groundY, g1 - g0, H - this.groundY);
      ctx.fillStyle = C_PINK;
      ctx.shadowColor = C_PINK;
      ctx.shadowBlur = 8;
      ctx.fillRect(g0 - 3, this.groundY - 3, 3, 16);
      ctx.fillRect(g1, this.groundY - 3, 3, 16);
      ctx.shadowBlur = 0;
    }
  }

  private drawRamps(ctx: CanvasRenderingContext2D) {
    for (const r of this.ramps) {
      const x0 = this.sx(r.x0);
      const xL = this.sx(r.xLip);
      if (xL < -40 || x0 > this.W + 40) continue;
      const STEPS = 12;
      const pts: [number, number][] = [];
      for (let i = 0; i <= STEPS; i++) {
        const wx = r.x0 + (r.xLip - r.x0) * (i / STEPS);
        pts.push([this.sx(wx), this.groundY - this.rampSurface(r, wx)]);
      }
      // body
      ctx.beginPath();
      ctx.moveTo(x0, this.groundY);
      for (const [px, py] of pts) ctx.lineTo(px, py);
      ctx.lineTo(xL, this.groundY);
      ctx.closePath();
      const rg = ctx.createLinearGradient(x0, this.groundY, xL, this.groundY - r.height);
      rg.addColorStop(0, "#241552");
      rg.addColorStop(1, "#4a2391");
      ctx.fillStyle = rg;
      ctx.fill();
      // glowing surface curve
      ctx.strokeStyle = C_CYAN;
      ctx.shadowColor = C_CYAN;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const [px, py] of pts) ctx.lineTo(px, py);
      ctx.stroke();
      // bright lip cap (the launch edge)
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(xL - 5, this.groundY - r.height - 3, 7, 5);
      ctx.shadowBlur = 0;
    }
  }

  private drawLoops(ctx: CanvasRenderingContext2D) {
    for (const l of this.loops) {
      const cx = this.sx(l.x + l.r);
      if (cx < -l.r - 50 || cx > this.W + l.r + 50) continue;
      const cy = this.groundY - l.r;
      const pulse = 0.6 + 0.4 * Math.sin(this.waveT * 4 + l.x * 0.01);
      ctx.save();
      // outer neon ring
      ctx.strokeStyle = C_PINK;
      ctx.shadowColor = C_PINK;
      ctx.shadowBlur = 14 * pulse;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(cx, cy, l.r, 0, Math.PI * 2);
      ctx.stroke();
      // inner ring
      ctx.shadowColor = C_CYAN;
      ctx.strokeStyle = C_CYAN;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(cx, cy, l.r - 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawRails(ctx: CanvasRenderingContext2D) {
    for (const r of this.rails) {
      const x0 = this.sx(r.x0);
      const x1 = this.sx(r.x1);
      if (x1 < -40 || x0 > this.W + 40) continue;
      const y = this.groundY - r.height;
      ctx.fillStyle = "#3a2a6e";
      ctx.fillRect(x0 + 2, y, 4, r.height);
      ctx.fillRect(x1 - 6, y, 4, r.height);
      const pulse = 0.6 + 0.4 * Math.sin(this.waveT * 5 + r.x0 * 0.01);
      ctx.fillStyle = C_PINK;
      ctx.shadowColor = C_PINK;
      ctx.shadowBlur = 10 * pulse;
      ctx.fillRect(x0, y - 3, x1 - x0, 4);
      ctx.shadowBlur = 0;
    }
  }

  private drawCollectibles(ctx: CanvasRenderingContext2D) {
    for (const b of this.bubbles) {
      if (b.taken) continue;
      const x = this.sx(b.x);
      if (x < -30 || x > this.W + 30) continue;
      const y = this.groundY - b.y + Math.sin(this.waveT * 3 + b.x * 0.02) * 3;
      ctx.save();
      ctx.shadowColor = C_TEAL;
      ctx.shadowBlur = 10;
      if (this.coin) {
        const s = 22;
        ctx.drawImage(this.coin, x - s / 2, y - s / 2, s, s);
      } else {
        ctx.fillStyle = C_TEAL;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    // power-ups
    for (const p of this.powers) {
      if (p.taken) continue;
      const x = this.sx(p.x);
      if (x < -30 || x > this.W + 30) continue;
      const y = this.groundY - p.y + Math.sin(this.waveT * 3 + p.x * 0.02) * 4;
      const col = p.kind === "rocket" ? C_GOLD : C_CYAN;
      ctx.save();
      ctx.shadowColor = col;
      ctx.shadowBlur = 16;
      ctx.fillStyle = "rgba(12,6,38,0.9)";
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = col;
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.font = "bold 16px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.kind === "rocket" ? "🚀" : "🧲", x, y + 1);
      ctx.restore();
    }
    for (const l of this.letters) {
      if (l.taken) continue;
      const x = this.sx(l.x);
      if (x < -30 || x > this.W + 30) continue;
      const y = this.groundY - l.y + Math.sin(this.waveT * 2.5 + l.x * 0.02) * 4;
      ctx.save();
      ctx.shadowColor = C_CYAN;
      ctx.shadowBlur = 14;
      ctx.fillStyle = "rgba(12,6,38,0.85)";
      ctx.fillRect(x - 14, y - 16, 28, 32);
      ctx.strokeStyle = C_CYAN;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 14, y - 16, 28, 32);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(l.ch, x, y + 1);
      ctx.restore();
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  private drawTrail(ctx: CanvasRenderingContext2D) {
    if (this.state === "idle" || this.state === "over") return;
    const offs = [-3, 0, 3];
    const rocket = this.rocketT > 0;
    const rainbow = this.flow || rocket || this.rainbow;
    for (let t = 0; t < 3; t++) {
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < this.trail.length; i++) {
        const p = this.trail[i];
        const yy = p.y + offs[t];
        if (!started) {
          ctx.moveTo(p.x, yy);
          started = true;
        } else ctx.lineTo(p.x, yy);
      }
      ctx.strokeStyle = rainbow
        ? FLOW_COLORS[(t + Math.floor(this.waveT * 12)) % FLOW_COLORS.length]
        : TRAIL_COLORS[t];
      ctx.globalAlpha = rocket ? 0.8 : 0.55;
      ctx.lineWidth = rocket ? 3 : 2;
      ctx.shadowColor = ctx.strokeStyle as string;
      ctx.shadowBlur = rocket ? 12 : 6;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  private drawSkater(ctx: CanvasRenderingContext2D) {
    let x = this.skaterX;
    let y = this.groundY - this.py;
    let rot = this.boardRot;
    if (this.state === "loop" && this.loopActive) {
      // ride around the ring: bottom → right → top (upside down) → left → bottom
      const phi = this.loopT * Math.PI * 2;
      const cx = this.sx(this.loopActive.x + this.loopActive.r);
      const cy = this.groundY - this.loopActive.r;
      x = cx + this.loopActive.r * Math.sin(phi);
      y = cy + this.loopActive.r * Math.cos(phi);
      rot = phi;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    // magnet aura
    if (this.magnetT > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(103,232,249,${0.3 + 0.2 * Math.sin(this.waveT * 6)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -8, 30 + 3 * Math.sin(this.waveT * 6), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.shadowColor = this.flow || this.rocketT > 0 || this.rainbow ? "#fde68a" : C_CYAN;
    ctx.shadowBlur = this.flow || this.rocketT > 0 ? 22 : 14;
    ctx.fillStyle = this.flow || this.rocketT > 0 ? "rgba(253,230,138,0.5)" : "rgba(103,232,249,0.4)";
    ctx.beginPath();
    ctx.ellipse(0, 6, 22, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(-20, 4, 40, 5);
    ctx.fillStyle = C_INDIGO;
    ctx.fillRect(-20, 9, 40, 2);
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(-15, 10, 5, 5);
    ctx.fillRect(10, 10, 5, 5);

    const rider = this.skaterImg || this.monster;
    if (rider) {
      const s = 40;
      ctx.imageSmoothingEnabled = !!this.skaterImg;
      ctx.drawImage(rider, -s / 2, -s + 4, s, s);
    } else {
      ctx.fillStyle = C_TEAL;
      ctx.fillRect(-12, -28, 24, 30);
    }
    ctx.restore();
  }

  /** Translucent racers replaying other players' recorded runs. */
  private drawGhosts(ctx: CanvasRenderingContext2D) {
    if (this.ghosts.length === 0 || this.state === "idle" || this.state === "over") {
      return;
    }
    const t = this.runTime / GHOST_DT;
    const i0 = Math.floor(t);
    const f = t - i0;
    for (const g of this.ghosts) {
      const n = g.samples.length / 2;
      if (n < 2) continue;
      const ia = Math.min(i0, n - 1);
      const ib = Math.min(i0 + 1, n - 1);
      const gx = g.samples[ia * 2] + (g.samples[ib * 2] - g.samples[ia * 2]) * f;
      const gy =
        g.samples[ia * 2 + 1] + (g.samples[ib * 2 + 1] - g.samples[ia * 2 + 1]) * f;
      const px = this.sx(gx);
      if (px < -40 || px > this.W + 40) continue;
      const py = this.groundY - gy;

      // Infer a trick: while a ghost is well above the rails it's mid-jump, so
      // spin it through whole rotations and land it flat. Progress is measured
      // across the contiguous airborne segment, so rot hits 0 at both ends
      // (continuous with the flat ground/grind sections). Grinds stay flat.
      let rot = 0;
      if (gy > GHOST_AIR_SPIN) {
        // Bound the airborne run, then find the exact times gy crosses the
        // threshold so the spin starts and ends flat (a whole number of
        // rotations) — no snap as the ghost touches down.
        const sy = (k: number) => g.samples[k * 2 + 1];
        let a = sy(ia) > GHOST_AIR_SPIN ? ia : ib;
        let b = a;
        while (a > 0 && sy(a - 1) > GHOST_AIR_SPIN) a--;
        while (b < n - 1 && sy(b + 1) > GHOST_AIR_SPIN) b++;
        let tEnter = a;
        if (a > 0)
          tEnter = a - 1 + (GHOST_AIR_SPIN - sy(a - 1)) / (sy(a) - sy(a - 1));
        let tExit = b;
        if (b < n - 1)
          tExit = b + (sy(b) - GHOST_AIR_SPIN) / (sy(b) - sy(b + 1));
        const dur = tExit - tEnter;
        if (dur > 1e-3) {
          const prog = Math.min(Math.max((t - tEnter) / dur, 0), 1);
          const flips = Math.max(
            1,
            Math.min(3, Math.round((dur * GHOST_DT) / 0.45))
          );
          rot = g.spin * prog * flips * Math.PI * 2;
        }
      }

      ctx.save();
      ctx.translate(px, py);
      ctx.globalAlpha = 0.4;
      // ground glow — stays flat beneath the trick
      ctx.shadowColor = g.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = g.color;
      ctx.beginPath();
      ctx.ellipse(0, 6, 15, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // rider + board, flipped around the body's middle
      ctx.save();
      ctx.translate(0, -10);
      ctx.rotate(rot);
      ctx.translate(0, 10);
      ctx.fillStyle = "#cbd5e1";
      ctx.fillRect(-15, 4, 30, 4);
      if (this.monster) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.monster, -16, -28, 32, 32);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      if (g.name) {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = g.color;
        ctx.font = "bold 9px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText(g.name.slice(0, 12), 0, -32);
        ctx.textAlign = "left";
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  }

  private drawScanlines(ctx: CanvasRenderingContext2D, W: number, H: number) {
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#000000";
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    ctx.globalAlpha = 1;
    const v = ctx.createRadialGradient(
      W / 2, H * 0.45, Math.min(W, H) * 0.3, W / 2, H * 0.5, Math.max(W, H) * 0.75
    );
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(4,2,16,0.55)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }
}
