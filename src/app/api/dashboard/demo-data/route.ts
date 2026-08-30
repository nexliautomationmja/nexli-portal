import { NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  engagements,
  engagementSigners,
  invoices,
  invoiceLineItems,
  users,
  leadNotifications,
  dailyStats,
} from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { generateInvoiceNumber, generateInvoiceToken } from "@/lib/invoice-utils";
import { generateSenderSignatureSvgDataUrl } from "@/lib/signature";
import { generateDrsContent } from "@/lib/engagement-defaults";
import { DRS_PRICING, type BillingPlan } from "@/lib/drs-pricing";
import {
  initOnboarding,
  setOnboardingValues,
  appendActivity,
} from "@/lib/onboarding";

/**
 * Demo data — creates a cast of fake clients wired through the WHOLE system:
 * signed engagements (with Launch Pad onboarding at various stages) and paid
 * invoices, so the Onboarding tab, Client Tracker, Engagements and Invoices
 * pages all show realistic data. Everything is tagged { demo: true } in
 * metadata and can be removed with DELETE. No emails or notifications are
 * ever sent for demo rows.
 */

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const daysAhead = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);
const iso = (d: Date) => d.toISOString();
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

interface DemoClient {
  name: string;
  email: string;
  company: string;
  plan: BillingPlan;
  signedDaysAgo: number;
  /** Paid platform invoices: [daysAgo, amountCents][] — first one is the recurring parent. */
  paidInvoices: [number, number][];
  /** Optional outstanding (sent, unpaid) invoice: [daysAgo, amountCents]. */
  outstandingInvoice?: [number, number];
  onboarding: "just_started" | "early" | "mid" | "complete";
}

const MONTHLY = DRS_PRICING.MONTHLY_CENTS;
const ANNUAL = DRS_PRICING.ANNUAL_CENTS;

const DEMO_CLIENTS: DemoClient[] = [
  {
    name: "Donald Sinatra",
    email: "donald@demo-sinatra.com",
    company: "Sinatra Wealth Management",
    plan: "annual",
    signedDaysAgo: 20,
    paidInvoices: [[20, ANNUAL]],
    onboarding: "mid",
  },
  {
    name: "Andy Reid",
    email: "andy@demo-reidtax.com",
    company: "Reid Tax Advisors",
    plan: "monthly",
    signedDaysAgo: 45,
    paidInvoices: [
      [45, MONTHLY],
      [15, MONTHLY],
    ],
    onboarding: "complete",
  },
  {
    name: "Maria Delgado",
    email: "maria@demo-delgadocpa.com",
    company: "Delgado & Co CPAs",
    plan: "monthly",
    signedDaysAgo: 10,
    paidInvoices: [[10, MONTHLY]],
    outstandingInvoice: [2, MONTHLY],
    onboarding: "early",
  },
  {
    name: "Sam Okafor",
    email: "sam@demo-okaforfg.com",
    company: "Okafor Financial Group",
    plan: "monthly",
    signedDaysAgo: 3,
    paidInvoices: [[3, MONTHLY]],
    onboarding: "just_started",
  },
];

/**
 * Demo client DASHBOARDS — Donald and Andy also get a connected dashboard
 * account (users row, role "client") seeded with their own tenant: signed
 * engagements + paid invoices from THEIR tax-planning clients, leads, and
 * website traffic. This is what the Client Tracker drill-down shows.
 * Deleting demo data removes the users rows; every tenant table cascades.
 */
interface DemoDashboardCustomer {
  name: string;
  email: string;
  company: string;
  /** [daysAgo, amountCents] paid invoice */
  paid: [number, number];
  /** Monthly recurring subscription? (drives their MRR) */
  recurring?: boolean;
}

interface DemoDashboard {
  websiteUrl: string;
  /** Base daily page views (varied deterministically per day). */
  trafficBase: number;
  customers: DemoDashboardCustomer[];
  leads: { name: string; email: string; source: string; daysAgo: number }[];
}

