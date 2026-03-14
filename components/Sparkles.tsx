'use client';
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface SparkleParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

interface SparklesProps {
  id?: string;
  className?: string;
  background?: string;
  minSize?: number;
  maxSize?: number;
  particleCount?: number;
  particleColor?: string;
  speed?: number;
}

export const SparklesCore: React.FC<SparklesProps> = ({
  id = 'sparkles',
  className = '',
  background = 'transparent',
  minSize = 0.4,
  maxSize = 1.4,
  particleCount = 50,
  particleColor = '#FFFFFF',
  speed = 1
}) => {
  const [particles, setParticles] = useState<SparkleParticle[]>([]);

  useEffect(() => {
    const generateParticles = () => {
      const newParticles: SparkleParticle[] = [];
      for (let i = 0; i < particleCount; i++) {
        newParticles.push({
          id: i,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: Math.random() * (maxSize - minSize) + minSize,
          duration: (Math.random() * 2 + 1) / speed,
          delay: Math.random() * 2
        });
      }
      setParticles(newParticles);
    };

    generateParticles();
  }, [particleCount, minSize, maxSize, speed]);

  return (
    <div
      id={id}
      className={`relative overflow-hidden ${className}`}
      style={{ background }}
    >
      {particles.map((particle) => (
        <motion.span
          key={particle.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
            backgroundColor: particleColor,
            boxShadow: `0 0 ${particle.size * 2}px ${particleColor}`
          }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1, 0]
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      ))}
    </div>
  );
};

// Sparkles text wrapper component
interface SparklesTextProps {
  children: React.ReactNode;
  className?: string;
  sparklesClassName?: string;
  particleColor?: string;
}

export const SparklesText: React.FC<SparklesTextProps> = ({
  children,
  className = '',
  sparklesClassName = '',
  particleColor = '#3b82f6'
}) => {
  return (
    <div className={`relative inline-block ${className}`}>
      <span className="relative z-10">{children}</span>
      <SparklesCore
        className={`absolute inset-0 z-0 ${sparklesClassName}`}
        particleColor={particleColor}
        particleCount={30}
        minSize={1}
        maxSize={2}
      />
    </div>
  );
};

export default SparklesCore;
