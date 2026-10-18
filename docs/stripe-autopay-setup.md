# Stripe setup — Digital Rainmaker autopay

Autopay for the DRS monthly invoices (`platform_monthly` $9,997 / `ad_spend_monthly` $5,000)
runs on Nexli's **platform** Stripe account. Code: `src/lib/autopay.ts`,
`src/lib/payments-webhook-handlers.ts`, `src/app/api/webhooks/payments/route.ts`.
Do all of the following in **live mode** (and test mode if you test there first).

## 1. Webhook endpoint

Dashboard → Developers → Webhooks → the platform endpoint
`https://portal.nexli.net/api/webhooks/payments` → "Select events". It must listen to:

- [ ] `checkout.session.completed`
- [ ] `checkout.session.async_payment_succeeded`
- [ ] `checkout.session.async_payment_failed`
- [ ] `invoice.paid`
- [ ] `invoice.payment_failed`
- [ ] `invoice.payment_action_required`
- [ ] `customer.subscription.updated`
- [ ] `customer.subscription.deleted`

The signing secret stays the same (`STRIPE_WEBHOOK_SECRET`) — only the event list changes.
Not the Connect endpoint (`/api/webhooks/connect`); autopay never touches connected accounts.

## 2. ACH Direct Debit for subscriptions

Settings → Payments → Payment methods → **ACH Direct Debit**: enabled (it already is for
one-time invoices). Confirm it is allowed for **subscriptions / recurring** payments and that
Financial Connections (instant bank verification) is on — checkout uses
`verification_method: "automatic"` (instant, with micro-deposits as fallback).

## 3. Customer Portal

Settings → Billing → **Customer portal** (clients reach it from the "Manage payment method"
button on their invoice page):

- [ ] **Payment methods: allow customers to update** their payment method — ON
- [ ] **Invoice history: show** — ON
- [ ] **Cancel subscriptions** — OFF (cancellation goes through Marcel; the contract term applies)
- [ ] **Switch plans / update subscriptions (quantities, prices)** — OFF
- [ ] Customer information updates (email / billing address) — optional
- [ ] Business info: Nexli name, privacy policy + terms links, default return URL
      `https://portal.nexli.net`

Note: the portal lets a client add a method of a different type too. The rule is "same type
only; switching bank ↔ card goes through Marcel" (prices differ: card is the card price), so if a
client switches type in the portal, Marcel re-prices the subscription in Stripe manually.

## 4. Retries for failed payments

Settings → Billing → Subscriptions and emails → **Manage failed payments**:

- [ ] **Smart Retries** — ON (recommended: up to 8 tries within 2 weeks)
- [ ] After all retries fail: **mark the subscription as unpaid** (or leave past due) — do NOT
      auto-cancel; Marcel decides. (A cancellation fires `customer.subscription.deleted` and
      notifies the owner.)

## 5. Stripe customer emails

Settings → Billing → Subscriptions and emails → Customer emails:

- [ ] **Send emails when card payments fail** — ON
- [ ] **Send emails to customers to update expiring cards** — ON
- [ ] **Send a reminder email when a payment requires 3D Secure / action** — ON
- [ ] Settings → Payments → ACH Direct Debit: **mandate / debit notification emails** — ON
      (NACHA requires the client is notified of the mandate and recurring debits)
- [ ] Settings → Customer emails → **Successful payments** — optional (the portal already sends
      its own receipt for every monthly charge; turning this on means two receipts)

## 6. Smoke test (test mode)

1. Build complete on a test DRS engagement → open the first monthly invoice → pay by card
   (4242…) → invoice turns paid, "clear to launch ads" notification fires, invoice metadata has
   `autopay.subscriptionId`.
2. Stripe Dashboard → the subscription → "Advance test clock" one month (or use a test clock
   customer) → `invoice.paid` (subscription_cycle) creates a new paid portal invoice and the
   client receipt email.
3. Repeat with bank (test routing 110000000 / account 000123456789) → the invoice stays unpaid
   with "pending" until `invoice.paid` settles it.
4. Card 4000 0000 0000 0341 (attach succeeds, charge fails) on a cycle → owner gets
   "Autopay failed" and the client gets the "Update payment / pay now" email.
