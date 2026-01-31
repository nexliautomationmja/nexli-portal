/**
 * Seed a test client with 30 days of sample analytics data.
 *
 * Usage:
 *   npx tsx scripts/seed-test-client.ts
 *
 * Requires DATABASE_URL in .env.local
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import bcrypt from "bcryptjs";
import {
  users,
  subscriptions,
  dailyStats,
  pageViews,
} from "../src/db/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function main() {
  console.log("Seeding test client...\n");

  // 1. Create test client user
  const password = await bcrypt.hash("TestClient2025!", 12);

  const [client] = await db
    .insert(users)
    .values({
      email: "client@demo.nexli.net",
      name: "Jordan Rivera",
      hashedPassword: password,
      role: "client",
      companyName: "Rivera Wealth Advisors",
      websiteUrl: "https://riverawealth.com",
    })
    .returning();

  console.log(`✓ Created client: ${client.name} (${client.email})`);
  console.log(`  ID: ${client.id}`);
  console.log(`  Password: TestClient2025!\n`);

  // 2. Create an active subscription
  const [sub] = await db
    .insert(subscriptions)
    .values({
      userId: client.id,
      stripeSubscriptionId: `sub_demo_${Date.now()}`,
      stripePriceId: "price_demo_monthly",
      status: "active",
      currentPeriodStart: new Date(Date.now() - 30 * 86400000),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
    })
    .returning();

  console.log(`✓ Created subscription: ${sub.id} (active)\n`);

  // 3. Seed 30 days of daily stats with realistic data
  const now = new Date();
  const statsRows = [];
  const samplePages = [
    { url: "/", count: 0 },
    { url: "/services", count: 0 },
    { url: "/about", count: 0 },
    { url: "/contact", count: 0 },
    { url: "/blog/retirement-planning", count: 0 },
    { url: "/blog/tax-strategies", count: 0 },
  ];

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    // Simulate realistic traffic: weekdays higher, weekends lower
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseViews = isWeekend ? 30 : 65;
    const jitter = Math.floor(Math.random() * 30) - 10;
    const pvCount = Math.max(10, baseViews + jitter);
    const uvCount = Math.max(5, Math.floor(pvCount * (0.55 + Math.random() * 0.15)));

    // Distribute page views across pages
    const topPages = samplePages.map((p) => ({
      url: p.url,
      count: Math.max(1, Math.floor(pvCount * (0.1 + Math.random() * 0.2))),
    }));
    topPages.sort((a, b) => b.count - a.count);

    statsRows.push({
      clientId: client.id,
      date,
      pageViewsCount: pvCount,
      uniqueVisitorsCount: uvCount,
      topPages: JSON.stringify(topPages.slice(0, 5)),
      topReferrers: JSON.stringify([
        { referrer: "google.com", count: Math.floor(uvCount * 0.4) },
        { referrer: "linkedin.com", count: Math.floor(uvCount * 0.2) },
        { referrer: "(direct)", count: Math.floor(uvCount * 0.25) },
        { referrer: "facebook.com", count: Math.floor(uvCount * 0.15) },
      ]),
    });
  }

  await db.insert(dailyStats).values(statsRows);
  console.log(`✓ Seeded ${statsRows.length} days of daily stats`);

  // 4. Seed some recent raw page views (last 3 days) for real-time feel
  const recentViews = [];
  const pages = ["/", "/services", "/about", "/contact", "/blog/retirement-planning"];
  const devices = ["desktop", "mobile", "tablet"];
  const referrers = ["https://google.com", "https://linkedin.com", "", "https://facebook.com"];

  for (let i = 0; i < 50; i++) {
    const hoursAgo = Math.floor(Math.random() * 72);
    const createdAt = new Date(Date.now() - hoursAgo * 3600000);

    recentViews.push({
      clientId: client.id,
      pageUrl: pages[Math.floor(Math.random() * pages.length)],
      referrer: referrers[Math.floor(Math.random() * referrers.length)] || null,
      userAgent: "Mozilla/5.0 (seed data)",
      deviceType: devices[Math.floor(Math.random() * devices.length)],
      sessionId: `seed_${Date.now()}_${i}`,
      createdAt,
    });
  }

  await db.insert(pageViews).values(recentViews);
  console.log(`✓ Seeded ${recentViews.length} raw page view events\n`);

  console.log("═══════════════════════════════════════════");
  console.log("  Test client ready!");
  console.log("  Email:    client@demo.nexli.net");
  console.log("  Password: TestClient2025!");
  console.log("  Login at: https://portal.nexli.net/login");
  console.log("═══════════════════════════════════════════");
}

main().catch(console.error);
