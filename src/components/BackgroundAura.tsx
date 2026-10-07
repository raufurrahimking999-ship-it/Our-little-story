import React, { useEffect, useRef } from 'react';

interface HeartParticle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  driftX: number;
  swayFreq: number;
  swayPhase: number;
  swayAmp: number;
  maxOpacity: number;
  hue: number;
  rotation: number;
  scaleVar: number;
  scalePhase: number;
  fadeLimitTop: number; // variable altitude where heart begins fading out
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
    // 1. REFINED FLOATING HEARTS (Subtle 3D Liquid-Glass Dimensional Appearance)
    // =========================================================================
    const heartCount = 20;
    // Elegant palette: midnight-blue, icy lavender, soft violet, whisper of rose
    const heartHues = [225, 240, 255, 270, 330, 345];

    const createHeart = (initialSpread = false, index = 0): HeartParticle => {
      // Natural size distribution (8px to 18px)
      const size = 8.0 + Math.random() * 9.5;
      const depthFactor = (size - 8.0) / 9.5; // 0.0 (distant) to 1.0 (foreground)

      // Distribute evenly across screen width with jitter
      const sectionWidth = width / heartCount;
      const x = Math.max(16, Math.min(width - 16, index * sectionWidth + (Math.random() - 0.5) * (sectionWidth * 0.9)));

      // Y positioning: staggered across height initially, resets at bottom on ascension
      let y: number;
      if (initialSpread) {
        y = Math.random() * height;
      } else {
        y = height + 15 + Math.random() * 40;
      }

      const speedY = 0.22 + depthFactor * 0.12 + Math.random() * 0.14;
      const driftX = (Math.random() - 0.5) * 0.12;

      const swayFreq = 0.0035 + Math.random() * 0.0045;
      const swayPhase = Math.random() * Math.PI * 2;
      const swayAmp = 0.10 + Math.random() * 0.18;

      // Subtle atmospheric opacity: tightly controlled (0.16 to 0.22) for smooth natural depth
      const maxOpacity = 0.16 + depthFactor * 0.06;
      const hue = heartHues[Math.floor(Math.random() * heartHues.length)];
      const rotation = (Math.random() - 0.5) * 0.10; // Gentle natural tilt

      const scaleVar = 0.02 + Math.random() * 0.02;
      const scalePhase = Math.random() * Math.PI * 2;

      return {
        x,
        y,
        size,
        speedY,
        driftX,
        swayFreq,
        swayPhase,
        swayAmp,
        maxOpacity,
        hue,
        rotation,
        scaleVar,
        scalePhase,
        fadeLimitTop: -15,
      };
    };

    const heartParticles: HeartParticle[] = Array.from({ length: heartCount }, (_, i) =>
      createHeart(true, i)
    );

    // =========================================================================
    // 2. ETHEREAL STARDUST PARTICLES (Delicate, Non-Pulsing Luminous Motes)
    // =========================================================================
    const stardustCount = 28;
    const UNIFORM_STARDUST_OPACITY = 0.15;

    const createStardust = (initialSpread = false): StardustParticle => {
      const x = Math.random() * width;
      const y = initialSpread ? Math.random() * height : height + 10 + Math.random() * 30;
      const radius = 0.8 + Math.random() * 1.0;
      const speedY = 0.14 + Math.random() * 0.18;
      const driftX = (Math.random() - 0.5) * 0.08;
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
    // 3. CANVAS DRAWING ROUTINES (Subtle 3D Glossy Translucent Glass Heart)
    // =========================================================================
    const drawSoftHeart = (
      x: number,
      y: number,
      size: number,
      opacity: number,
      hue: number,
      rotation: number
    ) => {
      if (opacity <= 0.002) return;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);

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

    let tick = 0;
    const render = () => {
      if (!isRunning) return;

      tick += 1;
      ctx.clearRect(0, 0, width, height);

      // 1. Draw Stardust Particles (Constant non-pulsing soft motes)
      for (let i = 0; i < stardustParticles.length; i++) {
        const s = stardustParticles[i];
        s.y -= s.speedY;
        s.x += s.driftX;

        if (s.y < -10) {
          stardustParticles[i] = createStardust(false);
          continue;
        }

        if (s.x < -10) s.x = width + 10;
        else if (s.x > width + 10) s.x = -10;

        drawStardust(s);
      }

      // 2. Draw Floating Hearts (100% Constant Brightness & Soft Blending)
      for (let i = 0; i < heartParticles.length; i++) {
        const p = heartParticles[i];

        p.y -= p.speedY;

        // Smooth wave trajectory
        const swayValue = Math.sin(tick * p.swayFreq + p.swayPhase);
        p.x += p.driftX + swayValue * p.swayAmp;

        // Smooth subtle scale
        const currentScale = p.size * (1 + Math.sin(tick * 0.015 + p.scalePhase) * p.scaleVar);

        // Reset if it passes screen top
        if (p.y < -30) {
          heartParticles[i] = createHeart(false, i);
          continue;
        }

        // Screen edge wrapping
        if (p.x < -30) p.x = width + 30;
        else if (p.x > width + 30) p.x = -30;

        // Gentle fade only at extreme bottom entry and extreme top exit
        let opacityFactor = 1.0;
        const bottomFadeLimit = height * 0.96;
        const topFadeLimit = 25;

        if (p.y > bottomFadeLimit) {
          opacityFactor = Math.max(0, (height - p.y) / (height - bottomFadeLimit));
        } else if (p.y < topFadeLimit) {
          opacityFactor = Math.max(0, p.y / topFadeLimit);
        }

        if (p.y > height) opacityFactor = 0;

        const currentOpacity = p.maxOpacity * opacityFactor;
        drawSoftHeart(p.x, p.y, currentScale, currentOpacity, p.hue, p.rotation);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    // Respect tab/app visibility to preserve battery and GPU
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isRunning = false;
        cancelAnimationFrame(animationFrameId);
      } else {
        if (!isRunning) {
          isRunning = true;
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
    <div className="fixed inset-0 w-screen h-screen min-h-[100dvh] pointer-events-none overflow-hidden z-0 bg-[#040711]">
      {/* Deep Midnight Navy & Indigo Base Gradient (Consistent single-tone romantic background) */}
      <div 
        className="absolute inset-0 w-full h-full bg-gradient-to-b from-[#05091a] via-[#040714] to-[#040711] pointer-events-none" 
      />

      {/* Balanced Ambient Glows (Evenly distributed across top & bottom viewport for zero two-tone split) */}
      <div 
        className="absolute top-[5%] left-[10%] w-[380px] h-[380px] sm:w-[480px] sm:h-[480px] rounded-full bg-indigo-600/10 blur-[130px] sm:blur-[160px] pointer-events-none" 
      />
      <div 
        className="absolute top-[45%] right-[5%] w-[360px] h-[360px] sm:w-[460px] sm:h-[460px] rounded-full bg-violet-600/10 blur-[130px] sm:blur-[160px] pointer-events-none" 
      />
      <div 
        className="absolute bottom-[5%] left-[8%] w-[340px] h-[340px] sm:w-[440px] sm:h-[440px] rounded-full bg-blue-600/10 blur-[130px] sm:blur-[160px] pointer-events-none" 
      />
      <div 
        className="absolute bottom-[25%] right-[15%] w-[320px] h-[320px] sm:w-[420px] sm:h-[420px] rounded-full bg-indigo-600/10 blur-[130px] sm:blur-[160px] pointer-events-none" 
      />

      {/* Dynamic Floating Hearts & Stardust Canvas (Rendered cleanly on top of all background gradients) */}
      <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full pointer-events-none z-10" />
    </div>
  );
};

