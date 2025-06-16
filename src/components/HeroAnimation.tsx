"use client";

import { useEffect, useState } from "react";

export function HeroAnimation() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check for dark mode
    const checkDarkMode = () => {
      const htmlElement = document.documentElement;
      const dataTheme = htmlElement.getAttribute("data-theme");
      const hasClassDark = htmlElement.classList.contains("dark");

      // Only consider it dark if explicitly set to dark theme
      const isDarkMode = dataTheme === "dark" || hasClassDark;
      
      // Only update state if it actually changed
      setIsDark(prevIsDark => {
        if (prevIsDark !== isDarkMode) {
          return isDarkMode;
        }
        return prevIsDark;
      });
    };

    checkDarkMode();

    // Listen for theme changes
    const observer = new MutationObserver((mutations) => {
      // Only check if data-theme or class actually changed
      const relevantChange = mutations.some(mutation => 
        mutation.type === 'attributes' && 
        (mutation.attributeName === 'data-theme' || mutation.attributeName === 'class')
      );
      
      if (relevantChange) {
        checkDarkMode();
      }
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", checkDarkMode);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", checkDarkMode);
    };
  }, []);

  const backgroundLineColor = isDark ? "hsl(220 13% 22%)" : "hsl(220 13% 97%)";
  const gradientStopColor = isDark ? "hsl(220 13% 50%)" : "white";

  return (
    <div className="wire-wrap relative w-full h-full opacity-70">
      <div className="w-embed absolute inset-0">
        <style>
          {`
              @keyframes slideMask {
                from {
                  x: -100%;
                }
                to {
                  x: 100%;
                }
              }

              @keyframes pulse {
                0%, 100% {
                  stroke-opacity: 0.3;
                }
                50% {
                  stroke-opacity: 0.6;
                }
              }

              @keyframes particleFlow {
                0% {
                  offset-distance: 0%;
                  opacity: 0;
                  transform: scale(0.8);
                }
                10% {
                  opacity: 0.7;
                  transform: scale(1);
                }
                90% {
                  opacity: 0.7;
                  transform: scale(1);
                }
                100% {
                  offset-distance: 100%;
                  opacity: 0;
                  transform: scale(0.8);
                }
              }

              .mask-rect {
                animation: slideMask 3.5s linear infinite;
              }

              .flow-line-1, .flow-line-2, .flow-line-3 {
                filter: drop-shadow(0 0 4px hsl(var(--b1) / 0.2));
              }

              .flow-line-1 {
                animation: pulse 4.2s ease-in-out infinite;
              }

              .flow-line-2 {
                animation: pulse 3.8s ease-in-out infinite;
              }

              .flow-line-3 {
                animation: pulse 4.5s ease-in-out infinite;
              }

              .reward-particle-1, .reward-particle-2, .reward-particle-3 {
                filter: drop-shadow(0 0 2px currentColor);
              }

              .reward-particle-1 {
                offset-path: path('M-100 80C200 80 400 100 800 200 C1200 300 1300 250 1540 250');
                animation: particleFlow 2.5s linear infinite;
              }

              .reward-particle-2 {
                offset-path: path('M-100 120C200 120 400 200 800 250 C1200 300 1300 300 1540 300');
                animation: particleFlow 3.2s linear infinite;
              }

              .reward-particle-3 {
                offset-path: path('M-100 180C200 180 400 300 800 300 C1200 300 1300 350 1540 350');
                animation: particleFlow 2.8s linear infinite;
              }
            `}
        </style>
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 1440 400"
          preserveAspectRatio="xMidYMid meet"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background gray lines */}
          <path
            d="M-100 80C200 80 400 100 800 200 C1200 300 1300 250 1540 250"
            stroke={backgroundLineColor}
            strokeWidth="4"
          ></path>
          <path
            d="M-100 120C200 120 400 200 800 250 C1200 300 1300 300 1540 300"
            stroke={backgroundLineColor}
            strokeWidth="4"
          ></path>
          <path
            d="M-100 180C200 180 400 300 800 300 C1200 300 1300 350 1540 350"
            stroke={backgroundLineColor}
            strokeWidth="4"
          ></path>

          {/* Reward Particles */}
          {/* Primary particles */}
          <g className="reward-particle-1">
            <circle r="8" fill="#2563eb" />
          </g>
          <g className="reward-particle-1" style={{ animationDelay: "-0.8s" }}>
            <circle r="7" fill="rgba(37, 99, 235, 0.9)" />
          </g>
          <g className="reward-particle-1" style={{ animationDelay: "-1.7s" }}>
            <circle r="6" fill="rgba(37, 99, 235, 0.8)" />
          </g>

          {/* Secondary particles */}
          <g className="reward-particle-2">
            <circle r="8" fill="#7c3aed" />
          </g>
          <g className="reward-particle-2" style={{ animationDelay: "-1.1s" }}>
            <circle r="7" fill="rgba(124, 58, 237, 0.9)" />
          </g>
          <g className="reward-particle-2" style={{ animationDelay: "-2.2s" }}>
            <circle r="6" fill="rgba(124, 58, 237, 0.8)" />
          </g>

          {/* Accent particles */}
          <g className="reward-particle-3">
            <circle r="8" fill="#dc2626" />
          </g>
          <g className="reward-particle-3" style={{ animationDelay: "-1.4s" }}>
            <circle r="7" fill="rgba(220, 38, 38, 0.9)" />
          </g>
          <g className="reward-particle-3" style={{ animationDelay: "-1.9s" }}>
            <circle r="6" fill="rgba(220, 38, 38, 0.8)" />
          </g>

          {/* Animated colored lines */}
          <defs>
            <linearGradient id="gradient">
              <stop
                offset="0"
                stopColor={gradientStopColor}
                stopOpacity="0"
              ></stop>
              <stop
                offset="0.2"
                stopColor={gradientStopColor}
                stopOpacity="0.5"
              ></stop>
              <stop
                offset="0.5"
                stopColor={gradientStopColor}
                stopOpacity="1"
              ></stop>
              <stop
                offset="0.8"
                stopColor={gradientStopColor}
                stopOpacity="0.5"
              ></stop>
              <stop
                offset="1"
                stopColor={gradientStopColor}
                stopOpacity="0"
              ></stop>
            </linearGradient>
            <mask id="gradient-mask">
              <rect
                className="mask-rect"
                x="-100"
                y="0"
                width="120%"
                height="100%"
                fill="url(#gradient)"
              ></rect>
            </mask>
          </defs>
          <path
            className="flow-line-1"
            d="M-100 80C200 80 400 100 800 200 C1200 300 1300 250 1540 250"
            stroke="#2563eb"
            strokeWidth="4"
            mask="url(#gradient-mask)"
          ></path>
          <path
            className="flow-line-2"
            d="M-100 120C200 120 400 200 800 250 C1200 300 1300 300 1540 300"
            stroke="#7c3aed"
            strokeWidth="4"
            mask="url(#gradient-mask)"
          ></path>
          <path
            className="flow-line-3"
            d="M-100 180C200 180 400 300 800 300 C1200 300 1300 350 1540 350"
            stroke="#dc2626"
            strokeWidth="4"
            mask="url(#gradient-mask)"
          ></path>
        </svg>
      </div>
    </div>
  );
}
