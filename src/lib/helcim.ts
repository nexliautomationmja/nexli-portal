import crypto from "crypto";

const HELCIM_API_BASE = "https://api.helcim.com/v2";

async function helcimFetch<T>(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${HELCIM_API_BASE}${path}`, {
    method,
    headers: {
      "api-token": process.env.HELCIM_API_TOKEN!,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Helcim API error ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<T>;
}

// ── Types ──

interface HelcimInvoiceResponse {
  invoiceId: number;
  invoiceNumber: string;
  token: string;
  status: string;
  amount: number;
}

export interface HelcimTransactionResponse {
  transactionId: number;
  type: string;
  amount: number;
  currency: string;
  status: string;
  statusAuth: number; // 1=Approved, 2=Declined, 5=Pending(ACH)
  cardType?: string;
  invoiceNumber?: string;
}

// ── Invoice Creation ──

export async function createHelcimInvoice(params: {
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  lineItems: { description: string; quantity: number; priceCents: number }[];
  taxAmountCents: number;
  currency: string;
}): Promise<{
  helcimInvoiceId: number;
  paymentUrl: string;
  helcimToken: string;
}> {
  const curr = params.currency.toLowerCase();
  if (curr !== "usd" && curr !== "cad") {
    throw new Error(
      `Helcim only supports USD and CAD. Got: ${params.currency}`
    );
  }

  const lineItems = params.lineItems.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    price: item.priceCents / 100,
    total: (item.priceCents * item.quantity) / 100,
  }));

  if (params.taxAmountCents > 0) {
    lineItems.push({
      description: "Tax",
      quantity: 1,
      price: params.taxAmountCents / 100,
      total: params.taxAmountCents / 100,
    });
  }

  const invoice = await helcimFetch<HelcimInvoiceResponse>("POST", "/invoices/", {
    invoiceNumber: params.invoiceNumber,
    customerName: params.clientName,
    customerEmail: params.clientEmail,
    currency: params.currency.toUpperCase(),
    lineItems,
  });

  const hostedUrl = process.env.HELCIM_HOSTED_URL!;
  const paymentUrl = `${hostedUrl}/order/?token=${invoice.token}`;

  return {
    helcimInvoiceId: invoice.invoiceId,
    paymentUrl,
    helcimToken: invoice.token,
  };
}

// ── Transaction Lookup ──

export async function getHelcimTransaction(
  transactionId: number
): Promise<HelcimTransactionResponse> {
  return helcimFetch<HelcimTransactionResponse>(
    "GET",
    `/payment/transaction/${transactionId}`
  );
}

// ── Webhook Verification ──

export function verifyHelcimWebhook(params: {
  webhookId: string;
  webhookTimestamp: string;
  webhookSignature: string;
  rawBody: string;
}): boolean {
  const verifierToken = process.env.HELCIM_WEBHOOK_SECRET!;
  const signedContent = `${params.webhookId}.${params.webhookTimestamp}.${params.rawBody}`;
  const verifierTokenBytes = Buffer.from(verifierToken, "base64");
  const expectedSignature = crypto
    .createHmac("sha256", verifierTokenBytes)
    .update(signedContent)
    .digest("base64");

  return params.webhookSignature === expectedSignature;
}
