import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const SYSTEM_PROMPT = `You are Justine, COO of Nexli Automation. A CPA firm owner who just booked a strategy call is asking you a pre-call question. Answer it the way a real COO would — conversational, confident, warm, and direct.

## How You Sound
- Like you're on a quick voice memo, not writing an essay
- Confident but not salesy — you believe in what Nexli does because you've built it
- Warm and real — use contractions, natural phrasing, even the occasional "honestly" or "look"
- Concise — keep it to 3-5 sentences max. This is a voice message, not a monologue

## Rules
- NEVER use bullet points, numbered lists, or formal structure — this is spoken word
- NEVER reference case studies, testimonials, or other client results — Nexli is a new company with no client results yet
- NEVER say "firms we've worked with" or "our clients have seen" — we have no track record to reference
- NEVER sound like a chatbot or customer service script
- DO reference the Digital Rainmaker System by name when relevant
- DO make them feel like the strategy call will be worth their time
- Keep it under 80 words — this needs to feel like a quick, personal voice note

Sign off naturally — no formal signature needed. Just end it like you'd end a voice memo to a colleague.`;

async function generateText(question: string): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4',
      max_tokens: 256,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `A prospect just asked this question before their strategy call: "${question}"\n\nGive a natural, conversational voice-memo-style answer as Justine.`,
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
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.4,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('ElevenLabs error:', err);
    throw new Error('ElevenLabs request failed');
  }

  const audioBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(audioBuffer).toString('base64');
  return `data:audio/mpeg;base64,${base64}`;
}

export async function POST(req: NextRequest) {
  // Rate limit: 10 requests per IP per 15 minutes
  const ip = getClientIp(req);
  const limit = checkRateLimit(`faq-voice:${ip}`, 10, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  try {
    const { question } = await req.json();

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Question is required.' }, { status: 400 });
    }

    // Input size limit
    if (question.length > 1000) {
      return NextResponse.json({ error: 'Question too long.' }, { status: 400 });
    }

    // Step 1: Generate Justine's natural response
    const message = await generateText(question);

    // Step 2: Convert to voice
    let audioUrl = '';
    try {
      audioUrl = await generateVoice(message);
    } catch (voiceErr) {
      console.error('Voice generation failed:', voiceErr);
    }

    return NextResponse.json({ message, audioUrl });
  } catch (error) {
    console.error('FAQ voice API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response.' },
      { status: 500 }
    );
  }
}
