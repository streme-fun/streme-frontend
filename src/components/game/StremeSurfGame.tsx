"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import sdk from "@farcaster/miniapp-sdk";
import confetti from "canvas-confetti";
import { Trophy, Volume2, VolumeX, X } from "lucide-react";
import { useAppFrameLogic } from "../../hooks/useAppFrameLogic";
import { SurfGameEngine, CoinEvent, CoinSkin } from "./SurfGameEngine";

interface PoolToken {
  image: HTMLImageElement | null;
  symbol: string;
  src: string;
}

export interface SurfChallenge {
  distance: number;
  by?: string;
  rank?: number;
}

interface LeaderboardEntry {
  fid: number;
  username: string;
  pfpUrl: string;
  distance: number;
  bubbles: number;
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
}

type Phase = "ready" | "playing" | "over";

const BEST_KEY = "streme-surf-best";
const MUTED_KEY = "streme-surf-muted";
const BASE_SHARE_URL = "https://streme.fun/surf";
const MAX_POOL_TOKENS = 16;

/** Same-origin proxy via Next's image optimizer keeps canvases untainted. */
function proxiedImageUrl(url: string): string {
  return `/_next/image?url=${encodeURIComponent(url)}&w=128&q=75`;
}

export default function StremeSurfGame({
  challenge,
}: {
  challenge?: SurfChallenge | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SurfGameEngine | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(false);
  const bestRef = useRef(0);
  const poolRef = useRef<PoolToken[]>([]);
  const pickupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const surgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phase, setPhase] = useState<Phase>("ready");
  const [distance, setDistance] = useState(0);
  const [bubbles, setBubbles] = useState(0);
  const [best, setBest] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [muted, setMuted] = useState(false);
  const [lastPickup, setLastPickup] = useState<PoolToken | null>(null);
  const [surgeText, setSurgeText] = useState<string | null>(null);
  const [challengeBeaten, setChallengeBeaten] = useState(false);
  const [rankResult, setRankResult] = useState<RankResult | null>(null);
  const [showBoard, setShowBoard] = useState(false);
  const [board, setBoard] = useState<LeaderboardData | null>(null);
  const [boardLoading, setBoardLoading] = useState(false);

  const { isMiniAppView, isSDKLoaded, farcasterContext } = useAppFrameLogic();
  const isMiniAppRef = useRef(false);
  isMiniAppRef.current = isMiniAppView && isSDKLoaded;
  const fcUserRef = useRef<{
    fid: number;
    username?: string;
    pfpUrl?: string;
  } | null>(null);
  fcUserRef.current = farcasterContext?.user ?? null;

  // ------------------------------------------------------------ sound fx

  const playTone = useCallback(
    (
      freq: number,
      duration: number,
      type: OscillatorType = "sine",
      volume = 0.08,
      delay = 0
    ) => {
      const ctx = audioCtxRef.current;
      if (!ctx || mutedRef.current) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + delay;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
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

  // ------------------------------------------------------------- haptics

  const haptic = useCallback((kind: "pop" | "surge" | "wipeout") => {
    if (!isMiniAppRef.current) return;
    try {
      if (kind === "pop") sdk.haptics.impactOccurred("light");
      else if (kind === "surge") sdk.haptics.notificationOccurred("success");
      else sdk.haptics.notificationOccurred("error");
    } catch {
      // Haptics unsupported on this client; ignore
    }
  }, []);

  // ------------------------------------------------------- engine wiring

  const showSurge = useCallback((text: string, ms = 1800) => {
    setSurgeText(text);
    if (surgeTimerRef.current) clearTimeout(surgeTimerRef.current);
    surgeTimerRef.current = setTimeout(() => setSurgeText(null), ms);
  }, []);

  const handleCoin = useCallback(
    (event: CoinEvent) => {
      setBubbles(event.total);
      haptic("pop");
      playTone(880, 0.07, "triangle", 0.07);
      playTone(1320, 0.1, "triangle", 0.06, 0.04);
      const token = poolRef.current.find((t) => t.symbol === event.symbol);
      if (token) {
        setLastPickup(token);
        if (pickupTimerRef.current) clearTimeout(pickupTimerRef.current);
        pickupTimerRef.current = setTimeout(() => setLastPickup(null), 1200);
      }
    },
    [haptic, playTone]
  );

  const handleMilestone = useCallback(() => {
    haptic("surge");
    playTone(523, 0.1, "triangle", 0.08);
    playTone(784, 0.16, "triangle", 0.08, 0.08);
    showSurge("🌊 Flow surge — the stream speeds up!");
  }, [haptic, playTone, showSurge]);

  const handleChallengePassed = useCallback(
    (challengeDistance: number) => {
      setChallengeBeaten(true);
      haptic("surge");
      playTone(523, 0.1, "triangle", 0.09);
      playTone(659, 0.1, "triangle", 0.09, 0.08);
      playTone(784, 0.1, "triangle", 0.09, 0.16);
      playTone(1046, 0.22, "triangle", 0.09, 0.24);
      showSurge(`🏆 Challenge smashed — past ${challengeDistance}m!`, 2400);
      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.6 },
        colors: ["#6366f1", "#ec4899", "#2dd4bf", "#67e8f9"],
      });
    },
    [haptic, playTone, showSurge]
  );

  const handleGameOver = useCallback(
    (finalDistance: number, finalBubbles: number) => {
      setPhase("over");
      haptic("wipeout");
      playTone(220, 0.25, "sawtooth", 0.06);
      playTone(120, 0.45, "sawtooth", 0.06, 0.12);
      const beatBest = finalDistance > 0 && finalDistance > bestRef.current;
      setIsNewBest(beatBest);
      if (beatBest) {
        bestRef.current = finalDistance;
        setBest(finalDistance);
        try {
          localStorage.setItem(BEST_KEY, String(finalDistance));
        } catch {}
      }

      // Post the run to the Farcaster leaderboard
      setRankResult(null);
      const user = fcUserRef.current;
      if (isMiniAppRef.current && user && finalDistance > 0) {
        sdk.quickAuth
          .fetch("/api/game/leaderboard", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              distance: finalDistance,
              bubbles: finalBubbles,
              username: user.username ?? "",
              pfpUrl: user.pfpUrl ?? "",
            }),
          })
          .then((res) => (res.ok ? res.json() : null))
          .then((result: RankResult | null) => {
            if (result) setRankResult(result);
          })
          .catch((error) => {
            console.error("Leaderboard submit failed:", error);
          });
      }
    },
    [haptic, playTone]
  );

  const getCoinSkin = useCallback((): CoinSkin | null => {
    const pool = poolRef.current;
    if (pool.length === 0) return null;
    const token = pool[Math.floor(Math.random() * pool.length)];
    return { image: token.image, symbol: token.symbol };
  }, []);

  const handleCoinRef = useRef(handleCoin);
  handleCoinRef.current = handleCoin;
  const handleMilestoneRef = useRef(handleMilestone);
  handleMilestoneRef.current = handleMilestone;
  const handleChallengePassedRef = useRef(handleChallengePassed);
  handleChallengePassedRef.current = handleChallengePassed;
  const handleGameOverRef = useRef(handleGameOver);
  handleGameOverRef.current = handleGameOver;
  const getCoinSkinRef = useRef(getCoinSkin);
  getCoinSkinRef.current = getCoinSkin;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const engine = new SurfGameEngine(container, {
      onStart: () => {
        setPhase("playing");
        setDistance(0);
        setBubbles(0);
        setLastPickup(null);
        setSurgeText(null);
        setChallengeBeaten(false);
      },
      onProgress: (d) => setDistance(d),
      onCoin: (event) => handleCoinRef.current(event),
      onMilestone: () => handleMilestoneRef.current(),
      onChallengePassed: (c) => handleChallengePassedRef.current(c),
      onGameOver: (d, c) => handleGameOverRef.current(d, c),
      getCoinSkin: () => getCoinSkinRef.current(),
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

  // A shared challenge drops a "beat this" gate into the run
  useEffect(() => {
    if (challenge && challenge.distance > 0) {
      engineRef.current?.setChallenge(challenge.distance);
    }
  }, [challenge]);

  // Saved best + sound preference
  useEffect(() => {
    try {
      const savedBest = Number(localStorage.getItem(BEST_KEY)) || 0;
      bestRef.current = savedBest;
      setBest(savedBest);
      const savedMuted = localStorage.getItem(MUTED_KEY) === "true";
      setMuted(savedMuted);
      mutedRef.current = savedMuted;
    } catch {}
  }, []);

  // Bubble pool: STREME plus live trending Streme tokens. Images are loaded
  // one at a time through the same-origin optimizer to avoid jank spikes.
  useEffect(() => {
    let cancelled = false;

    const loadToken = (symbol: string, src: string) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          if (!cancelled) poolRef.current.push({ image: img, symbol, src });
          resolve();
        };
        img.onerror = () => resolve();
        img.src = src;
      });

    (async () => {
      await loadToken("STREME", "/icon-transparent.png");
      try {
        const res = await fetch("/api/tokens/trending");
        const data: unknown = res.ok ? await res.json() : [];
        if (cancelled || !Array.isArray(data)) return;
        const seen = new Set<string>();
        for (const t of data) {
          if (cancelled || seen.size >= MAX_POOL_TOKENS) break;
          const token = t as { symbol?: unknown; img_url?: unknown };
          if (
            typeof token.symbol !== "string" ||
            typeof token.img_url !== "string" ||
            !token.img_url.startsWith("http") ||
            token.symbol === "STREME" ||
            seen.has(token.symbol)
          ) {
            continue;
          }
          seen.add(token.symbol);
          await loadToken(token.symbol, proxiedImageUrl(token.img_url));
        }
      } catch {
        // Trending fetch failed; STREME bubbles still work
      }
    })();

    return () => {
      cancelled = true;
      if (pickupTimerRef.current) clearTimeout(pickupTimerRef.current);
      if (surgeTimerRef.current) clearTimeout(surgeTimerRef.current);
    };
  }, []);

  // --------------------------------------------------------------- input

  const steerFromEvent = useCallback((clientX: number) => {
    const container = containerRef.current;
    const engine = engineRef.current;
    if (!container || !engine) return;
    const rect = container.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    engine.setTarget(nx);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      ensureAudio();
      if (phase === "over") return; // overlay buttons handle themselves
      steerFromEvent(e.clientX);
      engineRef.current?.tap();
    },
    [phase, ensureAudio, steerFromEvent]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (phase !== "playing") return;
      steerFromEvent(e.clientX);
    },
    [phase, steerFromEvent]
  );

  const handleRestart = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.reset();
    setIsNewBest(false);
    engine.tap(); // straight back into the water
  }, []);

  const openBoard = useCallback(async () => {
    setShowBoard(true);
    setBoardLoading(true);
    try {
      const fid = fcUserRef.current?.fid;
      const res = await fetch(
        `/api/game/leaderboard${fid ? `?fid=${fid}` : ""}`
      );
      if (res.ok) setBoard((await res.json()) as LeaderboardData);
    } catch (error) {
      console.error("Leaderboard fetch failed:", error);
    } finally {
      setBoardLoading(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      try {
        localStorage.setItem(MUTED_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleShare = useCallback(async () => {
    const username =
      (isMiniAppView && farcasterContext?.user?.username) || undefined;
    // Dare friends with your best ride, stamped with your leaderboard rank
    const shareDistance = Math.max(distance, rankResult?.best ?? 0);
    const params = new URLSearchParams({ d: String(shareDistance) });
    if (username) params.set("by", username);
    if (rankResult) params.set("r", String(rankResult.rank));
    const shareUrl = `${BASE_SHARE_URL}?${params.toString()}`;

    let opener: string;
    if (challengeBeaten && challenge) {
      opener = `I smashed ${
        challenge.by ? `@${challenge.by}'s` : "the"
      } ${challenge.distance}m challenge — rode ${distance}m in Streme Surf 🏄🌊`;
      if (rankResult) opener += `\n\nNow #${rankResult.rank} on the leaderboard 🏆`;
    } else if (rankResult) {
      opener = `I'm #${rankResult.rank} of ${rankResult.total} on the Streme Surf leaderboard with a ${rankResult.best}m ride 🏄🌊`;
    } else {
      opener = `I rode the stream ${distance}m and popped ${bubbles} bubbles in Streme Surf 🏄🌊`;
    }
    const castText = `${opener}\n\nThink you can beat my ride?\n\n${shareUrl}`;

    if (isMiniAppView && isSDKLoaded) {
      try {
        await sdk.actions.composeCast({
          text: castText,
          embeds: [shareUrl],
        });
        return;
      } catch (error) {
        console.error("composeCast failed, falling back to web:", error);
      }
    }
    window.open(
      `https://farcaster.xyz/~/compose?text=${encodeURIComponent(
        castText
      )}&embeds[]=${encodeURIComponent(shareUrl)}`,
      "_blank"
    );
  }, [
    distance,
    bubbles,
    challenge,
    challengeBeaten,
    rankResult,
    isMiniAppView,
    isSDKLoaded,
    farcasterContext,
  ]);

  // ----------------------------------------------------------------- UI

  const challengeLabel = challenge
    ? `${challenge.distance}m${challenge.by ? ` · @${challenge.by}` : ""}`
    : null;
  const shortBy = challenge
    ? challenge.distance - distance
    : best - distance;

  return (
    <div
      className="relative h-full w-full overflow-hidden select-none touch-none"
      style={{
        background:
          "linear-gradient(180deg, #0c0626 0%, #221060 28%, #45179b 40%, #8b1fae 47%, #2b1854 58%, #181243 100%)",
        WebkitTapHighlightColor: "transparent",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onContextMenu={(e) => e.preventDefault()}
    >
      <style>{`
        @keyframes surfTwinkle { 0%, 100% { opacity: 0.9; } 50% { opacity: 0.3; } }
        @keyframes surfFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes surfMirage {
          0%, 100% { transform: translateX(-50%) scaleY(-0.55) skewX(1.5deg); opacity: 0.5; }
          33% { transform: translateX(-50%) scaleY(-0.62) skewX(-2deg); opacity: 0.38; }
          66% { transform: translateX(-50%) scaleY(-0.5) skewX(2.5deg); opacity: 0.55; }
        }
      `}</style>

      {/* Synthwave sun on the horizon */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: "50%",
          top: "36%",
          width: "min(46vw, 210px)",
          aspectRatio: "1",
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background:
            "linear-gradient(180deg, #fde68a 0%, #fb923c 35%, #ec4899 65%, #a855f7 100%)",
          WebkitMaskImage:
            "repeating-linear-gradient(180deg, black 0 12px, black 12px, transparent 12px, transparent 16px)",
          maskImage:
            "repeating-linear-gradient(180deg, black 0 12px, black 12px, transparent 12px, transparent 16px)",
          boxShadow: "0 0 90px 24px rgba(236,72,153,0.35)",
          opacity: 0.9,
        }}
      />
      {/* Inferior mirage: flipped, squashed, heat-shimmering sun reflection */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: "50%",
          top: "calc(36% + min(23vw, 105px))",
          width: "min(46vw, 210px)",
          aspectRatio: "1",
          transformOrigin: "top center",
          transform: "translateX(-50%) scaleY(-0.55)",
          borderRadius: "50%",
          background:
            "linear-gradient(180deg, #fde68a 0%, #fb923c 35%, #ec4899 65%, #a855f7 100%)",
          WebkitMaskImage:
            "repeating-linear-gradient(180deg, black 0 9px, transparent 9px 15px)",
          maskImage:
            "repeating-linear-gradient(180deg, black 0 9px, transparent 9px 15px)",
          filter: "blur(4px)",
          animation: "surfMirage 4.5s ease-in-out infinite",
        }}
      />

      {/* Bonus-stage sky: stars + hot horizon band behind the canvas */}
      <div
        className="absolute left-0 right-0 top-0 pointer-events-none"
        style={{
          height: "46%",
          backgroundImage: [
            "radial-gradient(1.6px 1.6px at 12% 18%, rgba(255,255,255,0.95), transparent)",
            "radial-gradient(1.2px 1.2px at 28% 42%, rgba(186,230,253,0.9), transparent)",
            "radial-gradient(2px 2px at 41% 11%, rgba(255,255,255,0.8), transparent)",
            "radial-gradient(1.3px 1.3px at 55% 31%, rgba(249,168,212,0.9), transparent)",
            "radial-gradient(1.7px 1.7px at 66% 16%, rgba(255,255,255,0.9), transparent)",
            "radial-gradient(1.2px 1.2px at 74% 47%, rgba(165,243,252,0.85), transparent)",
            "radial-gradient(2px 2px at 86% 26%, rgba(255,255,255,0.85), transparent)",
            "radial-gradient(1.4px 1.4px at 93% 55%, rgba(196,181,253,0.9), transparent)",
            "radial-gradient(1.2px 1.2px at 7% 60%, rgba(255,255,255,0.7), transparent)",
            "radial-gradient(1.5px 1.5px at 48% 64%, rgba(165,243,252,0.8), transparent)",
          ].join(","),
          animation: "surfTwinkle 3.6s ease-in-out infinite",
        }}
      />
      <div
        className="absolute left-0 right-0 top-0 pointer-events-none"
        style={{
          height: "46%",
          backgroundImage: [
            "radial-gradient(1.5px 1.5px at 19% 33%, rgba(255,255,255,0.85), transparent)",
            "radial-gradient(1.2px 1.2px at 35% 22%, rgba(249,168,212,0.85), transparent)",
            "radial-gradient(1.8px 1.8px at 61% 41%, rgba(255,255,255,0.8), transparent)",
            "radial-gradient(1.3px 1.3px at 80% 12%, rgba(165,243,252,0.9), transparent)",
            "radial-gradient(1.5px 1.5px at 90% 38%, rgba(255,255,255,0.75), transparent)",
          ].join(","),
          animation: "surfTwinkle 4.8s ease-in-out 1.2s infinite",
        }}
      />
      {/* Distant mountain silhouettes flanking the sun */}
      <div
        className="absolute left-0 right-0 pointer-events-none"
        style={{
          top: "30.5%",
          height: "8%",
          background: "#241257",
          clipPath:
            "polygon(0% 100%, 0% 62%, 6% 34%, 13% 68%, 21% 22%, 29% 70%, 36% 44%, 42% 78%, 50% 60%, 58% 78%, 64% 40%, 71% 72%, 79% 26%, 87% 66%, 93% 38%, 100% 64%, 100% 100%)",
        }}
      />
      <div
        className="absolute left-0 right-0 pointer-events-none"
        style={{
          top: "33%",
          height: "6.5%",
          background: "#170b3e",
          clipPath:
            "polygon(0% 100%, 0% 50%, 8% 76%, 15% 30%, 24% 72%, 33% 48%, 41% 80%, 49% 56%, 57% 82%, 66% 36%, 74% 74%, 82% 46%, 90% 72%, 96% 40%, 100% 68%, 100% 100%)",
        }}
      />
      <div
        className="absolute left-0 right-0 pointer-events-none"
        style={{
          top: "34%",
          height: "26%",
          background:
            "radial-gradient(60% 55% at 50% 60%, rgba(236,72,153,0.5), rgba(168,85,247,0.22) 55%, transparent 78%)",
        }}
      />

      {/* Three.js canvas mounts here */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Cinematic vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 45%, transparent 58%, rgba(6,2,22,0.5) 100%)",
        }}
      />

      {/* Distance + bubbles HUD */}
      {phase !== "ready" && (
        <div className="absolute top-4 left-0 right-0 flex flex-col items-center pointer-events-none">
          <div className="font-mono text-5xl font-bold text-white drop-shadow-[0_2px_12px_rgba(99,102,241,0.6)]">
            {distance}
            <span className="text-2xl opacity-70">m</span>
          </div>
          <div className="mt-1 font-mono text-sm font-semibold text-cyan-300">
            🫧 ×{bubbles}
          </div>
          {lastPickup && (
            <div className="mt-1 flex items-center gap-1 font-mono text-xs font-semibold text-cyan-200 animate-pulse">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lastPickup.src}
                alt=""
                className="w-4 h-4 rounded-full object-cover"
              />
              ${lastPickup.symbol} bubble!
            </div>
          )}
        </div>
      )}

      {/* Challenge target chip */}
      {challengeLabel && phase === "playing" && !challengeBeaten && (
        <div className="absolute top-4 left-4 rounded-full bg-white/10 backdrop-blur-md px-3 py-1.5 pointer-events-none">
          <span className="text-xs font-semibold text-white">
            🎯 Beat {challengeLabel}
          </span>
        </div>
      )}

      {/* Surge / challenge toasts */}
      {surgeText && (
        <div className="absolute top-28 left-0 right-0 flex justify-center pointer-events-none">
          <div className="animate-slide-up flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md px-4 py-2 border border-cyan-300/30">
            <span className="text-sm font-semibold text-white">
              {surgeText}
            </span>
          </div>
        </div>
      )}

      {/* Sound + leaderboard buttons */}
      <div className="absolute top-4 right-4 flex gap-2">
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

      {/* Start screen */}
      {phase === "ready" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none px-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/game/monster.png"
            alt="Streme surfer"
            className="w-28 h-28 drop-shadow-[0_0_28px_rgba(103,232,249,0.7)]"
            style={{
              imageRendering: "pixelated",
              animation: "surfFloat 3s ease-in-out infinite",
            }}
          />
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-indigo-300 to-fuchsia-300">
              STREME SURF
            </h1>
            <p className="mt-2 text-sm text-indigo-200/80">
              Ride the stream. Dodge the rocks.
              <br />
              Pop the bubbles.
            </p>
          </div>
          {challengeLabel && (
            <div className="rounded-full bg-cyan-400/20 border border-cyan-300/40 px-4 py-1.5 font-mono text-sm text-cyan-100">
              🎯 Challenge: beat {challengeLabel}
            </div>
          )}
          {best > 0 && (
            <div className="rounded-full bg-white/10 px-4 py-1.5 font-mono text-sm text-cyan-200">
              Best ride: {best}m
            </div>
          )}
          <div className="mt-2 text-lg font-semibold text-white animate-pulse">
            Tap to drop in — drag to steer
          </div>
        </div>
      )}

      {/* Wipeout screen */}
      {phase === "over" && (
        <div
          className="absolute inset-0 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px] px-4 pb-8 sm:pb-4"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-sm rounded-2xl bg-base-100/95 p-6 shadow-2xl text-center">
            <div className="text-sm font-semibold uppercase tracking-widest opacity-60">
              Wipeout!
            </div>
            <div className="mt-2 font-mono text-6xl font-bold text-primary">
              {distance}
              <span className="text-3xl">m</span>
            </div>
            <div className="mt-1 font-mono text-sm text-cyan-500 font-semibold">
              🫧 {bubbles} bubbles popped
            </div>
            {rankResult && (
              <button
                className="mt-1 font-mono text-sm font-semibold text-primary underline-offset-2 hover:underline"
                onClick={openBoard}
              >
                🏆 #{rankResult.rank} of {rankResult.total} riders
              </button>
            )}
            <div className="mt-2 text-sm opacity-70">
              {challengeBeaten && challenge ? (
                <span className="font-bold text-success">
                  🏆 Challenge smashed
                  {challenge.by ? ` — sorry @${challenge.by}` : ""}!
                </span>
              ) : isNewBest ? (
                <span className="font-bold text-success">
                  🏆 New best ride!
                </span>
              ) : challenge && !challengeBeaten && shortBy > 0 && shortBy <= 150 ? (
                <span className="font-semibold text-warning">
                  So close — {shortBy}m short of{" "}
                  {challenge.by ? `@${challenge.by}` : "the challenge"}!
                </span>
              ) : (
                <>Best ride: {best}m</>
              )}
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <button className="btn btn-primary w-full" onClick={handleShare}>
                Challenge your friends
              </button>
              <button className="btn btn-outline w-full" onClick={handleRestart}>
                Paddle back out
              </button>
              <button className="btn btn-ghost btn-sm w-full" onClick={openBoard}>
                <Trophy size={14} /> Leaderboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard overlay */}
      {showBoard && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-sm rounded-2xl bg-base-100/95 p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Trophy size={18} className="text-warning" /> Top Riders
              </h2>
              <button
                className="btn btn-circle btn-ghost btn-sm"
                onClick={() => setShowBoard(false)}
                aria-label="Close leaderboard"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-3 max-h-80 overflow-y-auto">
              {boardLoading ? (
                <div className="flex justify-center py-8">
                  <span className="loading loading-spinner loading-md" />
                </div>
              ) : board && board.entries.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {board.entries.map((entry, i) => {
                    const isMe = fcUserRef.current?.fid === entry.fid;
                    return (
                      <li
                        key={entry.fid}
                        className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${
                          isMe ? "bg-primary/10 ring-1 ring-primary" : ""
                        }`}
                      >
                        <span className="w-6 text-right font-mono text-sm opacity-60">
                          {i + 1}
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
                        <span className="flex-1 truncate text-sm font-medium">
                          {entry.username
                            ? `@${entry.username}`
                            : `fid ${entry.fid}`}
                        </span>
                        <span className="font-mono text-sm font-semibold text-primary">
                          {entry.distance}m
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="py-8 text-center text-sm opacity-60">
                  No riders yet — be the first on the board!
                </p>
              )}
            </div>
            {board?.player && board.player.rank > 10 && (
              <div className="mt-2 rounded-lg bg-primary/10 px-3 py-2 text-center font-mono text-sm">
                You: #{board.player.rank} · {board.player.best}m
              </div>
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
