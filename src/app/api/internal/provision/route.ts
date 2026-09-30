/**
 * POST /api/internal/provision
 *
 * Called by the marketing app's Stripe webhook (and thank-you page) after a
 * Firm Foundation checkout. Guarded by the `x-provision-secret` header.
 * Idempotent — safe to retry on any 5xx.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  checkProvisionSecret,
  provisionFirm,
  type ProvisionInput,
  type ProvisionSource,
} from "@/lib/provision-firm";
import {
  validateFirmSiteConfig,
  type FirmSiteConfig,
} from "@/lib/firm-sites/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCES: ProvisionSource[] = [
  "stripe-webhook",
  "thank-you",
  "admin",
  "invoice-paid",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function optString(v: unknown, field: string, errors: string[]): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string") {
    errors.push(`${field} must be a string`);
    return undefined;
  }
  return v.trim();
}

function optIso(v: unknown, field: string, errors: string[]): string | undefined {
  const s = optString(v, field, errors);
  if (s === undefined) return undefined;
  if (Number.isNaN(new Date(s).getTime())) {
    errors.push(`${field} must be an ISO date string`);
    return undefined;
  }
  return s;
}

function optBool(v: unknown, field: string, errors: string[]): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "boolean") {
    errors.push(`${field} must be a boolean`);
    return undefined;
  }
  return v;
}

export async function POST(req: NextRequest) {
  const guard = checkProvisionSecret(req.headers.get("x-provision-secret"));
  if (guard === "unconfigured") {
    return NextResponse.json(
      { error: "Provisioning is not configured" },
      { status: 503 }
    );
  }
  if (guard === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const errors: string[] = [];

  const email = optString(body.email, "email", errors);
  if (!email) errors.push("email is required");
  else if (!EMAIL_RE.test(email)) errors.push("email is invalid");

  const firmName = optString(body.firmName, "firmName", errors);
  if (!firmName) errors.push("firmName is required");

  if (body.tier !== "foundation") errors.push("tier must be 'foundation'");

  const source = optString(body.source, "source", errors);
  if (source && !SOURCES.includes(source as ProvisionSource)) {
    errors.push(`source must be one of ${SOURCES.join(", ")}`);
  }

  // Optional pre-purchase website preview (marketing app's site_previews).
  // Structural validation only; the final slug is assigned during provisioning.
  let previewConfig: FirmSiteConfig | undefined;
  if (body.previewConfig !== undefined && body.previewConfig !== null) {
    const v = validateFirmSiteConfig(body.previewConfig);
    if (v.ok) previewConfig = v.config;
    else errors.push(...v.errors.map((e) => `previewConfig: ${e}`));
  }

  const input: ProvisionInput = {
    email: email ?? "",
    firstName: optString(body.firstName, "firstName", errors),
    lastName: optString(body.lastName, "lastName", errors),
    firmName: firmName ?? "",
    phone: optString(body.phone, "phone", errors),
    websiteUrl: optString(body.websiteUrl, "websiteUrl", errors),
    bookingUrl: optString(body.bookingUrl, "bookingUrl", errors),
    tier: "foundation",
    stripeCustomerId: optString(body.stripeCustomerId, "stripeCustomerId", errors),
    stripeSubscriptionId: optString(
      body.stripeSubscriptionId,
      "stripeSubscriptionId",
      errors
    ),
    subscriptionStatus: optString(body.subscriptionStatus, "subscriptionStatus", errors),
    subscriptionCurrentPeriodEnd: optIso(
      body.subscriptionCurrentPeriodEnd,
      "subscriptionCurrentPeriodEnd",
      errors
    ),
    subscriptionStartedAt: optIso(
      body.subscriptionStartedAt,
      "subscriptionStartedAt",
      errors
    ),
    sendAgreement: optBool(body.sendAgreement, "sendAgreement", errors) ?? true,
    sendWelcome: optBool(body.sendWelcome, "sendWelcome", errors) ?? true,
    source: (source as ProvisionSource | undefined) ?? "stripe-webhook",
    previewToken: optString(body.previewToken, "previewToken", errors),
    previewConfig,
  };

  if (errors.length > 0) {
    return NextResponse.json(
      { error: "Validation failed", details: errors },
      { status: 400 }
    );
  }

  try {
    const result = await provisionFirm(input);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[internal/provision] unexpected error:", err);
    return NextResponse.json(
      {
        error: "Provisioning failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
