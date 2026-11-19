import { isBankTransferInvoiceMeta, isWireOptionInvoiceMeta } from "@/lib/drs-pricing";
import { getNexliAdminId } from "@/lib/foundation-project";

/**
 * Whether an invoice is paid by bank transfer into Nexli's Mercury account
 * (lib/mercury.ts) instead of Stripe. Kept apart from lib/mercury.ts so the
 * invoice-sending code can ask without importing the sync (which imports the
 * DRS payment handlers — a cycle).
 */
export function mercuryConfigured(): boolean {
  return Boolean(process.env.MERCURY_API_TOKEN?.trim());
}

/** Mercury is connected, Nexli issued it, and it's an up-front kind (setup, annual, renewal, Enterprise). */
export async function usesBankTransfer(invoice: { ownerId: string; metadata: unknown }): Promise<boolean> {
  if (!mercuryConfigured() || !isBankTransferInvoiceMeta(invoice.metadata)) return false;
  return invoice.ownerId === (await getNexliAdminId());
}

/**
 * Nov 19 2026 pricing: the six-month prepayment and Performance Pay invoices
 * are paid through Stripe (card or ACH) but may ALSO be paid by wire, so
 * their pay page shows Nexli's bank details as a second way to pay and a
 * transfer that arrives is matched to them (lib/mercury.ts).
 */
export async function offersWire(invoice: { ownerId: string; metadata: unknown }): Promise<boolean> {
  if (!mercuryConfigured() || !isWireOptionInvoiceMeta(invoice.metadata)) return false;
  return invoice.ownerId === (await getNexliAdminId());
}
