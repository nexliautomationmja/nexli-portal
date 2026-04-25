/**
 * Seed demo invoices for Summit Tax Group under admin account
 *
 * Usage:
 *   npx tsx scripts/seed-demo-invoices.ts
 *
 * Requires DATABASE_URL in .env.local
 */

import { neon } from "@neondatabase/serverless";
import crypto from "crypto";

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!dbUrl) { console.error("No DATABASE_URL"); process.exit(1); }
const sql = neon(dbUrl);

function generateToken() {
  return crypto.randomBytes(32).toString("base64url");
}

async function main() {
  console.log("Looking up admin user mail@nexli.net...\n");

  const users = await sql`SELECT id, name, email FROM users WHERE email = 'mail@nexli.net' LIMIT 1`;
  if (users.length === 0) {
    console.error("Admin user not found!");
    process.exit(1);
  }
  const owner = users[0];
  console.log(`Found owner: ${owner.name || owner.email} (${owner.id})\n`);

  const now = new Date();

  const demoInvoices = [
    {
      clientName: "Summit Tax Group",
      clientEmail: "catbeardogmouse@proton.me",
      clientCompany: "Summit Tax Group LLC",
      invoiceNumber: "INV-202604-0010",
      status: "sent",
      currency: "usd",
      subtotal: 250000,
      taxRate: 0,
      taxAmount: 0,
      total: 250000,
      amountPaid: 0,
      balanceDue: 250000,
      dueDate: new Date(now.getTime() + 14 * 86400000),
      issueDate: new Date(now.getTime() - 2 * 86400000),
      sentAt: new Date(now.getTime() - 2 * 86400000),
      notes: "Thank you for choosing our tax preparation services.",
      terms: "Payment due within 14 days of invoice date.",
      lineItems: [
        { description: "2025 Corporate Tax Return Preparation (1120S)", quantity: 100, unitPrice: 175000, order: 0 },
        { description: "State Tax Filing — California", quantity: 100, unitPrice: 50000, order: 1 },
        { description: "Quarterly Estimated Tax Calculations", quantity: 100, unitPrice: 25000, order: 2 },
      ],
    },
    {
      clientName: "Summit Tax Group",
      clientEmail: "catbeardogmouse@proton.me",
      clientCompany: "Summit Tax Group LLC",
      invoiceNumber: "INV-202604-0011",
      status: "paid",
      currency: "usd",
      subtotal: 85000,
      taxRate: 0,
      taxAmount: 0,
      total: 85000,
      amountPaid: 85000,
      balanceDue: 0,
      dueDate: new Date(now.getTime() - 5 * 86400000),
      issueDate: new Date(now.getTime() - 20 * 86400000),
      sentAt: new Date(now.getTime() - 20 * 86400000),
      paidAt: new Date(now.getTime() - 7 * 86400000),
      notes: "Paid in full — thank you!",
      terms: null,
      lineItems: [
        { description: "Bookkeeping Services — March 2026", quantity: 100, unitPrice: 45000, order: 0 },
        { description: "Payroll Processing — March 2026", quantity: 100, unitPrice: 25000, order: 1 },
        { description: "QuickBooks Reconciliation", quantity: 100, unitPrice: 15000, order: 2 },
      ],
    },
    {
      clientName: "Summit Tax Group",
      clientEmail: "catbeardogmouse@proton.me",
      clientCompany: "Summit Tax Group LLC",
      invoiceNumber: "INV-202604-0012",
      status: "overdue",
      currency: "usd",
      subtotal: 125000,
      taxRate: 0,
      taxAmount: 0,
      total: 125000,
      amountPaid: 0,
      balanceDue: 125000,
      dueDate: new Date(now.getTime() - 10 * 86400000),
      issueDate: new Date(now.getTime() - 25 * 86400000),
      sentAt: new Date(now.getTime() - 25 * 86400000),
      notes: "Please remit payment at your earliest convenience.",
      terms: "Payment is past due. Late fees may apply after 30 days.",
      lineItems: [
        { description: "Annual Tax Planning & Strategy Consultation", quantity: 100, unitPrice: 75000, order: 0 },
        { description: "Entity Structure Review & Optimization", quantity: 100, unitPrice: 50000, order: 1 },
      ],
    },
    {
      clientName: "Summit Tax Group",
      clientEmail: "catbeardogmouse@proton.me",
      clientCompany: "Summit Tax Group LLC",
      invoiceNumber: "INV-202604-0013",
      status: "draft",
      currency: "usd",
      subtotal: 350000,
      taxRate: 0,
      taxAmount: 0,
      total: 350000,
      amountPaid: 0,
      balanceDue: 350000,
      dueDate: new Date(now.getTime() + 30 * 86400000),
      issueDate: now,
      sentAt: null,
      notes: "Annual advisory retainer — Q2 2026.",
      terms: null,
      lineItems: [
        { description: "Advisory Retainer — Q2 2026", quantity: 100, unitPrice: 200000, order: 0 },
        { description: "Multi-State Nexus Analysis", quantity: 100, unitPrice: 100000, order: 1 },
        { description: "R&D Tax Credit Assessment", quantity: 100, unitPrice: 50000, order: 2 },
      ],
    },
    {
      clientName: "Summit Tax Group",
      clientEmail: "catbeardogmouse@proton.me",
      clientCompany: "Summit Tax Group LLC",
      invoiceNumber: "INV-202604-0014",
      status: "partial",
      currency: "usd",
      subtotal: 180000,
      taxRate: 0,
      taxAmount: 0,
      total: 180000,
      amountPaid: 90000,
      balanceDue: 90000,
      dueDate: new Date(now.getTime() + 7 * 86400000),
      issueDate: new Date(now.getTime() - 10 * 86400000),
      sentAt: new Date(now.getTime() - 10 * 86400000),
      notes: "Partial payment received. Remaining balance due by due date.",
      terms: null,
      lineItems: [
        { description: "Business Formation & Compliance Package", quantity: 100, unitPrice: 120000, order: 0 },
        { description: "Operating Agreement Drafting", quantity: 100, unitPrice: 35000, order: 1 },
        { description: "EIN Application & State Registrations", quantity: 100, unitPrice: 25000, order: 2 },
      ],
    },
  ];

  for (const inv of demoInvoices) {
    const token = generateToken();

    const [created] = await sql`
      INSERT INTO invoices (
        owner_id, client_name, client_email, client_company,
        invoice_number, status, currency, token,
        subtotal, tax_rate, tax_amount, total,
        amount_paid, balance_due,
        issue_date, due_date, sent_at, paid_at,
        notes, terms
      ) VALUES (
        ${owner.id}, ${inv.clientName}, ${inv.clientEmail}, ${inv.clientCompany},
        ${inv.invoiceNumber}, ${inv.status}, ${inv.currency}, ${token},
        ${inv.subtotal}, ${inv.taxRate}, ${inv.taxAmount}, ${inv.total},
        ${inv.amountPaid}, ${inv.balanceDue},
        ${inv.issueDate.toISOString()}, ${inv.dueDate.toISOString()},
        ${inv.sentAt ? inv.sentAt.toISOString() : null},
        ${(inv as any).paidAt ? (inv as any).paidAt.toISOString() : null},
        ${inv.notes}, ${inv.terms}
      ) RETURNING id
    `;

    for (const li of inv.lineItems) {
      const amount = Math.round((li.quantity / 100) * li.unitPrice);
      await sql`
        INSERT INTO invoice_line_items (
          invoice_id, description, quantity, unit_price, amount, "order"
        ) VALUES (
          ${created.id}, ${li.description}, ${li.quantity}, ${li.unitPrice}, ${amount}, ${li.order}
        )
      `;
    }

    const statusIcon =
      inv.status === "paid" ? "✓" :
      inv.status === "overdue" ? "!" :
      inv.status === "partial" ? "◐" :
      inv.status === "sent" ? "→" : "○";

    console.log(
      `${statusIcon} ${inv.invoiceNumber} — $${(inv.total / 100).toFixed(2)} [${inv.status}] — ${inv.lineItems[0].description}`
    );
  }

  console.log(`\n══════════════════════════════════════════`);
  console.log(`  ${demoInvoices.length} demo invoices created for Summit Tax Group`);
  console.log(`  Billed to: catbeardogmouse@proton.me`);
  console.log(`  Owner: ${owner.email}`);
  console.log(`══════════════════════════════════════════`);
}

main().catch(console.error);
