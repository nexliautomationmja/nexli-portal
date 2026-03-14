'use client';
"use client"

import { motion } from "framer-motion"
import { cn } from "../../lib/utils"

interface BorderBeamProps {
  size?: number
  duration?: number
  delay?: number
  colorFrom?: string
  colorTo?: string
  className?: string
  reverse?: boolean
}

export const BorderBeam = ({
  className,
  size = 200,
  delay = 0,
  duration = 8,
  colorFrom = "#ffaa40",
  colorTo = "#9c40ff",
  reverse = false,
}: BorderBeamProps) => {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit]",
        className
      )}
      style={{
        overflow: "hidden",
        padding: "1.5px",
        WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
        WebkitMaskComposite: "xor",
        maskComposite: "exclude",
      }}
    >
      <motion.div
        className="absolute inset-[-100%]"
        style={{
          background: `conic-gradient(from 0deg at 50% 50%, transparent 0deg, ${colorFrom} 60deg, ${colorTo} 120deg, transparent 180deg)`,
        }}
        animate={{
          rotate: reverse ? [360, 0] : [0, 360],
        }}
        transition={{
          duration,
          repeat: Infinity,
          ease: "linear",
          delay,
        }}
      />
    </div>
  )
}
