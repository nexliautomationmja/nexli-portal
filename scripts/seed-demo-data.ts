/**
 * Seed fresh demo analytics & lead data for the test client.
 *
 * Usage:
 *   npx tsx scripts/seed-demo-data.ts
 *
 * Requires DATABASE_URL in .env.local
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and, gte } from "drizzle-orm";
import {
  users,
  dailyStats,
  pageViews,
  leadNotifications,
  analyticsSnapshots,
} from "../src/db/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function main() {
  console.log("Seeding demo data for test client...\n");

  // 1. Find test client
  const [client] = await db
    .select()
    .from(users)
    .where(eq(users.email, "client@demo.nexli.net"))
    .limit(1);

  if (!client) {
    console.error("Test client not found! Run seed-test-client.ts first.");
    process.exit(1);
  }

  console.log(`Found client: ${client.name} (${client.id})\n`);

  // 2. Clear old data for this client
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 31);

  await db.delete(dailyStats).where(eq(dailyStats.clientId, client.id));
  await db.delete(pageViews).where(eq(pageViews.clientId, client.id));
  await db.delete(leadNotifications).where(eq(leadNotifications.userId, client.id));
  await db
    .delete(analyticsSnapshots)
    .where(eq(analyticsSnapshots.userId, client.id));

  console.log("Cleared old data.\n");

  // 3. Seed 30 days of daily stats with realistic upward trend
  const now = new Date();
  const statsRows = [];
  const samplePages = [
    "/",
    "/services",
    "/about",
    "/contact",
    "/blog/retirement-planning",
    "/blog/tax-strategies",
    "/testimonials",
  ];

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Simulate growing traffic with a slight upward trend
    const trendMultiplier = 1 + (30 - i) * 0.015; // ~45% growth over 30 days
    const baseViews = isWeekend ? 25 : 58;
    const jitter = Math.floor(Math.random() * 20) - 8;
    const pvCount = Math.max(
      12,
      Math.floor((baseViews + jitter) * trendMultiplier)
    );
    const uvCount = Math.max(
      6,
      Math.floor(pvCount * (0.55 + Math.random() * 0.12))
    );

    // Top pages distribution
    const topPages = samplePages.map((url) => ({
      url,
      count: Math.max(
        1,
        Math.floor(pvCount * (url === "/" ? 0.3 : 0.05 + Math.random() * 0.15))
      ),
    }));
    topPages.sort((a, b) => b.count - a.count);

    statsRows.push({
      clientId: client.id,
      date,
      pageViewsCount: pvCount,
      uniqueVisitorsCount: uvCount,
      topPages: topPages.slice(0, 5),
      topReferrers: [
        { referrer: "google.com", count: Math.floor(uvCount * 0.42) },
        { referrer: "(direct)", count: Math.floor(uvCount * 0.22) },
        { referrer: "linkedin.com", count: Math.floor(uvCount * 0.18) },
        { referrer: "facebook.com", count: Math.floor(uvCount * 0.1) },
        { referrer: "bing.com", count: Math.floor(uvCount * 0.08) },
      ],
    });
  }

  await db.insert(dailyStats).values(statsRows);
  console.log(`Seeded ${statsRows.length} days of daily stats.`);

  // 4. Seed raw page views (last 7 days) for device breakdown & recent activity
  const recentViews = [];
  const pages = [
    "/",
    "/services",
    "/about",
    "/contact",
    "/blog/retirement-planning",
    "/blog/tax-strategies",
    "/testimonials",
  ];
  const deviceWeights = [
    { type: "desktop", weight: 0.52 },
    { type: "mobile", weight: 0.40 },
    { type: "tablet", weight: 0.08 },
  ];
  const referrers = [
    "https://google.com",
    "https://linkedin.com",
    "",
    "https://facebook.com",
    "https://bing.com",
  ];

  function pickDevice() {
    const r = Math.random();
    if (r < 0.52) return "desktop";
    if (r < 0.92) return "mobile";
    return "tablet";
  }

  for (let i = 0; i < 120; i++) {
    const hoursAgo = Math.floor(Math.random() * 168); // last 7 days
    const createdAt = new Date(Date.now() - hoursAgo * 3600000);

    recentViews.push({
      clientId: client.id,
      pageUrl: pages[Math.floor(Math.random() * pages.length)],
      referrer:
        referrers[Math.floor(Math.random() * referrers.length)] || null,
      userAgent: "Mozilla/5.0 (demo seed)",
      deviceType: pickDevice(),
      sessionId: `demo_${Date.now()}_${i}`,
      createdAt,
    });
  }

  await db.insert(pageViews).values(recentViews);
  console.log(`Seeded ${recentViews.length} raw page view events.`);

  // 5. Seed lead notifications (last 30 days)
  const firstNames = [
    "Emily",
    "Marcus",
    "Sarah",
    "David",
    "Michelle",
    "Robert",
    "Jennifer",
    "James",
    "Lisa",
    "Michael",
    "Amanda",
    "Christopher",
    "Ashley",
    "Daniel",
    "Stephanie",
  ];
  const lastNames = [
    "Chen",
    "Williams",
    "Johnson",
    "Brown",
    "Davis",
    "Martinez",
    "Garcia",
    "Wilson",
    "Anderson",
    "Thomas",
    "Taylor",
    "Moore",
    "Jackson",
    "White",
    "Harris",
  ];
  const sources = [
    "website_form",
    "website_form",
    "website_form",
    "ghl_workflow",
    "ghl_workflow",
    "referral",
  ];

  const leads = [];
  for (let i = 0; i < 18; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const hoursAgo = Math.floor(Math.random() * 24);
    const createdAt = new Date(
      Date.now() - daysAgo * 86400000 - hoursAgo * 3600000
    );

    const first = firstNames[Math.floor(Math.random() * firstNames.length)];
    const last = lastNames[Math.floor(Math.random() * lastNames.length)];

    leads.push({
      userId: client.id,
      leadName: `${first} ${last}`,
      leadEmail: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
      leadPhone: `(${Math.floor(Math.random() * 900) + 100}) ${
        Math.floor(Math.random() * 900) + 100
      }-${Math.floor(Math.random() * 9000) + 1000}`,
      source: sources[Math.floor(Math.random() * sources.length)],
      notifiedAt: createdAt,
      createdAt,
    });
  }

  await db.insert(leadNotifications).values(leads);
  console.log(`Seeded ${leads.length} lead notifications.\n`);

  // Summary
  const totalPV = statsRows.reduce((s, r) => s + r.pageViewsCount, 0);
  const totalUV = statsRows.reduce((s, r) => s + r.uniqueVisitorsCount, 0);

  console.log("═══════════════════════════════════════════════════");
  console.log("  Demo data seeded successfully!");
  console.log(`  30-day Page Views:      ${totalPV.toLocaleString()}`);
  console.log(`  30-day Unique Visitors: ${totalUV.toLocaleString()}`);
  console.log(`  Lead Notifications:     ${leads.length}`);
  console.log(`  Raw Page View Events:   ${recentViews.length}`);
  console.log("═══════════════════════════════════════════════════");
}

main().catch(console.error);
