'use client';
import React, { useRef, createContext, useContext } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface DockContextType {
  mouseX: ReturnType<typeof useMotionValue<number>>;
  iconMagnification: number;
  iconDistance: number;
}

const DockContext = createContext<DockContextType | null>(null);

interface DockProps {
  children: React.ReactNode;
  iconMagnification?: number;
  iconDistance?: number;
  className?: string;
}

export const Dock: React.FC<DockProps> = ({
  children,
  iconMagnification = 60,
  iconDistance = 100,
  className = ''
}) => {
  const mouseX = useMotionValue(Infinity);

  return (
    <DockContext.Provider value={{ mouseX, iconMagnification, iconDistance }}>
      <motion.div
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        className={`flex items-end gap-3 px-4 py-3 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-xl shadow-2xl ${className}`}
        style={{
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), inset 0 1px 1px rgba(255, 255, 255, 0.1)'
        }}
      >
        {children}
      </motion.div>
    </DockContext.Provider>
  );
};

interface DockIconProps {
  children: React.ReactNode;
  className?: string;
  href?: string;
  onClick?: () => void;
}

export const DockIcon: React.FC<DockIconProps> = ({
  children,
  className = '',
  href,
  onClick
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const context = useContext(DockContext);

  if (!context) {
    throw new Error('DockIcon must be used within a Dock');
  }

  const { mouseX, iconMagnification, iconDistance } = context;

  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const baseSize = 40;

  const widthSync = useTransform(
    distance,
    [-iconDistance, 0, iconDistance],
    [baseSize, iconMagnification, baseSize]
  );

  const width = useSpring(widthSync, {
    mass: 0.1,
    stiffness: 150,
    damping: 12
  });

  const content = (
    <motion.div
      ref={ref}
      style={{ width, height: width }}
      className={`relative flex items-center justify-center rounded-xl cursor-pointer transition-colors ${className}`}
    >
      {children}
    </motion.div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}>
        {content}
      </a>
    );
  }

  if (onClick) {
    return (
      <button onClick={onClick} className="bg-transparent border-none p-0 cursor-pointer">
        {content}
      </button>
    );
  }

  return content;
};

export default Dock;
