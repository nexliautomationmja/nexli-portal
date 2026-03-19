import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { engagementTemplates } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const TEMPLATE_NAME = "Digital Rainmaker System";

const TEMPLATE_CONTENT = `DIGITAL RAINMAKER SYSTEM
SERVICE ENGAGEMENT AGREEMENT

This Service Engagement Agreement ("Agreement") is entered into as of the date of last signature below, by and between:

Service Provider: Nexli Automation LLC, a Florida limited liability company ("Provider" or "Nexli")

Client: [CLIENT NAME / COMPANY] ("Client")


1. SCOPE OF SERVICES

Provider agrees to deliver the Digital Rainmaker System, a comprehensive digital infrastructure and automation platform, consisting of the following:

Phase 1 — Setup & Build (30 Days Maximum)

a) Website Development & Deployment — Design and build a professional website under Client's domain. Client must provide DNS editor access with their hosting provider to enable deployment.

b) Nexli Whitelabel Dashboard Setup — Configure Client's dedicated whitelabel dashboard with automated workflows and client management capabilities.

c) AI Automation Implementation — Deploy AI-powered automations including lead capture, follow-up sequences, appointment scheduling, and client communication workflows.

d) A2P 10DLC Verification — Register and verify Client's business for compliant SMS/text messaging through the Campaign Registry.

e) Payment Processing Integration — Create a Stripe account for Client or connect Client's existing payment processor via API to enable invoicing and payment collection through the dashboard.


2. FEE STRUCTURE

a) Initial Setup Fee: $10,000.00 USD — Due upon execution of this Agreement. This payment activates the Agreement and authorizes Provider to begin work.

b) Final Setup Fee: $10,000.00 USD — Due thirty (30) calendar days after execution of this Agreement, along with the first month of the recurring subscription.

c) Monthly Subscription: $997.00 USD/month — Recurring charge for continued access to the Digital Rainmaker System, including AI automations, dashboard access, and technical support. Billed monthly via ACH bank transfer.

d) Total Setup Investment: $20,000.00 USD
e) Ongoing Monthly: $997.00 USD/month


3. PAYMENT TERMS

a) All payments are processed via ACH bank transfer through Stripe.

b) All fees are non-refundable. No refunds will be issued under any circumstances once payment is received.

c) This Agreement does not become effective and Provider has no obligation to begin work until the Initial Setup Fee ($10,000.00) is received.

d) The Monthly Subscription is month-to-month with no minimum commitment. Client may cancel at any time; however, no refunds or pro-rated credits will be issued for the current billing period. Client retains access through the end of the paid billing cycle.


4. PROJECT TIMELINE & CLIENT COOPERATION

a) The setup phase (Phase 1) shall be completed within thirty (30) calendar days of this Agreement's execution.

b) Client agrees to provide timely cooperation, including but not limited to: DNS editor access, business information, brand assets, content materials, and responsiveness to Provider communications.

c) If Client fails to provide required access, materials, or cooperation within the 30-day setup period, the project shall be deemed complete regardless of outstanding deliverables. The Final Setup Fee and Monthly Subscription shall become due as scheduled. Provider is not responsible for delays caused by Client's non-cooperation.


5. INTELLECTUAL PROPERTY

a) Client Ownership: Client retains full ownership of their website content, brand assets, domain name, and any original content created specifically for Client.

b) Provider Ownership: Provider retains all ownership rights to the Digital Rainmaker System software, proprietary AI automations, dashboard platform, workflow templates, and underlying technology. These remain the intellectual property of Nexli Automation LLC.

c) License Grant: Provider grants Client a non-exclusive, non-transferable, revocable license to use the Digital Rainmaker System software and automations for the duration of the active subscription. Upon termination or non-payment of the Monthly Subscription, Client's access to Provider's proprietary systems shall be immediately terminated.

d) Client shall not reverse engineer, copy, modify, sublicense, or redistribute any of Provider's proprietary software, automations, or technology.


6. ADDITIONAL SERVICES

Major website redesigns, feature additions, or custom development beyond the scope defined in Section 1 shall be quoted and billed on a project basis at Provider's then-current rates, subject to a separate written agreement.


7. LIMITATION OF LIABILITY

a) Provider's total cumulative liability under this Agreement shall not exceed the total fees actually paid by Client to Provider in the twelve (12) months preceding the claim.

b) In no event shall Provider be liable for any indirect, incidental, consequential, special, or exemplary damages, including but not limited to loss of revenue, profits, data, business opportunities, or goodwill, even if advised of the possibility of such damages.

c) Provider does not guarantee specific business results, revenue increases, lead generation volumes, or return on investment. Results depend on market conditions, Client's industry, and Client's use of the system.

d) Provider is not liable for any third-party service disruptions, including but not limited to Stripe, DNS providers, or telecommunications carriers.


8. INDEMNIFICATION

Client agrees to indemnify, defend, and hold harmless Provider, its members, officers, employees, and agents from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising out of or related to: (a) Client's use of the Digital Rainmaker System; (b) Client's violation of any applicable law or regulation; (c) any content, data, or materials provided by Client.


9. CONFIDENTIALITY

Both parties agree to maintain the confidentiality of proprietary information disclosed during the course of this engagement. This obligation survives termination of this Agreement.


10. TERMINATION

a) Either party may terminate the Monthly Subscription with thirty (30) days' written notice. Access continues through the end of the current paid billing cycle.

b) Provider may immediately suspend or terminate access for non-payment, breach of this Agreement, or misuse of the platform.

c) Upon termination, Client retains ownership of their website and content per Section 5(a). All access to Provider's proprietary systems ceases per Section 5(c).


11. DISPUTE RESOLUTION

Any dispute arising out of or relating to this Agreement shall be resolved by binding arbitration administered in the State of Florida, in accordance with the rules of the American Arbitration Association. The arbitrator's decision shall be final and binding. Each party shall bear its own costs and attorneys' fees.


12. GOVERNING LAW

This Agreement shall be governed by and construed in accordance with the laws of the State of Florida, without regard to conflicts of law principles.


13. ENTIRE AGREEMENT

This Agreement constitutes the entire agreement between the parties and supersedes all prior or contemporaneous negotiations, representations, warranties, and agreements, whether written or oral. This Agreement may not be amended except in writing signed by both parties.


14. ELECTRONIC SIGNATURES

The parties agree that electronic signatures are legally binding and this Agreement may be executed electronically in compliance with the ESIGN Act (15 U.S.C. § 7001) and the Uniform Electronic Transactions Act (UETA).`;

