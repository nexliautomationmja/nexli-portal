import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { pageViews, leadNotifications } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;

  const [recentPages, recentLeads] = await Promise.all([
    db
      .select({
        id: pageViews.id,
        pageUrl: pageViews.pageUrl,
        referrer: pageViews.referrer,
        deviceType: pageViews.deviceType,
        country: pageViews.country,
        createdAt: pageViews.createdAt,
      })
      .from(pageViews)
      .where(eq(pageViews.clientId, clientId))
      .orderBy(desc(pageViews.createdAt))
      .limit(15),

    db
      .select({
        id: leadNotifications.id,
        leadName: leadNotifications.leadName,
        leadEmail: leadNotifications.leadEmail,
        source: leadNotifications.source,
        createdAt: leadNotifications.createdAt,
      })
      .from(leadNotifications)
      .where(eq(leadNotifications.userId, clientId))
      .orderBy(desc(leadNotifications.createdAt))
      .limit(15),
  ]);

  return NextResponse.json({ recentPages, recentLeads });
}
