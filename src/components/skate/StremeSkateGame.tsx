"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import sdk from "@farcaster/miniapp-sdk";
import confetti from "canvas-confetti";
import {
  Circle,
  CircleCheck,
  Coins,
  Crown,
  Flame,
  Heart,
  Home,
  Hourglass,
  Infinity as InfinityIcon,
  Magnet,
  Medal,
  Play,
  Rainbow,
  Rocket,
  RotateCcw,
  Skull,
  Sparkles,
  Sticker,
  Sun,
  Swords,
  Target,
  Timer,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { useAppFrameLogic } from "../../hooks/useAppFrameLogic";
import { useUnifiedWallet } from "../../hooks/useUnifiedWallet";
import {
  SkateGameEngine,
  CalloutKind,
  ComboInfo,
  GhostInput,
  SfxType,
  SkateResult,
  SwipeDir,
} from "./SkateGameEngine";
import {
  buildDailyShareIntent,
  buildSkateShareIntent,
} from "../../lib/skateShare";
import { FREE_SKATE_SEED, formatTimeLeft } from "../../lib/skateDaily";
import { FLAIR_META, FlairTier } from "../../lib/skateFlair";

export interface SkateChallenge {
  score: number;
  by?: string;
  rank?: number;
  day?: string; // present on DAILY LINE dares — only live while that day runs
}

interface LeaderboardEntry {
  fid: number;
  username: string;
  pfpUrl: string;
  score: number;
  combo: number;
  flair?: FlairTier | null; // $STREME crew badge, resolved server-side
  rank?: number; // 1-based, present on daily "nearby" rows
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  player: { rank: number; best: number } | null;
  total: number;
}

interface RankResult {
  best: number;
  rank: number;
  total: number;
  improved: boolean;
  flair?: FlairTier | null;
}

interface DailyStatus {
  day: string;
  name: string;
  seed: number;
  endsAt: number;
  played: boolean;
  me: { rank: number; score: number } | null;
  streak: { count: number; best: number };
  total: number;
  entries: LeaderboardEntry[];
  nearby: LeaderboardEntry[];
  ghosts: {
    fid: number;
    username: string;
    flair?: FlairTier | null;
    samples: number[];
  }[];
}

interface DailySubmitResult {
  rank: number;
  total: number;
  streak: { count: number; best: number };
  improved: boolean;
  best: number;
  flair?: FlairTier | null;
}

type Phase = "ready" | "playing" | "over";
type SkateMode = "free" | "daily";
type RunKind = "free" | "practice" | "counted";

// In local dev (browser, no Farcaster host) submit with the API's x-dev-fid
// escape hatch so the whole daily flow is testable; never set in production.
const DEV_FID = process.env.NODE_ENV === "development" ? 6841 : null;

const BEST_KEY = "streme-skate-best";
const MUTED_KEY = "streme-skate-muted";
const WARPLET_KEY = "streme-skate-warplet";
const LETTERS = ["S", "T", "R", "E", "M", "E"];
const GHOST_TINTS = ["#fb7185", "#a78bfa", "#34d399", "#fbbf24", "#38bdf8"];

// lucide equivalents of the flair emoji for React UI (the emoji in FLAIR_META
// still serve the canvas ghost name tags and the OG card, where SVG can't go)
const FLAIR_ICONS = { deck: Sticker, sponsored: Zap, pro: Crown } as const;
const FLAIR_TEXT = {
  deck: "text-cyan-500",
  sponsored: "text-violet-500",
  pro: "text-amber-500",
} as const;

interface WarpletItem {
  tokenId: string;
  name: string;
  image: string;
}

/**
 * Knock the (uniform, dark) background out of a Warplet NFT image so the
 * creature rides transparently. Flood-fills from the corners over pixels close
 * to the corner colour, so it won't punch holes inside the warplet. The source
 * is same-origin (our proxy), so the canvas stays untainted.
 */
function removeWarpletBg(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const S = 128;
        const c = document.createElement("canvas");
        c.width = S;
        c.height = S;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(img);
        ctx.drawImage(img, 0, 0, S, S);
        const data = ctx.getImageData(0, 0, S, S);
        const p = data.data;
        const corners = [0, (S - 1) * 4, S * (S - 1) * 4, (S * S - 1) * 4];
        let br = 0,
          bg = 0,
          bb = 0;
        for (const o of corners) {
          br += p[o];
          bg += p[o + 1];
          bb += p[o + 2];
        }
        let ba = 0;
        for (const o of corners) ba += p[o + 3];
        br /= 4;
        bg /= 4;
        bb /= 4;
        ba /= 4;
        // already has a transparent background — leave it as-is
        if (ba < 32) return resolve(img);
        const TOL = 66 * 66;
        const near = (o: number) => {
          const dr = p[o] - br,
            dg = p[o + 1] - bg,
            db = p[o + 2] - bb;
          return dr * dr + dg * dg + db * db < TOL;
        };
        const visited = new Uint8Array(S * S);
        const stack: number[] = [];
        let cleared = 0;
        const push = (x: number, y: number) => {
          if (x < 0 || y < 0 || x >= S || y >= S) return;
          const i = y * S + x;
          if (visited[i]) return;
          visited[i] = 1;
          const o = i * 4;
          if (near(o)) {
            p[o + 3] = 0;
            cleared++;
            stack.push(x, y);
          }
        };
        push(0, 0);
        push(S - 1, 0);
        push(0, S - 1);
        push(S - 1, S - 1);
        while (stack.length) {
          const y = stack.pop() as number;
          const x = stack.pop() as number;
          push(x + 1, y);
          push(x - 1, y);
          push(x, y + 1);
          push(x, y - 1);
        }
        // if the key matched most of the sprite, the bg wasn't a clean colour —
        // keep the original rather than show a near-empty rider
        if (cleared > S * S * 0.92) return resolve(img);
        ctx.putImageData(data, 0, 0);
        const out = new Image();
        out.onload = () => resolve(out);
        out.onerror = () => resolve(img);
        out.src = c.toDataURL();
      } catch {
        resolve(img);
      }
    };
    img.onerror = reject;
    img.src = url;
  });
}
interface WarpletInfo {
  eligible: boolean;
  streme: number;
  staked: number;
  ownsWarplet: boolean;
  warplets: WarpletItem[];
}

const ZONE_NAMES = [
  "NEON DOWNTOWN",
  "GRIND DISTRICT",
  "GAP CITY",
  "VERT HEIGHTS",
  "OVERDRIVE",
];

const START_TIME = 18; // mirrors engine START_TIME (initial clock display)
const STREME_TOKEN = "0x3B3Cd21242BA44e9865B066e5EF5d1cC1030CC58";

const CALLOUT_COLORS: Record<CalloutKind, string> = {
  perfect: "#fde68a",
  sick: "#34d399",
  sloppy: "#f87171",
  close: "#fb923c",
  combo: "#67e8f9",
  power: "#c4b5fd",
  milestone: "#ffffff",
};

