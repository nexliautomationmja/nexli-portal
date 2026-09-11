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
  params?: Record<string, string>,
  opts?: { version?: string; method?: "GET" | "POST"; body?: unknown }
): Promise<T> {
  const url = new URL(path, GHL_BASE_URL);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    method: opts?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      // Some GHL APIs pin their own Version (conversations = 2021-04-15).
      Version: opts?.version ?? "2021-07-28",
    },
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    throw new Error(
      `GHL API error: ${res.status} ${res.statusText} — ${(await res.text().catch(() => "")).slice(0, 500)}`
    );
  }

  return res.json() as Promise<T>;
}

export async function getContacts(
  locationId: string,
  limit = 20,
  startAfterId?: string
) {
  // v2 GET /contacts/ has no sort params; sorting lives on POST /contacts/search.
  const params: Record<string, string> = { locationId, limit: String(limit) };
  if (startAfterId) params.startAfterId = startAfterId;
  return ghlFetch<GHLContactsResponse>("/contacts/", params);
}

/**
 * The contact count across GHL's response variants: the list endpoint
 * returns `count`, the search endpoint returns `total`. Fall back to the
 * page length so a working call never reads as 0 contacts.
 */
export function contactsCount(res: GHLContactsResponse): number {
  return res.count ?? res.total ?? res.contacts?.length ?? 0;
}

/**
 * Contacts added within a date window, newest first, via POST
 * /contacts/search (the only contacts endpoint with server-side date
 * filtering and full contact objects incl. attributions + customFields).
 * `page` is 1-based.
 */
export async function searchContactsAddedBetween(
  locationId: string,
  since: Date,
  until: Date,
  page = 1,
  pageLimit = 100
) {
  return ghlFetch<GHLContactsResponse>("/contacts/search", undefined, {
    method: "POST",
    body: {
      locationId,
      page,
      pageLimit,
      filters: [
        {
          field: "dateAdded",
          operator: "range",
          value: { gte: since.toISOString(), lte: until.toISOString() },
        },
      ],
      sort: [{ field: "dateAdded", direction: "desc" }],
    },
  });
}

/** Custom field definitions for a location (id → name / fieldKey). */
export async function getCustomFields(locationId: string) {
  return ghlFetch<GHLCustomFieldsResponse>(
    `/locations/${locationId}/customFields`,
    {}
  );
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
  // /opportunities/search (Version 2021-07-28) takes snake_case ids.
  const params: Record<string, string> = { location_id: locationId };
  if (pipelineId) params.pipeline_id = pipelineId;
  return ghlFetch<GHLOpportunitiesResponse>("/opportunities/search", params);
}

// ── Type definitions ──────────────────────────────────

/**
 * One attribution record. GHL's `attributions[]` history uses utm* keys plus
 * `utmSessionSource`; the older `attributionSource` object uses `campaign`
 * and `sessionSource`. Both shapes are covered here.
 */
export interface GHLAttribution {
  isFirst?: boolean;
  url?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  campaign?: string;
  utmContent?: string;
  utmTerm?: string;
  utmKeyword?: string;
  utmSessionSource?: string;
  sessionSource?: string;
  medium?: string;
  referrer?: string;
  fbclid?: string;
  gclid?: string;
}

export interface GHLContactCustomField {
  id: string;
  value?: unknown;
  /** Some responses inline the key instead of only the id. */
  key?: string;
  fieldKey?: string;
}

export interface GHLContact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateAdded: string;
  source?: string;
  tags?: string[];
  attributions?: GHLAttribution[];
  attributionSource?: GHLAttribution;
  lastAttributionSource?: GHLAttribution;
  customFields?: GHLContactCustomField[];
  /** Older responses use the singular key. */
  customField?: GHLContactCustomField[];
}

export interface GHLCustomFieldDefinition {
  id: string;
  name?: string;
  fieldKey?: string;
}

export interface GHLCustomFieldsResponse {
  customFields: GHLCustomFieldDefinition[];
}

export interface GHLContactsResponse {
  contacts: GHLContact[];
  /** GET /contacts/ returns `count`; POST /contacts/search returns `total`. */
  count?: number;
  total?: number;
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
  /** Search responses carry pagination info under `meta`. */
  meta?: { total?: number };
  total?: number;
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
  // GHL wants epoch milliseconds for the event window.
  return ghlFetch<GHLCalendarEventsResponse>("/calendars/events", {
    locationId,
    calendarId,
    startTime: String(new Date(startDate).getTime()),
    endTime: String(new Date(endDate).getTime()),
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
  return ghlFetch<GHLConversationsSearchResponse>(
    "/conversations/search",
    {
      locationId,
      limit: String(limit),
    },
    { version: "2021-04-15" }
  );
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

// ── Extended API functions for GHL Wrapper Portal ─────

export async function searchContacts(
  locationId: string,
  query: string,
  limit = 20,
  startAfterId?: string
) {
  const params: Record<string, string> = {
    locationId,
    limit: String(limit),
    query,
  };
  if (startAfterId) params.startAfterId = startAfterId;
  return ghlFetch<GHLContactsResponse>("/contacts/", params);
}

export async function getContactById(locationId: string, contactId: string) {
  return ghlFetch<{ contact: GHLContact }>(`/contacts/${contactId}`, {});
}

export async function updateOpportunityStage(
  opportunityId: string,
  stageId: string,
  pipelineId: string
) {
  const url = new URL(
    `/opportunities/${opportunityId}`,
    GHL_BASE_URL
  );

  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
    body: JSON.stringify({ pipelineStageId: stageId, pipelineId }),
  });

  if (!res.ok) {
    throw new Error(
      `GHL API error: ${res.status} ${res.statusText} — ${(await res.text().catch(() => "")).slice(0, 500)}`
    );
  }

  return res.json();
}

export async function sendMessage(
  conversationId: string,
  message: string,
  type: string = "SMS"
) {
  const url = new URL(
    `/conversations/messages`,
    GHL_BASE_URL
  );

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
    body: JSON.stringify({
      type,
      conversationId,
      message,
    }),
  });

  if (!res.ok) {
    throw new Error(
      `GHL API error: ${res.status} ${res.statusText} — ${(await res.text().catch(() => "")).slice(0, 500)}`
    );
  }

  return res.json();
}
