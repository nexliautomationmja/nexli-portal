import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { engagementSigners, engagements, invoices, pipelineLeads } from "@/db/schema";
import { ensurePipelineTable } from "@/lib/pipeline-table";

/**
 * A pipeline lead turns Won only when the client pays the UP-FRONT invoice
 * of their engagement (Marcel's rule): the setup fee on a monthly DRS letter,
 * the full annual invoice on an annual one, or the bank invoice on an
 * Enterprise license. Sending or signing the letter doesn't move the lead.
 *
 * Called from onDrsInvoicePaid (lib/digital-rainmaker.ts), which every paid
 * path already runs: card checkout, ACH settled, autopay, manual mark-paid.
 */

/** DRS invoice roles paid up front at signing (see SETUP_ROLES in digital-rainmaker.ts). */
const UPFRONT_DRS_ROLES = ["setup_fee", "setup_annual"];

/** Is this paid invoice the engagement's up-front invoice? Pure, for tests. */
export function isUpfrontInvoice(meta: Record<string, unknown> | null | undefined): boolean {
  if (!meta || typeof meta.engagementId !== "string") return false;
  if (typeof meta.drsRole === "string") return UPFRONT_DRS_ROLES.includes(meta.drsRole);
  return meta.offer === "enterprise";
}

export async function markLeadWonForPaidInvoice(invoiceId: string): Promise<void> {
  const [invoice] = await db
    .select({ status: invoices.status, metadata: invoices.metadata, clientEmail: invoices.clientEmail })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  if (!invoice || invoice.status !== "paid") return;
  const meta = (invoice.metadata ?? {}) as Record<string, unknown>;
  if (!isUpfrontInvoice(meta)) return;

  const [engagement] = await db
    .select({ id: engagements.id, ownerId: engagements.ownerId, metadata: engagements.metadata })
    .from(engagements)
    .where(eq(engagements.id, meta.engagementId as string))
    .limit(1);
  if (!engagement) return;
  await ensurePipelineTable();

  const engMeta = (engagement.metadata ?? {}) as Record<string, unknown>;
  const linkedId = typeof engMeta.pipelineLeadId === "string" ? engMeta.pipelineLeadId : null;
  const open = and(eq(pipelineLeads.ownerId, engagement.ownerId), eq(pipelineLeads.stage, "open"), isNull(pipelineLeads.deletedAt));

  let leadId: string | null = null;
  if (linkedId) {
    const [lead] = await db
      .select({ id: pipelineLeads.id })
      .from(pipelineLeads)
      .where(and(eq(pipelineLeads.id, linkedId), eq(pipelineLeads.ownerId, engagement.ownerId), isNull(pipelineLeads.deletedAt)))
      .limit(1);
    leadId = lead?.id ?? null;
  } else {
    // Letters sent before leads were linked: match an open lead by a signer's email.
    const signers = await db
      .select({ email: engagementSigners.email, order: engagementSigners.order })
      .from(engagementSigners)
      .where(eq(engagementSigners.engagementId, engagement.id));
    const emails = [...new Set([invoice.clientEmail, ...signers.filter((s) => s.order > 0).map((s) => s.email)].map((e) => e.trim().toLowerCase()))];
    for (const email of emails) {
      const [lead] = await db
        .select({ id: pipelineLeads.id })
        .from(pipelineLeads)
        .where(and(open, sql`lower(${pipelineLeads.email}) = ${email}`))
        .limit(1);
      if (lead) {
        leadId = lead.id;
        break;
      }
    }
  }
  if (!leadId) return;

  await db
    .update(pipelineLeads)
    .set({ stage: "won", updatedAt: new Date() })
    .where(and(eq(pipelineLeads.id, leadId), sql`${pipelineLeads.stage} <> 'won'`));
}