const DEMO_DASHBOARDS: Record<string, DemoDashboard> = {
  "donald@demo-sinatra.com": {
    websiteUrl: "https://sinatrawealth-demo.com",
    trafficBase: 55,
    customers: [
      {
        name: "Kim Brooks",
        email: "kim@demo-brightsmile.com",
        company: "BrightSmile Dental Group",
        paid: [9, 950_000],
      },
      {
        name: "Raj Patel",
        email: "raj@demo-pateldev.com",
        company: "Patel Development LLC",
        paid: [4, 600_000],
      },
      {
        name: "Elena Ortiz",
        email: "elena@demo-ortizortho.com",
        company: "Ortiz Orthodontics",
        paid: [2, 300_000],
        recurring: true,
      },
    ],
    leads: [
      { name: "Marcus Hill", email: "marcus@demo-hillgroup.com", source: "facebook_ads", daysAgo: 1 },
      { name: "Priya Shah", email: "priya@demo-shahmed.com", source: "facebook_ads", daysAgo: 2 },
      { name: "Tom Reyes", email: "tom@demo-reyeslogistics.com", source: "website_form", daysAgo: 4 },
      { name: "Alice Chen", email: "alice@demo-chendental.com", source: "facebook_ads", daysAgo: 6 },
      { name: "Bill Okada", email: "bill@demo-okadare.com", source: "website_form", daysAgo: 9 },
    ],
  },
  "andy@demo-reidtax.com": {
    websiteUrl: "https://reidtax-demo.com",
    trafficBase: 35,
    customers: [
      {
        name: "Paul Nguyen",
        email: "paul@demo-nguyenbuild.com",
        company: "Nguyen Construction",
        paid: [12, 680_000],
      },
      {
        name: "Dana White",
        email: "dana@demo-whitept.com",
        company: "White Physical Therapy",
        paid: [5, 300_000],
        recurring: true,
      },
    ],
    leads: [
      { name: "Grace Lee", email: "grace@demo-leefranchise.com", source: "facebook_ads", daysAgo: 2 },
      { name: "Omar Diaz", email: "omar@demo-diazrestaurants.com", source: "facebook_ads", daysAgo: 5 },
      { name: "Nina Brandt", email: "nina@demo-brandtlaw.com", source: "website_form", daysAgo: 8 },
      { name: "Chris Foley", email: "chris@demo-foleyhomes.com", source: "facebook_ads", daysAgo: 12 },
    ],
  },
};

