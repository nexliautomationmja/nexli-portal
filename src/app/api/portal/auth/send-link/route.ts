import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  invoices,
  documents,
  engagementSigners,
  taxReturns,
  eSignatures,
  documentLinks,
} from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { generateMagicLink } from "@/lib/portal-auth";
import { sendEmailWithLog, buildMagicLinkEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = (body.email || "").toLowerCase().trim();

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "Valid email is required" },
      { status: 400 }
    );
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

  if (hasData && clientName) {
    try {
      const magicLinkUrl = await generateMagicLink(email);
      const { subject, html } = buildMagicLinkEmail({
        clientName,
        magicLinkUrl,
        expiresInMinutes: 15,
      });
      await sendEmailWithLog({ to: email, subject, html, recipientName: clientName || undefined, emailType: "magic_link" });
    } catch (err) {
      console.error("Failed to send magic link:", err);
    }
  }

  // Always return success to prevent email enumeration
  return NextResponse.json({ success: true });
}
