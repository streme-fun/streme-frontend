"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export function TutorialStreamingAnimation() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check for dark mode
    const checkDarkMode = () => {
      const htmlElement = document.documentElement;
      const dataTheme = htmlElement.getAttribute("data-theme");
      const hasClassDark = htmlElement.classList.contains("dark");

      const isDarkMode = dataTheme === "dark" || hasClassDark;
      setIsDark(isDarkMode);
    };

    checkDarkMode();

    // Listen for theme changes
    const observer = new MutationObserver(() => {
      checkDarkMode();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  const backgroundLineColor = isDark ? "hsl(220 13% 22%)" : "hsl(220 13% 97%)";
  const gradientStopColor = isDark ? "hsl(220 13% 85%)" : "white";

  // Much brighter colors for dark mode
  const flowLineColors = {
    blue: isDark ? "#60a5fa" : "#2563eb",
    purple: isDark ? "#a78bfa" : "#7c3aed",
    green: isDark ? "#4ade80" : "#10b981",
  };

  return (
    <div className="relative w-full h-48 overflow-hidden flex items-center justify-center tutorial-container">
      <style>
        {`
          @keyframes streamFlow {
            0% {
              offset-distance: 0%;
              opacity: 0;
              filter: brightness(1);
            }
            10%, 90% {
              opacity: 0.9;
              filter: brightness(1);
            }
            100% {
              offset-distance: 100%;
              opacity: 0;
              filter: brightness(1);
            }
          }

          @keyframes pulse {
            0%, 100% {
              opacity: ${isDark ? "0.9" : "0.4"};
            }
            50% {
              opacity: ${isDark ? "1.0" : "0.8"};
            }
          }

          @keyframes slideMask {
            0% {
              transform: translateX(-120%);
            }
            100% {
              transform: translateX(120%);
            }
          }

          @keyframes float {
            0%, 100% {
              transform: translateY(-50%) translateY(0px);
            }
            50% {
              transform: translateY(-50%) translateY(-6px);
            }
          }

          .stream-particle-1 {
            offset-path: path('M-50 96 Q100 80 250 96 Q400 112 550 96');
            animation: streamFlow 3s linear infinite;
            will-change: offset-distance, opacity;
          }

          .stream-particle-2 {
            offset-path: path('M-50 96 Q100 112 250 96 Q400 80 550 96');
            animation: streamFlow 3.5s linear infinite;
            animation-delay: -1s;
            will-change: offset-distance, opacity;
          }

          .stream-particle-3 {
            offset-path: path('M-50 96 Q100 64 250 96 Q400 128 550 96');
            animation: streamFlow 4s linear infinite;
            animation-delay: -2s;
            will-change: offset-distance, opacity;
          }

          .flow-line {
            animation: pulse 8s ease-in-out infinite;
            will-change: opacity;
          }

          .mask-rect {
            animation: slideMask 3s linear infinite;
            will-change: transform;
          }

          .float-element {
            animation: float 6s ease-in-out infinite;
            will-change: transform;
          }

          /* Reduce repaints by using transform instead of layout properties */
          .tutorial-container {
            contain: layout style paint;
            transform: translateZ(0);
          }
        `}
      </style>

      <svg
        width="500"
        height="192"
        viewBox="0 0 500 192"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0"
      >
        {/* Background flowing lines */}
        <path
          d="M-50 96 Q100 80 250 96 Q400 112 550 96"
          stroke={backgroundLineColor}
          strokeWidth="1.5"
          opacity="0.3"
        />
        <path
          d="M-50 96 Q100 112 250 96 Q400 80 550 96"
          stroke={backgroundLineColor}
          strokeWidth="1.5"
          opacity="0.3"
        />
        <path
          d="M-50 96 Q100 64 250 96 Q400 128 550 96"
          stroke={backgroundLineColor}
          strokeWidth="1.5"
          opacity="0.3"
        />
        <path
          d="M-50 96 Q100 128 250 96 Q400 64 550 96"
          stroke={backgroundLineColor}
          strokeWidth="1.5"
          opacity="0.3"
        />
        <path
          d="M-50 96 Q100 96 250 112 Q400 96 550 96"
          stroke={backgroundLineColor}
          strokeWidth="1.5"
          opacity="0.3"
        />

        {/* Animated mask and colored lines */}
        <defs>
          <linearGradient id="gradient-tutorial">
            <stop
              offset="0"
              stopColor={gradientStopColor}
              stopOpacity={isDark ? "0.5" : "0"}
            />
            <stop
              offset="0.1"
              stopColor={gradientStopColor}
              stopOpacity={isDark ? "0.9" : "0.5"}
            />
            <stop offset="0.5" stopColor={gradientStopColor} stopOpacity="1" />
            <stop
              offset="0.9"
              stopColor={gradientStopColor}
              stopOpacity={isDark ? "0.9" : "0.5"}
            />
            <stop
              offset="1"
              stopColor={gradientStopColor}
              stopOpacity={isDark ? "0.5" : "0"}
            />
          </linearGradient>
          <mask id="gradient-mask-tutorial">
            <rect
              className="mask-rect"
              x="-120"
              y="0"
              width="140%"
              height="100%"
              fill="url(#gradient-tutorial)"
            />
          </mask>
        </defs>

        <path
          className="flow-line"
          d="M-50 96 Q100 80 250 96 Q400 112 550 96"
          stroke={flowLineColors.blue}
          strokeWidth="2.5"
          mask="url(#gradient-mask-tutorial)"
        />
        <path
          className="flow-line"
          d="M-50 96 Q100 112 250 96 Q400 80 550 96"
          stroke={flowLineColors.purple}
          strokeWidth="2.5"
          mask="url(#gradient-mask-tutorial)"
          style={{ animationDelay: "-2s" }}
        />
        <path
          className="flow-line"
          d="M-50 96 Q100 64 250 96 Q400 128 550 96"
          stroke={flowLineColors.green}
          strokeWidth="2.5"
          mask="url(#gradient-mask-tutorial)"
          style={{ animationDelay: "-4s" }}
        />

        {/* Streaming particles */}
        <g className="stream-particle-1">
          <circle r="3" fill={flowLineColors.blue} />
        </g>
        <g className="stream-particle-2">
          <circle r="3" fill={flowLineColors.purple} />
        </g>
        <g className="stream-particle-3">
          <circle r="3" fill={flowLineColors.green} />
        </g>
      </svg>

      {/* Streme logo - upper left */}
      <div className="absolute left-1/3 top-1/2 z-10 float-element transform -translate-x-1/2 -translate-y-1/2">
        <div className="w-8 h-8 bg-white/95 rounded-full flex items-center justify-center shadow-lg border border-white/20">
          <Image
            src="/icon-transparent.png"
            alt="Streme"
            width={24}
            height={24}
            className="opacity-90"
          />
        </div>
      </div>

      {/* Superinu mascot - lower right */}
      <div
        className="absolute right-1/3 bottom-1/3 z-10 float-element transform translate-x-1/2 translate-y-1/2"
        style={{ animationDelay: "-3s" }}
      >
        <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg border-2 border-white/30 overflow-hidden">
          <Image
            src="/superinu.webp"
            alt="Superinu"
            width={48}
            height={48}
            className="opacity-90"
          />
        </div>
      </div>
    </div>
  );
}
