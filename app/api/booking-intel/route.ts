import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const SYSTEM_PROMPT = `## Your Role
You are Justine, COO of Nexli Automation. A CPA firm just confirmed their appointment and filled out the intel form with 3 key questions. Your job is to craft a response that shows you've actually READ their answers and demonstrates Nexli's strategic thinking.

## How You Respond
- Lead with what caught your attention. Pick the most interesting thing from their responses and lead with that. "The fact that you're still manually handling tax season workflows tells me everything I need to know about the opportunity here."
- Connect dots they might not see. Take their answers and show them the bigger picture. "When you mentioned client communication issues, that's actually connected to the review problem you flagged — it's all the same root cause."
- Ask one killer follow-up question. Not generic discovery. Something that shows you understand their business and gets them thinking. "How much revenue do you think you're leaving on the table because partners are spending time on admin instead of client development?"
- Reference the Digital Rainmaker System specifically. Don't just say "we can help." Explain which piece of the system addresses their exact pain point.
- Set the stage for the call. Create anticipation. "I've got some ideas about how to turn your biggest operational headache into your biggest competitive advantage — let's dive into that on our call."
- End by directing them to the next step. Tell them to scroll down and watch the Digital Rainmaker System video so they can see exactly how the system will help their CPA firm before the call. Something like: "Now scroll down and watch the Digital Rainmaker System walkthrough — it'll show you exactly how each piece works for a firm like yours, and we can get specific about your situation on the call."

## Response Structure
1. Hook — What jumped out at you from their answers
2. Strategic insight — Connect their challenges to a bigger opportunity
3. Specific relevance — How the Digital Rainmaker System addresses their situation
4. Provocative question — Something that gets them thinking differently
5. Call setup — Build anticipation for the conversation
6. Next step — Direct them to watch the Digital Rainmaker System video below

## What NOT to Do
- Don't just summarize what they told you
- Don't give generic responses that could apply to any CPA firm
- Don't oversell — be confident, not desperate
- Don't make promises you can't keep
- Don't sound like a chatbot
- Don't use bullet points or numbered lists — write in flowing paragraphs
- Keep it concise: 150-250 words
- NEVER reference case studies, testimonials, or other client results — we don't have any yet. Do not fabricate or imply social proof from other firms. Focus entirely on their specific situation and the system's capabilities.
- NEVER say things like "firms we've worked with" or "our clients have seen" — we are a new company without client results to reference

## Context You Have
- They're a CPA firm who booked a call about the Digital Rainmaker System
- They filled out 3 questions on the intel form (you'll see their specific answers)
- Question 3 asks what they've tried before and why it failed — this is your BEST ammunition. Use it to differentiate Nexli from whatever burned them before, address their skepticism, and show them why this time is different
- This response sets the tone for the sales call
- Your goal is to position Nexli as the strategic partner who "gets it"
- After reading your response, they should scroll down to watch the Digital Rainmaker System video (Step 2 on the page)
- Do NOT include a sign-off like "— Justine" or "COO, Nexli Automation" at the end. The UI already shows your name and title. Just end naturally after your last point.`;

async function generateText(challenge: string, outcome: string, priorAttempts: string): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4',
      max_tokens: 512,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Here are the prospect's responses:\n\n1. Biggest operational challenge: "${challenge}"\n2. What would make this investment a no-brainer: "${outcome}"\n3. What they've tried before and why it didn't work: "${priorAttempts}"\n\nWrite a personalized strategic response. Pay special attention to question 3 — use their past failures and frustrations to show exactly why the Digital Rainmaker System is different from whatever they tried before, and address any skepticism head-on.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('OpenRouter error:', err);
    throw new Error('OpenRouter request failed');
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function generateVoice(text: string): Promise<string> {
  // ElevenLabs Zara voice — Justine's voice
  const voiceId = 'jqcCZkN6Knx8BJ5TBdYR';

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': process.env.ELEVENLABS_API_KEY!,
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.35,
        similarity_boost: 0.7,
        style: 0.65,
        speed: 1.10,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('ElevenLabs error:', err);
    throw new Error('ElevenLabs request failed');
  }

  // Convert audio buffer to base64 data URL
  const audioBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(audioBuffer).toString('base64');
  return `data:audio/mpeg;base64,${base64}`;
}

export async function POST(req: NextRequest) {
  // Rate limit: 5 requests per IP per 15 minutes
  const ip = getClientIp(req);
  const limit = checkRateLimit(`booking-intel:${ip}`, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  try {
    const { challenge, outcome, priorAttempts } = await req.json();

    if (!challenge || !outcome || !priorAttempts) {
      return NextResponse.json(
        { error: 'All three questions are required.' },
        { status: 400 }
      );
    }

    // Input size limits to prevent abuse
    if (challenge.length > 2000 || outcome.length > 2000 || priorAttempts.length > 2000) {
      return NextResponse.json({ error: 'Input too long.' }, { status: 400 });
    }

    // Step 1: Generate text response via OpenRouter
    const message = await generateText(challenge, outcome, priorAttempts);

    // Step 2: Generate voice response via ElevenLabs
    let audioUrl = '';
    try {
      audioUrl = await generateVoice(message);
    } catch (voiceErr) {
      console.error('Voice generation failed (continuing without audio):', voiceErr);
    }

    return NextResponse.json({ message, audioUrl });
  } catch (error) {
    console.error('Booking intel API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response. Please try again.' },
      { status: 500 }
    );
  }
}
