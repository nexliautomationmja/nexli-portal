import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import {
  users,
  invoices,
  invoiceLineItems,
  taxReturns,
  documentLinks,
  engagements,
  engagementSigners,
} from "./schema";
import crypto from "crypto";

const CLIENT_EMAIL = "catbeardogmouse@proton.me";
const CLIENT_NAME = "Summit Tax Group";
const CLIENT_COMPANY = "Summit Tax Group LLC";

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const db = drizzle(sql);

  // Get the admin user (owner of all data)
  const [admin] = await db
    .select()
    .from(users)
    .where(eq(users.email, "mail@nexli.net"))
    .limit(1);

  if (!admin) {
    console.error("Admin user not found. Run the main seed first.");
    process.exit(1);
  }

  const ownerId = admin.id;
  console.log(`Admin user found: ${admin.name} (${admin.id})`);

  // ── Invoice 1: Paid ──
  const inv1Token = crypto.randomBytes(16).toString("hex");
  const [inv1] = await db
    .insert(invoices)
    .values({
      ownerId,
      clientName: CLIENT_NAME,
      clientEmail: CLIENT_EMAIL,
      clientCompany: CLIENT_COMPANY,
      invoiceNumber: "INV-2025-001",
      status: "paid",
      currency: "usd",
      subtotal: 250000, // $2,500
      taxRate: 0,
      taxAmount: 0,
      total: 250000,
      amountPaid: 250000,
      balanceDue: 0,
      issueDate: new Date("2025-01-15"),
      dueDate: new Date("2025-02-15"),
      paidAt: new Date("2025-02-10"),
      token: inv1Token,
      notes: "Monthly retainer — January 2025",
      terms: "Net 30",
    })
    .returning();

  await db.insert(invoiceLineItems).values([
    {
      invoiceId: inv1.id,
      description: "Monthly Retainer — Website Management & SEO",
      quantity: 100,
      unitPrice: 150000,
      amount: 150000,
      billingType: "monthly",
      order: 0,
    },
    {
      invoiceId: inv1.id,
      description: "Digital Rainmaker System — Platform License",
      quantity: 100,
      unitPrice: 100000,
      amount: 100000,
      billingType: "monthly",
      order: 1,
    },
  ]);
  console.log("Created Invoice 1 (Paid): INV-2025-001");

  // ── Invoice 2: Sent (unpaid) ──
  const inv2Token = crypto.randomBytes(16).toString("hex");
  const [inv2] = await db
    .insert(invoices)
    .values({
      ownerId,
      clientName: CLIENT_NAME,
      clientEmail: CLIENT_EMAIL,
      clientCompany: CLIENT_COMPANY,
      invoiceNumber: "INV-2025-002",
      status: "sent",
      currency: "usd",
      subtotal: 250000,
      taxRate: 0,
      taxAmount: 0,
      total: 250000,
      amountPaid: 0,
      balanceDue: 250000,
      issueDate: new Date("2025-02-15"),
      dueDate: new Date("2025-03-15"),
      token: inv2Token,
      notes: "Monthly retainer — February 2025",
      terms: "Net 30",
    })
    .returning();

  await db.insert(invoiceLineItems).values([
    {
      invoiceId: inv2.id,
      description: "Monthly Retainer — Website Management & SEO",
      quantity: 100,
      unitPrice: 150000,
      amount: 150000,
      billingType: "monthly",
      order: 0,
    },
    {
      invoiceId: inv2.id,
      description: "Digital Rainmaker System — Platform License",
      quantity: 100,
      unitPrice: 100000,
      amount: 100000,
      billingType: "monthly",
      order: 1,
    },
  ]);
  console.log("Created Invoice 2 (Sent): INV-2025-002");

  // ── Invoice 3: Overdue ──
  const inv3Token = crypto.randomBytes(16).toString("hex");
  const [inv3] = await db
    .insert(invoices)
    .values({
      ownerId,
      clientName: CLIENT_NAME,
      clientEmail: CLIENT_EMAIL,
      clientCompany: CLIENT_COMPANY,
      invoiceNumber: "INV-2025-003",
      status: "overdue",
      currency: "usd",
      subtotal: 350000,
      taxRate: 0,
      taxAmount: 0,
      total: 350000,
      amountPaid: 0,
      balanceDue: 350000,
      issueDate: new Date("2025-03-01"),
      dueDate: new Date("2025-03-10"),
      token: inv3Token,
      notes: "March retainer + website redesign deposit",
      terms: "Net 10",
    })
    .returning();

  await db.insert(invoiceLineItems).values([
    {
      invoiceId: inv3.id,
      description: "Monthly Retainer — Website Management & SEO",
      quantity: 100,
      unitPrice: 150000,
      amount: 150000,
      billingType: "monthly",
      order: 0,
    },
    {
      invoiceId: inv3.id,
      description: "Digital Rainmaker System — Platform License",
      quantity: 100,
      unitPrice: 100000,
      amount: 100000,
      billingType: "monthly",
      order: 1,
    },
    {
      invoiceId: inv3.id,
      description: "Website Redesign — Phase 1 Deposit",
      quantity: 100,
      unitPrice: 100000,
      amount: 100000,
      billingType: "one_time",
      order: 2,
    },
  ]);
  console.log("Created Invoice 3 (Overdue): INV-2025-003");

  // ── Tax Return 1: In Progress ──
  await db.insert(taxReturns).values({
    ownerId,
    clientName: CLIENT_NAME,
    clientEmail: CLIENT_EMAIL,
    clientCompany: CLIENT_COMPANY,
    taxYear: "2024",
    returnType: "1120S",
    status: "in_progress",
    dueDate: new Date("2025-03-15"),
  });
  console.log("Created Tax Return 1 (In Progress): 1120S 2024");

  // ── Tax Return 2: Filed ──
  await db.insert(taxReturns).values({
    ownerId,
    clientName: CLIENT_NAME,
    clientEmail: CLIENT_EMAIL,
    clientCompany: CLIENT_COMPANY,
    taxYear: "2024",
    returnType: "1040",
    status: "filed",
    dueDate: new Date("2025-04-15"),
    filedDate: new Date("2025-03-01"),
  });
  console.log("Created Tax Return 2 (Filed): 1040 2024");

  // ── Tax Return 3: Accepted ──
  await db.insert(taxReturns).values({
    ownerId,
    clientName: CLIENT_NAME,
    clientEmail: CLIENT_EMAIL,
    clientCompany: CLIENT_COMPANY,
    taxYear: "2023",
    returnType: "1120S",
    status: "accepted",
    dueDate: new Date("2024-03-15"),
    filedDate: new Date("2024-03-10"),
    acceptedDate: new Date("2024-03-12"),
  });
  console.log("Created Tax Return 3 (Accepted): 1120S 2023");

  // ── Document Upload Link (active) ──
  const linkToken = crypto.randomBytes(16).toString("hex");
  await db.insert(documentLinks).values({
    ownerId,
    token: linkToken,
    clientName: CLIENT_NAME,
    clientEmail: CLIENT_EMAIL,
    message: "Please upload your 2024 tax documents including W-2s, 1099s, and bank statements.",
    requiredDocuments: ["W-2", "1099-INT", "1099-DIV", "Bank Statements", "Prior Year Return"],
    maxUploads: 20,
    uploadCount: 0,
    status: "active",
    expiresAt: new Date("2025-04-15"),
    deliveryMethod: "email",
  });
  console.log("Created Document Upload Link (active)");

  // ── Engagement Letter ──
  const [eng] = await db
    .insert(engagements)
    .values({
      ownerId,
      subject: "2024 Tax Preparation Engagement Letter",
      content: `<h2>Engagement Letter</h2>
<p>Dear Summit Tax Group,</p>
<p>This letter confirms our understanding of the terms and objectives of our engagement and the nature and limitations of the services we will provide.</p>
<p><strong>Scope of Services:</strong> We will prepare your 2024 federal and state income tax returns based on information you provide to us.</p>
<p><strong>Fee Structure:</strong> Our fees for tax preparation services will be billed at our standard hourly rates. We estimate fees of $3,500 for the 1120S corporate return and $1,200 for the individual 1040 return.</p>
<p><strong>Client Responsibilities:</strong> You are responsible for providing us with accurate and complete financial records. You are also responsible for the accuracy of your tax returns.</p>
<p>Please sign below to confirm your agreement to these terms.</p>
<p>Sincerely,<br/>Marcel Allen<br/>Nexli Automation</p>`,
      status: "sent",
      sentAt: new Date("2025-02-01"),
      expiresAt: new Date("2025-04-15"),
    })
    .returning();

  const signerToken = crypto.randomBytes(16).toString("hex");
  await db.insert(engagementSigners).values({
    engagementId: eng.id,
    name: CLIENT_NAME,
    email: CLIENT_EMAIL,
    token: signerToken,
    order: 1,
    status: "sent",
    sentAt: new Date("2025-02-01"),
    role: "Managing Partner, Summit Tax Group LLC",
  });
  console.log("Created Engagement Letter (pending signature)");

  console.log("\n✅ Demo data created for:", CLIENT_EMAIL);
  console.log("   Portal URL: /portal");
  console.log("   Invoices: 3 (1 paid, 1 sent, 1 overdue)");
  console.log("   Tax Returns: 3 (1 in progress, 1 filed, 1 accepted)");
  console.log("   Upload Links: 1 (active, 5 required docs)");
  console.log("   Engagements: 1 (pending signature)");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