async function seedDemoDashboard(client: DemoClient): Promise<void> {
  const config = DEMO_DASHBOARDS[client.email];
  if (!config) return;

  // If the demo account already exists, its tenant is already seeded — don't
  // re-insert dailyStats/leads (the (clientId, date) unique index would throw).
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, client.email))
    .limit(1);
  if (existing) return;

  const [account] = await db
    .insert(users)
    .values({
      email: client.email,
      name: client.name,
      companyName: client.company,
      role: "client",
      hashedPassword: await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 12),
      websiteUrl: config.websiteUrl,
    })
    .returning({ id: users.id });
  const tenantId = account.id;

  // Their book of business: each customer gets a signed engagement + paid invoice.
  for (const cust of config.customers) {
    const [ago, amountCents] = cust.paid;
    const signedAt = daysAgo(ago + 1);

    const [engagement] = await db
      .insert(engagements)
      .values({
        ownerId: tenantId,
        templateId: null,
        subject: `Tax Planning Engagement — ${cust.company}`,
        content: `This engagement letter covers a comprehensive tax planning strategy and implementation for ${cust.company}, including entity structuring review, quarterly planning sessions, and year-round advisory.`,
        status: "signed",
        sentAt: signedAt,
        expiresAt: daysAhead(365),
        metadata: { demo: true },
      })
      .returning();

    await db.insert(engagementSigners).values({
      engagementId: engagement.id,
      name: client.name,
      email: client.email,
      token: crypto.randomBytes(32).toString("base64url"),
      order: 0,
      status: "signed",
      sentAt: signedAt,
      signedAt,
      signatureData: generateSenderSignatureSvgDataUrl(client.name),
      signatureIp: "demo",
      signatureUserAgent: "Demo data",
      role: "Authorized Representative",
    });
    await db.insert(engagementSigners).values({
      engagementId: engagement.id,
      name: cust.name,
      email: cust.email,
      token: crypto.randomBytes(32).toString("base64url"),
      order: 1,
      status: "signed",
      sentAt: signedAt,
      signedAt,
      signatureData: generateSenderSignatureSvgDataUrl(cust.name),
      signatureIp: "demo",
      signatureUserAgent: "Demo data",
    });

    const paidDate = daysAgo(ago);
    const [invoice] = await db
      .insert(invoices)
      .values({
        ownerId: tenantId,
        clientName: cust.name,
        clientEmail: cust.email,
        clientCompany: cust.company,
        invoiceNumber: await generateInvoiceNumber(),
        token: generateInvoiceToken(),
        currency: "usd",
        subtotal: amountCents,
        taxRate: 0,
        taxAmount: 0,
        total: amountCents,
        amountPaid: amountCents,
        balanceDue: 0,
        isRecurring: Boolean(cust.recurring),
        recurringInterval: cust.recurring ? "monthly" : null,
        nextRecurrenceDate: cust.recurring ? daysAhead(30 - ago) : null,
        dueDate: paidDate,
        paidAt: paidDate,
        paymentMethod: "ach",
        status: "paid",
        sentAt: paidDate,
        notes: "Tax planning strategy and implementation.",
        metadata: { engagementId: engagement.id, demo: true },
      })
      .returning();
    await db.insert(invoiceLineItems).values({
      invoiceId: invoice.id,
      description: cust.recurring
        ? "Tax Planning Advisory — Monthly"
        : "Tax Planning Strategy & Implementation",
      quantity: 100,
      unitPrice: amountCents,
      amount: amountCents,
      billingType: cust.recurring ? "monthly" : "one_time",
      order: 0,
    });
  }

  // Their inbound leads.
  for (const lead of config.leads) {
    await db.insert(leadNotifications).values({
      userId: tenantId,
      leadName: lead.name,
      leadEmail: lead.email,
      source: lead.source,
      notifiedAt: daysAgo(lead.daysAgo),
      createdAt: daysAgo(lead.daysAgo),
    });
  }

  // 30 days of website traffic — deterministic variation by day index.
  const statRows = [];
  for (let i = 0; i < 30; i++) {
    const day = daysAgo(i);
    day.setHours(0, 0, 0, 0);
    const pageViewsCount = config.trafficBase + ((i * 17) % 29) + (i % 3 === 0 ? 12 : 0);
    statRows.push({
      clientId: tenantId,
      date: day,
      pageViewsCount,
      uniqueVisitorsCount: Math.round(pageViewsCount * 0.62),
      topPages: [
        { url: "/", count: Math.round(pageViewsCount * 0.5) },
        { url: "/tax-planning", count: Math.round(pageViewsCount * 0.3) },
        { url: "/contact", count: Math.round(pageViewsCount * 0.2) },
      ],
      topReferrers: [
        { referrer: "facebook.com", count: Math.round(pageViewsCount * 0.45) },
        { referrer: "google.com", count: Math.round(pageViewsCount * 0.25) },
      ],
    });
  }
  await db.insert(dailyStats).values(statRows);
}

async function deleteDemoDashboards(): Promise<void> {
  // Only the exact demo dashboard emails — deleting the users row cascades
  // to their whole tenant (engagements, invoices, leads, daily stats).
  await db
    .delete(users)
    .where(
      and(
        eq(users.role, "client"),
        inArray(users.email, Object.keys(DEMO_DASHBOARDS))
      )
    );
}

async function deleteDemoRows(ownerId: string): Promise<void> {
  await deleteDemoDashboards();
  await db
    .delete(invoices)
    .where(
      and(
        eq(invoices.ownerId, ownerId),
        sql`${invoices.metadata} @> '{"demo":true}'::jsonb`
      )
    );
  await db
    .delete(engagements)
    .where(
      and(
        eq(engagements.ownerId, ownerId),
        sql`${engagements.metadata} @> '{"demo":true}'::jsonb`
      )
    );
}

async function hasDemoData(ownerId: string): Promise<boolean> {
  const rows = await db
    .select({ id: engagements.id })
    .from(engagements)
    .where(
      and(
        eq(engagements.ownerId, ownerId),
        sql`${engagements.metadata} @> '{"demo":true}'::jsonb`
      )
    )
    .limit(1);
  return rows.length > 0;
}

