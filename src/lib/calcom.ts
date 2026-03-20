import { db } from "@/db";
import { calendarConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// ── Config ───────────────────────────────────────────────

const CALCOM_CLIENT_ID = process.env.CALCOM_CLIENT_ID!;
const CALCOM_CLIENT_SECRET = process.env.CALCOM_CLIENT_SECRET!;
const CALCOM_REDIRECT_URI = process.env.CALCOM_REDIRECT_URI!;

const CALCOM_AUTH_URL = "https://app.cal.com/auth/oauth2/authorize";
const CALCOM_TOKEN_URL = "https://app.cal.com/api/auth/oauth2/token";
const CALCOM_API_URL = "https://api.cal.com/v2";

// ── OAuth Helpers ────────────────────────────────────────

export function getCalcomAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CALCOM_CLIENT_ID,
    redirect_uri: CALCOM_REDIRECT_URI,
    response_type: "code",
    state,
  });
  return `${CALCOM_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCalcomCode(code: string) {
  const res = await fetch(CALCOM_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: CALCOM_REDIRECT_URI,
      client_id: CALCOM_CLIENT_ID,
      client_secret: CALCOM_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cal.com token exchange failed: ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string,
    expiresIn: (data.expires_in as number) || 3600,
  };
}

export async function refreshCalcomToken(refreshToken: string) {
  const res = await fetch(CALCOM_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CALCOM_CLIENT_ID,
      client_secret: CALCOM_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cal.com token refresh failed: ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token as string,
    refreshToken: (data.refresh_token as string) || refreshToken,
    expiresIn: (data.expires_in as number) || 3600,
  };
}

// ── Token Management ─────────────────────────────────────

export async function getValidCalcomToken(userId: string) {
  const [conn] = await db
    .select()
    .from(calendarConnections)
    .where(
      and(
        eq(calendarConnections.userId, userId),
        eq(calendarConnections.provider, "calcom")
      )
    )
    .limit(1);

  if (!conn) return null;

  // Refresh if token expires within 5 minutes
  if (conn.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
    try {
      const tokens = await refreshCalcomToken(conn.refreshToken);
      await db
        .update(calendarConnections)
        .set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
          updatedAt: new Date(),
        })
        .where(eq(calendarConnections.id, conn.id));

      return tokens.accessToken;
    } catch (err) {
      console.error("Cal.com token refresh failed:", err);
      return null;
    }
  }

  return conn.accessToken;
}

// ── User Info ────────────────────────────────────────────

export async function getCalcomUserEmail(accessToken: string): Promise<string> {
  const res = await fetch(`${CALCOM_API_URL}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "cal-api-version": "2024-08-13",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to get Cal.com user info: ${await res.text()}`);
  }

  const data = await res.json();
  return (data.data?.email || data.email || "Cal.com User") as string;
}

// ── Bookings ─────────────────────────────────────────────

interface CalcomBooking {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  status: string; // "accepted" | "pending" | "cancelled" | "rejected"
}

export async function getCalcomBookings(
  accessToken: string,
  afterStart: string,
  beforeEnd: string
) {
  const params = new URLSearchParams({
    "afterStart": afterStart,
    "beforeEnd": beforeEnd,
    status: "upcoming,past,recurring",
  });

  const res = await fetch(`${CALCOM_API_URL}/bookings?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "cal-api-version": "2024-08-13",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cal.com Bookings API failed: ${text}`);
  }

  const data = await res.json();
  const bookings = (data.data || []) as CalcomBooking[];

  return bookings.map((b) => ({
    id: `calcom_${b.id}`,
    title: b.title || "Cal.com Booking",
    startTime: b.startTime,
    endTime: b.endTime,
    status:
      b.status === "cancelled" || b.status === "rejected"
        ? "cancelled"
        : b.status === "pending"
        ? "pending"
        : "confirmed",
    source: "calcom" as const,
  }));
}
