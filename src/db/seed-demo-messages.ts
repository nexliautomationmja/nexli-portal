import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { users, portalMessages } from "./schema";

const CLIENT_EMAIL = "catbeardogmouse@proton.me";

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const db = drizzle(sql);

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

  // Back-and-forth conversation about onboarding, engagement letter, invoices
  const messages = [
    {
      senderType: "cpa",
      message:
        "Hi Summit Tax Group! Welcome to the Nexli portal. I've sent over your engagement letter for the 2024 tax prep services. You can review and sign it directly from the portal. Let me know if you have any questions.",
      read: true,
      createdAt: new Date("2025-02-01T10:00:00Z"),
    },
    {
      senderType: "client",
      message:
        "Thanks Marcel! We received the engagement letter. Just reviewing the fee structure with our managing partner — should have the signature back to you by end of week.",
      read: true,
      createdAt: new Date("2025-02-02T14:30:00Z"),
    },
    {
      senderType: "cpa",
      message:
        "Sounds good. No rush — the letter is valid through April 15. Also, I've sent your January invoice (INV-2025-001) for the monthly retainer. You can view and pay it through the portal as well.",
      read: true,
      createdAt: new Date("2025-02-03T09:15:00Z"),
    },
    {
      senderType: "client",
      message:
        "Got it. We just submitted the payment for January. Can you confirm it went through on your end?",
      read: true,
      createdAt: new Date("2025-02-10T11:45:00Z"),
    },
    {
      senderType: "cpa",
      message:
        "Payment received — thank you! INV-2025-001 is marked as paid. I'll have the February and March invoices sent out on schedule. Let me know when you're ready to sign the engagement letter.",
      read: true,
      createdAt: new Date("2025-02-10T13:00:00Z"),
    },
    {
      senderType: "client",
      message:
        "Quick question — we noticed the March invoice (INV-2025-003) includes a website redesign deposit. Can you send over the project scope before we approve that one?",
      read: false,
      createdAt: new Date("2025-03-12T16:20:00Z"),
    },
  ];

  for (const msg of messages) {
    await db.insert(portalMessages).values({
      ownerId,
      clientEmail: CLIENT_EMAIL,
      senderType: msg.senderType,
      message: msg.message,
      read: msg.read,
      createdAt: msg.createdAt,
    });
  }

  console.log(`\nInserted ${messages.length} portal messages for ${CLIENT_EMAIL}`);
  console.log("  - 5 read messages (conversation history)");
  console.log("  - 1 unread message from client (triggers badge)");
  console.log("\nDone!");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