const INVOICE_SCHEDULE = [
  {
    label: "Initial Setup Fee",
    daysAfterSigning: 0,
    lineItems: [
      {
        description: "Digital Rainmaker System — Initial Setup Fee",
        quantity: 1,
        unitPriceCents: 1000000, // $10,000
        billingType: "one_time" as const,
      },
    ],
  },
  {
    label: "Final Setup Fee + Monthly Subscription",
    daysAfterSigning: 30,
    lineItems: [
      {
        description: "Digital Rainmaker System — Remaining Setup Fee",
        quantity: 1,
        unitPriceCents: 1000000, // $10,000
        billingType: "one_time" as const,
      },
      {
        description: "Digital Rainmaker System — Monthly Subscription",
        quantity: 1,
        unitPriceCents: 99700, // $997
        billingType: "monthly" as const,
      },
    ],
  },
];

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if template already exists for this user
  const existing = await db
    .select()
    .from(engagementTemplates)
    .where(
      and(
        eq(engagementTemplates.ownerId, session.user.id),
        eq(engagementTemplates.name, TEMPLATE_NAME)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Update existing template
    const [updated] = await db
      .update(engagementTemplates)
      .set({
        content: TEMPLATE_CONTENT,
        invoiceSchedule: INVOICE_SCHEDULE,
        updatedAt: new Date(),
      })
      .where(eq(engagementTemplates.id, existing[0].id))
      .returning();

    return NextResponse.json({ template: updated, action: "updated" });
  }

  // Create new template
  const [template] = await db
    .insert(engagementTemplates)
    .values({
      ownerId: session.user.id,
      name: TEMPLATE_NAME,
      content: TEMPLATE_CONTENT,
      invoiceSchedule: INVOICE_SCHEDULE,
    })
    .returning();

  return NextResponse.json({ template, action: "created" }, { status: 201 });
}
