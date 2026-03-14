'use client';
import React, { useState } from 'react';
import { Dock, DockIcon } from './Dock';

type IconProps = React.SVGAttributes<SVGElement>;

const Icons = {
  instagram: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"
        fill="currentColor"
      />
    </svg>
  ),
  mail: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M22 6l-10 7L2 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  check: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M20 6L9 17L4 12"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
};

interface SocialDockProps {
  instagramUrl?: string;
}

const SocialDock: React.FC<SocialDockProps> = ({
  instagramUrl = '#',
}) => {
  const [emailCopied, setEmailCopied] = useState(false);

  const handleEmailClick = () => {
    navigator.clipboard.writeText('mail@nexli.net');
    window.location.href = 'mailto:mail@nexli.net';
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
  };

  return (
    <Dock iconMagnification={60} iconDistance={100}>
      {/* Instagram - Authentic gradient */}
      <DockIcon href={instagramUrl}>
        <div
          className="w-full h-full rounded-full flex items-center justify-center p-2 relative overflow-hidden"
          style={{
            background: 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)',
            boxShadow: '0 4px 12px rgba(214, 36, 159, 0.4), inset 0 1px 1px rgba(255,255,255,0.2)'
          }}
        >
          <Icons.instagram className="w-5 h-5 text-white relative z-10" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }} />
        </div>
      </DockIcon>

      {/* Mail - Blue gradient, copies email + opens mailto */}
      <DockIcon onClick={handleEmailClick}>
        <div
          className="w-full h-full rounded-full flex items-center justify-center p-2 relative overflow-hidden transition-all duration-300"
          style={{
            background: emailCopied
              ? 'linear-gradient(135deg, #22c55e, #16a34a)'
              : 'linear-gradient(135deg, #2563EB, #06B6D4)',
            boxShadow: emailCopied
              ? '0 4px 12px rgba(34,197,94,0.4), inset 0 1px 1px rgba(255,255,255,0.2)'
              : '0 4px 12px rgba(37,99,235,0.4), inset 0 1px 1px rgba(255,255,255,0.2)'
          }}
        >
          {emailCopied
            ? <Icons.check className="w-5 h-5 text-white relative z-10" />
            : <Icons.mail className="w-5 h-5 text-white relative z-10" />
          }
        </div>
      </DockIcon>
    </Dock>
  );
};

export default SocialDock;
