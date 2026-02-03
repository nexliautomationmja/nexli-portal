const GHL_BASE_URL = "https://services.leadconnectorhq.com";

let _apiKey: string | null = null;

function getApiKey(): string {
  if (!_apiKey) {
    _apiKey = process.env.GHL_API_KEY!;
  }
  return _apiKey;
}

async function ghlFetch<T>(
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(path, GHL_BASE_URL);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
  });

  if (!res.ok) {
    throw new Error(`GHL API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export async function getContacts(locationId: string, limit = 20) {
  return ghlFetch<GHLContactsResponse>("/contacts/", {
    locationId,
    limit: String(limit),
    sortBy: "date_added",
  });
}

export async function getPipelines(locationId: string) {
  return ghlFetch<GHLPipelinesResponse>("/opportunities/pipelines", {
    locationId,
  });
}

export async function getOpportunities(
  locationId: string,
  pipelineId?: string
) {
  const params: Record<string, string> = { locationId };
  if (pipelineId) params.pipelineId = pipelineId;
  return ghlFetch<GHLOpportunitiesResponse>("/opportunities/search", params);
}

// ── Type definitions ──────────────────────────────────

export interface GHLContact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateAdded: string;
  source?: string;
}

export interface GHLContactsResponse {
  contacts: GHLContact[];
  total: number;
}

export interface GHLPipeline {
  id: string;
  name: string;
  stages: { id: string; name: string }[];
}

export interface GHLPipelinesResponse {
  pipelines: GHLPipeline[];
}

export interface GHLOpportunity {
  id: string;
  name: string;
  monetaryValue?: number;
  pipelineStageId: string;
  status: string;
  createdAt: string;
  contact?: { id: string; name: string };
}

export interface GHLOpportunitiesResponse {
  opportunities: GHLOpportunity[];
  total: number;
}

// ── Calendar types ────────────────────────────────────

export interface GHLCalendar {
  id: string;
  name: string;
  locationId: string;
}

export interface GHLCalendarsResponse {
  calendars: GHLCalendar[];
}

export interface GHLCalendarEvent {
  id: string;
  calendarId: string;
  title?: string;
  status: string;
  contactId: string;
  startTime: string;
  endTime: string;
  createdAt?: string;
}

export interface GHLCalendarEventsResponse {
  events: GHLCalendarEvent[];
}

// ── Conversation types ────────────────────────────────

export interface GHLConversation {
  id: string;
  contactId: string;
  locationId: string;
  dateAdded: string;
  lastMessageDate?: string;
}

export interface GHLConversationsSearchResponse {
  conversations: GHLConversation[];
  total: number;
}

export interface GHLMessage {
  id: string;
  conversationId: string;
  contactId: string;
  direction: "inbound" | "outbound";
  type: string;
  dateAdded: string;
  body?: string;
  messageType?: string;
}

// The GHL API returns { messages: { messages: [...], nextPage, lastMessageId } }
interface GHLConversationMessagesRawResponse {
  messages: {
    messages: GHLMessage[];
    nextPage?: boolean;
    lastMessageId?: string;
  };
}

// ── Calendar / Conversation API functions ─────────────

export async function getCalendars(locationId: string) {
  return ghlFetch<GHLCalendarsResponse>("/calendars/", {
    locationId,
  });
}

export async function getCalendarEvents(
  locationId: string,
  calendarId: string,
  startDate: string,
  endDate: string
) {
  return ghlFetch<GHLCalendarEventsResponse>("/calendars/events", {
    locationId,
    calendarId,
    startTime: startDate,
    endTime: endDate,
  });
}

/** Fetch events from ALL calendars in a location. */
export async function getAllCalendarEvents(
  locationId: string,
  startDate: string,
  endDate: string
): Promise<GHLCalendarEvent[]> {
  const { calendars } = await getCalendars(locationId);
  if (!calendars.length) return [];

  const results = await Promise.all(
    calendars.map((cal) =>
      getCalendarEvents(locationId, cal.id, startDate, endDate).catch(() => ({
        events: [],
      }))
    )
  );

  return results.flatMap((r) => r.events ?? []);
}

export async function searchConversations(
  locationId: string,
  limit = 50
) {
  return ghlFetch<GHLConversationsSearchResponse>("/conversations/search", {
    locationId,
    limit: String(limit),
  });
}

export async function getConversationMessages(
  conversationId: string,
  limit = 50
): Promise<{ messages: GHLMessage[] }> {
  const raw = await ghlFetch<GHLConversationMessagesRawResponse>(
    `/conversations/${conversationId}/messages`,
    { limit: String(limit) }
  );

  // GHL nests messages inside messages: { messages: [...] }
  const msgs = raw?.messages?.messages ?? [];
  return { messages: msgs };
}
