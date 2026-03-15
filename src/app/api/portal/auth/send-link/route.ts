import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  invoices,
  documents,
  engagementSigners,
  taxReturns,
  eSignatures,
  documentLinks,
  portalMagicLinks,
} from "@/db/schema";
import { eq, and, gt, count } from "drizzle-orm";
import { generateMagicLink } from "@/lib/portal-auth";
import { sendEmailWithLog, buildMagicLinkEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // Rate limit by IP (10 requests per 15 min)
  const ip = getClientIp(req);
  const ipLimit = checkRateLimit(`send-link:ip:${ip}`, 10, 15 * 60 * 1000);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const email = ((body.email as string) || "").toLowerCase().trim();

  if (!email || !email.includes("@") || email.length > 254) {
    return NextResponse.json(
      { error: "Valid email is required" },
      { status: 400 }
    );
  }

  // Rate limit by email (3 magic links per 15 min via DB check)
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
  const [recentCount] = await db
    .select({ count: count() })
    .from(portalMagicLinks)
    .where(
      and(
        eq(portalMagicLinks.email, email),
        gt(portalMagicLinks.createdAt, fifteenMinAgo)
      )
    );

  if (recentCount && recentCount.count >= 3) {
    // Still return success to prevent email enumeration
    return NextResponse.json({ success: true });
  }

  // Check if any data exists for this email (across all client-facing tables)
  const [inv] = await db
    .select({ id: invoices.id, clientName: invoices.clientName })
    .from(invoices)
    .where(eq(invoices.clientEmail, email))
    .limit(1);

  const [doc] = await db
    .select({ id: documents.id, clientName: documents.clientName })
    .from(documents)
    .where(eq(documents.clientEmail, email))
    .limit(1);

  const [signer] = await db
    .select({ id: engagementSigners.id, name: engagementSigners.name })
    .from(engagementSigners)
    .where(eq(engagementSigners.email, email))
    .limit(1);

  const [taxReturn] = await db
    .select({ id: taxReturns.id, clientName: taxReturns.clientName })
    .from(taxReturns)
    .where(eq(taxReturns.clientEmail, email))
    .limit(1);

  const [esign] = await db
    .select({ id: eSignatures.id, signerName: eSignatures.signerName })
    .from(eSignatures)
    .where(eq(eSignatures.signerEmail, email))
    .limit(1);

  const [link] = await db
    .select({ id: documentLinks.id, clientName: documentLinks.clientName })
    .from(documentLinks)
    .where(eq(documentLinks.clientEmail, email))
    .limit(1);

  // Determine client name from whichever record we found
  const clientName =
    inv?.clientName ||
    doc?.clientName ||
    signer?.name ||
    taxReturn?.clientName ||
    esign?.signerName ||
    link?.clientName ||
    null;

  const hasData = !!(inv || doc || signer || taxReturn || esign || link);

  if (!hasData) {
    return NextResponse.json(
      { error: "No account found for this email address. Please contact your provider." },
      { status: 404 }
    );
  }

  try {
    const magicLinkUrl = await generateMagicLink(email);
    const { subject, html } = buildMagicLinkEmail({
      clientName: clientName!,
      magicLinkUrl,
      expiresInMinutes: 15,
    });
    await sendEmailWithLog({ to: email, subject, html, recipientName: clientName || undefined, emailType: "magic_link" });
  } catch (err) {
    console.error("Failed to send magic link:", err);
  }

  return NextResponse.json({ success: true });
}
