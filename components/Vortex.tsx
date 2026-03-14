'use client';
import React, { useEffect, useRef } from 'react';
import { createNoise3D } from 'simplex-noise';
import { motion } from 'framer-motion';

interface VortexProps {
  children?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  particleCount?: number;
  rangeY?: number;
  baseHue?: number;
  baseSpeed?: number;
  rangeSpeed?: number;
  baseRadius?: number;
  rangeRadius?: number;
  backgroundColor?: string;
}

export const Vortex: React.FC<VortexProps> = ({
  children,
  className = '',
  containerClassName = '',
  particleCount = 700,
  rangeY = 100,
  baseHue = 220, // Blue hue for branding
  baseSpeed = 0.0,
  rangeSpeed = 1.5,
  baseRadius = 1,
  rangeRadius = 2,
  backgroundColor = '#ffffff'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const noise3D = createNoise3D();
    let animationId: number;
    let particles: Particle[] = [];
    let tick = 0;

    const resize = () => {
      canvas.width = container.offsetWidth * window.devicePixelRatio;
      canvas.height = container.offsetHeight * window.devicePixelRatio;
      canvas.style.width = `${container.offsetWidth}px`;
      canvas.style.height = `${container.offsetHeight}px`;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    class Particle {
      x: number;
      y: number;
      originX: number;
      originY: number;
      speed: number;
      radius: number;
      hue: number;
      alpha: number;

      constructor() {
        this.x = Math.random() * container!.offsetWidth;
        this.y = Math.random() * container!.offsetHeight;
        this.originX = this.x;
        this.originY = this.y;
        this.speed = baseSpeed + Math.random() * rangeSpeed;
        this.radius = baseRadius + Math.random() * rangeRadius;
        // Vary hue slightly around base for visual interest
        this.hue = baseHue + Math.random() * 30 - 15;
        this.alpha = 0.3 + Math.random() * 0.5;
      }

      update(tick: number) {
        const noiseX = noise3D(this.originX * 0.002, this.originY * 0.002, tick * 0.0005);
        const noiseY = noise3D(this.originX * 0.002 + 100, this.originY * 0.002 + 100, tick * 0.0005);

        this.x = this.originX + noiseX * rangeY;
        this.y = this.originY + noiseY * rangeY;
      }

      draw(ctx: CanvasRenderingContext2D) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, 80%, 60%, ${this.alpha})`;
        ctx.fill();
      }
    }

    const init = () => {
      particles = [];
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
      }
    };

    const animate = () => {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particles.forEach((particle) => {
        particle.update(tick);
        particle.draw(ctx);
      });

      tick += 1;
      animationId = requestAnimationFrame(animate);
    };

    resize();
    init();
    animate();

    window.addEventListener('resize', () => {
      resize();
      init();
    });

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [particleCount, rangeY, baseHue, baseSpeed, rangeSpeed, baseRadius, rangeRadius, backgroundColor]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${containerClassName}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0"
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className={`relative z-10 ${className}`}
      >
        {children}
      </motion.div>
    </div>
  );
};

export default Vortex;