export default function StremeSkateGame({
  challenge,
}: {
  challenge?: SkateChallenge | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SkateGameEngine | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const musicStartedRef = useRef(false);
  const mutedRef = useRef(false);
  const bestRef = useRef(0);
  const bankTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState<ComboInfo | null>(null);
  const [bank, setBank] = useState<number | null>(null);
  const [distance, setDistance] = useState(0);
  const [progress, setProgress] = useState(0);
  const [zone, setZone] = useState<{ name: string; index: number; accent: string }>(
    { name: "NEON DOWNTOWN", index: 0, accent: "#67e8f9" }
  );
  const [special, setSpecial] = useState(0);
  const [timeLeft, setTimeLeft] = useState(START_TIME);
  const [timeBonus, setTimeBonus] = useState<{ id: number; amount: number } | null>(null);
  const timeBonusId = useRef(0);
  const [flow, setFlow] = useState(false);
  const [letters, setLetters] = useState<boolean[]>([
    false, false, false, false, false, false,
  ]);
  const [toast, setToast] = useState<string | null>(null);
  const [callouts, setCallouts] = useState<
    { id: number; text: string; kind: CalloutKind }[]
  >([]);
  const [power, setPower] = useState<"magnet" | "rocket" | null>(null);
  const calloutId = useRef(0);
  const [best, setBest] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [muted, setMuted] = useState(false);
  // ghosts are always on — racing rivals is the game's social heartbeat
  const ghostsRef = useRef<GhostInput[]>([]);
  const [warplet, setWarplet] = useState<WarpletInfo | null>(null);
  const [selectedWarplet, setSelectedWarplet] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const warpletPfpRef = useRef<string | null>(null);
  const [radMode, setRadMode] = useState(false);
  const radModeRef = useRef(false);
  const eggTapsRef = useRef(0);
  const [challengeBeaten, setChallengeBeaten] = useState(false);
  const [rankResult, setRankResult] = useState<RankResult | null>(null);
  const [showBoard, setShowBoard] = useState(false);
  const [board, setBoard] = useState<LeaderboardData | null>(null);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardTab, setBoardTab] = useState<"daily" | "alltime">("daily");
  const [finishedRun, setFinishedRun] = useState<SkateResult | null>(null);

  // ----- DAILY LINE: one shared seed per UTC day, unlimited runs, best holds -----
  const [mode, setMode] = useState<SkateMode>("free");
  const modeRef = useRef<SkateMode>("free");
  const [daily, setDaily] = useState<DailyStatus | null>(null);
  const dailyRef = useRef<DailyStatus | null>(null);
  const [dailyResult, setDailyResult] = useState<DailySubmitResult | null>(null);
  const [runKind, setRunKind] = useState<RunKind>("free");
  const runKindRef = useRef<RunKind>("free");
  const autoDailyRef = useRef(false); // default to the daily once it loads
  const [nowTs, setNowTs] = useState(() => Date.now()); // reset countdown tick

  const { isMiniAppView, isSDKLoaded, farcasterContext } = useAppFrameLogic();
  const {
    address: walletAddress,
    isEffectivelyMiniApp,
    connect: connectWallet,
  } = useUnifiedWallet();
  const autoConnectTriedRef = useRef(false);
  const isMiniAppRef = useRef(false);
  isMiniAppRef.current = isMiniAppView && isSDKLoaded;
  const fcUserRef = useRef<{
    fid: number;
    username?: string;
    pfpUrl?: string;
  } | null>(null);
  fcUserRef.current = farcasterContext?.user ?? null;
  // a DAILY LINE dare is only a live target while that day's line is open —
  // once it rolls over, the course is different and the score isn't comparable
  const liveChallenge =
    challenge && (!challenge.day || !daily || challenge.day === daily.day)
      ? challenge
      : null;
  const staleDailyDare = Boolean(challenge?.day && daily && !liveChallenge);
  const challengeRef = useRef(liveChallenge);
  challengeRef.current = liveChallenge;

  // --------------------------------------------------------------- sound fx

  const playTone = useCallback(
    (
      freq: number,
      duration: number,
      type: OscillatorType = "square",
      volume = 0.06,
      delay = 0,
      slideTo?: number
    ) => {
      const ctx = audioCtxRef.current;
      if (!ctx || mutedRef.current) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + delay;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    },
    []
  );

  const ensureAudio = useCallback(() => {
    if (!audioCtxRef.current && typeof window !== "undefined") {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (Ctor) audioCtxRef.current = new Ctor();
    }
    audioCtxRef.current?.resume().catch(() => {});
  }, []);

  const startMusic = useCallback(() => {
    if (!musicRef.current) {
      const audio = new Audio("/skate/theme.mp3");
      audio.loop = true;
      audio.volume = 0.32;
      audio.preload = "auto";
      musicRef.current = audio;
    }
    musicRef.current.muted = mutedRef.current;
    musicRef.current
      .play()
      .then(() => {
        musicStartedRef.current = true;
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      const music = musicRef.current;
      if (!music || !musicStartedRef.current) return;
      if (document.hidden) music.pause();
      else music.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      musicRef.current?.pause();
      if (musicRef.current) musicRef.current.src = "";
      musicRef.current = null;
    };
  }, []);

  const haptic = useCallback((kind: "light" | "success" | "error") => {
    if (!isMiniAppRef.current) return;
    try {
      if (kind === "light") sdk.haptics.impactOccurred("light");
      else if (kind === "success") sdk.haptics.notificationOccurred("success");
      else sdk.haptics.notificationOccurred("error");
    } catch {
      // unsupported
    }
  }, []);

  const handleSfx = useCallback(
    (type: SfxType) => {
      switch (type) {
        case "jump":
          playTone(320, 0.12, "square", 0.05, 0, 640);
          haptic("light");
          break;
        case "trick":
          playTone(660, 0.07, "square", 0.05);
          playTone(990, 0.08, "square", 0.045, 0.05);
          haptic("light");
          break;
        case "land":
          playTone(440, 0.08, "triangle", 0.06);
          playTone(660, 0.1, "triangle", 0.05, 0.05);
          break;
        case "grind":
          playTone(120, 0.18, "sawtooth", 0.04, 0, 90);
          haptic("light");
          break;
        case "perfect":
          playTone(659, 0.07, "square", 0.07);
          playTone(880, 0.07, "square", 0.07, 0.06);
          playTone(1318, 0.16, "square", 0.07, 0.12);
          haptic("success");
          break;
        case "power":
          playTone(523, 0.08, "square", 0.06);
          playTone(784, 0.08, "square", 0.06, 0.07);
          playTone(1046, 0.1, "square", 0.06, 0.14);
          playTone(1318, 0.16, "square", 0.06, 0.21);
          haptic("success");
          break;
        case "crash":
          playTone(200, 0.3, "sawtooth", 0.06, 0, 60);
          playTone(90, 0.4, "square", 0.05, 0.1);
          haptic("error");
          break;
        case "bubble":
          playTone(880, 0.06, "square", 0.05);
          playTone(1320, 0.08, "square", 0.04, 0.04);
          break;
        case "letter":
          playTone(523, 0.08, "triangle", 0.07);
          playTone(784, 0.08, "triangle", 0.07, 0.07);
          playTone(1046, 0.14, "triangle", 0.07, 0.14);
          haptic("success");
          break;
        case "flow":
          playTone(440, 0.1, "square", 0.06);
          playTone(587, 0.1, "square", 0.06, 0.08);
          playTone(880, 0.18, "square", 0.06, 0.16);
          haptic("success");
          break;
        case "milestone":
          playTone(659, 0.1, "square", 0.06);
          playTone(988, 0.18, "square", 0.06, 0.1);
          break;
      }
    },
    [playTone, haptic]
  );

  // grind audio rises in pitch the longer you hold the rail (THPS/OlliOlli feel)
  const handleGrindTick = useCallback(
    (level: number) => {
      const f = Math.min(170 + level * 62, 560);
      playTone(f, 0.06, "sawtooth", 0.035);
    },
    [playTone]
  );

  // a great play recharged the clock — pop "+X.Xs" and chirp a reward chime
  const handleTimeBonus = useCallback(
    (amount: number) => {
      const id = ++timeBonusId.current;
      setTimeBonus({ id, amount });
      playTone(720, 0.05, "sine", 0.045);
      playTone(1080, 0.08, "sine", 0.04, 0.05);
      setTimeout(
        () => setTimeBonus((prev) => (prev && prev.id === id ? null : prev)),
        850
      );
    },
    [playTone]
  );

  const showToast = useCallback((text: string, ms = 1600) => {
    setToast(text);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), ms);
  }, []);

  const showCallout = useCallback((text: string, kind: CalloutKind) => {
    const id = ++calloutId.current;
    setCallouts((prev) => [...prev.slice(-3), { id, text, kind }]);
    setTimeout(() => {
      setCallouts((prev) => prev.filter((c) => c.id !== id));
    }, 900);
  }, []);

  // ------------------------------------------------------------- callbacks

  const handleBank = useCallback((amount: number) => {
    if (amount <= 0) return;
    setBank(amount);
    if (bankTimerRef.current) clearTimeout(bankTimerRef.current);
    bankTimerRef.current = setTimeout(() => setBank(null), 1100);
  }, []);

  const handleAllLetters = useCallback(() => {
    showToast("🔥 S-T-R-E-M-E complete — FLOW STATE!", 2200);
    confetti({
      particleCount: 90,
      spread: 75,
      origin: { y: 0.6 },
      colors: ["#6366f1", "#ec4899", "#2dd4bf", "#67e8f9", "#fde68a"],
    });
  }, [showToast]);

  // Authenticated fetch: Quick Auth inside the mini-app, x-dev-fid in local
  // dev so the daily flow is end-to-end testable in a plain browser.
  const authedFetch = useCallback(
    (url: string, init?: RequestInit): Promise<Response> | null => {
      if (isMiniAppRef.current) return sdk.quickAuth.fetch(url, init);
      if (DEV_FID) {
        return fetch(url, {
          ...init,
          headers: {
            ...(init?.headers as Record<string, string> | undefined),
            "x-dev-fid": String(DEV_FID),
          },
        });
      }
      return null;
    },
    []
  );

  // Today's line: status + board + rival ghosts in one read
  const loadDaily = useCallback(async () => {
    try {
      const fid = fcUserRef.current?.fid ?? DEV_FID ?? undefined;
      const res = await fetch(`/api/skate/daily${fid ? `?fid=${fid}` : ""}`);
      if (!res.ok) return;
      const data = (await res.json()) as DailyStatus;
      setDaily(data);
      dailyRef.current = data;
    } catch {
      // daily unavailable — free skate still works
    }
  }, []);

  const handleGameOver = useCallback((result: SkateResult) => {
    setFinishedRun(result);
    setPhase("over");
    setCombo(null);
    const beatBest = result.score > 0 && result.score > bestRef.current;
    setIsNewBest(beatBest);
    if (beatBest) {
      bestRef.current = result.score;
      setBest(result.score);
      try {
        localStorage.setItem(BEST_KEY, String(result.score));
      } catch {}
    }
    playTone(523, 0.12, "square", 0.06);
    playTone(392, 0.18, "square", 0.06, 0.12);

    setRankResult(null);
    setDailyResult(null);
    const user =
      fcUserRef.current ??
      (DEV_FID ? { fid: DEV_FID, username: "dev", pfpUrl: "" } : null);
    if (user && result.score > 0) {
      // a held Warplet becomes your leaderboard PFP too
      const pfpUrl = warpletPfpRef.current
        ? `${window.location.origin}${warpletPfpRef.current}`
        : user.pfpUrl ?? "";
      authedFetch("/api/skate/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: result.score,
          combo: result.bestCombo,
          username: user.username ?? "",
          pfpUrl,
        }),
      })
        ?.then((res) => (res.ok ? res.json() : null))
        .then((r: RankResult | null) => {
          if (r) setRankResult(r);
        })
        .catch((e) => console.error("Leaderboard submit failed:", e));

      const samples = engineRef.current?.getRecording() ?? [];

      if (modeRef.current === "daily" && runKindRef.current === "counted") {
        // a counted run on today's line — unlimited tries within the 24h
        // window, your BEST score holds the board rank and its recording
        // becomes the rival ghost. The server keeps-best; we mirror that below.
        const day = dailyRef.current?.day;
        authedFetch("/api/skate/daily", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            day,
            score: result.score,
            combo: result.bestCombo,
            username: user.username ?? "",
            pfpUrl,
            samples,
          }),
        })
          ?.then(async (res) => {
            const r = (await res.json().catch(() => null)) as
              | (DailySubmitResult & { error?: string })
              | null;
            if (res.ok && r) {
              setDailyResult(r);
              setDaily((prev) => {
                const next = prev
                  ? {
                      ...prev,
                      played: true,
                      me: { rank: r.rank, score: r.best },
                      streak: r.streak,
                      total: r.total,
                    }
                  : prev;
                dailyRef.current = next;
                return next;
              });
            }
            // refresh the board + rivals (picks up other players' new bests)
            loadDaily();
          })
          .catch((e) => console.error("Daily submit failed:", e));
      } else if (modeRef.current === "free" && samples.length >= 8) {
        // global ghosts replay on the free-skate course — only aligned runs
        authedFetch("/api/skate/ghosts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            score: result.score,
            username: user.username ?? "",
            samples,
          }),
        })?.catch((e) => console.error("Ghost submit failed:", e));
      }
    }
    // challenge check
    const ch = challengeRef.current;
    if (ch && result.score >= ch.score) setChallengeBeaten(true);
  }, [playTone, authedFetch, loadDaily]);

  // keep latest callbacks in refs for the stable engine wiring
  const cbRef = useRef({
    handleBank,
    handleAllLetters,
    handleGameOver,
    handleSfx,
    handleGrindTick,
    handleTimeBonus,
    showToast,
    showCallout,
  });
  cbRef.current = {
    handleBank,
    handleAllLetters,
    handleGameOver,
    handleSfx,
    handleGrindTick,
    handleTimeBonus,
    showToast,
    showCallout,
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const engine = new SkateGameEngine(container, {
      onStart: () => {
        // rivals on the daily are recordings of TODAY'S line (same course, so
        // the replays align); free skate races the global ghost pool
        const pool =
          modeRef.current === "daily"
            ? (dailyRef.current?.ghosts ?? []).map((g, i) => ({
                samples: g.samples,
                color: GHOST_TINTS[i % GHOST_TINTS.length],
                name: `${g.flair ? `${FLAIR_META[g.flair].icon} ` : ""}${
                  g.username ? `@${g.username}` : "rival"
                }`,
              }))
            : ghostsRef.current;
        engineRef.current?.setGhosts(pool);
        engineRef.current?.setRainbow(radModeRef.current);
        setRunKind(runKindRef.current);
        setDailyResult(null);
        setPhase("playing");
        setScore(0);
        setCombo(null);
        setBank(null);
        setDistance(0);
        setProgress(0);
        setSpecial(0);
        setTimeLeft(START_TIME);
        setTimeBonus(null);
        setFlow(false);
        setLetters([false, false, false, false, false, false]);
        setToast(null);
        setCallouts([]);
        setPower(null);
        setChallengeBeaten(false);
        setFinishedRun(null);
      },
      onScore: (s) => setScore(s),
      onCombo: (c) => setCombo(c),
      onBank: (a) => cbRef.current.handleBank(a),
      onBail: (lost: number) => {
        cbRef.current.showToast(
          lost > 0
            ? `💥 BAILED — lost ${lost.toLocaleString()}!`
            : "💥 Wipeout!",
          1100
        );
      },
      onLetters: (l) => setLetters(l),
      onAllLetters: () => cbRef.current.handleAllLetters(),
      onFlow: (active) => setFlow(active),
      onSpecial: (v) => setSpecial(v),
      onDistance: (d) => setDistance(d),
      onProgress: (p) => setProgress(p),
      onZone: (name, index, accent) => setZone({ name, index, accent }),
      onGrindTick: (lvl) => cbRef.current.handleGrindTick(lvl),
      onTime: (s) => setTimeLeft(s),
      onTimeBonus: (a) => cbRef.current.handleTimeBonus(a),
      onCallout: (text, kind) => cbRef.current.showCallout(text, kind),
      onPower: (kind) => setPower(kind),
      onSfx: (t) => cbRef.current.handleSfx(t),
      onGameOver: (r) => cbRef.current.handleGameOver(r),
    });
    engineRef.current = engine;

    const observer = new ResizeObserver(() => {
      engine.resize(container.clientWidth, container.clientHeight);
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // saved best + sound preference
  useEffect(() => {
    try {
      const savedBest = Number(localStorage.getItem(BEST_KEY)) || 0;
      bestRef.current = savedBest;
      setBest(savedBest);
      const savedMuted = localStorage.getItem(MUTED_KEY) === "true";
      setMuted(savedMuted);
      mutedRef.current = savedMuted;
    } catch {}
    return () => {
      if (bankTimerRef.current) clearTimeout(bankTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Fetch ghost runs to race against (default on)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fid = fcUserRef.current?.fid;
        const res = await fetch(
          `/api/skate/ghosts?limit=4${fid ? `&fid=${fid}` : ""}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          ghosts: {
            username: string;
            flair?: FlairTier | null;
            samples: number[];
          }[];
        };
        if (cancelled) return;
        ghostsRef.current = (data.ghosts || []).map((g, i) => ({
          samples: g.samples,
          color: GHOST_TINTS[i % GHOST_TINTS.length],
          // crew flair rides on the ghost's name tag — rivals flex in-run
          name: `${g.flair ? `${FLAIR_META[g.flair].icon} ` : ""}${
            g.username ? `@${g.username}` : "ghost"
          }`,
        }));
      } catch {
        // no ghosts available — solo run
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSDKLoaded]);

  useEffect(() => {
    loadDaily();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSDKLoaded]);

  // Point the engine at the selected course (takes effect via toTitle re-prime)
  const applyMode = useCallback((m: SkateMode) => {
    setMode(m);
    modeRef.current = m;
    const engine = engineRef.current;
    if (!engine) return;
    if (m === "daily" && dailyRef.current) {
      engine.setCourse(dailyRef.current.seed, true);
    } else {
      engine.setCourse(FREE_SKATE_SEED, false);
    }
    engine.toTitle();
  }, []);

  // Once the daily loads, make it the default selection (the event), and let
  // a daily dare link land directly on today's line.
  useEffect(() => {
    if (!daily || autoDailyRef.current || phase !== "ready") return;
    autoDailyRef.current = true;
    applyMode("daily");
  }, [daily, phase, applyMode]);

  // tick the "resets in…" countdown while the menu is up; refetch on rollover
  useEffect(() => {
    if (phase !== "ready") return;
    const id = setInterval(() => {
      setNowTs(Date.now());
      const d = dailyRef.current;
      if (d && Date.now() >= d.endsAt) loadDaily();
    }, 30_000);
    return () => clearInterval(id);
  }, [phase, loadDaily]);

  // Auto-connect the Farcaster wallet in the mini-app (like the rest of the
  // app) so Warplet skaters resolve without the user tapping connect. The
  // connector attaches to the host wallet; we only nudge it once.
  useEffect(() => {
    if (autoConnectTriedRef.current) return;
    if (isEffectivelyMiniApp && isSDKLoaded && !walletAddress) {
      autoConnectTriedRef.current = true;
      try {
        connectWallet();
      } catch (e) {
        console.error("Skate auto-connect failed:", e);
      }
    }
    // connectWallet is recreated each render; deliberately excluded to avoid loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEffectivelyMiniApp, isSDKLoaded, walletAddress]);

  // Check Warplet eligibility for the connected wallet
  useEffect(() => {
    let cancelled = false;
    if (!walletAddress) {
      setWarplet(null);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/skate/warplets?address=${walletAddress}`);
        if (!res.ok) return;
        const data = (await res.json()) as WarpletInfo;
        if (cancelled) return;
        setWarplet(data);
        if (data.eligible && data.warplets.length > 0) {
          const fid = fcUserRef.current?.fid;
          const saved = (() => {
            try {
              return localStorage.getItem(WARPLET_KEY);
            } catch {
              return null;
            }
          })();
          const pick =
            data.warplets.find((w) => w.tokenId === saved)?.tokenId ||
            data.warplets.find((w) => w.tokenId === String(fid))?.tokenId ||
            data.warplets[0].tokenId;
          setSelectedWarplet(pick);
        }
      } catch {
        // ignore — default skater
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  // Load the selected Warplet image into the engine as the rider sprite
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!selectedWarplet || !warplet?.eligible) {
      engine.setSkaterImage(null);
      warpletPfpRef.current = null;
      return;
    }
    const url = `/api/skate/warplet-image?token=${selectedWarplet}`;
    warpletPfpRef.current = url;
    let cancelled = false;
    removeWarpletBg(url)
      .then((img) => {
        if (!cancelled) engineRef.current?.setSkaterImage(img);
      })
      .catch(() => {});
    try {
      localStorage.setItem(WARPLET_KEY, selectedWarplet);
    } catch {}
    return () => {
      cancelled = true;
    };
  }, [selectedWarplet, warplet?.eligible]);

  // --------------------------------------------------------------- input

  // Touch model: hold anywhere = tuck (build speed / dive), release = let go
  // (launch off a crest / float). A quick flick while airborne is a trick and
  // does not end the hold.
  const gestureRef = useRef<{ x: number; y: number; fired: boolean } | null>(
    null
  );

  // Every start is just "play" — on the daily, every run counts (unlimited
  // tries; your best holds the board). "practice" only when we can't submit.
  const stampRunKind = useCallback(() => {
    if (modeRef.current !== "daily") {
      runKindRef.current = "free";
      return;
    }
    const canSubmit = isMiniAppRef.current || Boolean(DEV_FID);
    runKindRef.current =
      canSubmit && dailyRef.current ? "counted" : "practice";
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      ensureAudio();
      if (phase === "over") return;
      if (phase === "ready") {
        startMusic();
        stampRunKind();
      }
      engineRef.current?.holdStart();
      gestureRef.current = { x: e.clientX, y: e.clientY, fired: false };
    },
    [phase, ensureAudio, startMusic, stampRunKind]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (!g || g.fired) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (Math.abs(dx) > 26 || Math.abs(dy) > 26) {
      g.fired = true;
      let dir: SwipeDir;
      if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? "right" : "left";
      else dir = dy > 0 ? "down" : "up";
      engineRef.current?.swipe(dir);
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    gestureRef.current = null;
    engineRef.current?.holdEnd();
  }, []);

  // keyboard for desktop play / testing: Space = hold/tuck, arrows = tricks
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      if (e.key === " " || e.key === "ArrowDown" || e.key === "s") {
        e.preventDefault();
        if (e.repeat) return;
        ensureAudio();
        if (phase === "ready") {
          startMusic();
          stampRunKind();
        }
        engine.holdStart();
      } else if (e.key === "ArrowUp" || e.key === "w") {
        engine.swipe("up");
      } else if (e.key === "ArrowLeft" || e.key === "a") {
        engine.swipe("left");
      } else if (e.key === "ArrowRight" || e.key === "d") {
        engine.swipe("right");
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "ArrowDown" || e.key === "s") {
        engineRef.current?.holdEnd();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [phase, ensureAudio, startMusic, stampRunKind]);

  const handleRestart = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    setIsNewBest(false);
    setChallengeBeaten(false);
    stampRunKind();
    startMusic();
    engine.reset();
  }, [startMusic, stampRunKind]);

  // back to the title menu (change skater, toggle ghosts, RAD mode, etc.)
  const handleBackToMenu = useCallback(() => {
    setPhase("ready");
    setFinishedRun(null);
    setIsNewBest(false);
    setRankResult(null);
    setChallengeBeaten(false);
    setCombo(null);
    engineRef.current?.toTitle();
  }, []);

  const openBoard = useCallback(async () => {
    setShowBoard(true);
    setBoardLoading(true);
    loadDaily(); // freshen today's board + rivals alongside the all-time list
    try {
      const fid = fcUserRef.current?.fid ?? DEV_FID ?? undefined;
      const res = await fetch(
        `/api/skate/leaderboard${fid ? `?fid=${fid}` : ""}`
      );
      if (res.ok) setBoard((await res.json()) as LeaderboardData);
    } catch (e) {
      console.error("Leaderboard fetch failed:", e);
    } finally {
      setBoardLoading(false);
    }
  }, [loadDaily]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      if (musicRef.current) musicRef.current.muted = next;
      try {
        localStorage.setItem(MUTED_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  // 🥚 secret: tap the warplet on the title screen 7× to unlock RAD MODE
  const tapEgg = useCallback(() => {
    eggTapsRef.current += 1;
    if (eggTapsRef.current >= 7 && !radModeRef.current) {
      radModeRef.current = true;
      setRadMode(true);
      engineRef.current?.setRainbow(true);
      ensureAudio();
      playTone(523, 0.1, "square", 0.06);
      playTone(659, 0.1, "square", 0.06, 0.09);
      playTone(784, 0.1, "square", 0.06, 0.18);
      playTone(1046, 0.22, "square", 0.06, 0.27);
      confetti({
        particleCount: 140,
        spread: 110,
        origin: { y: 0.5 },
        colors: ["#fde68a", "#ec4899", "#67e8f9", "#a855f7", "#2dd4bf"],
      });
      showToast("🥚 SECRET FOUND — RAD MODE unlocked! 🌈", 2800);
    }
  }, [ensureAudio, playTone, showToast]);

  // send a user who's short on $STREME to buy it. In the Farcaster mini-app
  // this opens the native swap sheet (no leaving the game); on the web we fall
  // back to the canonical token page where the full buy UI lives.
  const handleBuyStreme = useCallback(async () => {
    if (isMiniAppView && isSDKLoaded) {
      try {
        await sdk.actions.swapToken({
          buyToken: `eip155:8453/erc20:${STREME_TOKEN}`,
        });
        return;
      } catch (e) {
        console.error("swapToken failed, falling back to token page:", e);
      }
    }
    window.open(`/token/${STREME_TOKEN}`, "_blank");
  }, [isMiniAppView, isSDKLoaded]);

  const handleShare = useCallback(async () => {
    const username =
      (isMiniAppView && farcasterContext?.user?.username) ||
      (DEV_FID ? "dev" : undefined);
    const runScore = finishedRun?.score ?? score;
    const runCombo = finishedRun?.bestCombo ?? 0;
    // a counted daily run shares the DAILY LINE dare — everyone in the feed is
    // on the same course today, so the cast is directly comparable
    const isDailyShare =
      mode === "daily" && daily && (dailyResult || daily.me) ? daily : null;
    // crew flair for the card: this run's submit response, or (sharing later
    // from the board overlay) whatever the board already shows for us
    const myFid = fcUserRef.current?.fid ?? DEV_FID ?? undefined;
    const boardFlair = isDailyShare
      ? [...isDailyShare.entries, ...isDailyShare.nearby].find(
          (e) => e.fid === myFid
        )?.flair
      : undefined;
    const { castText, shareUrl } = isDailyShare
      ? buildDailyShareIntent({
          score: isDailyShare.me?.score ?? runScore,
          day: isDailyShare.day,
          name: isDailyShare.name,
          username,
          rank: dailyResult?.rank ?? isDailyShare.me?.rank,
          total: dailyResult?.total ?? isDailyShare.total,
          streak: (dailyResult?.streak ?? isDailyShare.streak)?.count,
          flair: dailyResult?.flair ?? boardFlair,
        })
      : buildSkateShareIntent({
          score: runScore,
          combo: runCombo,
          username,
          rankResult,
          challenge: liveChallenge,
          challengeBeaten,
          flair: rankResult?.flair,
        });

    if (isMiniAppView && isSDKLoaded) {
      try {
        await sdk.actions.composeCast({ text: castText, embeds: [shareUrl] });
        return;
      } catch (e) {
        console.error("composeCast failed, falling back to web:", e);
      }
    }
    window.open(
      `https://farcaster.xyz/~/compose?text=${encodeURIComponent(
        castText
      )}&embeds[]=${encodeURIComponent(shareUrl)}`,
      "_blank"
    );
  }, [
    score,
    finishedRun,
    liveChallenge,
    challengeBeaten,
    rankResult,
    mode,
    daily,
    dailyResult,
    isMiniAppView,
    isSDKLoaded,
    farcasterContext,
  ]);

  // ----------------------------------------------------------------- UI

  // own crew flair, as the server resolved it on this run's submit — both
  // routes compute it from the same fid, so either response is authoritative
  const myFlair: FlairTier | null =
    dailyResult?.flair ?? rankResult?.flair ?? null;

  const challengeLabel = liveChallenge
    ? `${liveChallenge.score.toLocaleString()}${
        liveChallenge.by ? ` · @${liveChallenge.by}` : ""
      }`
    : null;
  const canCount = (isMiniAppView && isSDKLoaded) || Boolean(DEV_FID);
  const dailyCounted = mode === "daily" && runKind === "counted";
  const dailyPractice = mode === "daily" && runKind === "practice";

  return (
    <div
      className="relative h-full w-full overflow-hidden select-none touch-none"
      style={{
        background:
          "linear-gradient(180deg, #0c0626 0%, #221060 45%, #45179b 60%, #2b1854 100%)",
        WebkitTapHighlightColor: "transparent",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <style>{`
        @keyframes skFloat { 0%,100%{transform:translateY(0) rotate(-8deg)} 50%{transform:translateY(-8px) rotate(-4deg)} }
        @keyframes skBankPop { 0%{transform:translateY(8px) scale(0.7);opacity:0} 25%{transform:translateY(0) scale(1.1);opacity:1} 100%{transform:translateY(-26px) scale(1);opacity:0} }
        @keyframes skPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes skCallout { 0%{transform:scale(0.5) rotate(-6deg);opacity:0} 18%{transform:scale(1.25) rotate(-2deg);opacity:1} 70%{transform:scale(1) rotate(0deg);opacity:1} 100%{transform:scale(1) rotate(0deg);opacity:0} }
        @keyframes skShine { 0%{background-position:0% 50%} 100%{background-position:200% 50%} }
        @keyframes skGlow { 0%,100%{transform:scale(1);filter:brightness(1)} 50%{transform:scale(1.05);filter:brightness(1.15)} }
        @keyframes skBob { 0%,100%{transform:translateY(0) rotate(-3deg)} 50%{transform:translateY(-10px) rotate(2deg)} }
        @keyframes skRise { 0%{transform:translateY(14px);opacity:0} 100%{transform:translateY(0);opacity:1} }
      `}</style>

      {/* canvas mounts here */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* flow-state glowing frame */}
      {flow && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: "inset 0 0 60px 8px rgba(103,232,249,0.5)",
            border: "2px solid rgba(253,230,138,0.6)",
          }}
        />
      )}

      {/* ---------- HUD ---------- */}
      {phase === "playing" && (
        <>
          {/* score + distance */}
          <div className="absolute top-3 left-0 right-0 flex flex-col items-center pointer-events-none">
            <div
              className="font-mono text-4xl font-extrabold text-white"
              style={{ textShadow: "0 0 14px rgba(236,72,153,0.8)" }}
            >
              {score.toLocaleString()}
            </div>
            <div className="font-mono text-xs font-semibold text-cyan-300">
              {distance.toLocaleString()}m
            </div>
            <div
              className="mt-0.5 inline-flex items-center gap-1 font-mono text-[9px] font-bold tracking-[0.18em] text-rose-300/90"
              style={{ textShadow: "0 0 6px rgba(244,63,94,0.7)" }}
            >
              <Heart size={9} fill="currentColor" /> ONE LIFE
            </div>
            {/* the sun (in-canvas) IS the clock; this is just a compact readout
                that flashes red as it runs out, plus the +Xs recharge pop */}
            {(() => {
              const low = timeLeft <= 4;
              const mid = timeLeft <= 7;
              const col = low ? "#f87171" : mid ? "#fbbf24" : "#fcd34d";
              return (
                <div className="mt-0.5 flex flex-col items-center">
                  <div
                    className={`inline-flex items-center gap-1 font-mono text-xs font-bold ${low ? "animate-pulse" : ""}`}
                    style={{ color: col, textShadow: `0 0 8px ${col}` }}
                  >
                    <Sun size={11} /> {timeLeft.toFixed(1)}s
                  </div>
                  {timeBonus && (
                    <div
                      key={timeBonus.id}
                      className="font-mono text-sm font-extrabold text-emerald-300"
                      style={{
                        textShadow: "0 0 10px rgba(16,185,129,0.85)",
                        animation: "skBankPop 0.85s ease-out forwards",
                      }}
                    >
                      +{timeBonus.amount.toFixed(1)}s
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* STREME letters + special meter (top-left) */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none">
            <div className="flex gap-0.5">
              {LETTERS.map((ch, i) => (
                <span
                  key={i}
                  className={`flex h-4 w-4 items-center justify-center rounded font-mono text-[9px] font-bold ${
                    letters[i]
                      ? "bg-cyan-400 text-[#0c0626]"
                      : "bg-white/10 text-white/40"
                  }`}
                >
                  {ch}
                </span>
              ))}
            </div>
            <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-[width] duration-150"
                style={{
                  width: `${Math.round(special * 100)}%`,
                  background: flow
                    ? "linear-gradient(90deg,#fde68a,#ec4899,#67e8f9)"
                    : "linear-gradient(90deg,#6366f1,#2dd4bf)",
                }}
              />
            </div>
            {flow && (
              <span className="inline-flex items-center gap-0.5 font-mono text-[10px] font-bold text-amber-300 animate-pulse">
                <Zap size={10} /> FLOW STATE ×2
              </span>
            )}
            {dailyCounted && (
              <span className="inline-flex items-center gap-0.5 font-mono text-[9px] font-bold tracking-[0.14em] text-amber-200">
                <Zap size={9} /> DAILY · 1 SHOT
              </span>
            )}
          </div>

          {/* live combo readout */}
          {combo && (
            <div className="absolute left-0 right-0 top-28 flex flex-col items-center pointer-events-none px-4 text-center">
              <div
                className="font-mono text-sm font-bold uppercase tracking-wide text-cyan-200"
                style={{ textShadow: "0 0 8px rgba(45,212,191,0.8)" }}
              >
                {combo.tricks.join(" + ")}
              </div>
              <div className="mt-0.5 font-mono text-2xl font-extrabold text-white">
                {combo.live.toLocaleString()}
                <span className="ml-1 text-pink-400">×{combo.multiplier}</span>
              </div>
            </div>
          )}

          {/* banked points pop */}
          {bank && (
            <div className="absolute left-0 right-0 top-44 flex justify-center pointer-events-none">
              <div
                className="font-mono text-3xl font-extrabold text-emerald-300"
                style={{
                  textShadow: "0 0 14px rgba(16,185,129,0.8)",
                  animation: "skBankPop 1.1s ease-out forwards",
                }}
              >
                +{bank.toLocaleString()}
              </div>
            </div>
          )}

          {/* toast */}
          {toast && (
            <div className="absolute left-0 right-0 top-16 flex justify-center pointer-events-none px-4">
              <div className="rounded-full bg-white/10 backdrop-blur-md px-4 py-1.5 border border-cyan-300/30">
                <span className="text-sm font-semibold text-white">{toast}</span>
              </div>
            </div>
          )}

          {/* arcade callouts (PERFECT! · SICK! · CLOSE! · ROCKET! · 1,000m!) */}
          {callouts.length > 0 && (
            <div className="absolute left-0 right-0 top-1/3 flex flex-col items-center gap-1 pointer-events-none">
              {callouts.map((c) => (
                <div
                  key={c.id}
                  className="font-mono font-extrabold tracking-wider"
                  style={{
                    fontSize: c.kind === "perfect" ? 40 : 28,
                    color: CALLOUT_COLORS[c.kind],
                    textShadow: `0 0 16px ${CALLOUT_COLORS[c.kind]}`,
                    animation: "skCallout 0.9s ease-out forwards",
                  }}
                >
                  {c.text}
                </div>
              ))}
            </div>
          )}

          {/* zone meter — fills across the current biome, then loops to the
              next one (endless). The current zone name rides above it. */}
          <div className="absolute bottom-1.5 left-3 right-3 pointer-events-none">
            <div className="mb-0.5 flex items-center justify-between">
              <span
                className="font-mono text-[10px] font-bold tracking-[0.2em]"
                style={{ color: zone.accent, textShadow: `0 0 8px ${zone.accent}` }}
              >
                {zone.name}
              </span>
              <span className="font-mono text-[9px] font-semibold tracking-[0.16em] text-white/40">
                NEXT: {ZONE_NAMES[(zone.index + 1) % ZONE_NAMES.length]}
              </span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-black/40">
              <div
                className="absolute inset-y-0 left-0"
                style={{
                  width: `${Math.min(progress * 100, 100)}%`,
                  background: zone.accent,
                  opacity: 0.9,
                  boxShadow: `0 0 8px ${zone.accent}`,
                }}
              />
              <div
                className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white bg-white/30"
                style={{
                  left: `calc(${Math.min(progress * 100, 100)}% - 6px)`,
                  boxShadow: `0 0 8px ${zone.accent}`,
                }}
              />
            </div>
          </div>

          {/* active power-up chip */}
          {power && (
            <div
              className="absolute bottom-9 right-3 rounded-full bg-white/10 backdrop-blur-md px-3 py-1.5 pointer-events-none border"
              style={{ borderColor: power === "rocket" ? "#fde68a66" : "#67e8f966" }}
            >
              <span
                className="inline-flex items-center gap-1 text-xs font-bold animate-pulse"
                style={{ color: power === "rocket" ? "#fde68a" : "#67e8f9" }}
              >
                {power === "rocket" ? (
                  <>
                    <Rocket size={12} /> ROCKET
                  </>
                ) : (
                  <>
                    <Magnet size={12} /> MAGNET
                  </>
                )}
              </span>
            </div>
          )}

          {/* challenge chip */}
          {challengeLabel && !challengeBeaten && (
            <div className="absolute bottom-9 left-3 rounded-full bg-white/10 backdrop-blur-md px-3 py-1.5 pointer-events-none">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-white">
                <Target size={12} /> Beat {challengeLabel}
              </span>
            </div>
          )}
        </>
      )}

      {/* sound + leaderboard buttons */}
      <div className="absolute top-3 right-3 flex gap-2">
        {phase !== "playing" && (
          <button
            className="btn btn-circle btn-sm border-0 bg-white/10 text-white hover:bg-white/20"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={openBoard}
            aria-label="Leaderboard"
          >
            <Trophy size={16} />
          </button>
        )}
        <button
          className="btn btn-circle btn-sm border-0 bg-white/10 text-white hover:bg-white/20"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={toggleMute}
          aria-label={muted ? "Unmute sound" : "Mute sound"}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>

      {/* ---------- start screen (title menu) ---------- */}
      {phase === "ready" && (
        <div className="absolute inset-0 pointer-events-none">
          {/* legibility scrim — sits BEHIND the menu content (the relative z-10
              wrapper below), so it darkens the moving course, never the text */}
          <div
            className="absolute inset-0 backdrop-blur-[2px]"
            style={{
              background:
                "radial-gradient(130% 95% at 50% 42%, rgba(6,3,18,0.85) 0%, rgba(6,3,18,0.7) 60%, rgba(6,3,18,0.6) 100%)",
            }}
          />

          {/* all menu content — layered above the scrim so it stays readable */}
          <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
          {/* character on a spotlight — tap me 7× for a secret */}
          <div
            className="relative pointer-events-auto"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={tapEgg}
            role="button"
            aria-label="Skater"
          >
            <div
              className="absolute left-1/2 top-1/2 -z-10 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(103,232,249,0.4) 0%, rgba(236,72,153,0.18) 45%, transparent 72%)",
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                selectedWarplet
                  ? `/api/skate/warplet-image?token=${selectedWarplet}`
                  : "/surf/monster.png"
              }
              alt="Streme skater"
              className="relative h-28 w-28 object-contain drop-shadow-[0_0_30px_rgba(103,232,249,0.7)]"
              style={{
                imageRendering: selectedWarplet ? "auto" : "pixelated",
                animation: "skBob 2.8s ease-in-out infinite",
              }}
            />
          </div>

          {/* title */}
          <div className="relative" style={{ animation: "skRise 0.55s ease-out both" }}>
            <h1
              className="whitespace-nowrap font-black italic leading-none tracking-tighter"
              style={{
                fontSize: "clamp(1.9rem, 9vw, 3rem)",
                backgroundImage:
                  "linear-gradient(90deg,#67e8f9,#ec4899,#fde68a,#67e8f9)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                filter:
                  "drop-shadow(0 2px 5px rgba(0,0,0,0.85)) drop-shadow(0 0 18px rgba(103,232,249,0.5))",
                animation: "skShine 3.2s linear infinite",
              }}
            >
              STREME SKATE
            </h1>
            {radMode && (
              <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-black tracking-[0.25em] text-amber-200">
                <Rainbow size={12} /> RAD MODE
              </div>
            )}
          </div>

          {/* mode select — the DAILY LINE is the event, free skate the gym */}
          <div
            className="flex w-72 items-center gap-1 rounded-full border border-white/15 bg-white/5 p-1 pointer-events-auto"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => applyMode("daily")}
              className={`flex flex-1 items-center justify-center gap-1 rounded-full px-2 py-1.5 text-xs font-black tracking-wide transition ${
                mode === "daily"
                  ? "bg-amber-300 text-[#0c0626]"
                  : "text-white/60"
              }`}
            >
              <Zap size={13} /> DAILY LINE
            </button>
            <button
              onClick={() => applyMode("free")}
              className={`flex flex-1 items-center justify-center gap-1 rounded-full px-2 py-1.5 text-xs font-black tracking-wide transition ${
                mode === "free" ? "bg-cyan-300 text-[#0c0626]" : "text-white/60"
              }`}
            >
              <InfinityIcon size={13} /> FREE SKATE
            </button>
          </div>

          {/* stat chips — same column width as everything else */}
          <div className="flex w-72 flex-col items-stretch gap-1.5 text-center empty:hidden">
            {mode === "daily" && daily && (
              <div className="rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-xs text-amber-100">
                <span className="font-bold">{daily.name}</span>
                <span className="opacity-70">
                  {" "}
                  · resets in {formatTimeLeft(daily.endsAt, nowTs)}
                </span>
              </div>
            )}
            {mode === "daily" && daily?.me && (
              <div className="flex items-center justify-center gap-3 rounded-full border border-cyan-300/40 bg-cyan-400/15 px-3 py-1 text-xs text-cyan-100">
                <span>
                  Best <span className="font-bold">#{daily.me.rank}</span>
                  <span className="opacity-70"> of {daily.total}</span>
                </span>
                <span className="font-mono font-semibold">
                  {daily.me.score.toLocaleString()}
                </span>
                {daily.streak.count >= 2 && (
                  <span className="inline-flex items-center gap-0.5 font-bold text-orange-300">
                    <Flame size={12} /> {daily.streak.count}d
                  </span>
                )}
              </div>
            )}
            {mode === "daily" &&
              daily &&
              !daily.me &&
              daily.streak.count >= 2 && (
                <div className="inline-flex items-center justify-center gap-1 rounded-full border border-orange-300/40 bg-orange-400/10 px-3 py-1 text-xs font-bold text-orange-200">
                  <Flame size={12} /> {daily.streak.count}-day streak
                </div>
              )}
            {mode === "free" && best > 0 && (
              <div className="inline-flex items-center justify-center gap-1 rounded-full border border-amber-300/25 bg-white/8 px-3 py-1 text-xs text-amber-200">
                <Trophy size={12} /> Best{" "}
                <span className="font-mono font-semibold">
                  {best.toLocaleString()}
                </span>
              </div>
            )}
            {challengeLabel && (
              <div className="inline-flex items-center justify-center gap-1 rounded-full border border-cyan-300/40 bg-cyan-400/15 px-3 py-1 text-xs text-cyan-100">
                <Target size={12} /> Beat {challengeLabel}
                {liveChallenge?.day ? " today" : ""}
              </div>
            )}
            {staleDailyDare && (
              <div className="inline-flex items-center justify-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/60">
                <Hourglass size={12} /> That dare expired — fresh line today
              </div>
            )}
          </div>

          {/* PLAY (visual — tapping anywhere drops you in). On the daily every
              run counts toward your best; the pill burns amber to say so. */}
          {(() => {
            const countsNext = mode === "daily" && !!daily && canCount;
            return (
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className="mt-1 flex w-72 items-center justify-center gap-2 rounded-full py-3 text-xl font-black text-[#0c0626]"
                  style={{
                    background: countsNext
                      ? "linear-gradient(90deg,#fde68a,#fb923c,#ec4899)"
                      : "linear-gradient(90deg,#67e8f9,#34d399,#fbbf24)",
                    boxShadow: countsNext
                      ? "0 0 34px rgba(253,230,138,0.55)"
                      : "0 0 34px rgba(103,232,249,0.55)",
                    animation: "skGlow 1.5s ease-in-out infinite",
                  }}
                >
                  <Play size={20} fill="currentColor" /> PLAY
                </div>
                {countsNext && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-200/90">
                    <Zap size={11} />{" "}
                    {daily?.me
                      ? "beat your best — every run counts today"
                      : "every run counts — best holds the board"}
                  </span>
                )}
              </div>
            );
          })()}

          {/* option chips — interactive, must not start the run. Stacked. */}
          <div
            className="mt-0.5 flex flex-col items-center gap-2 pointer-events-auto"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowPicker(true)}
              className="inline-flex w-72 items-center justify-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-300/10 px-3.5 py-1.5 text-xs font-bold text-amber-100"
            >
              <Sparkles size={13} /> Choose your skater
            </button>
            <button
              onClick={openBoard}
              className="inline-flex w-72 items-center justify-center gap-1.5 rounded-full border border-cyan-300/40 bg-white/5 px-3.5 py-1.5 text-xs font-bold text-cyan-100"
            >
              <Trophy size={13} /> Leaderboard
            </button>
          </div>
          </div>
        </div>
      )}

      {/* ---------- game over ---------- */}
      {phase === "over" && finishedRun && (
        <div
          className="absolute inset-0 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px] px-4 pb-8 sm:pb-4"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-sm rounded-2xl bg-base-100/95 p-6 shadow-2xl text-center">
            {dailyCounted && daily && (
              <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-3 py-1 text-xs font-bold text-amber-600">
                <Zap size={12} /> Daily Line · {daily.name}
              </div>
            )}
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] opacity-50">
              {finishedRun.timedOut ? (
                <>
                  <Timer size={13} /> Time up
                </>
              ) : (
                <>
                  <Skull size={13} /> Wiped out
                </>
              )}
            </div>
            <div className="mt-1 font-mono text-6xl font-black leading-none text-primary">
              {finishedRun.score.toLocaleString()}
            </div>
            <div className="mt-2 text-sm">
              {challengeBeaten && liveChallenge ? (
                <span className="inline-flex items-center gap-1 font-bold text-success">
                  <Swords size={14} /> Challenge smashed
                  {liveChallenge.by ? ` — sorry @${liveChallenge.by}` : ""}!
                </span>
              ) : isNewBest ? (
                <span className="inline-flex items-center gap-1 font-bold text-success">
                  <Sparkles size={14} /> New best run
                </span>
              ) : (
                <span className="opacity-50">
                  Best: {best.toLocaleString()}
                </span>
              )}
            </div>
            <div className="mt-4 grid grid-cols-3 divide-x divide-base-content/10 rounded-xl bg-base-200/70 py-2.5">
              <div>
                <div className="font-mono text-base font-bold">
                  {finishedRun.distance.toLocaleString()}m
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-wider opacity-45">
                  distance
                </div>
              </div>
              <div>
                <div className="font-mono text-base font-bold">
                  {finishedRun.bestCombo.toLocaleString()}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-wider opacity-45">
                  best combo
                </div>
              </div>
              <div>
                <div className="font-mono text-base font-bold">
                  {finishedRun.bubbles.toLocaleString()}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-wider opacity-45">
                  bubbles
                </div>
              </div>
            </div>
            {/* one achievements row: rank, streak, crew flair */}
            {(dailyCounted ? dailyResult : rankResult) && (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                {dailyCounted && dailyResult ? (
                  <button
                    className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-3 py-1 text-sm font-bold text-amber-600"
                    onClick={openBoard}
                  >
                    <Zap size={13} /> #{dailyResult.rank} today
                  </button>
                ) : (
                  rankResult && (
                    <button
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary"
                      onClick={openBoard}
                    >
                      {/* the all-time rank belongs to your BEST run — say so
                          when this run isn't it, or the numbers look wrong */}
                      <Trophy size={13} />{" "}
                      {rankResult.improved
                        ? `#${rankResult.rank} all-time`
                        : `best is #${rankResult.rank} all-time`}
                    </button>
                  )
                )}
                {dailyCounted &&
                  dailyResult &&
                  dailyResult.streak.count >= 2 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-400/15 px-3 py-1 text-sm font-bold text-orange-500">
                      <Flame size={13} /> {dailyResult.streak.count} days
                    </span>
                  )}
                {myFlair &&
                  (() => {
                    const FlairIcon = FLAIR_ICONS[myFlair];
                    return (
                      <span
                        title={FLAIR_META[myFlair].hint}
                        className={`inline-flex cursor-help items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${FLAIR_META[myFlair].chipClassName}`}
                      >
                        <FlairIcon size={13} /> {FLAIR_META[myFlair].label}
                      </span>
                    );
                  })()}
              </div>
            )}
            {/* crew flair upsell — one quiet line at the pride moment, only
                when this run made the board and the wallet has no flair */}
            {(dailyCounted ? dailyResult : rankResult) && !myFlair && (
              <button
                className="mt-2 inline-flex items-center gap-1 text-xs opacity-60 underline-offset-2 hover:underline hover:opacity-100"
                onClick={handleBuyStreme}
              >
                <Sticker size={12} /> Hold 1M $STREME for crew flair on the
                board
              </button>
            )}
            {dailyCounted && dailyResult && (
              <div className="mt-2 text-xs opacity-60">
                {dailyResult.improved ? (
                  <span className="font-bold text-success">
                    New daily best — run it back to climb higher
                  </span>
                ) : (
                  <span>
                    Didn&apos;t top today&apos;s best (
                    {dailyResult.best.toLocaleString()}) — try again
                  </span>
                )}
              </div>
            )}
            {dailyPractice && daily?.me && (
              <div className="mt-2 text-xs opacity-50">
                Practice run — your best today is{" "}
                {daily.me.score.toLocaleString()} (#{daily.me.rank})
              </div>
            )}
            {dailyCounted && daily && daily.nearby.length > 0 && (
              <div className="mt-2 rounded-lg bg-base-200 px-3 py-2 text-left">
                <div className="mb-1 text-center font-mono text-[10px] font-bold tracking-widest opacity-50">
                  RIVALS ON TODAY&apos;S LINE
                </div>
                {daily.nearby.map((e) => {
                  const isMe = fcUserRef.current?.fid === e.fid;
                  return (
                    <div
                      key={e.fid}
                      className={`flex items-center justify-between font-mono text-xs ${
                        isMe ? "font-bold text-primary" : "opacity-70"
                      }`}
                    >
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <span className="truncate">
                          {e.username ? `@${e.username}` : `fid ${e.fid}`}
                        </span>
                        {e.flair &&
                          (() => {
                            const FlairIcon = FLAIR_ICONS[e.flair];
                            return (
                              <span
                                title={FLAIR_META[e.flair].hint}
                                className={`shrink-0 cursor-help ${FLAIR_TEXT[e.flair]}`}
                              >
                                <FlairIcon size={11} />
                              </span>
                            );
                          })()}
                        {isMe ? " (you)" : ""}
                      </span>
                      <span>{e.score.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-5 flex flex-col gap-2">
              <button className="btn btn-primary w-full" onClick={handleShare}>
                {dailyCounted ? (
                  <>
                    <Zap size={16} /> Dare the feed
                  </>
                ) : (
                  <>
                    <Swords size={16} /> Challenge your friends
                  </>
                )}
              </button>
              <button className="btn btn-outline w-full" onClick={handleRestart}>
                <RotateCcw size={15} /> Play again
              </button>
              <div className="flex gap-2">
                <button
                  className="btn btn-ghost btn-sm flex-1"
                  onClick={handleBackToMenu}
                >
                  <Home size={14} /> Menu
                </button>
                <button
                  className="btn btn-ghost btn-sm flex-1"
                  onClick={openBoard}
                >
                  <Trophy size={14} /> Leaderboard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- skater / Warplet picker ---------- */}
      {showPicker && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-sm rounded-2xl bg-base-100/95 p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Choose your skater</h2>
              <button
                className="btn btn-circle btn-ghost btn-sm"
                onClick={() => setShowPicker(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <p className="mt-1 text-xs opacity-60">
              Hold a{" "}
              <a
                href="https://opensea.io/collection/the-warplets-farcaster"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Warplet
              </a>{" "}
              + 10M $STREME (or staked) to skate as your own Warplet.
            </p>

            <div className="mt-3 flex flex-col gap-2">
              {/* default skater */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setSelectedWarplet(null);
                    setShowPicker(false);
                  }}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2 ${
                    !selectedWarplet ? "border-primary" : "border-base-300"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/surf/monster.png"
                    alt="Warplet"
                    className="h-12 w-12 object-contain"
                    style={{ imageRendering: "pixelated" }}
                  />
                  <span className="text-[10px] font-semibold">Classic</span>
                </button>

                {warplet?.eligible &&
                  warplet.warplets.map((w) => (
                    <button
                      key={w.tokenId}
                      onClick={() => {
                        setSelectedWarplet(w.tokenId);
                        setShowPicker(false);
                      }}
                      className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2 ${
                        selectedWarplet === w.tokenId
                          ? "border-amber-400"
                          : "border-base-300"
                      }`}
                      title={w.name}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={w.image}
                        alt={w.name}
                        className="h-12 w-12 rounded-md object-cover bg-base-300"
                      />
                      <span className="text-[10px] font-semibold">
                        #{w.tokenId}
                      </span>
                    </button>
                  ))}
              </div>

              {/* status / requirements */}
              {!walletAddress ? (
                <div className="rounded-lg bg-base-200 p-3 text-center text-xs opacity-70">
                  Connect your wallet in Farcaster to skate as a Warplet.
                </div>
              ) : !warplet ? (
                <div className="flex justify-center py-3">
                  <span className="loading loading-spinner loading-sm" />
                </div>
              ) : !warplet.eligible ? (
                <div className="rounded-lg bg-base-200 p-3 text-xs">
                  <div className="mb-1 font-semibold opacity-70">
                    To unlock Warplet skaters:
                  </div>
                  <div className="flex items-center gap-2">
                    {warplet.ownsWarplet ? (
                      <CircleCheck size={14} className="text-success" />
                    ) : (
                      <Circle size={14} className="opacity-40" />
                    )}
                    <span>Own a Warplet NFT</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {warplet.streme >= 10_000_000 ||
                    warplet.staked >= 10_000_000 ? (
                      <CircleCheck size={14} className="text-success" />
                    ) : (
                      <Circle size={14} className="opacity-40" />
                    )}
                    <span>
                      Hold 10M $STREME or staked (you:{" "}
                      {Math.max(warplet.streme, warplet.staked).toLocaleString()})
                    </span>
                  </div>
                  {warplet.streme < 10_000_000 && warplet.staked < 10_000_000 && (
                    <button
                      onClick={handleBuyStreme}
                      className="btn btn-primary btn-sm mt-3 w-full"
                    >
                      <Coins size={14} /> Buy $STREME
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ---------- leaderboard overlay (TODAY / ALL-TIME) ---------- */}
      {showBoard && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-sm rounded-2xl bg-base-100/95 p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Trophy size={18} className="text-warning" />
                {boardTab === "daily" ? "Daily Line" : "Top Skaters"}
              </h2>
              <button
                className="btn btn-circle btn-ghost btn-sm"
                onClick={() => setShowBoard(false)}
                aria-label="Close leaderboard"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-2 flex gap-1 rounded-full bg-base-200 p-1">
              <button
                onClick={() => setBoardTab("daily")}
                className={`flex flex-1 items-center justify-center gap-1 rounded-full py-1 text-xs font-bold ${
                  boardTab === "daily" ? "bg-warning text-warning-content" : "opacity-60"
                }`}
              >
                <Zap size={12} /> TODAY
              </button>
              <button
                onClick={() => setBoardTab("alltime")}
                className={`flex flex-1 items-center justify-center gap-1 rounded-full py-1 text-xs font-bold ${
                  boardTab === "alltime" ? "bg-primary text-primary-content" : "opacity-60"
                }`}
              >
                <Trophy size={12} /> ALL-TIME
              </button>
            </div>

            {boardTab === "daily" && daily && (
              <div className="mt-2 text-center font-mono text-[11px] opacity-60">
                {daily.name} · resets in {formatTimeLeft(daily.endsAt, nowTs)} ·{" "}
                {daily.total} dropped in
              </div>
            )}

            <div className="mt-2 max-h-80 overflow-y-auto">
              {(() => {
                const entries =
                  boardTab === "daily" ? daily?.entries ?? [] : board?.entries ?? [];
                const loading = boardTab === "alltime" && boardLoading;
                if (loading) {
                  return (
                    <div className="flex justify-center py-8">
                      <span className="loading loading-spinner loading-md" />
                    </div>
                  );
                }
                if (entries.length === 0) {
                  return (
                    <p className="py-8 text-center text-sm opacity-60">
                      {boardTab === "daily"
                        ? "Nobody's dropped in yet — set today's line!"
                        : "No skaters yet — be the first on the board!"}
                    </p>
                  );
                }
                const MEDAL_TINTS = [
                  "text-amber-400",
                  "text-slate-400",
                  "text-amber-700",
                ];
                const row = (entry: LeaderboardEntry, rank: number) => {
                  const isMe = fcUserRef.current?.fid === entry.fid;
                  return (
                    <li
                      key={`${rank}-${entry.fid}`}
                      className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${
                        isMe ? "bg-primary/10 ring-1 ring-primary" : ""
                      }`}
                    >
                      <span className="flex w-6 justify-end font-mono text-sm opacity-60">
                        {rank <= 3 ? (
                          <Medal size={15} className={MEDAL_TINTS[rank - 1]} />
                        ) : (
                          rank
                        )}
                      </span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={entry.pfpUrl || "/icon-transparent.png"}
                        alt=""
                        className="w-7 h-7 rounded-full object-cover bg-base-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "/icon-transparent.png";
                        }}
                      />
                      <span className="flex min-w-0 flex-1 items-center gap-1 text-sm font-medium">
                        <span className="truncate">
                          {entry.username
                            ? `@${entry.username}`
                            : `fid ${entry.fid}`}
                        </span>
                        {entry.flair &&
                          (() => {
                            const FlairIcon = FLAIR_ICONS[entry.flair];
                            return (
                              <span
                                title={FLAIR_META[entry.flair].hint}
                                className={`shrink-0 cursor-help ${FLAIR_TEXT[entry.flair]}`}
                              >
                                <FlairIcon size={13} />
                              </span>
                            );
                          })()}
                      </span>
                      <span className="font-mono text-sm font-semibold text-primary">
                        {entry.score.toLocaleString()}
                      </span>
                    </li>
                  );
                };
                const nearby =
                  boardTab === "daily" && daily?.me
                    ? daily.nearby.filter(
                        (e) =>
                          (e.rank ?? 0) > entries.length &&
                          !entries.some((t) => t.fid === e.fid)
                      )
                    : [];
                return (
                  <ul className="flex flex-col gap-1">
                    {entries.map((e, i) => row(e, i + 1))}
                    {nearby.length > 0 && (
                      <>
                        <li className="py-0.5 text-center font-mono text-xs opacity-40">
                          ···
                        </li>
                        {nearby.map((e) => row(e, e.rank ?? 0))}
                      </>
                    )}
                  </ul>
                );
              })()}
            </div>

            {boardTab === "alltime" &&
              board?.player &&
              board.player.rank > (board?.entries.length ?? 0) && (
                <div className="mt-2 rounded-lg bg-primary/10 px-3 py-2 text-center font-mono text-sm">
                  You: #{board.player.rank} ·{" "}
                  {board.player.best.toLocaleString()}
                </div>
              )}
            {boardTab === "daily" && daily?.me && (
              <div className="mt-2 flex items-center justify-between rounded-lg bg-warning/10 px-3 py-2 font-mono text-sm">
                <span>
                  You: #{daily.me.rank} · {daily.me.score.toLocaleString()}
                </span>
                {daily.streak.count >= 2 && (
                  <span className="inline-flex items-center gap-0.5 text-orange-500">
                    <Flame size={13} /> {daily.streak.count}d
                  </span>
                )}
              </div>
            )}
            {boardTab === "daily" && daily?.me && (
              <button
                className="btn btn-warning btn-sm mt-2 w-full font-bold"
                onClick={handleShare}
              >
                <Zap size={14} /> Dare the feed with your rank
              </button>
            )}
            {!isMiniAppView && (
              <p className="mt-3 text-center text-xs opacity-60">
                Play inside Farcaster to claim a spot on the board
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