async function seedOnboardingProgress(
  engagementId: string,
  stage: DemoClient["onboarding"],
  clientName: string
) {
  await initOnboarding(engagementId, "admin");

  if (stage === "just_started") {
    await setOnboardingValues(engagementId, [
      { segments: ["targetLaunchDate"], value: isoDate(daysAhead(28)) },
    ]);
    return;
  }

  if (stage === "early") {
    await setOnboardingValues(engagementId, [
      { segments: ["targetLaunchDate"], value: isoDate(daysAhead(21)) },
      { segments: ["phases", "website", "status"], value: "in_progress" },
      { segments: ["phases", "website", "startedAt"], value: iso(daysAgo(7)) },
      { segments: ["phases", "website", "targetDate"], value: isoDate(daysAhead(10)) },
      { segments: ["tasks", "stripe_setup", "status"], value: "submitted" },
      { segments: ["tasks", "stripe_setup", "submittedAt"], value: iso(daysAgo(6)) },
    ]);
    await appendActivity(engagementId, {
      actor: "agency",
      type: "phase_update",
      message: "Website Build-Out is now in the works 🎨",
    });
    await appendActivity(engagementId, {
      actor: "client",
      type: "task_submitted",
      message: `${clientName} set up Stripe and sent over their login 💳`,
    });
    return;
  }

  if (stage === "mid") {
    await setOnboardingValues(engagementId, [
      { segments: ["targetLaunchDate"], value: isoDate(daysAhead(9)) },
      { segments: ["phases", "website", "status"], value: "done" },
      { segments: ["phases", "website", "startedAt"], value: iso(daysAgo(18)) },
      { segments: ["phases", "website", "completedAt"], value: iso(daysAgo(6)) },
      { segments: ["phases", "automations", "status"], value: "in_progress" },
      { segments: ["phases", "automations", "startedAt"], value: iso(daysAgo(5)) },
      { segments: ["phases", "automations", "targetDate"], value: isoDate(daysAhead(5)) },
      { segments: ["phases", "automations", "note"], value: "Missed-call textback live; review engine next." },
      { segments: ["tasks", "stripe_setup", "status"], value: "approved" },
      { segments: ["tasks", "stripe_setup", "submittedAt"], value: iso(daysAgo(16)) },
      { segments: ["tasks", "stripe_setup", "reviewedAt"], value: iso(daysAgo(15)) },
      { segments: ["tasks", "dns_access", "status"], value: "submitted" },
      { segments: ["tasks", "dns_access", "submittedAt"], value: iso(daysAgo(12)) },
      { segments: ["tasks", "dream_clients", "status"], value: "submitted" },
      { segments: ["tasks", "dream_clients", "submittedAt"], value: iso(daysAgo(11)) },
      {
        segments: ["tasks", "dream_clients", "submission"],
        value: {
          client1: "Owner of a 14-location dental group, ~$6M revenue",
          client2: "Real estate developer with 3 LLCs and a family office",
          client3: "SaaS founder who just exited, sitting on a large cap gain",
          commonality:
            "All high-income owners with multiple entities who came in for compliance and stayed for proactive tax planning.",
          avatar:
            "High-income dental practice owners with 3+ locations and multiple entities",
          notes: "Wants more clients in the $2M–$10M revenue range.",
        },
      },
      { segments: ["tasks", "fb_ads_invite", "status"], value: "submitted" },
      { segments: ["tasks", "fb_ads_invite", "submittedAt"], value: iso(daysAgo(11)) },
      { segments: ["tasks", "fb_ads_invite", "submission"], value: { confirmed: true } },
    ]);
    await appendActivity(engagementId, {
      actor: "agency",
      type: "phase_update",
      message: "Website Build-Out is DONE ✅",
    });
    await appendActivity(engagementId, {
      actor: "agency",
      type: "phase_update",
      message: "Automations & Reputation Management is now in the works ⚡",
    });
    await appendActivity(engagementId, {
      actor: "client",
      type: "task_submitted",
      message: `${clientName} sent over their domain & DNS access 🌐`,
    });
    return;
  }

  // complete
  await setOnboardingValues(engagementId, [
    { segments: ["targetLaunchDate"], value: isoDate(daysAgo(14)) },
    { segments: ["phases", "website", "status"], value: "done" },
    { segments: ["phases", "website", "startedAt"], value: iso(daysAgo(43)) },
    { segments: ["phases", "website", "completedAt"], value: iso(daysAgo(30)) },
    { segments: ["phases", "automations", "status"], value: "done" },
    { segments: ["phases", "automations", "startedAt"], value: iso(daysAgo(30)) },
    { segments: ["phases", "automations", "completedAt"], value: iso(daysAgo(20)) },
    { segments: ["phases", "portal", "status"], value: "done" },
    { segments: ["phases", "portal", "startedAt"], value: iso(daysAgo(20)) },
    { segments: ["phases", "portal", "completedAt"], value: iso(daysAgo(15)) },
    { segments: ["tasks", "stripe_setup", "status"], value: "approved" },
    { segments: ["tasks", "stripe_setup", "submittedAt"], value: iso(daysAgo(42)) },
    { segments: ["tasks", "dns_access", "status"], value: "approved" },
    { segments: ["tasks", "dns_access", "submittedAt"], value: iso(daysAgo(41)) },
    { segments: ["tasks", "dream_clients", "status"], value: "approved" },
    { segments: ["tasks", "dream_clients", "submittedAt"], value: iso(daysAgo(41)) },
    {
      segments: ["tasks", "dream_clients", "submission"],
      value: {
        client1: "Franchise restaurant operator, 9 locations",
        client2: "Construction company owner, ~$8M revenue, S-corp",
        client3: "Medical practice partner group (4 physicians)",
        commonality:
          "Multi-entity operators with big payrolls who need entity structuring and quarterly planning, not just year-end filing.",
        avatar:
          "Franchise operators clearing $1M+ profit across multiple entities",
        notes: "",
      },
    },
    { segments: ["tasks", "fb_ads_invite", "status"], value: "approved" },
    { segments: ["tasks", "fb_ads_invite", "submission"], value: { confirmed: true } },
    { segments: ["tasks", "fb_ads_invite", "submittedAt"], value: iso(daysAgo(40)) },
    { segments: ["tasks", "drivers_license", "status"], value: "approved" },
    { segments: ["tasks", "drivers_license", "submittedAt"], value: iso(daysAgo(39)) },
  ]);
  await appendActivity(engagementId, {
    actor: "agency",
    type: "note",
    message: "Everything is live — you're fully launched! 🎉",
  });
}

