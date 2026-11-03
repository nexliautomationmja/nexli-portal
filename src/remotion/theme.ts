import { loadFont as loadOutfit } from "@remotion/google-fonts/Outfit";
import { loadFont as loadJakarta } from "@remotion/google-fonts/PlusJakartaSans";

/** Nexli brand (editing rulebook § Brand). No watermark, no logo on video. */
export const BRAND = {
  gradient: "linear-gradient(90deg, #2563EB, #06B6D4)",
  blue: "#2563EB",
  cyan: "#06B6D4",
  money: "#22C55E",
  negative: "#EF4444",
  qualifier: "linear-gradient(90deg, #DC2626, #991B1B)",
  panel: "rgba(10, 14, 30, 0.95)",
};

export const { fontFamily: OUTFIT } = loadOutfit("normal", { weights: ["700", "800"], subsets: ["latin"] });
export const { fontFamily: JAKARTA } = loadJakarta("normal", { weights: ["600", "700", "800"], subsets: ["latin"] });

/** Card pop-in spring, used consistently (rulebook). */
export const POP = { damping: 13, stiffness: 145, mass: 0.8 };

/** Vertical 1080×1920: every graphic lives inside this band (4:5 feed crop top, Reels chrome bottom). */
export const FB_SAFE_TOP = 285;
export const FB_SAFE_BOTTOM = 1248;

export const isMoney = (w: string) => /\$/.test(w) || /^\d[\d,.]*(K|M|B)?%?$/.test(w);
