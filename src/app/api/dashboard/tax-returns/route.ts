import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { taxReturns } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(taxReturns)
    .where(eq(taxReturns.ownerId, session.user.id))
    .orderBy(desc(taxReturns.createdAt));

  return NextResponse.json({ taxReturns: rows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { clientName, clientEmail, clientCompany, taxYear, returnType, dueDate, notes } = body;

  if (!clientName || !clientEmail || !taxYear) {
    return NextResponse.json(
      { error: "clientName, clientEmail, and taxYear are required" },
      { status: 400 }
    );
  }

  type ReturnType = "1040" | "1120" | "1120S" | "1065" | "990" | "other";
  const validReturnTypes: ReturnType[] = ["1040", "1120", "1120S", "1065", "990", "other"];
  const rt = validReturnTypes.includes(returnType as ReturnType)
    ? (returnType as ReturnType)
    : ("1040" as const);

  const [taxReturn] = await db
    .insert(taxReturns)
    .values({
      ownerId: session.user.id,
      clientName,
      clientEmail,
      clientCompany: clientCompany || null,
      taxYear,
      returnType: rt,
      status: "not_started",
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes || null,
    })
    .returning();

  return NextResponse.json({ taxReturn }, { status: 201 });
}