// POST — create the demo cast (idempotent).
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = session.user.id;

  if (await hasDemoData(ownerId)) {
    return NextResponse.json({ ok: true, alreadySeeded: true });
  }

  const senderName = session.user.name || session.user.email || "Nexli";
  const senderSignature = generateSenderSignatureSvgDataUrl(senderName);

  try {
    for (const c of DEMO_CLIENTS) {
    const signedAt = daysAgo(c.signedDaysAgo);

    // 1. Signed engagement with the real letter for the plan.
    const [engagement] = await db
      .insert(engagements)
      .values({
        ownerId,
        templateId: null,
        subject: `Digital Rainmaker System — ${c.company}`,
        content: generateDrsContent(c.plan),
        status: "signed",
        sentAt: signedAt,
        expiresAt: daysAhead(365),
        metadata: { billingPlan: c.plan, demo: true },
      })
      .returning();

    // 2. Signers: sender (order 0, auto-signed) + client (order 1, signed).
    await db.insert(engagementSigners).values({
      engagementId: engagement.id,
      name: senderName,
      email: session.user.email || "mail@nexli.net",
      token: crypto.randomBytes(32).toString("base64url"),
      order: 0,
      status: "signed",
      sentAt: signedAt,
      signedAt,
      signatureData: senderSignature,
      signatureIp: "demo",
      signatureUserAgent: "Demo data",
      role: "Authorized Representative",
    });
    await db.insert(engagementSigners).values({
      engagementId: engagement.id,
      name: c.name,
      email: c.email,
      token: crypto.randomBytes(32).toString("base64url"),
      order: 1,
      status: "signed",
      sentAt: signedAt,
      signedAt,
      signatureData: generateSenderSignatureSvgDataUrl(c.name),
      signatureIp: "demo",
      signatureUserAgent: "Demo data",
    });

    // 3. Onboarding Launch Pad at the right stage.
    await seedOnboardingProgress(engagement.id, c.onboarding, c.name);

    // 3b. Connected demo dashboard (Donald & Andy) — their own tenant with
    // signed clients, paid invoices, leads and website traffic.
    await seedDemoDashboard(c);

    // 4. Invoices — paid platform invoices (first is the recurring parent).
    const isAnnual = c.plan === "annual";
    for (let i = 0; i < c.paidInvoices.length; i++) {
      const [ago, amountCents] = c.paidInvoices[i];
      const created = daysAgo(ago);
      const isParent = i === 0;
      const [invoice] = await db
        .insert(invoices)
        .values({
          ownerId,
          clientName: c.name,
          clientEmail: c.email,
          clientCompany: c.company,
          invoiceNumber: await generateInvoiceNumber(),
          token: generateInvoiceToken(),
          currency: "usd",
          subtotal: amountCents,
          taxRate: 0,
          taxAmount: 0,
          total: amountCents,
          amountPaid: amountCents,
          balanceDue: 0,
          isRecurring: isParent,
          recurringInterval: isParent ? (isAnnual ? "yearly" : "monthly") : null,
          nextRecurrenceDate: isParent
            ? isAnnual
              ? daysAhead(365 - c.signedDaysAgo)
              : daysAhead(30)
            : null,
          dueDate: created,
          paidAt: created,
          paymentMethod: "ach",
          status: "paid",
          sentAt: created,
          notes: isAnnual
            ? "Annual all-in-one investment for the Digital Rainmaker System, paid in full."
            : "Monthly all-in-one investment for the Digital Rainmaker System.",
          metadata: { engagementId: engagement.id, demo: true },
        })
        .returning();
      await db.insert(invoiceLineItems).values({
        invoiceId: invoice.id,
        description: isAnnual
          ? "Digital Rainmaker System — Annual (Paid in Full)"
          : "Digital Rainmaker System — Monthly",
        quantity: 100,
        unitPrice: amountCents,
        amount: amountCents,
        billingType: isAnnual ? "yearly" : "monthly",
        order: 0,
      });
    }

    // 5. Optional outstanding invoice (sent, unpaid).
    if (c.outstandingInvoice) {
      const [ago, amountCents] = c.outstandingInvoice;
      const created = daysAgo(ago);
      const [invoice] = await db
        .insert(invoices)
        .values({
          ownerId,
          clientName: c.name,
          clientEmail: c.email,
          clientCompany: c.company,
          invoiceNumber: await generateInvoiceNumber(),
          token: generateInvoiceToken(),
          currency: "usd",
          subtotal: amountCents,
          taxRate: 0,
          taxAmount: 0,
          total: amountCents,
          amountPaid: 0,
          balanceDue: amountCents,
          isRecurring: false,
          dueDate: daysAhead(12),
          status: "sent",
          sentAt: created,
          notes: "Monthly all-in-one investment for the Digital Rainmaker System.",
          metadata: { engagementId: engagement.id, demo: true },
        })
        .returning();
      await db.insert(invoiceLineItems).values({
        invoiceId: invoice.id,
        description: "Digital Rainmaker System — Monthly",
        quantity: 100,
        unitPrice: amountCents,
        amount: amountCents,
        billingType: "monthly",
        order: 0,
      });
    }
    }
  } catch (err) {
    // No transactions on neon-http — clean up any partially created demo
    // rows so a retry starts fresh instead of being blocked by hasDemoData.
    console.error("Demo seeding failed, rolling back demo rows:", err);
    try {
      await deleteDemoRows(ownerId);
    } catch (cleanupErr) {
      console.error("Demo cleanup after failure also failed:", cleanupErr);
    }
    return NextResponse.json(
      { error: "Demo seeding failed. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, created: DEMO_CLIENTS.length });
}

// GET — is demo data present?
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ hasDemo: await hasDemoData(session.user.id) });
}

// DELETE — remove every demo row (line items + signers cascade via FK).
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await deleteDemoRows(session.user.id);
  return NextResponse.json({ ok: true });
}
