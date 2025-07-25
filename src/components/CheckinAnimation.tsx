"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export function CheckinAnimation() {
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
      setIsDark((prevIsDark) => {
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
      const relevantChange = mutations.some(
        (mutation) =>
          mutation.type === "attributes" &&
          (mutation.attributeName === "data-theme" ||
            mutation.attributeName === "class")
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

  const backgroundOpacity = isDark ? 0.1 : 0.05;
  const particleGlow = isDark
    ? "rgba(139, 92, 246, 0.3)"
    : "rgba(139, 92, 246, 0.2)";

  return (
    <div className="relative w-full h-40 pointer-events-none">
      <style>
        {`
          @keyframes orbit {
            from {
              transform: rotate(0deg) translateX(35px) rotate(0deg);
            }
            to {
              transform: rotate(360deg) translateX(35px) rotate(-360deg);
            }
          }

          @keyframes orbitReverse {
            from {
              transform: rotate(0deg) translateX(50px) rotate(0deg);
            }
            to {
              transform: rotate(-360deg) translateX(50px) rotate(360deg);
            }
          }

          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
              opacity: 0.8;
            }
            50% {
              transform: scale(1.2);
              opacity: 1;
            }
          }

          @keyframes float {
            0%, 100% {
              transform: translateY(0) scale(1);
            }
            50% {
              transform: translateY(-10px) scale(1.05);
            }
          }

          @keyframes sparkle {
            0% {
              opacity: 0;
              transform: scale(0) rotate(0deg);
            }
            50% {
              opacity: 1;
              transform: scale(1) rotate(180deg);
            }
            100% {
              opacity: 0;
              transform: scale(0) rotate(360deg);
            }
          }

          .orbit-particle {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 8px;
            height: 8px;
            margin: -4px 0 0 -4px;
            border-radius: 50%;
          }

          .sparkle {
            position: absolute;
            width: 4px;
            height: 4px;
            background: white;
            border-radius: 50%;
            animation: sparkle 2s infinite;
          }

          .checkin-glow {
            position: absolute;
            width: 80px;
            height: 80px;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: radial-gradient(circle, ${particleGlow} 0%, transparent 70%);
            animation: pulse 3s ease-in-out infinite;
          }
        `}
      </style>

      {/* Central glow effect */}
      <div className="checkin-glow" />

      {/* Central floating icon */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div
          className="relative"
          style={{ animation: "float 4s ease-in-out infinite" }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="24"
              cy="24"
              r="22"
              stroke="currentColor"
              strokeWidth="2"
              className="text-primary/20"
            />
            <circle
              cx="24"
              cy="24"
              r="18"
              fill="currentColor"
              className="text-primary/10"
            />

            {/* Stacked coins icon */}
            <g transform="translate(24, 24)">
              {/* Bottom coin */}
              <ellipse
                cx="0"
                cy="5"
                rx="10"
                ry="3.5"
                fill="currentColor"
                className="text-primary/40"
              />
              <rect
                x="-10"
                y="2"
                width="20"
                height="3"
                fill="currentColor"
                className="text-primary/40"
              />

              {/* Middle coin */}
              <ellipse
                cx="0"
                cy="0"
                rx="10"
                ry="3.5"
                fill="currentColor"
                className="text-primary/60"
              />
              <rect
                x="-10"
                y="-3"
                width="20"
                height="3"
                fill="currentColor"
                className="text-primary/60"
              />

              {/* Top coin */}
              <ellipse
                cx="0"
                cy="-5"
                rx="10"
                ry="3.5"
                fill="currentColor"
                className="text-primary"
              />
            </g>
          </svg>

          {/* Streme icon on top coin */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" style={{ marginTop: '-5px' }}>
            <Image
              src="/icon-transparent.png"
              alt="Streme"
              width={16}
              height={16}
              className="opacity-90"
            />
          </div>

          {/* Sparkles around the icon */}
          <div
            className="sparkle"
            style={{ top: "5px", left: "5px", animationDelay: "0s" }}
          />
          <div
            className="sparkle"
            style={{ top: "5px", right: "5px", animationDelay: "0.5s" }}
          />
          <div
            className="sparkle"
            style={{ bottom: "5px", left: "5px", animationDelay: "1s" }}
          />
          <div
            className="sparkle"
            style={{ bottom: "5px", right: "5px", animationDelay: "1.5s" }}
          />
        </div>
      </div>

      {/* Container for orbiting particles with padding */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Orbiting particles - Inner orbit */}
        <div className="relative w-24 h-24">
          <div
            className="orbit-particle bg-primary"
            style={{ animation: "orbit 4s linear infinite" }}
          >
            <div className="absolute inset-0 bg-primary blur-sm" />
          </div>
          <div
            className="orbit-particle bg-secondary"
            style={{
              animation: "orbit 4s linear infinite",
              animationDelay: "-1s",
            }}
          >
            <div className="absolute inset-0 bg-secondary blur-sm" />
          </div>
          <div
            className="orbit-particle bg-accent"
            style={{
              animation: "orbit 4s linear infinite",
              animationDelay: "-2s",
            }}
          >
            <div className="absolute inset-0 bg-accent blur-sm" />
          </div>
          <div
            className="orbit-particle bg-success"
            style={{
              animation: "orbit 4s linear infinite",
              animationDelay: "-3s",
            }}
          >
            <div className="absolute inset-0 bg-success blur-sm" />
          </div>
        </div>

        {/* Orbiting particles - Outer orbit */}
        <div className="absolute w-32 h-32">
          <div
            className="orbit-particle bg-info opacity-60"
            style={{ animation: "orbitReverse 6s linear infinite" }}
          >
            <div className="absolute inset-0 bg-info blur-sm" />
          </div>
          <div
            className="orbit-particle bg-warning opacity-60"
            style={{
              animation: "orbitReverse 6s linear infinite",
              animationDelay: "-2s",
            }}
          >
            <div className="absolute inset-0 bg-warning blur-sm" />
          </div>
          <div
            className="orbit-particle bg-error opacity-60"
            style={{
              animation: "orbitReverse 6s linear infinite",
              animationDelay: "-4s",
            }}
          >
            <div className="absolute inset-0 bg-error blur-sm" />
          </div>
        </div>
      </div>

      {/* Background pattern */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 400 300"
        preserveAspectRatio="none"
        style={{ opacity: backgroundOpacity }}
      >
        <pattern
          id="checkin-pattern"
          x="0"
          y="0"
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx="20"
            cy="20"
            r="1"
            fill="currentColor"
            className="text-primary"
          />
        </pattern>
        <rect width="100%" height="100%" fill="url(#checkin-pattern)" />
      </svg>
    </div>
  );
}
