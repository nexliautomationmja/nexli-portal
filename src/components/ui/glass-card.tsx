"use client";

import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "compact" | "elevated";
}

export function GlassCard({
  className,
  variant = "default",
  children,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        variant === "elevated" ? "glass-card-elevated" : "glass-card",
        variant === "default" && "p-5 md:p-6 rounded-2xl",
        variant === "compact" && "p-4 md:p-5 rounded-xl",
        variant === "elevated" && "p-5 md:p-6 rounded-2xl",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
