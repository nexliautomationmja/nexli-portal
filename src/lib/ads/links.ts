/** Deep links into Meta's tools (pure, client-safe). */

const ADS_MANAGER = "https://adsmanager.facebook.com/adsmanager/manage";

export function adsManagerUrl(account: string, level: "account" | "campaign" | "adset" | "ad", id?: string | null): string {
  const act = encodeURIComponent(account);
  if (level === "campaign" && id) return `${ADS_MANAGER}/campaigns?act=${act}&selected_campaign_ids=${encodeURIComponent(id)}`;
  if (level === "adset" && id) return `${ADS_MANAGER}/adsets?act=${act}&selected_adset_ids=${encodeURIComponent(id)}`;
  if (level === "ad" && id) return `${ADS_MANAGER}/ads?act=${act}&selected_ad_ids=${encodeURIComponent(id)}`;
  return `${ADS_MANAGER}/campaigns?act=${act}`;
}

export const eventsManagerUrl = (pixelId?: string | null) =>
  pixelId ? `https://business.facebook.com/events_manager2/list/pixel/${encodeURIComponent(pixelId)}/overview` : "https://business.facebook.com/events_manager2";
