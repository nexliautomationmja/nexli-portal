/** Photo ad limits and sizes shared by the browser and the server (client-safe). */
export const PHOTO_MAX = 20;
/** Instagram/Facebook Stories and Reels, 9:16. */
export const STORY_SIZE = { width: 1080, height: 1920 } as const;
/** Feed, 4:5. */
export const FEED_SIZE = { width: 1080, height: 1350 } as const;

export const clampPhotoCount = (n: unknown) => {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : 1;
  return Math.min(PHOTO_MAX, Math.max(1, v));
};
