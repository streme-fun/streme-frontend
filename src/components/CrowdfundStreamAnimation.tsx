"use client";

import { useEffect, useRef, useState } from "react";

interface StreamParticle {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  size: number;
  opacity: number;
  color: string;
  angle: number;
  progress: number;
}

export const CrowdfundStreamAnimation = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, setParticles] = useState<StreamParticle[]>([]);
  const animationRef = useRef<number>(0);
  const [isDark, setIsDark] = useState(false);

  // Check theme
  useEffect(() => {
    const checkDarkMode = () => {
      const htmlElement = document.documentElement;
      const dataTheme = htmlElement.getAttribute("data-theme");
      setIsDark(dataTheme === "dark");
    };

    checkDarkMode();

    const observer = new MutationObserver(() => checkDarkMode());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });

    return () => observer.disconnect();
  }, []);

  // Initialize particles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      // Create mission targets (representing different missions) based on current size
      const missionTargets = [
        { x: rect.width * 0.2, y: rect.height * 0.3 },
        { x: rect.width * 0.5, y: rect.height * 0.2 },
        { x: rect.width * 0.8, y: rect.height * 0.4 },
        { x: rect.width * 0.3, y: rect.height * 0.7 },
        { x: rect.width * 0.7, y: rect.height * 0.8 }
      ];
      
      return { rect, missionTargets };
    };

    const { rect, missionTargets } = updateCanvasSize();

    const colors = [
      '#6366f1', // Primary blue
      '#a855f7', // Purple  
      '#ec4899', // Pink
      '#06b6d4', // Cyan
      '#10b981', // Green
      '#f59e0b'  // Amber
    ];

    const newParticles: StreamParticle[] = [];
    
    // Create particles based on container size (more particles for larger containers)
    const particleCount = Math.min(50, Math.max(20, Math.floor((rect.width * rect.height) / 1000)));
    
    for (let i = 0; i < particleCount; i++) {
      const targetIndex = Math.floor(Math.random() * missionTargets.length);
      const target = missionTargets[targetIndex];
      
      // Scale particle properties based on container size
      const scaleX = rect.width / 300; // Base width of 300px
      const scaleY = rect.height / 100; // Base height of 100px
      const scale = Math.min(scaleX, scaleY);
      
      newParticles.push({
        id: i,
        x: Math.random() * rect.width,
        y: rect.height + 50, // Start from bottom
        targetX: target.x + (Math.random() - 0.5) * (100 * scaleX),
        targetY: target.y + (Math.random() - 0.5) * (60 * scaleY),
        speed: 0.3 + Math.random() * 0.7,
        size: (2 + Math.random() * 4) * scale,
        opacity: 0.3 + Math.random() * 0.7,
        color: colors[Math.floor(Math.random() * colors.length)],
        angle: Math.random() * Math.PI * 2,
        progress: 0
      });
    }

    setParticles(newParticles);
  }, []);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      // Clear canvas with theme-appropriate background
      ctx.fillStyle = isDark ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      setParticles(prevParticles => 
        prevParticles.map(particle => {
          // Move towards target with some curves
          const dx = particle.targetX - particle.x;
          const dy = particle.targetY - particle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > 5) {
            // Add some wave motion to the stream
            const waveX = Math.sin(particle.progress * 0.02) * 10;
            const waveY = Math.cos(particle.progress * 0.03) * 5;
            
            particle.x += (dx * particle.speed * 0.02) + waveX * 0.1;
            particle.y += (dy * particle.speed * 0.02) + waveY * 0.1;
            particle.progress += 1;
          } else {
            // Reset particle when it reaches target
            particle.x = Math.random() * canvas.width;
            particle.y = canvas.height + 50;
            particle.progress = 0;
            
            // Choose new random target with responsive scaling
            const targets = [
              { x: canvas.width * 0.2, y: canvas.height * 0.3 },
              { x: canvas.width * 0.5, y: canvas.height * 0.2 },
              { x: canvas.width * 0.8, y: canvas.height * 0.4 },
              { x: canvas.width * 0.3, y: canvas.height * 0.7 },
              { x: canvas.width * 0.7, y: canvas.height * 0.8 }
            ];
            const newTarget = targets[Math.floor(Math.random() * targets.length)];
            const scaleX = canvas.width / 300;
            const scaleY = canvas.height / 100;
            particle.targetX = newTarget.x + (Math.random() - 0.5) * (100 * scaleX);
            particle.targetY = newTarget.y + (Math.random() - 0.5) * (60 * scaleY);
          }

          // Draw particle
          ctx.save();
          ctx.globalAlpha = particle.opacity;
          ctx.fillStyle = particle.color;
          ctx.shadowBlur = 10;
          ctx.shadowColor = particle.color;
          
          // Draw main particle
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fill();
          
          // Draw trail effect
          ctx.globalAlpha = particle.opacity * 0.3;
          ctx.beginPath();
          ctx.arc(particle.x - dx * 0.1, particle.y - dy * 0.1, particle.size * 0.7, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.restore();

          return particle;
        })
      );

      // Draw mission targets as glowing circles
      const targets = [
        { x: canvas.width * 0.2, y: canvas.height * 0.3, label: 'DeFi' },
        { x: canvas.width * 0.5, y: canvas.height * 0.2, label: 'Gaming' },
        { x: canvas.width * 0.8, y: canvas.height * 0.4, label: 'Dev' },
        { x: canvas.width * 0.3, y: canvas.height * 0.7, label: 'Social' },
        { x: canvas.width * 0.7, y: canvas.height * 0.8, label: 'Community' }
      ];

      targets.forEach((target, index) => {
        ctx.save();
        ctx.globalAlpha = 0.6;
        
        // Pulsing effect with responsive radius
        const pulse = Math.sin(Date.now() * 0.003 + index) * 0.3 + 0.7;
        const baseRadius = Math.min(canvas.width, canvas.height) / 15; // Responsive base radius
        const radius = baseRadius * pulse;
        
        // Gradient for glow effect
        const gradient = ctx.createRadialGradient(
          target.x, target.y, 0,
          target.x, target.y, radius * 2
        );
        gradient.addColorStop(0, `rgba(99, 102, 241, ${0.8 * pulse})`);
        gradient.addColorStop(0.5, `rgba(99, 102, 241, ${0.4 * pulse})`);
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(target.x, target.y, radius * 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner circle
        ctx.fillStyle = `rgba(99, 102, 241, ${0.9 * pulse})`;
        ctx.beginPath();
        ctx.arc(target.x, target.y, radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isDark]);

  // Handle resize - simplified to just update canvas size
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.7 }}
    />
  );
};