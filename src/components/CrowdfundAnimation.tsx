"use client";

import { CrowdfundToken } from "@/src/lib/crowdfundTokens";

interface CrowdfundAnimationProps {
  contributorCount: number;
  growthRate: number;
  tokenConfig?: CrowdfundToken;
  tokenImageUrl?: string;
}

export const CrowdfundAnimation = ({
  contributorCount: _contributorCount, // eslint-disable-line @typescript-eslint/no-unused-vars
  growthRate,
  tokenConfig,
}: CrowdfundAnimationProps) => {
  // Get the appropriate image path based on token symbol
  const getTokenImagePath = () => {
    const symbol = tokenConfig?.symbol;
    if (symbol === "STREME") return "/icon.png";
    if (symbol === "$BUTTHOLE") return "/tokens/butthole.avif";
    return null; // No image available
  };

  const tokenImagePath = getTokenImagePath();
  // Generate stream paths - always use 20 lines
  const generateStreamPaths = () => {
    const streams = [];
    const maxStreams = 20;

    for (let i = 0; i < maxStreams; i++) {
      // Distribute streams around the perimeter of the animation with longer reach
      const angle = (i / maxStreams) * 2 * Math.PI;
      const radius = 180; // Increased distance from center for longer streams
      const startX = 225 + Math.cos(angle) * radius; // Center at 225, 150
      const startY = 150 + Math.sin(angle) * radius;
      const endX = 225; // Converge to icon center
      const endY = 150; // Icon is now in center

      // Create more complex curved paths with multiple control points
      const midX1 = startX + (endX - startX) * 0.2 + ((i % 5) - 2) * 40;
      const midY1 = startY + (endY - startY) * 0.25 + ((i % 3) - 1) * 35;
      const midX2 = startX + (endX - startX) * 0.5 + ((i % 4) - 1.5) * 25;
      const midY2 = startY + (endY - startY) * 0.6 + ((i % 2) - 0.5) * 30;
      const midX3 = startX + (endX - startX) * 0.8 + ((i % 3) - 1) * 15;
      const midY3 = startY + (endY - startY) * 0.85 + ((i % 2) - 0.5) * 20;

      streams.push({
        id: i,
        path: `M${startX} ${startY} C${midX1} ${midY1}, ${midX2} ${midY2}, ${midX3} ${midY3} Q${midX3} ${midY3} ${endX} ${endY}`,
        color: `hsl(${200 + i * 30}, 70%, 60%)`,
        particleColor: `hsl(${200 + i * 30}, 80%, 65%)`,
        delay: i * 0.5,
      });
    }

    return streams;
  };

  const streams = generateStreamPaths();

  // Animation duration based on growth rate
  const baseAnimationDuration = Math.max(2, 4 - growthRate);

  return (
    <div className="relative w-full h-52 sm:h-64 rounded-lg bg-transparent">
      <div className="absolute inset-0 opacity-80">
        <style>
          {`
            @keyframes streamHighlight {
              0% { 
                stroke-opacity: 0.4;
              }
              50% { 
                stroke-opacity: 1.0;
              }
              100% { 
                stroke-opacity: 0.4;
              }
            }

            @keyframes streamPulse {
              0%, 100% { stroke-opacity: 0.3; }
              50% { stroke-opacity: 0.6; }
            }

            @keyframes particleFlow {
              0% {
                offset-distance: 0%;
                opacity: 0;
                transform: scale(0.5);
              }
              15% {
                opacity: 1;
                transform: scale(1);
              }
              85% {
                opacity: 1;
                transform: scale(1);
              }
              100% {
                offset-distance: 100%;
                opacity: 0;
                transform: scale(0.5);
              }
            }

            @keyframes iconPulse {
              0% { 
                transform: scale(1);
                filter: drop-shadow(0 0 5px hsl(var(--p) / 0.3));
              }
              15% { 
                transform: scale(1.12);
                filter: drop-shadow(0 0 25px hsl(var(--p) / 0.9));
              }
              22% { 
                transform: scale(0.98);
                filter: drop-shadow(0 0 3px hsl(var(--p) / 0.2));
              }
              35% { 
                transform: scale(1.05);
                filter: drop-shadow(0 0 15px hsl(var(--p) / 0.6));
              }
              45% { 
                transform: scale(1);
                filter: drop-shadow(0 0 8px hsl(var(--p) / 0.4));
              }
              60% { 
                transform: scale(1.15);
                filter: drop-shadow(0 0 30px hsl(var(--p) / 1));
              }
              70% { 
                transform: scale(0.95);
                filter: drop-shadow(0 0 2px hsl(var(--p) / 0.2));
              }
              85% { 
                transform: scale(1.03);
                filter: drop-shadow(0 0 12px hsl(var(--p) / 0.5));
              }
              100% { 
                transform: scale(1);
                filter: drop-shadow(0 0 5px hsl(var(--p) / 0.3));
              }
            }

            @keyframes energyRing {
              0% { 
                opacity: 0.2;
                stroke-width: 2px;
              }
              18% { 
                opacity: 0.8;
                stroke-width: 5px;
              }
              25% { 
                opacity: 0.1;
                stroke-width: 1px;
              }
              40% { 
                opacity: 0.5;
                stroke-width: 3px;
              }
              55% { 
                opacity: 0.9;
                stroke-width: 6px;
              }
              65% { 
                opacity: 0.15;
                stroke-width: 1.5px;
              }
              80% { 
                opacity: 0.7;
                stroke-width: 4px;
              }
              100% { 
                opacity: 0.2;
                stroke-width: 2px;
              }
            }

            ${streams
              .map((stream, i) => {
                const randomOffset = Math.sin(i * 0.7) * 0.5 + 0.5; // 0-1 random based on index

                // Create more varied speeds - generally faster with some variation
                const speedVariation = Math.sin(i * 1.1) * 0.5 + 0.5; // 0-1 range
                const streamSpeed = 0.3 + speedVariation * 1.2; // 0.3x to 1.5x multiplier (faster = lower number)
                const randomDuration = baseAnimationDuration * streamSpeed;
                const randomDelay = stream.delay + randomOffset * 2;

                // Random assignment: some streams get highlights, others get regular pulse
                const shouldHighlight = Math.sin(i * 1.3) > 0.3; // ~70% get highlights
                const highlightDelay = (i * 0.8 + randomOffset * 2) % 4; // Stagger highlights

                // Particle speeds - make them generally faster
                const particleSpeed1 = streamSpeed * (0.4 + randomOffset * 0.3); // Faster particles
                const particleSpeed2 = streamSpeed * (0.3 + randomOffset * 0.4); // Even faster particles
                const particleSpeed3 = streamSpeed * (0.5 + randomOffset * 0.4); // Varied fast particles

                return `
              .stream-line-${i} {
                animation: ${
                  shouldHighlight ? "streamHighlight" : "streamPulse"
                } ${randomDuration}s ease-in-out infinite;
                animation-delay: ${
                  shouldHighlight ? highlightDelay : randomDelay
                }s;
                stroke-opacity: 0.3;
              }

              .stream-particle-${i} {
                offset-path: path('${stream.path}');
                animation: particleFlow ${
                  baseAnimationDuration * particleSpeed1
                }s linear infinite;
                animation-delay: ${randomDelay}s;
              }

              .stream-particle-${i}-2 {
                offset-path: path('${stream.path}');
                animation: particleFlow ${
                  baseAnimationDuration * particleSpeed2
                }s linear infinite;
                animation-delay: ${randomDelay + randomDuration * 0.3}s;
              }

              .stream-particle-${i}-3 {
                offset-path: path('${stream.path}');
                animation: particleFlow ${
                  baseAnimationDuration * particleSpeed3
                }s linear infinite;
                animation-delay: ${randomDelay + randomDuration * 0.6}s;
              }
            `;
              })
              .join("")}

            .icon-pulse {
              animation: iconPulse 6s ease-in-out infinite;
              transform-origin: center center;
              transform-box: fill-box;
            }

            .energy-ring {
              animation: energyRing 7s ease-in-out infinite;
            }

            @keyframes pulseCircle {
              0%, 100% { 
                transform: scale(1);
                opacity: 0.6;
                stroke-width: 3px;
              }
              50% { 
                transform: scale(1.2);
                opacity: 0.2;
                stroke-width: 1px;
              }
            }

            .pulse-circle {
              animation: pulseCircle 4s ease-in-out infinite;
              transform-origin: center center;
              transform-box: fill-box;
            }
          `}
        </style>

        <svg
          width="100%"
          height="100%"
          viewBox="-25 -25 500 350"
          preserveAspectRatio="xMidYMid meet"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background stream paths - removed for cleaner look */}

          {/* Flowing stream lines with individual highlights */}
          {streams.map((stream, i) => (
            <path
              key={`stream-${i}`}
              className={`stream-line-${i}`}
              d={stream.path}
              stroke={stream.color}
              strokeWidth="3"
              fill="none"
            />
          ))}

          {/* Flowing particles */}
          {streams.map((stream, i) => (
            <g key={`particles-${i}`}>
              <g className={`stream-particle-${i}`}>
                <circle r="4" fill={stream.particleColor} />
              </g>
              <g className={`stream-particle-${i}-2`}>
                <circle r="3" fill={stream.particleColor} opacity="0.8" />
              </g>
              <g className={`stream-particle-${i}-3`}>
                <circle r="2.5" fill={stream.particleColor} opacity="0.6" />
              </g>
            </g>
          ))}

          {/* Token Icon Target - Centered */}
          <g className="icon-container" transform="translate(225, 150)">
            {/* Apply pulse animation to this group instead of individual elements */}
            <g className="icon-pulse">
              {/* Circular background for icon */}
              <circle
                cx="0"
                cy="0"
                r="65"
                fill="hsl(var(--b1))"
                stroke="hsl(var(--p))"
                strokeWidth="4"
                opacity="0.95"
              />

              {/* Icon border ring - outer */}
              <circle
                cx="0"
                cy="0"
                r="58"
                fill="none"
                stroke="hsl(var(--s))"
                strokeWidth="4"
                opacity="0.9"
              />

              {/* Icon border ring - inner */}
              <circle
                cx="0"
                cy="0"
                r="52"
                fill="none"
                stroke="hsl(var(--a))"
                strokeWidth="3"
                opacity="0.7"
              />

              {/* Token Icon - Circular, centered and bigger */}
              {tokenImagePath ? (
                <image
                  x="-45"
                  y="-45"
                  width="90"
                  height="90"
                  href={tokenImagePath}
                  opacity="0.95"
                  clipPath="circle(45px at 45px 45px)"
                />
              ) : (
                <text
                  x="0"
                  y="8"
                  textAnchor="middle"
                  fontSize="20"
                  fontWeight="bold"
                  fill="hsl(var(--p))"
                  opacity="0.9"
                >
                  {tokenConfig?.symbol || "TOKEN"}
                </text>
              )}
            </g>

            {/* Pulse circle around icon */}
            <circle
              cx="0"
              cy="0"
              r="85"
              fill="none"
              stroke="hsl(var(--p))"
              strokeWidth="3"
              opacity="0.6"
              className="pulse-circle"
            />

            {/* Energy ring around icon */}
            <circle
              cx="0"
              cy="0"
              r="75"
              fill="none"
              stroke="hsl(var(--p))"
              strokeWidth="2"
              opacity="0.4"
              className="energy-ring"
            />
          </g>
        </svg>
      </div>
    </div>
  );
};
