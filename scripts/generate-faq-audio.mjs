// One-time script to generate pre-recorded Justine FAQ voice messages via ElevenLabs
// Usage: node scripts/generate-faq-audio.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'audio', 'faq');

const ELEVENLABS_API_KEY = 'sk_ec25f83327c746782ecd46ca698e706da6469cf00c4b228d';
const VOICE_ID = 'jqcCZkN6Knx8BJ5TBdYR'; // Justine's voice (Zara)

const faqScripts = [
  {
    filename: 'faq-security.mp3',
    text: `Look, I totally get the concern — you're handling sensitive financial data, social security numbers, the works. Here's what most people don't realize: our document portal runs on Supabase, which is backed by AWS — the same infrastructure the IRS uses, the same systems hospitals and government agencies trust with their most sensitive data. We're talking SOC 2 Type II compliance, end-to-end encryption, the whole nine. Honestly? If it's good enough for the IRS, it's good enough for your firm. And I'd ask you this — what are you using right now? Because if it's Dropbox or shared drives or emailing documents back and forth, you're actually taking way more risk than you realize. You're not just getting a portal — you're getting a real security upgrade.`,
  },
  {
    filename: 'faq-data-ownership.mp3',
    text: `This is honestly one of the biggest things that sets us apart. With most platforms — Canopy, TaxDome, whatever — your data lives on their servers. You cancel? You lose access. They raise prices? You pay or you start over. With us, you own everything. Your client data, your documents, your templates — all of it. We build it, you own it. No hostage situation, no per-seat fees holding you captive. And if you ever want to take it somewhere else, it's yours to take. That's how it should be.`,
  },
  {
    filename: 'faq-website.mp3',
    text: `Honestly, I hear this all the time, and I get it. But here's the thing — having a website and having a website that actually brings in clients are two completely different things. Most CPA firm websites are basically digital business cards. They look fine, but they don't convert. What we build is a client acquisition engine — it's designed to turn visitors into booked consultations. So it's not about replacing what you have, it's about upgrading to something that actually works for you around the clock.`,
  },
  {
    filename: 'faq-time.mp3',
    text: `I totally understand — tax season, client deadlines, you're slammed. But here's the thing: we handle everything. You're not building this yourself. We design it, we build it, we launch it. Your involvement is basically one strategy call and maybe a couple of quick approvals. That's it. The whole point of the Digital Rainmaker System is to save you time, not eat more of it. And once it's running, it works for you while you're focused on your clients.`,
  },
  {
    filename: 'faq-different.mp3',
    text: `Great question. Most agencies build you a pretty website, hand you the keys, and disappear. We're not an agency — we're building you an entire system. The Digital Rainmaker System combines your website, AI automation, a secure document portal, and a review engine into one platform you actually own. No monthly retainers for basic updates, no relying on a third party for every little change. You're not just getting a website — you're getting a security upgrade, an automation layer, and a client acquisition engine. That's the difference.`,
  },
  {
    filename: 'faq-disruption.mp3',
    text: `I hear this concern all the time, and honestly it's the opposite of what happens. Your clients are going to love this. Instead of emailing documents back and forth or using some clunky portal with a terrible interface, they get a clean, secure place to upload everything — encrypted, compliant, professional. It actually makes their experience better. And for your team, the transition is seamless. We handle the setup, the migration, everything. Your clients just see a better, more polished version of working with your firm. Nobody's disrupted — everybody's upgraded.`,
  },
];

async function generateAudio(text, filename) {
  console.log(`Generating: ${filename}...`);

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.4,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Failed to generate ${filename}:`, err);
    return false;
  }

  const audioBuffer = await res.arrayBuffer();
  const outputPath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(outputPath, Buffer.from(audioBuffer));
  console.log(`Saved: ${outputPath}`);
  return true;
}

async function main() {
  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`\nGenerating ${faqScripts.length} FAQ audio files with Justine's voice...\n`);

  let success = 0;
  for (const script of faqScripts) {
    const ok = await generateAudio(script.text, script.filename);
    if (ok) success++;
    // Small delay between requests to be nice to the API
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\nDone! Generated ${success}/${faqScripts.length} audio files.`);
  console.log(`Files saved to: ${OUTPUT_DIR}\n`);
}

main().catch(console.error);
