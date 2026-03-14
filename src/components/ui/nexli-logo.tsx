interface NexliLogoProps {
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "h-6",
  md: "h-7",
  lg: "h-9",
};

export function NexliLogo({ size = "md" }: NexliLogoProps) {
  const h = sizeMap[size];
  return (
    <span className="inline-flex items-center">
      {/* Dark mode */}
      <img
        src="/logos/nexli-logo-white-wordmark@2x.png"
        alt="Nexli"
        className={`${h} w-auto logo-icon-dark`}
      />
      {/* Light mode */}
      <img
        src="/logos/nexli-logo-dark-wordmark@2x.png"
        alt="Nexli"
        className={`${h} w-auto logo-icon-light`}
      />
    </span>
  );
}
