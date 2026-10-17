import React, { useEffect, useRef } from 'react';

interface HeartParticle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  baseDriftX: number;
  wanderPhase1: number;
  wanderFreq1: number;
  wanderAmp1: number;
  wanderPhase2: number;
  wanderFreq2: number;
  wanderAmp2: number;
  maxOpacity: number;
  hue: number;
}

interface StardustParticle {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  driftX: number;
  pulseSpeed: number;
  pulsePhase: number;
  baseOpacity: number;
  hue: number;
}

export const BackgroundAura: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let isRunning = true;

    // Detect Device Pixel Ratio (DPR) for Native/High-Density Crisp Rendering
    let dpr = window.devicePixelRatio || 1;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const setupCanvasSize = () => {
      const currentDpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = currentDpr;

      canvas.width = Math.floor(width * currentDpr);
      canvas.height = Math.floor(height * currentDpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(currentDpr, currentDpr);
    };

    setupCanvasSize();
    window.addEventListener('resize', setupCanvasSize);

    // =========================================================================
    // 1. REFINED FLOATING HEARTS (Strictly Upward, Natural Drift, Upright)
    // =========================================================================
    // Romantic palette: midnight-blue, icy lavender, soft violet, whisper of rose
    const heartHues = [225, 240, 255, 270, 330, 345];

    const getMaxHearts = () => {
      // Balanced, uncluttered capacity tuned for serene, graceful ascension
      return Math.min(9, Math.max(5, Math.floor(width / 60)));
    };

    let lastSpawnX = width * 0.5;

    // Smart spacing algorithm to prevent hearts from bunching or rising side-by-side
    const findSpacedSpawnX = (existingHearts: HeartParticle[]): number => {
      const lowerHearts = existingHearts.filter((h) => h.y > height * 0.55);
      let bestX = 28 + Math.random() * (width - 56);
      let bestDist = -1;

      for (let i = 0; i < 14; i++) {
        const candidateX = 28 + Math.random() * (width - 56);
        let minDist = Math.abs(candidateX - lastSpawnX);
        for (const h of lowerHearts) {
          const d = Math.abs(candidateX - h.x);
          if (d < minDist) minDist = d;
        }
        if (minDist > bestDist) {
          bestDist = minDist;
          bestX = candidateX;
        }
      }

      lastSpawnX = bestX;
      return bestX;
    };

    const createSingleHeart = (
      initialSpread = false,
      customX?: number,
      customY?: number
    ): HeartParticle => {
      // Natural size variation (9px to 17.5px)
      const size = 9 + Math.random() * 8.5;
      const depthFactor = (size - 9) / 8.5; // 0.0 (distant) to 1.0 (foreground)

      // Horizontal coordinate
      let x: number;
      if (customX !== undefined) {
        x = customX;
      } else if (!initialSpread) {
        x = findSpacedSpawnX(activeHearts);
      } else {
        x = 28 + Math.random() * (width - 56);
      }

      // Vertical start position: initial scattered screen presence on mount, or strictly below bottom
      let y: number;
      if (initialSpread) {
        y = customY !== undefined ? customY : Math.random() * (height * 0.85);
      } else {
        y = height + size + 8 + Math.random() * 24;
      }

      // Strictly upward floating speed for every heart (always positive, gentle and continuous)
      const speedY = 0.20 + depthFactor * 0.08 + Math.random() * 0.08;

      // Independent horizontal drift: some left, some right, some almost vertical
      // Independent of screen position (hearts on right don't automatically go right, etc.)
      const baseDriftX = (Math.random() - 0.5) * 0.20;

      // Ultra-slow, smooth harmonic wandering for gradual, natural drift evolution
      // Low frequencies eliminate rapid side-to-side oscillation, shaking, or repetitive waves
      const wanderPhase1 = Math.random() * Math.PI * 2;
      const wanderFreq1 = 0.0014 + Math.random() * 0.0016;
      const wanderAmp1 = 0.06 + Math.random() * 0.06;

      const wanderPhase2 = Math.random() * Math.PI * 2;
      const wanderFreq2 = 0.0026 + Math.random() * 0.0020;
      const wanderAmp2 = 0.03 + Math.random() * 0.04;

      // Controlled atmospheric opacity for natural integration
      const maxOpacity = 0.18 + depthFactor * 0.06;
      const hue = heartHues[Math.floor(Math.random() * heartHues.length)];

      return {
        x,
        y,
        size,
        speedY,
        baseDriftX,
        wanderPhase1,
        wanderFreq1,
        wanderAmp1,
        wanderPhase2,
        wanderFreq2,
        wanderAmp2,
        maxOpacity,
        hue,
      };
    };

    // Initialize with spaced hearts across separate vertical & horizontal zones
    // ensures instant aesthetic ambiance on app launch without clumping
    const initialHeartCount = Math.min(6, Math.max(3, Math.floor(getMaxHearts() * 0.65)));
    let activeHearts: HeartParticle[] = [];
    const laneWidth = (width - 64) / Math.max(1, initialHeartCount);
    for (let i = 0; i < initialHeartCount; i++) {
      const laneX = 32 + i * laneWidth + Math.random() * (laneWidth * 0.7);
      const staggeredY = (height * 0.15) + (i / initialHeartCount) * (height * 0.65) + (Math.random() - 0.5) * 30;
      activeHearts.push(createSingleHeart(true, laneX, staggeredY));
    }

    // Randomized spawn interval generator for natural pacing (one by one)
    const getNextSpawnDelay = () => {
      return 2200 + Math.random() * 2000; // 2.2s - 4.2s natural interval
    };

    let nextSpawnTime = performance.now() + 1200; // First new bottom spawn shortly after launch

    // =========================================================================
    // 2. ETHEREAL STARDUST PARTICLES (Delicate, Non-Pulsing Luminous Motes)
    // =========================================================================
    const stardustCount = 26;
    const UNIFORM_STARDUST_OPACITY = 0.14;

    const createStardust = (initialSpread = false): StardustParticle => {
      const x = Math.random() * width;
      const y = initialSpread ? Math.random() * height : height + 10 + Math.random() * 30;
      const radius = 0.8 + Math.random() * 1.0;
      const speedY = 0.08 + Math.random() * 0.09;
      const driftX = (Math.random() - 0.5) * 0.05;
      const hue = heartHues[Math.floor(Math.random() * heartHues.length)];

      return {
        x,
        y,
        radius,
        speedY,
        driftX,
        pulseSpeed: 0,
        pulsePhase: 0,
        baseOpacity: UNIFORM_STARDUST_OPACITY,
        hue,
      };
    };

    const stardustParticles: StardustParticle[] = Array.from({ length: stardustCount }, () =>
      createStardust(true)
    );

    // =========================================================================
    // 3. CANVAS DRAWING ROUTINES (Upright 3D Glossy Translucent Glass Heart)
    // =========================================================================
    const drawSoftHeart = (
      x: number,
      y: number,
      size: number,
      opacity: number,
      hue: number
    ) => {
      if (opacity <= 0.002) return;

      ctx.save();
      ctx.translate(x, y);
      // Strictly upright orientation (no rotation, tilt, or distortion)

      // Disable shadow blur to avoid blooming or accidental brightness flashes
      ctx.shadowBlur = 0;

      // 1. Subtle 3D Curvature Volumetric Gradient (Top-left light to bottom-right ambient depth)
      const gradient = ctx.createLinearGradient(-size * 0.35, -size * 0.45, size * 0.35, size * 0.65);
      gradient.addColorStop(0, `hsla(${hue}, 80%, 82%, ${opacity * 0.96})`);
      gradient.addColorStop(0.48, `hsla(${hue}, 75%, 72%, ${opacity * 0.86})`);
      gradient.addColorStop(1, `hsla(${hue}, 70%, 58%, ${opacity * 0.72})`);
      ctx.fillStyle = gradient;

      ctx.beginPath();
      // Start at top center dip
      ctx.moveTo(0, -size * 0.32);

      // Left lobe
      ctx.bezierCurveTo(
        -size * 0.36, -size * 0.74,
        -size * 0.75, -size * 0.34,
        -size * 0.75, 0
      );

      // Bottom left curve to tip
      ctx.bezierCurveTo(
        -size * 0.75, size * 0.35,
        -size * 0.35, size * 0.75,
        0, size
      );

      // Bottom right curve to tip
      ctx.bezierCurveTo(
        size * 0.35, size * 0.75,
        size * 0.75, size * 0.35,
        size * 0.75, 0
      );

      // Right lobe
      ctx.bezierCurveTo(
        size * 0.75, -size * 0.34,
        size * 0.36, -size * 0.74,
        0, -size * 0.32
      );
      ctx.closePath();
      ctx.fill();

      // 2. Subtle Glass Hairline Bevel Rim
      ctx.strokeStyle = `hsla(${hue}, 78%, 85%, ${opacity * 0.65})`;
      ctx.lineWidth = Math.max(0.55, size * 0.04);
      ctx.stroke();

      // 3. Soft Glossy Glass Reflection Highlight on Left Lobe (Tinted & Subtle, never harsh white)
      ctx.beginPath();
      ctx.ellipse(
        -size * 0.22,
        -size * 0.22,
        size * 0.16,
        size * 0.065,
        -Math.PI / 4,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = `hsla(${hue}, 85%, 90%, ${opacity * 0.45})`;
      ctx.fill();

      ctx.restore();
    };

    const drawStardust = (p: StardustParticle) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.shadowBlur = 0;
      ctx.fillStyle = `hsla(${p.hue}, 80%, 85%, ${p.baseOpacity})`;
      ctx.fill();
      ctx.restore();
    };

    let lastTime = performance.now();

    const render = (now: number) => {
      if (!isRunning) return;

      const dt = Math.min(50, Math.max(8, now - lastTime));
      lastTime = now;
      const dtFactor = dt / 16.667; // Normalized to 60fps

      ctx.clearRect(0, 0, width, height);

      // =======================================================================
      // Timed Individual Heart Spawner (No large batches, organic intervals)
      // =======================================================================
      if (now >= nextSpawnTime) {
        const maxLimit = getMaxHearts();
        if (activeHearts.length < maxLimit) {
          activeHearts.push(createSingleHeart(false));
        }
        nextSpawnTime = now + getNextSpawnDelay();
      }

      // 1. Draw Stardust Particles (Constant non-pulsing soft motes)
      for (let i = 0; i < stardustParticles.length; i++) {
        const s = stardustParticles[i];
        s.y -= s.speedY * dtFactor;
        s.x += s.driftX * dtFactor;

        if (s.y < -10) {
          stardustParticles[i] = createStardust(false);
          continue;
        }

        if (s.x < -10) s.x = width + 10;
        else if (s.x > width + 10) s.x = -10;

        drawStardust(s);
      }

      // 2. Update & Draw Floating Hearts (Graceful individual upward ascension)
      const remainingHearts: HeartParticle[] = [];

      for (let i = 0; i < activeHearts.length; i++) {
        const p = activeHearts[i];

        // Smooth vertical ascension: strictly upward travel for every heart
        p.y -= p.speedY * dtFactor;

        // Individual organic wandering drift (smooth compound harmonic variations)
        p.wanderPhase1 += p.wanderFreq1 * dtFactor;
        p.wanderPhase2 += p.wanderFreq2 * dtFactor;
        let currentDriftX =
          p.baseDriftX +
          Math.sin(p.wanderPhase1) * p.wanderAmp1 +
          Math.cos(p.wanderPhase2) * p.wanderAmp2;

        // Soft boundary guidance: smoothly ease inward if nearing viewport sides
        if (p.x < 32 && currentDriftX < 0) {
          currentDriftX *= Math.max(0, (p.x - 12) / 20);
          p.baseDriftX = Math.abs(p.baseDriftX) * 0.4;
        } else if (p.x > width - 32 && currentDriftX > 0) {
          currentDriftX *= Math.max(0, (width - 12 - p.x) / 20);
          p.baseDriftX = -Math.abs(p.baseDriftX) * 0.4;
        }

        p.x += currentDriftX * dtFactor;

        // Remove naturally once departed past top bounds
        if (p.y < -35 || p.x < -40 || p.x > width + 40) {
          continue;
        }

        // Natural edge fade only at extreme bottom entry and extreme top exit
        let opacityFactor = 1.0;
        const bottomFadeLimit = height - 12;
        const topFadeLimit = 35;

        if (p.y > bottomFadeLimit) {
          opacityFactor = Math.max(0, (height + p.size - p.y) / (p.size + 12));
        } else if (p.y < topFadeLimit) {
          opacityFactor = Math.max(0, p.y / topFadeLimit);
        }

        if (p.y > height + p.size + 20) opacityFactor = 0;

        const currentOpacity = p.maxOpacity * opacityFactor;
        // Upright, consistent shape with no rotation, tilt, or distortion
        drawSoftHeart(p.x, p.y, p.size, currentOpacity, p.hue);

        remainingHearts.push(p);
      }

      activeHearts = remainingHearts;

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    // Respect tab/app visibility to preserve battery and GPU
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isRunning = false;
        cancelAnimationFrame(animationFrameId);
      } else {
        if (!isRunning) {
          isRunning = true;
          lastTime = performance.now();
          nextSpawnTime = performance.now() + 600;
          animationFrameId = requestAnimationFrame(render);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isRunning = false;
      window.removeEventListener('resize', setupCanvasSize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 w-screen h-screen min-h-[100dvh] pointer-events-none overflow-hidden z-0 bg-[#030611] isolate">
      {/* Deep Midnight Navy Base (Cinematic, pure, noise-free foundation) */}
      <div 
        className="absolute inset-0 w-full h-full bg-gradient-to-b from-[#040817] via-[#030612] to-[#02040b] pointer-events-none" 
      />

      {/* Elegant Midnight Aurora Ambient Glows (Smooth quadratic radial falloffs, no rings, banding, or downsampling) */}
      
      {/* 1. Grand Midnight Sapphire Aurora Veil (XL: ~780px - 920px) - Expansive soft atmospheric illumination */}
      <div 
        className="absolute top-0 left-0 w-[780px] h-[780px] sm:w-[920px] sm:h-[920px] rounded-full bg-[radial-gradient(circle_at_center,rgba(30,64,175,0.32)_0%,rgba(30,58,138,0.24)_18%,rgba(23,37,84,0.15)_36%,rgba(15,23,42,0.07)_56%,rgba(4,7,17,0.02)_76%,transparent_100%)] blur-[42px] sm:blur-[54px] animate-glow-journey-1 pointer-events-none" 
      />

      {/* 2. Luminous Arctic Cyan Aurora Ribbon (S-M: ~360px - 440px) - Refined cool cyan luminance accent */}
      <div 
        className="absolute top-0 left-0 w-[360px] h-[360px] sm:w-[440px] sm:h-[440px] rounded-full bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.32)_0%,rgba(56,189,248,0.22)_18%,rgba(37,99,235,0.14)_38%,rgba(30,58,138,0.06)_60%,rgba(3,6,17,0.01)_82%,transparent_100%)] blur-[26px] sm:blur-[34px] animate-glow-journey-2 pointer-events-none" 
      />

      {/* 3. Romantic Deep Indigo-Violet Aurora Glow (XXL: ~860px - 1040px) - Warm midnight dusk undertone */}
      <div 
        className="absolute top-0 left-0 w-[860px] h-[860px] sm:w-[1040px] sm:h-[1040px] rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.20)_0%,rgba(79,70,229,0.15)_22%,rgba(67,56,202,0.09)_42%,rgba(49,46,129,0.045)_64%,rgba(17,24,39,0.015)_82%,transparent_100%)] blur-[48px] sm:blur-[60px] animate-glow-journey-3 pointer-events-none" 
      />

      {/* 4. Radiant Pure Cobalt Azure Bloom (M: ~480px - 580px) - Vivid blue core with gentle diffusion */}
      <div 
        className="absolute top-0 left-0 w-[480px] h-[480px] sm:w-[580px] sm:h-[580px] rounded-full bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.30)_0%,rgba(59,130,246,0.20)_18%,rgba(29,78,216,0.12)_40%,rgba(30,58,138,0.05)_62%,transparent_100%)] blur-[30px] sm:blur-[40px] animate-glow-journey-4 pointer-events-none" 
      />

      {/* 5. Celestial Cyan-Blue Aurora Spark (S: ~280px - 340px) - Delicate drifting light accent */}
      <div 
        className="absolute top-0 left-0 w-[280px] h-[280px] sm:w-[340px] sm:h-[340px] rounded-full bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.28)_0%,rgba(59,130,246,0.18)_22%,rgba(37,99,235,0.09)_44%,rgba(30,58,138,0.03)_68%,transparent_100%)] blur-[22px] sm:blur-[30px] animate-glow-journey-5 pointer-events-none" 
      />

      {/* Dynamic Floating Hearts & Stardust Canvas (Rendered cleanly on top of all background gradients) */}
      <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full pointer-events-none z-10" />
    </div>
  );
};

