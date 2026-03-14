'use client';
"use client";
import React, { useMemo } from "react";
import { motion } from "framer-motion";

interface WeatherFxProps {
  height?: number;
  type?: "rain" | "snow";
  intensity?: number;
  colors?: string[];
  className?: string;
  speed?: number; // Multiplier for animation duration (higher = slower)
}

export const WeatherFx: React.FC<WeatherFxProps> = ({
  height = 16,
  type = "rain",
  intensity = 75,
  colors = ["#3b82f6"],
  className = "",
  speed = 1,
}) => {
  // Generate rain drops based on intensity
  const drops = useMemo(() => {
    return Array.from({ length: intensity }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 3,
      duration: (0.6 + Math.random() * 0.4) * speed,
      length: 15 + Math.random() * 20,
      opacity: 0.4 + Math.random() * 0.4,
    }));
  }, [intensity, speed]);

  const getColor = (index: number) => {
    const colorMap: Record<string, string> = {
      "brand-solid-medium": "#3b82f6",
      "brand-solid-light": "#60a5fa",
      "brand-solid-dark": "#2563eb",
      "cyan": "#06b6d4",
    };
    const color = colors[index % colors.length];
    return colorMap[color] || color;
  };

  if (type === "rain") {
    return (
      <div
        className={`absolute inset-x-0 top-0 overflow-hidden pointer-events-none ${className}`}
        style={{ height: `${height}rem` }}
      >
        {drops.map((drop) => (
          <motion.div
            key={drop.id}
            initial={{ y: -50 }}
            animate={{ y: `${height * 16 + 100}px` }}
            transition={{
              duration: drop.duration,
              delay: drop.delay,
              ease: "linear",
              repeat: Infinity,
              repeatDelay: Math.random() * 0.3,
            }}
            style={{
              position: "absolute",
              left: `${drop.x}%`,
              width: "2px",
              height: `${drop.length}px`,
              backgroundColor: getColor(drop.id),
              opacity: drop.opacity,
              borderRadius: "2px",
            }}
          />
        ))}
      </div>
    );
  }

  // Snow effect
  return (
    <div
      className={`absolute inset-x-0 top-0 overflow-hidden pointer-events-none ${className}`}
      style={{ height: `${height}rem` }}
    >
      {drops.map((drop) => (
        <motion.div
          key={drop.id}
          initial={{ y: -20, x: 0 }}
          animate={{
            y: `${height * 16 + 50}px`,
            x: [0, 10, -10, 5, 0],
          }}
          transition={{
            duration: drop.duration * 5,
            delay: drop.delay,
            ease: "linear",
            repeat: Infinity,
          }}
          style={{
            position: "absolute",
            left: `${drop.x}%`,
            width: "4px",
            height: "4px",
            backgroundColor: getColor(drop.id),
            opacity: drop.opacity,
            borderRadius: "50%",
          }}
        />
      ))}
    </div>
  );
};
