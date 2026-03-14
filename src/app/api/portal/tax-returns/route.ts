import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { taxReturns } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getPortalSessionFromRequest } from "@/lib/portal-auth";

export async function GET(req: NextRequest) {
  const session = await getPortalSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(taxReturns)
    .where(eq(taxReturns.clientEmail, session.email))
    .orderBy(desc(taxReturns.taxYear));

  return NextResponse.json({
    taxReturns: rows.map((r) => ({
      id: r.id,
      clientName: r.clientName,
      clientCompany: r.clientCompany,
      taxYear: r.taxYear,
      returnType: r.returnType,
      status: r.status,
      dueDate: r.dueDate,
      filedDate: r.filedDate,
      acceptedDate: r.acceptedDate,
      notes: r.notes,
      createdAt: r.createdAt,
    })),
  });
}
