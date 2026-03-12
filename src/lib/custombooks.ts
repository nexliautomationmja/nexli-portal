// CustomBooks (formerly AccountingSuite) integration scaffold. Register at developer.custombooks.com for API credentials.

import { db } from "@/db";
import { accountingConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// ── Config ───────────────────────────────────────────────

const CB_CLIENT_ID = process.env.CB_CLIENT_ID!;
const CB_CLIENT_SECRET = process.env.CB_CLIENT_SECRET!;
const CB_REDIRECT_URI = process.env.CB_REDIRECT_URI!;
const CB_API_BASE_URL =
  process.env.CB_API_BASE_URL || "https://api.custombooks.com/v1";

// TODO: Confirm actual OAuth endpoints from CustomBooks developer documentation
const CB_AUTH_URL = "https://auth.custombooks.com/oauth2/authorize";
const CB_TOKEN_URL = "https://auth.custombooks.com/oauth2/token";

// ── OAuth Helpers ────────────────────────────────────────

export function getCustomBooksAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CB_CLIENT_ID,
    redirect_uri: CB_REDIRECT_URI,
    response_type: "code",
    scope: "accounting:read accounting:write company:read",
    state,
  });
  return `${CB_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCustomBooksCode(code: string) {
  const res = await fetch(CB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${CB_CLIENT_ID}:${CB_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: CB_REDIRECT_URI,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CustomBooks token exchange failed: ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string,
    expiresIn: data.expires_in as number,
  };
}

export async function refreshCustomBooksTokens(refreshToken: string) {
  const res = await fetch(CB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${CB_CLIENT_ID}:${CB_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CustomBooks token refresh failed: ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string,
    expiresIn: data.expires_in as number,
  };
}

// ── Token Management ─────────────────────────────────────

export async function getValidToken(userId: string) {
  const [conn] = await db
    .select()
    .from(accountingConnections)
    .where(
      and(
        eq(accountingConnections.userId, userId),
        eq(accountingConnections.provider, "custombooks")
      )
    )
    .limit(1);

  if (!conn) return null;

  // Refresh if token expires within 5 minutes
  if (conn.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
    const tokens = await refreshCustomBooksTokens(conn.refreshToken);
    await db
      .update(accountingConnections)
      .set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        updatedAt: new Date(),
      })
      .where(eq(accountingConnections.id, conn.id));

    return { accessToken: tokens.accessToken, companyId: conn.realmId! };
  }

  return { accessToken: conn.accessToken, companyId: conn.realmId! };
}

// ── API Helpers ──────────────────────────────────────────

async function cbRequest(
  method: string,
  path: string,
  accessToken: string,
  body?: unknown
) {
  // TODO: Confirm final API URL structure from CustomBooks docs
  const url = `${CB_API_BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CustomBooks API ${method} ${path} failed (${res.status}): ${text}`);
  }

  return res.json();
}

// ── Invoice Operations ───────────────────────────────────

interface CBInvoiceData {
  clientName: string;
  clientEmail: string;
  invoiceNumber: string;
  lineItems: {
    description: string;
    quantity: number; // already divided by 100
    unitPrice: number; // already in dollars
    amount: number; // already in dollars
  }[];
  dueDate: string; // YYYY-MM-DD
  taxRate?: number; // percentage e.g. 8.25
}

export async function createCustomBooksInvoice(
  userId: string,
  data: CBInvoiceData
): Promise<string | null> {
  const token = await getValidToken(userId);
  if (!token) return null;

  try {
    // TODO: Confirm invoice creation endpoint and payload schema from CustomBooks API docs
    const cbInvoice = {
      invoice_number: data.invoiceNumber,
      due_date: data.dueDate,
      customer: {
        name: data.clientName,
        email: data.clientEmail,
      },
      line_items: data.lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        amount: item.amount,
      })),
      tax_rate: data.taxRate ?? 0,
    };

    const result = await cbRequest(
      "POST",
      "/invoices", // TODO: Confirm endpoint path
      token.accessToken,
      cbInvoice
    );

    return result?.invoice?.id || result?.id || null;
  } catch (err) {
    console.error("CustomBooks createInvoice error:", err);
    return null;
  }
}

// ── Payment Operations ───────────────────────────────────

export async function recordCustomBooksPayment(
  userId: string,
  cbInvoiceId: string,
  amountDollars: number
): Promise<string | null> {
  const token = await getValidToken(userId);
  if (!token) return null;

  try {
    // TODO: Confirm payment recording endpoint and payload schema from CustomBooks API docs
    const payment = {
      amount: amountDollars,
      invoice_id: cbInvoiceId,
      payment_date: new Date().toISOString().split("T")[0],
      payment_method: "other",
    };

    const result = await cbRequest(
      "POST",
      "/payments", // TODO: Confirm endpoint path
      token.accessToken,
      payment
    );

    return result?.payment?.id || result?.id || null;
  } catch (err) {
    console.error("CustomBooks recordPayment error:", err);
    return null;
  }
}

// ── Company Info ─────────────────────────────────────────

export async function getCustomBooksCompanyInfo(
  accessToken: string
): Promise<string> {
  try {
    // TODO: Confirm company info endpoint from CustomBooks API docs
    const result = await cbRequest(
      "GET",
      "/company", // TODO: Confirm endpoint path
      accessToken
    );

    return result?.company?.name || result?.name || "CustomBooks Company";
  } catch (err) {
    console.error("CustomBooks getCompanyInfo error:", err);
    return "CustomBooks Company";
  }
}
