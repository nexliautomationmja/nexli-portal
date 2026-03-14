'use client';
import React from 'react';
import { motion } from 'framer-motion';

interface ShimmerButtonProps {
  children: React.ReactNode;
  className?: string;
  href?: string;
  onClick?: () => void;
  theme?: 'light' | 'dark';
}

export const ShimmerButton: React.FC<ShimmerButtonProps> = ({
  children,
  className = '',
  href,
  onClick,
  theme = 'dark'
}) => {
  const baseStyles = `
    relative inline-flex items-center justify-center gap-3
    px-8 py-4 rounded-full text-base font-bold
    overflow-hidden cursor-pointer
    transition-transform duration-200
    hover:scale-105 active:scale-95
  `;

  const themeStyles = theme === 'dark'
    ? 'bg-slate-950 text-white shadow-[0_0_0_3px_rgba(255,255,255,0.1)_inset]'
    : 'bg-white text-slate-900 shadow-[0_0_0_3px_rgba(0,0,0,0.06)_inset,0_4px_20px_rgba(0,0,0,0.1)]';

  const content = (
    <>
      {/* Shimmer effect - animated gradient border */}
      <span
        className="absolute inset-0 overflow-hidden rounded-full"
        style={{ padding: '2px' }}
      >
        <span
          className="absolute inset-[-100%] animate-[shimmer_2s_linear_infinite]"
          style={{
            background: theme === 'dark'
              ? 'conic-gradient(from 90deg at 50% 50%, #3b82f6 0%, transparent 50%, transparent 75%, #06b6d4 100%)'
              : 'conic-gradient(from 90deg at 50% 50%, #2563eb 0%, transparent 50%, transparent 75%, #0891b2 100%)'
          }}
        />
      </span>

      {/* Inner background to cover the shimmer except at edges */}
      <span
        className={`absolute inset-[2px] rounded-full ${
          theme === 'dark' ? 'bg-slate-950' : 'bg-white'
        }`}
      />

      {/* Radial glow on hover */}
      <span
        className={`absolute inset-0 rounded-full opacity-0 hover:opacity-100 transition-opacity duration-300 ${
          theme === 'dark'
            ? 'bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.15),transparent_70%)]'
            : 'bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.1),transparent_70%)]'
        }`}
      />

      {/* Button content */}
      <span className="relative z-10 flex items-center gap-3">
        {children}
      </span>

      {/* Bottom highlight for depth */}
      <span
        className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-px ${
          theme === 'dark'
            ? 'bg-gradient-to-r from-transparent via-blue-400/50 to-transparent'
            : 'bg-gradient-to-r from-transparent via-blue-500/30 to-transparent'
        }`}
      />
    </>
  );

  // Add the shimmer keyframes to the document if not already present
  React.useEffect(() => {
    const styleId = 'shimmer-button-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes shimmer {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  if (href) {
    return (
      <motion.a
        href={href}
        className={`${baseStyles} ${themeStyles} ${className}`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {content}
      </motion.a>
    );
  }

  return (
    <motion.button
      onClick={onClick}
      className={`${baseStyles} ${themeStyles} ${className}`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {content}
    </motion.button>
  );
};

export default ShimmerButton;
