import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { eSignatures, documents } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ esignId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { esignId } = await params;

  const [result] = await db
    .select({
      esign: eSignatures,
      documentName: documents.fileName,
      storagePath: documents.storagePath,
    })
    .from(eSignatures)
    .innerJoin(documents, eq(eSignatures.documentId, documents.id))
    .where(
      and(
        eq(eSignatures.id, esignId),
        eq(eSignatures.ownerId, session.user.id)
      )
    )
    .limit(1);

  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...result.esign,
    documentName: result.documentName,
    storagePath: result.storagePath,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ esignId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { esignId } = await params;
  const body = await req.json();

  const [esign] = await db
    .select()
    .from(eSignatures)
    .where(
      and(
        eq(eSignatures.id, esignId),
        eq(eSignatures.ownerId, session.user.id)
      )
    )
    .limit(1);

  if (!esign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only allow voiding/cancelling
  if (body.action === "void") {
    await db
      .update(eSignatures)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(eSignatures.id, esignId));

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
