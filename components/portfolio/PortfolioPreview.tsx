'use client';
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { BorderBeam } from '../ui/BorderBeam';

interface PortfolioPreviewProps {
  title: string;
  subtitle: string;
  slug: string;
  accentColor: string;
  onNavigate: (slug: string) => void;
  children: React.ReactNode;
}

// Desktop: render at full desktop width, scale to fit browser frame
const DESKTOP_WIDTH = 1440;
// Mobile: render at iPhone viewport width, scale to fit phone frame
const PHONE_WIDTH = 390;
// iPhone 15 Pro aspect ratio
const PHONE_ASPECT = 852 / 393;

const PortfolioPreview: React.FC<PortfolioPreviewProps> = ({
  title,
  subtitle,
  slug,
  accentColor,
  onNavigate,
  children,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const screenRef = useRef<HTMLDivElement>(null);
  const [screenWidth, setScreenWidth] = useState(0);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Re-measure when switching between mobile/desktop since the ref element changes
  useEffect(() => {
    const el = screenRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setScreenWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobile]);

  const renderWidth = isMobile ? PHONE_WIDTH : DESKTOP_WIDTH;
  const scale = screenWidth > 0 ? screenWidth / renderWidth : 0;

  // Shared scroll content used by both frames
  // IMPORTANT: scale and scroll animation are on SEPARATE elements
  // to avoid CSS animation overriding the inline transform: scale()
  const scrollContent = (
    <>
      {/* Scale wrapper */}
      <div
        className="absolute top-0 left-0"
        style={{
          width: `${renderWidth}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {/* Scroll animation wrapper */}
        <div
          style={{
            animationName: 'portfolioScroll',
            animationDuration: '25s',
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
            animationPlayState: isHovered ? 'paused' : 'running',
          }}
        >
          <div className="pointer-events-none select-none">{children}</div>
        </div>
      </div>

      {/* Hover overlay */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-opacity duration-300 z-20"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `linear-gradient(180deg, ${accentColor}08 0%, ${accentColor}18 100%)`,
          backdropFilter: isHovered ? 'blur(2px)' : 'none',
        }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={isHovered ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className={`rounded-full text-white font-bold shadow-xl ${
            isMobile ? 'px-3 py-1.5 text-[10px]' : 'px-5 py-2.5 text-xs'
          }`}
          style={{ backgroundColor: accentColor }}
        >
          {isMobile ? 'View' : 'View Project'}
        </motion.div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/25 to-transparent z-10 pointer-events-none" />
    </>
  );

  if (isMobile) {
    // ==================
    // iPhone Frame
    // ==================
    return (
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
        className="group cursor-pointer flex flex-col items-center w-full"
        onClick={() => onNavigate(slug)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className="relative transition-all duration-500 w-full"
          style={{
            transform: isHovered ? 'scale(1.03)' : 'scale(1)',
          }}
        >
          {/* iPhone outer shell */}
          <div
            className="relative overflow-hidden"
            style={{
              borderRadius: '1.8rem',
              border: '4px solid',
              borderColor: 'var(--text-main)',
              aspectRatio: `1 / ${PHONE_ASPECT}`,
              boxShadow: isHovered
                ? `0 20px 40px -10px ${accentColor}35, 0 0 30px ${accentColor}12`
                : '0 15px 35px -10px rgba(0,0,0,0.2)',
            }}
          >
            {isHovered && (
              <BorderBeam
                size={180}
                duration={4}
                colorFrom={accentColor}
                colorTo={`${accentColor}88`}
                className="rounded-[1.5rem]"
              />
            )}

            {/* Dynamic Island */}
            <div className="absolute top-0 left-0 right-0 z-30 flex justify-center pt-1.5 pointer-events-none">
              <div
                className="rounded-full"
                style={{
                  width: '35%',
                  height: 14,
                  backgroundColor: '#000000',
                }}
              />
            </div>

            {/* Screen content area */}
            <div
              ref={screenRef}
              className="absolute inset-0 overflow-hidden bg-white"
              style={{ borderRadius: '1.4rem' }}
            >
              {scrollContent}
            </div>

            {/* Home indicator bar */}
            <div className="absolute bottom-0 left-0 right-0 z-30 flex justify-center pb-1 pointer-events-none">
              <div
                className="rounded-full"
                style={{
                  width: '35%',
                  height: 3,
                  backgroundColor: 'rgba(255,255,255,0.3)',
                }}
              />
            </div>
          </div>

          {/* Side button (power) */}
          <div
            className="absolute pointer-events-none"
            style={{
              right: -5,
              top: '28%',
              width: 2,
              height: 24,
              borderRadius: 2,
              backgroundColor: 'var(--text-main)',
            }}
          />
          {/* Volume buttons */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: -5,
              top: '22%',
              width: 2,
              height: 14,
              borderRadius: 2,
              backgroundColor: 'var(--text-main)',
            }}
          />
          <div
            className="absolute pointer-events-none"
            style={{
              left: -5,
              top: '30%',
              width: 2,
              height: 14,
              borderRadius: 2,
              backgroundColor: 'var(--text-main)',
            }}
          />
        </div>

        {/* Label below phone */}
        <div className="mt-3 text-center">
          <h3 className="text-xs font-bold text-[var(--text-main)]">{title}</h3>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
            <span className="text-[8px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              {subtitle}
            </span>
          </div>
        </div>
      </motion.div>
    );
  }

  // ==================
  // Desktop Browser Frame
  // ==================
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      className="group cursor-pointer flex flex-col items-center w-full"
      onClick={() => onNavigate(slug)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className="relative w-full transition-all duration-500 rounded-xl overflow-hidden"
        style={{
          transform: isHovered ? 'scale(1.02) translateY(-4px)' : 'scale(1)',
          boxShadow: isHovered
            ? `0 30px 60px -15px ${accentColor}30, 0 0 40px ${accentColor}10`
            : '0 20px 50px -15px rgba(0,0,0,0.2)',
          border: '1px solid',
          borderColor: isHovered ? `${accentColor}40` : 'var(--glass-border)',
        }}
      >
        {isHovered && (
          <BorderBeam
            size={300}
            duration={4}
            colorFrom={accentColor}
            colorTo={`${accentColor}88`}
          />
        )}

        {/* Browser chrome bar */}
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{
            background: 'var(--glass-bg)',
            borderBottom: '1px solid var(--glass-border)',
          }}
        >
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div
            className="flex-1 mx-3 px-3 py-1 rounded-md text-[10px] font-medium tracking-wide"
            style={{
              background: 'var(--bg-main)',
              color: 'var(--text-muted)',
              border: '1px solid var(--glass-border)',
            }}
          >
            {slug}.com
          </div>
        </div>

        {/* Browser content viewport */}
        <div
          ref={screenRef}
          className="relative overflow-hidden bg-white"
          style={{ aspectRatio: '16 / 10' }}
        >
          {scrollContent}
        </div>
      </div>

      {/* Label below browser */}
      <div className="mt-5 text-center">
        <h3 className="text-base sm:text-lg font-bold text-[var(--text-main)]">
          {title}
        </h3>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
          <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
            {subtitle}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default PortfolioPreview;
