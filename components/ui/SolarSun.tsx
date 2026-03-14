'use client';
import React from "react";

interface SolarSunProps {
  className?: string;
}

export const SolarSun: React.FC<SolarSunProps> = ({ className }) => {
  return (
    <div className={className} style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* Sky gradient background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, #0ea5e9 0%, #38bdf8 30%, #7dd3fc 60%, #e0f2fe 100%)',
        }}
      />

      {/* Sun orb - positioned upper-right area */}
      <div
        style={{
          position: 'absolute',
          top: '8%',
          right: '15%',
          width: '120px',
          height: '120px',
        }}
      >
        {/* Outer glow pulse */}
        <div
          className="animate-sun-pulse"
          style={{
            position: 'absolute',
            inset: '-60px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(251,191,36,0.25) 0%, rgba(251,191,36,0.08) 40%, transparent 70%)',
          }}
        />

        {/* Mid glow */}
        <div
          style={{
            position: 'absolute',
            inset: '-30px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(253,224,71,0.4) 0%, rgba(251,191,36,0.15) 50%, transparent 70%)',
          }}
        />

        {/* Sun core */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #fef3c7 0%, #fbbf24 40%, #f59e0b 100%)',
            boxShadow: '0 0 60px rgba(251,191,36,0.6), 0 0 120px rgba(251,191,36,0.3), 0 0 200px rgba(251,191,36,0.15)',
          }}
        />

        {/* Rotating rays */}
        <div
          className="animate-sun-rotate"
          style={{
            position: 'absolute',
            inset: '-40px',
          }}
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '2px',
                height: '40px',
                marginLeft: '-1px',
                marginTop: '-20px',
                transformOrigin: '1px 60px',
                transform: `rotate(${i * 30}deg)`,
                background: 'linear-gradient(to bottom, rgba(253,224,71,0.6), transparent)',
                borderRadius: '1px',
              }}
            />
          ))}
        </div>
      </div>

      {/* Soft lens flare streaks */}
      <div
        style={{
          position: 'absolute',
          top: '5%',
          right: '10%',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(ellipse at center, rgba(251,191,36,0.08) 0%, transparent 70%)',
          transform: 'rotate(-20deg)',
        }}
      />

      {/* Floating cloud-like wisps */}
      <div
        className="animate-cloud-drift"
        style={{
          position: 'absolute',
          bottom: '15%',
          left: '-5%',
          width: '250px',
          height: '60px',
          borderRadius: '30px',
          background: 'rgba(255,255,255,0.3)',
          filter: 'blur(20px)',
        }}
      />
      <div
        className="animate-cloud-drift-slow"
        style={{
          position: 'absolute',
          bottom: '25%',
          left: '20%',
          width: '200px',
          height: '40px',
          borderRadius: '20px',
          background: 'rgba(255,255,255,0.2)',
          filter: 'blur(15px)',
        }}
      />
      <div
        className="animate-cloud-drift"
        style={{
          position: 'absolute',
          top: '40%',
          right: '-3%',
          width: '180px',
          height: '45px',
          borderRadius: '22px',
          background: 'rgba(255,255,255,0.25)',
          filter: 'blur(18px)',
          animationDelay: '3s',
        }}
      />

      {/* Light particles / dust motes */}
      {Array.from({ length: 15 }).map((_, i) => {
        const seed = (i * 7 + 3) % 15;
        const size = 2 + (seed / 15) * 3;
        const top = 10 + ((i * 13 + 5) % 15) / 15 * 70;
        const left = (i * 17 % 15) / 15 * 100;
        const delay = (i / 15) * 5;
        const duration = 3 + (seed / 15) * 4;
        return (
        <div
          key={i}
          className="animate-float-particle"
          style={{
            position: 'absolute',
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            background: 'rgba(253,224,71,0.4)',
            top: `${top}%`,
            left: `${left}%`,
            animationDelay: `${delay}s`,
            animationDuration: `${duration}s`,
          }}
        />
      );})}
    </div>
  );
};
