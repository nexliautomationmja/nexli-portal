import { db } from "@/db";
import { calendarConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// ── Config ───────────────────────────────────────────────

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI!;

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

// ── OAuth Helpers ────────────────────────────────────────

export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.readonly email profile",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: GOOGLE_REDIRECT_URI,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string,
    expiresIn: data.expires_in as number,
  };
}

export async function refreshGoogleToken(refreshToken: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token refresh failed: ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token as string,
    expiresIn: data.expires_in as number,
  };
}

// ── Token Management ─────────────────────────────────────

export async function getValidGoogleToken(userId: string) {
  const [conn] = await db
    .select()
    .from(calendarConnections)
    .where(
      and(
        eq(calendarConnections.userId, userId),
        eq(calendarConnections.provider, "google")
      )
    )
    .limit(1);

  if (!conn) return null;

  // Refresh if token expires within 5 minutes
  if (conn.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
    try {
      const tokens = await refreshGoogleToken(conn.refreshToken);
      await db
        .update(calendarConnections)
        .set({
          accessToken: tokens.accessToken,
          tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
          updatedAt: new Date(),
        })
        .where(eq(calendarConnections.id, conn.id));

      return tokens.accessToken;
    } catch (err) {
      console.error("Google token refresh failed:", err);
      return null;
    }
  }

  return conn.accessToken;
}

// ── User Info ────────────────────────────────────────────

export async function getGoogleUserEmail(accessToken: string): Promise<string> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to get Google user info: ${await res.text()}`);
  }

  const data = await res.json();
  return data.email as string;
}

// ── Calendar Events ──────────────────────────────────────

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  status: string; // "confirmed" | "tentative" | "cancelled"
}

export async function getGoogleCalendarEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string
) {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/primary/events?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar API failed: ${text}`);
  }

  const data = await res.json();
  const items = (data.items || []) as GoogleCalendarEvent[];

  return items.map((evt) => ({
    id: `google_${evt.id}`,
    title: evt.summary || "Google Event",
    startTime: evt.start.dateTime || evt.start.date || "",
    endTime: evt.end.dateTime || evt.end.date || "",
    status: evt.status === "cancelled" ? "cancelled" : "confirmed",
    source: "google" as const,
  }));
}
