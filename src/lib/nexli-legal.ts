/**
 * Nexli's legal identity and public policy pages, for Nexli's OWN documents
 * (its engagement letters, invoices, Launch Pad and client emails) — never
 * for a firm tenant's white-label pages.
 *
 * Must read exactly as nexli.net states it (lib/site.ts there: LEGAL_NAME,
 * ADDRESS_LINES, PHONE_DISPLAY, EMAIL): the card processor's underwriters
 * match the business identity across the website and what clients see.
 *
 * Client-safe: no server-only imports.
 */

export const NEXLI_LEGAL = {
  name: "Nexli Automation LLC",
  entity: "a Florida limited liability company",
  street: "480 N Orlando Ave STE 236",
  cityLine: "Winter Park, FL 32789",
  phoneDisplay: "(321) 272-7741",
  phoneE164: "+13212727741",
  email: "mail@nexli.net",
} as const;

/** "Nexli Automation LLC · 480 N Orlando Ave STE 236, Winter Park, FL 32789 · (321) 272-7741 · mail@nexli.net" */
export const NEXLI_IDENTITY_LINE = `${NEXLI_LEGAL.name} · ${NEXLI_LEGAL.street}, ${NEXLI_LEGAL.cityLine} · ${NEXLI_LEGAL.phoneDisplay} · ${NEXLI_LEGAL.email}`;

/** The policies on nexli.net that govern Nexli's own sales. */
export const NEXLI_POLICY_LINKS = [
  { label: "Terms", href: "https://www.nexli.net/terms" },
  { label: "Refund Policy", href: "https://www.nexli.net/refund-policy" },
  { label: "Privacy", href: "https://www.nexli.net/privacy" },
  { label: "Contact", href: "https://www.nexli.net/contact" },
] as const;

export type NexliLetterKind = "drs" | "enterprise" | "foundation";

/**
 * Which of Nexli's own letters this is, from its first line, or null for a
 * firm's own letter (those keep the generic Stripe disclosure).
 */
export function nexliLetterKind(content: string | null | undefined): NexliLetterKind | null {
  const head = (content ?? "").trimStart();
  if (head.startsWith("DIGITAL RAINMAKER SYSTEM")) return "drs";
  if (head.startsWith("NEXLI ENTERPRISE LICENSE")) return "enterprise";
  if (head.startsWith("FIRM FOUNDATION")) return "foundation";
  return null;
}

/**
 * How payments work under each of Nexli's letters — the disclosure shown
 * under the letter. Says what each letter's payment clause says (DRS 4(a):
 * up-front invoice by ACH or wire only, monthly by card or ACH on Stripe
 * autopay; Enterprise: ACH or wire only; Foundation: card subscription).
 */
export function nexliPaymentDisclosure(kind: NexliLetterKind): string {
  const n = NEXLI_LEGAL.name;
  switch (kind) {
    case "drs":
      return `The up-front invoice (the Setup Fee, or the Setup Fee and the Annual Investment on the annual plan) is paid by ACH bank transfer or wire directly to ${n}'s bank account, using the details on the invoice; cards are not accepted for it. Monthly invoices are paid by credit/debit card or ACH through Stripe, Inc., Nexli's payment processor, at the same price, and each month after the first is charged automatically. Card details are handled by Stripe; Nexli never sees or stores your full card number. Nexli is not responsible for holds, delays or disputes imposed by your bank, card issuer or payment provider.`;
    case "enterprise":
      return `The Enterprise License Fee is paid by ACH bank transfer or wire directly to ${n}'s bank account (a business check is accepted once it clears); card payments are not accepted. Nexli is not responsible for holds or delays imposed by your bank.`;
    case "foundation":
      return `Fees are billed by card through Stripe, Inc., Nexli's payment processor, as a monthly subscription. Card details are handled by Stripe; Nexli never sees or stores your full card number. Nexli is not responsible for holds, delays or disputes imposed by your bank or card issuer.`;
  }
}
