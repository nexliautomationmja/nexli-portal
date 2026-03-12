import { db } from "@/db";
import { accountingConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// ── Config ───────────────────────────────────────────────

const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID!;
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET!;
const XERO_REDIRECT_URI = process.env.XERO_REDIRECT_URI!;

const XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize";
const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_API_URL = "https://api.xero.com/api.xro/2.0";
const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";

// ── OAuth Helpers ────────────────────────────────────────

export function getXeroAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: XERO_CLIENT_ID,
    redirect_uri: XERO_REDIRECT_URI,
    response_type: "code",
    scope: "openid profile email accounting.transactions accounting.contacts offline_access",
    state,
  });
  return `${XERO_AUTH_URL}?${params.toString()}`;
}

export async function exchangeXeroCode(code: string) {
  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: XERO_REDIRECT_URI,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Xero token exchange failed: ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string,
    expiresIn: data.expires_in as number,
  };
}

export async function refreshXeroTokens(refreshToken: string) {
  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Xero token refresh failed: ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string,
    expiresIn: data.expires_in as number,
  };
}

// ── Token Management ─────────────────────────────────────

async function getValidToken(userId: string) {
  const [conn] = await db
    .select()
    .from(accountingConnections)
    .where(
      and(
        eq(accountingConnections.userId, userId),
        eq(accountingConnections.provider, "xero")
      )
    )
    .limit(1);

  if (!conn) return null;

  // Refresh if token expires within 5 minutes
  if (conn.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
    const tokens = await refreshXeroTokens(conn.refreshToken);
    await db
      .update(accountingConnections)
      .set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        updatedAt: new Date(),
      })
      .where(eq(accountingConnections.id, conn.id));

    return { accessToken: tokens.accessToken, tenantId: conn.tenantId! };
  }

  return { accessToken: conn.accessToken, tenantId: conn.tenantId! };
}

// ── API Helpers ──────────────────────────────────────────

async function xeroRequest(
  method: string,
  path: string,
  tenantId: string,
  accessToken: string,
  body?: unknown
) {
  const res = await fetch(`${XERO_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "xero-tenant-id": tenantId,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Xero API ${method} ${path} failed (${res.status}): ${text}`);
  }

  return res.json();
}

// ── Tenant Discovery ─────────────────────────────────────

export async function getXeroTenants(accessToken: string) {
  const res = await fetch(XERO_CONNECTIONS_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to get Xero tenants: ${await res.text()}`);
  }

  const tenants = await res.json();
  return tenants as { tenantId: string; tenantName: string }[];
}

// ── Invoice Operations ───────────────────────────────────

interface XeroInvoiceData {
  clientName: string;
  clientEmail: string;
  invoiceNumber: string;
  lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }[];
  dueDate: string; // YYYY-MM-DD
  taxRate?: number;
}

export async function createXeroInvoice(
  userId: string,
  data: XeroInvoiceData
): Promise<string | null> {
  const token = await getValidToken(userId);
  if (!token) return null;

  const xeroInvoice = {
    Type: "ACCREC", // Accounts Receivable
    Contact: {
      Name: data.clientName,
      EmailAddress: data.clientEmail,
    },
    InvoiceNumber: data.invoiceNumber,
    DueDate: data.dueDate,
    Status: "AUTHORISED",
    LineItems: data.lineItems.map((item) => ({
      Description: item.description,
      Quantity: item.quantity,
      UnitAmount: item.unitPrice,
      LineAmount: item.amount,
      AccountCode: "200", // Default revenue account
    })),
  };

  const result = await xeroRequest(
    "PUT",
    "/Invoices",
    token.tenantId,
    token.accessToken,
    { Invoices: [xeroInvoice] }
  );

  return result.Invoices?.[0]?.InvoiceID || null;
}

export async function recordXeroPayment(
  userId: string,
  xeroInvoiceId: string,
  amountDollars: number,
  paidDate: string // YYYY-MM-DD
): Promise<string | null> {
  const token = await getValidToken(userId);
  if (!token) return null;

  const payment = {
    Invoice: { InvoiceID: xeroInvoiceId },
    Account: { Code: "090" }, // Default bank account
    Amount: amountDollars,
    Date: paidDate,
  };

  const result = await xeroRequest(
    "PUT",
    "/Payments",
    token.tenantId,
    token.accessToken,
    { Payments: [payment] }
  );

  return result.Payments?.[0]?.PaymentID || null;
}

export async function getXeroOrganisation(
  accessToken: string,
  tenantId: string
): Promise<string> {
  const result = await xeroRequest(
    "GET",
    "/Organisation",
    tenantId,
    accessToken
  );
  return result.Organisations?.[0]?.Name || "Xero Organisation";
}
