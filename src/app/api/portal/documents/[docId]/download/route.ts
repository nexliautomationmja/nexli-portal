import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documents, documentAuditLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getPortalSessionFromRequest } from "@/lib/portal-auth";
import { getSupabase } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  const session = await getPortalSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { docId } = await params;

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, docId))
    .limit(1);

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Verify access: must be shared, belong to this client, and same CPA
  if (
    !doc.sharedWithClient ||
    doc.clientEmail !== session.email ||
    (session.ownerId && doc.ownerId !== session.ownerId)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.storagePath, 3600); // 1 hour

  if (error || !data?.signedUrl) {
    console.error("Signed URL error:", error);
    return NextResponse.json(
      { error: "Failed to generate download link" },
      { status: 500 }
    );
  }

  // Audit log
  await db.insert(documentAuditLog).values({
    documentId: doc.id,
    actorId: null,
    actorName: session.clientName || session.email,
    action: "downloaded",
    metadata: { portal: true, clientEmail: session.email },
  });

  return NextResponse.json({ url: data.signedUrl });
}
