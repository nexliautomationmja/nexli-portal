"use client";

import { useTheme } from "@/components/theme-provider";
import Image from "next/image";

interface NexliLogoProps {
  iconSize?: string;
  textSize?: string;
  gradientId?: string;
}

export function NexliLogo({
  iconSize = "w-8 h-8",
  textSize = "text-xl",
  gradientId = "logo-grad",
}: NexliLogoProps) {
  const { theme } = useTheme();

  return (
    <span className="inline-flex items-center gap-2">
      {theme === "dark" ? (
        <svg className={iconSize} viewBox="0 0 48 48" fill="none">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
          </defs>
          <path d="M4 36L20 24L4 12L4 20L12 24L4 28L4 36Z" fill="#2563EB" />
          <path d="M12 36L28 24L12 12L12 18L18 24L12 30L12 36Z" fill={`url(#${gradientId})`} />
          <path d="M20 36L44 24L20 12L20 18L32 24L20 30L20 36Z" fill="#06B6D4" />
        </svg>
      ) : (
        <Image
          src="/logos/icon-light.svg"
          alt="Nexli"
          width={32}
          height={32}
          className={iconSize}
        />
      )}
      <span
        className={`${textSize} font-black tracking-tighter`}
        style={{ fontFamily: "'Syne', sans-serif", color: "var(--text-main)" }}
      >
        NEXLI
      </span>
    </span>
  );
}
