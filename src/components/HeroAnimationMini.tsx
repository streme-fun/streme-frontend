"use client";

import { useEffect, useState } from 'react';

export function HeroAnimationMini() {
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

              .flow-line-4, .flow-line-5 {
                filter: drop-shadow(0 0 4px hsl(var(--b1) / 0.2));
              }

              .flow-line-4 {
                animation: pulse 3.5s ease-in-out infinite;
              }

              .flow-line-5 {
                animation: pulse 4.8s ease-in-out infinite;
              }

              .flow-line-6, .flow-line-7, .flow-line-8 {
                filter: drop-shadow(0 0 4px hsl(var(--b1) / 0.2));
              }

              .flow-line-6 {
                animation: pulse 3.2s ease-in-out infinite;
              }

              .flow-line-7 {
                animation: pulse 4.0s ease-in-out infinite;
              }

              .flow-line-8 {
                animation: pulse 3.7s ease-in-out infinite;
              }

              .reward-particle-1, .reward-particle-2, .reward-particle-3, .reward-particle-4, .reward-particle-5, .reward-particle-6, .reward-particle-7, .reward-particle-8 {
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

              .reward-particle-4 {
                offset-path: path('M-100 220C200 220 400 150 800 280 C1200 410 1300 200 1540 200');
                animation: particleFlow 3.5s linear infinite;
              }

              .reward-particle-5 {
                offset-path: path('M-100 260C200 260 400 350 800 150 C1200 -50 1300 300 1540 300');
                animation: particleFlow 3.0s linear infinite;
              }

              .reward-particle-6 {
                offset-path: path('M-100 40C250 40 450 120 800 100 C1150 80 1350 150 1540 150');
                animation: particleFlow 3.8s linear infinite;
              }

              .reward-particle-7 {
                offset-path: path('M-100 300C150 300 350 200 800 320 C1250 440 1350 250 1540 220');
                animation: particleFlow 2.6s linear infinite;
              }

              .reward-particle-8 {
                offset-path: path('M-100 340C200 340 400 280 800 380 C1200 480 1300 320 1540 350');
                animation: particleFlow 3.3s linear infinite;
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
          <path
            d="M-100 220C200 220 400 150 800 280 C1200 410 1300 200 1540 200"
            stroke={backgroundLineColor}
            strokeWidth="4"
          ></path>
          <path
            d="M-100 260C200 260 400 350 800 150 C1200 -50 1300 300 1540 300"
            stroke={backgroundLineColor}
            strokeWidth="4"
          ></path>
          <path
            d="M-100 40C250 40 450 120 800 100 C1150 80 1350 150 1540 150"
            stroke={backgroundLineColor}
            strokeWidth="4"
          ></path>
          <path
            d="M-100 300C150 300 350 200 800 320 C1250 440 1350 250 1540 220"
            stroke={backgroundLineColor}
            strokeWidth="4"
          ></path>
          <path
            d="M-100 340C200 340 400 280 800 380 C1200 480 1300 320 1540 350"
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
          <g className="reward-particle-3" style={{ animationDelay: "-1.9s" }}>
            <circle r="6" fill="rgba(220, 38, 38, 0.8)" />
          </g>

          {/* Additional Particles 1 */}
          <g className="reward-particle-4">
            <circle r="8" fill="#10b981" />
          </g>
          <g className="reward-particle-4" style={{ animationDelay: "-1.2s" }}>
            <circle r="7" fill="rgba(16, 185, 129, 0.9)" />
          </g>
          <g className="reward-particle-4" style={{ animationDelay: "-2.4s" }}>
            <circle r="6" fill="rgba(16, 185, 129, 0.8)" />
          </g>

          {/* Additional Particles 2 */}
          <g className="reward-particle-5" style={{ animationDelay: "-2.1s" }}>
            <circle r="6" fill="rgba(245, 158, 11, 0.8)" />
          </g>

          {/* Additional Particles 3 */}
          <g className="reward-particle-6">
            <circle r="8" fill="#ec4899" />
          </g>
          <g className="reward-particle-6" style={{ animationDelay: "-1.3s" }}>
            <circle r="7" fill="rgba(236, 72, 153, 0.9)" />
          </g>
          <g className="reward-particle-6" style={{ animationDelay: "-2.5s" }}>
            <circle r="6" fill="rgba(236, 72, 153, 0.8)" />
          </g>

          {/* Additional Particles 4 */}
          <g className="reward-particle-7">
            <circle r="8" fill="#06b6d4" />
          </g>
          <g className="reward-particle-7" style={{ animationDelay: "-0.7s" }}>
            <circle r="7" fill="rgba(6, 182, 212, 0.9)" />
          </g>
          <g className="reward-particle-7" style={{ animationDelay: "-1.8s" }}>
            <circle r="6" fill="rgba(6, 182, 212, 0.8)" />
          </g>

          {/* Additional Particles 5 */}
          <g className="reward-particle-8">
            <circle r="8" fill="#8b5cf6" />
          </g>
          <g className="reward-particle-8" style={{ animationDelay: "-1.0s" }}>
            <circle r="7" fill="rgba(139, 92, 246, 0.9)" />
          </g>
          <g className="reward-particle-8" style={{ animationDelay: "-2.2s" }}>
            <circle r="6" fill="rgba(139, 92, 246, 0.8)" />
          </g>

          {/* Animated colored lines */}
          <defs>
            <linearGradient id="gradient-mini">
              <stop offset="0" stopColor={gradientStopColor} stopOpacity="0"></stop>
              <stop offset="0.2" stopColor={gradientStopColor} stopOpacity="0.5"></stop>
              <stop offset="0.5" stopColor={gradientStopColor} stopOpacity="1"></stop>
              <stop offset="0.8" stopColor={gradientStopColor} stopOpacity="0.5"></stop>
              <stop offset="1" stopColor={gradientStopColor} stopOpacity="0"></stop>
            </linearGradient>
            <mask id="gradient-mask-mini">
              <rect
                className="mask-rect"
                x="-100"
                y="0"
                width="120%"
                height="100%"
                fill="url(#gradient-mini)"
              ></rect>
            </mask>
          </defs>
          <path
            className="flow-line-1"
            d="M-100 80C200 80 400 100 800 200 C1200 300 1300 250 1540 250"
            stroke="#2563eb"
            strokeWidth="4"
            mask="url(#gradient-mask-mini)"
          ></path>
          <path
            className="flow-line-2"
            d="M-100 120C200 120 400 200 800 250 C1200 300 1300 300 1540 300"
            stroke="#7c3aed"
            strokeWidth="4"
            mask="url(#gradient-mask-mini)"
          ></path>
          <path
            className="flow-line-3"
            d="M-100 180C200 180 400 300 800 300 C1200 300 1300 350 1540 350"
            stroke="#dc2626"
            strokeWidth="4"
            mask="url(#gradient-mask-mini)"
          ></path>
          <path
            className="flow-line-4"
            d="M-100 220C200 220 400 150 800 280 C1200 410 1300 200 1540 200"
            stroke="#10b981"
            strokeWidth="4"
            mask="url(#gradient-mask-mini)"
          ></path>
          <path
            className="flow-line-5"
            d="M-100 260C200 260 400 350 800 150 C1200 -50 1300 300 1540 300"
            stroke="#f59e0b"
            strokeWidth="4"
            mask="url(#gradient-mask-mini)"
          ></path>
          <path
            className="flow-line-6"
            d="M-100 40C250 40 450 120 800 100 C1150 80 1350 150 1540 150"
            stroke="#ec4899"
            strokeWidth="4"
            mask="url(#gradient-mask-mini)"
          ></path>
          <path
            className="flow-line-7"
            d="M-100 300C150 300 350 200 800 320 C1250 440 1350 250 1540 220"
            stroke="#06b6d4"
            strokeWidth="4"
            mask="url(#gradient-mask-mini)"
          ></path>
          <path
            className="flow-line-8"
            d="M-100 340C200 340 400 280 800 380 C1200 480 1300 320 1540 350"
            stroke="#8b5cf6"
            strokeWidth="4"
            mask="url(#gradient-mask-mini)"
          ></path>
        </svg>
      </div>
    </div>
  );
}
