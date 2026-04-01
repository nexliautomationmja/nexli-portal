import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  taxOrganizerLinks,
  taxOrganizerSubmissions,
  taxReturns,
  documents,
  documentAuditLog,
} from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET: Validate token and return organizer metadata (public)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const [link] = await db
    .select()
    .from(taxOrganizerLinks)
    .where(
      and(
        eq(taxOrganizerLinks.token, token),
        eq(taxOrganizerLinks.status, "active"),
        gt(taxOrganizerLinks.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!link) {
    return NextResponse.json(
      { error: "This tax organizer link is invalid or has expired." },
      { status: 404 }
    );
  }

  if (link.submittedAt) {
    return NextResponse.json(
      { error: "This tax organizer has already been submitted." },
      { status: 410 }
    );
  }

  // Update last accessed
  await db
    .update(taxOrganizerLinks)
    .set({ lastAccessedAt: new Date() })
    .where(eq(taxOrganizerLinks.id, link.id));

  try {
    await db.insert(documentAuditLog).values({
      action: "link_accessed",
      actorName: link.clientName,
      metadata: { taxOrganizerLinkId: link.id },
    });
  } catch {}

  return NextResponse.json({
    clientName: link.clientName,
    clientEmail: link.clientEmail,
    taxYear: link.taxYear,
    returnType: link.returnType,
    expiresAt: link.expiresAt,
  });
}

// POST: Submit completed tax organizer form + file uploads (public)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const [link] = await db
    .select()
    .from(taxOrganizerLinks)
    .where(
      and(
        eq(taxOrganizerLinks.token, token),
        eq(taxOrganizerLinks.status, "active"),
        gt(taxOrganizerLinks.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!link) {
    return NextResponse.json(
      { error: "This tax organizer link is invalid or has expired." },
      { status: 404 }
    );
  }

  if (link.submittedAt) {
    return NextResponse.json(
      { error: "This tax organizer has already been submitted." },
      { status: 410 }
    );
  }

  const formData = await req.formData();
  const formDataJson = formData.get("formData") as string;
  const files = formData.getAll("files") as File[];

  if (!formDataJson) {
    return NextResponse.json(
      { error: "Form data is required." },
      { status: 400 }
    );
  }

  let parsedFormData;
  try {
    parsedFormData = JSON.parse(formDataJson);
  } catch {
    return NextResponse.json(
      { error: "Invalid form data." },
      { status: 400 }
    );
  }

  // Upload files to Supabase
  const uploadedDocIds: string[] = [];
  if (files.length > 0) {
    const supabase = getSupabase();
    const MAX_SIZE = 25 * 1024 * 1024;

    for (const file of files) {
      if (file.size > MAX_SIZE) {
        return NextResponse.json(
          { error: `File "${file.name}" exceeds 25MB limit.` },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const fileId = crypto.randomUUID();
      const storagePath = `documents/${link.ownerId}/${link.id}/${fileId}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("[TaxOrganizer] Supabase upload error:", uploadError);
        return NextResponse.json(
          { error: `Failed to upload "${file.name}".` },
          { status: 500 }
        );
      }

      const [doc] = await db
        .insert(documents)
        .values({
          ownerId: link.ownerId,
          clientName: link.clientName,
          clientEmail: link.clientEmail,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          storagePath,
          category: "Tax Document",
          status: "new",
        })
        .returning();

      uploadedDocIds.push(doc.id);

      try {
        await db.insert(documentAuditLog).values({
          documentId: doc.id,
          action: "uploaded",
          actorName: link.clientName,
          actorIp:
            req.headers.get("x-forwarded-for") ||
            req.headers.get("x-real-ip"),
          actorUserAgent: req.headers.get("user-agent"),
          metadata: {
            taxOrganizerLinkId: link.id,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          },
        });
      } catch {}
    }
  }

  // Save submission
  const [submission] = await db
    .insert(taxOrganizerSubmissions)
    .values({
      linkId: link.id,
      ownerId: link.ownerId,
      taxReturnId: link.taxReturnId || null,
      clientName: link.clientName,
      clientEmail: link.clientEmail,
      formData: parsedFormData,
      uploadedDocumentIds: uploadedDocIds,
      submitterIp:
        req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
      submitterUserAgent: req.headers.get("user-agent"),
    })
    .returning();

  // Mark link as submitted
  await db
    .update(taxOrganizerLinks)
    .set({ submittedAt: new Date() })
    .where(eq(taxOrganizerLinks.id, link.id));

  // Update tax return status to documents_received (if linked to a return)
  if (link.taxReturnId) {
    await db
      .update(taxReturns)
      .set({ status: "documents_received", updatedAt: new Date() })
      .where(eq(taxReturns.id, link.taxReturnId));
  }

  // Notify CPA
  try {
    await createNotification({
      userId: link.ownerId,
      type: "tax_organizer_submitted",
      title: "Tax Organizer Submitted",
      message: `${link.clientName} completed their ${link.taxYear} tax organizer`,
      metadata: {
        taxReturnId: link.taxReturnId,
        submissionId: submission.id,
        documentsUploaded: uploadedDocIds.length,
      },
    });
  } catch (err) {
    console.error("Tax organizer notification failed:", err);
  }

  // Audit log
  try {
    await db.insert(documentAuditLog).values({
      action: "tax_organizer_submitted",
      actorName: link.clientName,
      actorIp:
        req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
      actorUserAgent: req.headers.get("user-agent"),
      metadata: { taxOrganizerLinkId: link.id, documentsUploaded: uploadedDocIds.length },
    });
  } catch {}

  return NextResponse.json({ ok: true, submissionId: submission.id });
}
