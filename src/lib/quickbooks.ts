import { db } from "@/db";
import { accountingConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// ── Config ───────────────────────────────────────────────

const QB_CLIENT_ID = process.env.QB_CLIENT_ID!;
const QB_CLIENT_SECRET = process.env.QB_CLIENT_SECRET!;
const QB_REDIRECT_URI = process.env.QB_REDIRECT_URI!;
const QB_API_BASE_URL =
  process.env.QB_API_BASE_URL || "https://quickbooks.api.intuit.com";

const QB_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QB_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

// ── OAuth Helpers ────────────────────────────────────────

export function getQuickBooksAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: QB_CLIENT_ID,
    redirect_uri: QB_REDIRECT_URI,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    state,
  });
  return `${QB_AUTH_URL}?${params.toString()}`;
}

export async function exchangeQuickBooksCode(code: string) {
  const res = await fetch(QB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: QB_REDIRECT_URI,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QuickBooks token exchange failed: ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string,
    expiresIn: data.expires_in as number,
  };
}

export async function refreshQuickBooksTokens(refreshToken: string) {
  const res = await fetch(QB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QuickBooks token refresh failed: ${text}`);
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
        eq(accountingConnections.provider, "quickbooks")
      )
    )
    .limit(1);

  if (!conn) return null;

  // Refresh if token expires within 5 minutes
  if (conn.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
    const tokens = await refreshQuickBooksTokens(conn.refreshToken);
    await db
      .update(accountingConnections)
      .set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        updatedAt: new Date(),
      })
      .where(eq(accountingConnections.id, conn.id));

    return { accessToken: tokens.accessToken, realmId: conn.realmId! };
  }

  return { accessToken: conn.accessToken, realmId: conn.realmId! };
}

// ── API Helpers ──────────────────────────────────────────

async function qbRequest(
  method: string,
  path: string,
  realmId: string,
  accessToken: string,
  body?: unknown
) {
  const url = `${QB_API_BASE_URL}/v3/company/${realmId}${path}`;
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
    throw new Error(`QuickBooks API ${method} ${path} failed (${res.status}): ${text}`);
  }

  return res.json();
}

// ── Invoice Operations ───────────────────────────────────

interface QBInvoiceData {
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

export async function createQuickBooksInvoice(
  userId: string,
  data: QBInvoiceData
): Promise<string | null> {
  const token = await getValidToken(userId);
  if (!token) return null;

  const qbInvoice = {
    DocNumber: data.invoiceNumber,
    DueDate: data.dueDate,
    CustomerRef: {
      name: data.clientName,
    },
    BillEmail: {
      Address: data.clientEmail,
    },
    Line: data.lineItems.map((item) => ({
      DetailType: "SalesItemLineDetail",
      Amount: item.amount,
      Description: item.description,
      SalesItemLineDetail: {
        Qty: item.quantity,
        UnitPrice: item.unitPrice,
      },
    })),
  };

  const result = await qbRequest(
    "POST",
    "/invoice",
    token.realmId,
    token.accessToken,
    qbInvoice
  );

  return result.Invoice?.Id || null;
}

export async function recordQuickBooksPayment(
  userId: string,
  qbInvoiceId: string,
  amountDollars: number
): Promise<string | null> {
  const token = await getValidToken(userId);
  if (!token) return null;

  const payment = {
    TotalAmt: amountDollars,
    Line: [
      {
        Amount: amountDollars,
        LinkedTxn: [
          {
            TxnId: qbInvoiceId,
            TxnType: "Invoice",
          },
        ],
      },
    ],
  };

  const result = await qbRequest(
    "POST",
    "/payment",
    token.realmId,
    token.accessToken,
    payment
  );

  return result.Payment?.Id || null;
}

export async function getQuickBooksCompanyInfo(
  accessToken: string,
  realmId: string
): Promise<string> {
  const result = await qbRequest(
    "GET",
    "/companyinfo/" + realmId,
    realmId,
    accessToken
  );
  return result.CompanyInfo?.CompanyName || "QuickBooks Company";
}
