import {
  getConversationMessages,
  type GHLContact,
  type GHLCalendarEvent,
  type GHLConversation,
} from "@/lib/ghl-client";
import type {
  GHLMetricsData,
  ConversionFunnelData,
  SpeedToLeadData,
} from "@/lib/types/ghl-metrics";

export function emptySpeedToLead(): SpeedToLeadData {
  return {
    averageResponseMinutes: 0,
    medianResponseMinutes: 0,
    distribution: { under5min: 0, from5to30min: 0, over30min: 0 },
    performanceRating: "green",
    aiResponses: 0,
    humanResponses: 0,
    totalMeasured: 0,
  };
}

export function emptyMetrics(): GHLMetricsData {
  return {
    conversion: {
      totalLeads: 0,
      respondedLeads: 0,
      bookedConsultations: 0,
      conversionRate: 0,
      previousConversionRate: null,
      benchmarkLow: 30,
      benchmarkHigh: 50,
    },
    speedToLead: emptySpeedToLead(),
  };
}

export function computeConversionFunnel(
  contacts: GHLContact[],
  events: GHLCalendarEvent[],
  conversations: GHLConversation[]
): ConversionFunnelData {
  const totalLeads = contacts.length;

  const contactIdsWithConversation = new Set(
    conversations.map((c) => c.contactId)
  );
  const respondedLeads = contacts.filter((c) =>
    contactIdsWithConversation.has(c.id)
  ).length;

  const contactIdSet = new Set(contacts.map((c) => c.id));
  const bookedEvents = events.filter(
    (e) => contactIdSet.has(e.contactId) && e.status !== "cancelled"
  );
  const bookedConsultations = new Set(
    bookedEvents.map((e) => e.contactId)
  ).size;

  const conversionRate =
    totalLeads > 0
      ? Math.round((bookedConsultations / totalLeads) * 1000) / 10
      : 0;

  return {
    totalLeads,
    respondedLeads,
    bookedConsultations,
    conversionRate,
    previousConversionRate: null,
    benchmarkLow: 30,
    benchmarkHigh: 50,
  };
}

export async function computeSpeedToLead(
  contacts: GHLContact[],
  conversations: GHLConversation[]
): Promise<SpeedToLeadData> {
  const contactDates = new Map(
    contacts.map((c) => [c.id, new Date(c.dateAdded)])
  );

  const relevantConvos = conversations.filter((c) =>
    contactDates.has(c.contactId)
  );

  const responseTimes: { minutes: number; isAi: boolean }[] = [];

  const BATCH_SIZE = 10;
  for (let i = 0; i < relevantConvos.length; i += BATCH_SIZE) {
    const batch = relevantConvos.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((convo) =>
        getConversationMessages(convo.id, 20).catch(() => ({
          messages: [],
        }))
      )
    );

    for (let j = 0; j < batch.length; j++) {
      const convo = batch[j];
      const messages = results[j].messages;
      const contactAdded = contactDates.get(convo.contactId);
      if (!contactAdded) continue;

      const firstOutbound = messages
        .filter((m) => m.direction === "outbound")
        .sort(
          (a, b) =>
            new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime()
        )[0];

      if (firstOutbound) {
        const responseMs =
          new Date(firstOutbound.dateAdded).getTime() -
          contactAdded.getTime();
        const responseMinutes = Math.max(0, responseMs / 60000);
        const isAi = firstOutbound.messageType === "ai";
        responseTimes.push({ minutes: responseMinutes, isAi });
      }
    }
  }

  if (responseTimes.length === 0) {
    return emptySpeedToLead();
  }

  const sorted = responseTimes
    .map((r) => r.minutes)
    .sort((a, b) => a - b);
  const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  const median = sorted[Math.floor(sorted.length / 2)];

  const under5 = responseTimes.filter((r) => r.minutes < 5).length;
  const from5to30 = responseTimes.filter(
    (r) => r.minutes >= 5 && r.minutes < 30
  ).length;
  const over30 = responseTimes.filter((r) => r.minutes >= 30).length;

  const aiCount = responseTimes.filter((r) => r.isAi).length;
  const humanCount = responseTimes.length - aiCount;

  const rating: "green" | "yellow" | "red" =
    avg < 5 ? "green" : avg < 30 ? "yellow" : "red";

  return {
    averageResponseMinutes: Math.round(avg * 10) / 10,
    medianResponseMinutes: Math.round(median * 10) / 10,
    distribution: {
      under5min: under5,
      from5to30min: from5to30,
      over30min: over30,
    },
    performanceRating: rating,
    aiResponses: aiCount,
    humanResponses: humanCount,
    totalMeasured: responseTimes.length,
  };
}
