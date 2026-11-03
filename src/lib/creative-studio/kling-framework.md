# Kling talking-head creatives & VSLs

This is the framework for producing Nexli's AI-presenter videos (persona: **Daniela**) with Kling AI's native audio. The user gives you:

1. **A frame image (or several):** the exact opening frame for every clip.
2. **An idea or angle:** the belief to shatter, the offer, the CTA destination, plus any must-say lines.

You return a clip-by-clip script. Each clip has a **Line**, a **Register**, an **Action**, an **Edit/caption** and a **complete Kling prompt**. Show it as an HTML review page, and render on Kling only after the user approves.

---

## 1. Standing rules (never break these)

**Clip format**
- **One line per clip, ≤ 12 seconds.** Kling drifts past 12 s. Split long lines into two clips.
- **The spoken line goes inside the Kling prompt.** Use native Kling audio, not ElevenLabs-style voice settings.
- **Aspect ratio:** ads are 9:16 vertical, VSLs are 16:9 horizontal.

**How to write the words**
- Write **"C-P-A"** (never CPA) in spoken lines, and add a cue for each letter.
- **Dollar figures as digits** in the line ($9,997, $15,000).
- For Nexli's offer, say **"investment"**, never "price".
- **Numbers must be pronounceable.** Every number Daniela says gets a pronunciation strategy (see §6).

**Approval and redos**
- **New scripts:** show them as an HTML review page first and wait for approval before rendering.
- **Redos and swaps of single clips:** render directly.
- **Keep a copy of the previous version** whenever you rewrite a script (e.g. `*_v1_original.html` plus a backup of the builder). The user may revert.

**Copy guardrails**
- No guarantees of results. No savior positioning ("we're not here to save your firm / babysit").
- No stereotype jokes. No unverifiable claims; soften absolutes ("rarely", "usually").
- Use "legally" when talking about keeping money from the IRS.

---

## 2. Intake: what to settle before writing

Ask only what you can't infer:

- **Format:** ad (9:16) or VSL (16:9). Also: single presenter, 2-founder duo, or 3-founder trio.
- **Angle:**
  - **Old belief:** what the prospect believes now, in their words.
  - **New belief:** what replaces it.
  - **Proof or math:** numbers must add up. Recompute every equation, e.g. 300 × $800 = $240,000 vs 50 × $15,000 = $750,000.
- **CTA destination.** Ads point to an angle-specific VSL ("I made a video that shows…"), or to a lead magnet. VSLs end with booking a call.
- **Required lines:** qualifier, scarcity, investment, anything the user dictated verbatim.
- **Frames:** which image belongs to which video when several are sent. Default to the order sent and say so.

---

## 3. Script structures

### 3a. Ad creative (belief-shift ad, 7–11 clips, 9:16)

| # | Section | Job |
|---|---|---|
| 1 | Hook | Call out the audience plus the old belief or pain. "If you think your C-P-A firm needs more clients to grow…" |
| 2–4 | Shatter | Why the old belief caps them. Concrete mechanism, short punchy lines. |
| 5–6 | New belief | The reframe, with math or an analogy. |
| Q | Qualifier | "This is for C-P-A firms doing 750K to 1 million a year, who know they can 10x their business." Goes right before the CTA. |
| n-1 | CTA bridge | "I made a video that shows exactly how…" (angle-specific VSL) |
| n | Close | "Tap below and watch it. …" Point one finger down toward the lower edge of the frame. |

Variants per angle:
- 2 single-presenter ads (one locked-off camera, one handheld selfie).
- 1 duo ad (old belief vs new belief).
- 1 trio ad (smallest firm, stuck mid-size firm, scaled firm).

In multi-person ads the **new-belief speaker (RIGHT)** delivers the qualifier and CTA.

### 3b. VSL (30–50 clips, 16:9, single presenter)

| Section | Job |
|---|---|
| 1 · Hook | Headline as a fact, then "give me three minutes" or "no fluff, everything up front". |
| 2 · Shatter the old belief | 6–12 clips. Mechanism, an analogy (rain vs irrigation; "would you guarantee a client their refund before seeing their books?"), and the bigger hidden cost. |
| 3 · The new belief | 3–6 clips. The new rule, short and punchy, fair to what they have now. |
| 4 · What you get | Walk the system front to back (see §8). |
| 5 · Who this is for | Qualifier line, plus one angle-specific "owners who…" line. |
| 6 · Who this isn't for | Not a rescue. We don't babysit. "If you won't show up for your own firm, we can't show up for you." Shopping for a guarantee or the cheapest option → plenty of agencies for that. |
| 7 · The investment | Transparent monthly investment, ad spend portion, setup fee and contract walked through on the call, real scarcity. |
| 8 · Book the call | Pick a time below. The next page shows the entire system. "Pick a spot below, and I'll see you on the next page." |

Sections 5–8 are a **shared tail** reused across every VSL. Only the angle-specific "who it's for" line changes.

Scarcity wording: "we're only taking on three more firms. That way, our full focus goes into one thing: scaling their business." Never word it as "we want to get those firms results first", because it makes them doubt you can perform.

---

## 4. Per-clip fields

For every clip produce:

- **Section**
- **Speaker** (multi-person only): `LEFT · old belief` / `RIGHT · new belief`, or `LEFT · smallest firm` / `CENTER · mid-size firm, stuck` / `RIGHT · scaled firm (the new belief)`.
- **Line:** exactly what she says, one idea, conversational.
- **Register:** delivery direction, 3–10 words, e.g. "Dry and matter-of-fact", "Warm and vivid, painting the analogy", "Short and certain, the punchline".
- **Action:** one small physical beat that fits the frame. Examples:
  - leans forward slightly
  - counts lightly on the fingers of one hand
  - opens one hand toward camera
  - small shake of the head
  - raises her eyebrows slightly
  - points one finger down toward the lower edge of frame (CTA)

  Never write an action the pose can't support (e.g. "hands over her lap" when she is behind a desk).
- **Edit:** caption, overlay or graphic note for the editor (e.g. `Caption: THE VOLUME TRAP`, `Graphic: 300 × $800 vs 50 × $15,000`). It never appears in the prompt.
- **Duration:** `min(12, max(4, ceil(words/2.4 + 1.5) + (1 if "$" in line)))` seconds. If a line hits 12 s with more than ~22 words, split it.

---

## 5. Writing the frame description

Look at the image and describe, specifically and factually:

- **Subject:** "Daniela, the woman with long dark wavy hair and small gold hoop earrings[, a thin gold heart necklace],". Then:
  - exact outfit colour and cut, e.g. "a pale butter-yellow tailored blazer with gold buttons over a black satin shirt"
  - the seat
  - the pose in the frame, e.g. "behind a light wooden desk, facing camera, her right elbow on the desk with her fingertips resting lightly under her chin and her left hand resting flat on the desk; as she talks she moves naturally from this pose"
- **Room:** props by side ("On the left side of the desk: a closed beige notebook with a black pen on top"), then the background left to right, then the light. End with "Warm natural daylight, soft background blur."
- **Selfie frames:** "holding the phone at arm's length with her right arm extended toward camera…". The CTA action becomes "points one finger of her free left hand down".
- **Multi-person frames:** define a `who` string per position ("the woman on the RIGHT in the olive three-piece suit with a white shirt") and a short name for listener directions ("The woman in olive").
- **Image prep:**
  - Ads: crop 2:3 frames to 9:16 (center crop: `nw=round(h*9/16); x=(w-nw)//2`).
  - VSLs: use 16:9 frames as they are.

---

## 6. Pronunciation playbook (hard-won)

| Problem | Fix |
|---|---|
| "C-P-A" said as a word | Add: `She clearly pronounces each letter: C, P, A.` Same for C-E-O, P-and-L, I-R-S (`She says I-R-S as the letters I, R, S.`). |
| Dollar amounts mangled | Add a guide. Write it exactly like this so she doesn't read both versions: `Pronunciation guide (she says each number only once): $9,997 as "nine thousand nine hundred ninety-seven dollars"; $5,000 as "five thousand dollars".` |
| She says the number twice (digits plus the words in the note) | Drop the note for that line and write the amount plainly in the line: "750K to 1 million a year". Proven to work on Kling 3.0. |
| Writing the amount fully in words still came out wrong | Go back to plain digits/K with no note (as above). |
| Omni duo/trio turned "1 million" into "100 million" | Write "one million" as a word in multi-person prompts. Keep the spoken result identical to the single-presenter clips. |
| "10x" said as "I times" | Guide `10x as "ten-X"`. For the phrase "ten times" add: `She clearly pronounces the number ten, the word T-E-N, before the word times: "ten times."` |
| Decimals ($1.25 million) | Guide: `"one point two five million dollars"`. |
| A single word garbled (e.g. "won't") | Redo with a targeted cue: `She pronounces the word "won't" clearly and fully, rhyming with "don't", with a crisp T at the end.` |
| She repeats the line | Every prompt includes `She says the line once, word for word, then holds a natural expression until the end.` Never write "keeps talking until the end". |

---

## 7. Prompt templates

### Voice (same in every single-presenter clip)
`Daniela's voice, the same in every clip: a confident woman talking to a firm owner she respects, warm, honest and direct, no hype and no sales tone, neutral American accent, medium-low pitch, natural conversational pace`

### Single presenter, locked-off (ads 9:16 / VSL 16:9)
```
Static locked-off camera, single continuous shot, no cuts. {Vertical 9:16 | Horizontal 16:9}. {SUBJECT} {ACTION}. She starts speaking within the first half-second, looking into the lens with natural lip-sync and subtle head movement, saying: "{LINE}" Voice: {VOICE}. Delivery: {REGISTER}.{CUES} She says the line once, word for word, then holds a natural expression until the end. {ROOM} Realistic skin, hair and fabric; everything in the scene stays unchanged. Only her voice is heard: no background music, no on-screen text.
```

### Single presenter, handheld selfie (9:16)
Same as above, but it opens with:
`Vertical 9:16 handheld selfie video, single continuous shot, no cuts, with only gentle natural hand sway. Selfie-style shot: {SUBJECT}…`

### Multi-person (duo or trio, Kling 3.0 Omni)
```
Use 图片1 as the exact opening frame: the same {three women | two women, same armchairs}, same outfits, same positions and the same office, framed exactly as in 图片1. Static locked-off {wide shot, … no zoom | camera, …}. Vertical 9:16. {BASE: who they are, shared look} On the LEFT: the woman in {outfit}. [In the CENTER: …] On the RIGHT: the woman in {outfit}. In this clip ONLY {who[speaker]} speaks. {ACTION}. She starts speaking within the first half-second, with natural lip-sync and subtle head movement, saying: "{LINE}" She says the line once, word for word, then holds a natural expression until the end. The other {two women never speak and keep their lips closed | woman never speaks and keeps her lips closed} the whole time, but {they behave like real people listening, not statues | she behaves like a real person listening, not a statue}, with natural blinking, breathing and small shifts of weight. {Short name}: {listener reaction}. … Voice: Daniela's voice: a confident woman, neutral American accent, medium-low pitch, natural conversational pace. Delivery: {REGISTER}.{CUES} {ROOM} Only one voice is heard: no background music, no other people talking, no on-screen text.
```

Listener reactions are small and specific:
- "she turns her head to look at the speaker, listening closely"
- "she gives a small agreeing nod"
- "she shifts her weight and glances over at the speaker"

---

## 8. The system walkthrough ("What you get" section of a VSL)

Walk the funnel front to back, one beat per clip, tied to the prospect's pain:

1. **Ads:** Facebook ads aimed at business owners paying six and seven figures in taxes. "And you never get on camera."
2. **Pain hook:** writing the I-R-S a check for $1.25 million. "An owner facing a $1 million tax bill will gladly pay $30,000 for a plan that legally keeps more of it."
3. **Website and funnel** built around that pain. It positions the firm as *the planning firm*, not a drop-off for returns.
4. **Belief shift inside the funnel:**
   - Old belief: paying the IRS whatever it asks is just part of business.
   - New belief: that money is hard-earned, and the right plan builds wealth and keeps it.
   - Payoff: $15,000–$55,000 for planning "doesn't feel like a cost. It feels like the obvious move."
5. **Qualifier:** weeds out tire kickers. Only serious owners get through, and their answers arrive before the call, so the owner can go deep instead of covering basics.
6. **Booking + follow-up:** qualified owners book straight onto the calendar, and everyone else stays in automated follow-up.
7. **Client portal:** onboarding, engagement letters, invoices. "A first impression that matches your fee."
8. **Weekly report:** cost per lead, per booked call, per show-up, per new client.
9. **Close:** "Your only job? Show up to the calls."

Positioning lines that recur:
- "The ad is just the front end."
- "We optimize for booked calls and owners who show up, not cheap leads."
- "A cheap lead is cheap for a reason."

---

## 9. Current Nexli offer facts (verify before reuse)

- **Qualifier:** C-P-A firms doing 750K to 1 million a year, who know they can 10x their business.
- **Investment:** $9,997 a month, of which $5,000 goes straight to ad spend.
- **Terms:** a one-time setup fee and a contract, both walked through on the call. Not month-to-month.
- **Scarcity:** only taking on three more firms right now.
- **Tax planning fees** prospects pay the firm: $15,000–$55,000.

---

## 10. Review page (before any render)

Build one self-contained HTML page:

- Dark theme, a card per clip, grouped by section.
- Each card shows: clip number and duration, the line (large), Register, Action, Edit, and a collapsible "Kling prompt" with a Copy button.
- Header: clip count, total seconds, approximate minutes after trims (about 0.85×), and estimated credits.

Point out risky lines: claims, long lines near 12 s, and numbers.

---

## 11. Rendering on Kling (MCP)

### Models
| Use | Model | Inputs | Notes |
|---|---|---|---|
| Single presenter (ads and VSLs) | `kling-video-v3_0` | `[{"name":"first_image","inputType":"URL","url":FRAME}]` | args: prompt, duration, resolution `1080p`, imageCount `1`, prefer_multi_shots `false`, enable_audio `true`. Aspect follows the frame. |
| Duo / trio founder ads | `kling-video-v3_0_omni` | `[{"name":"image_1",…}]` | Must pass `aspect_ratio` `9:16` (the default is 16:9). The prompt starts with the 图片1 line. |
| Avoid for talking heads | `kling-video-v4_0` | — | Butchers words. The user rejected it. |

**Cost:** about 12 credits per second on 3.0 and Omni. Check `query_membership_and_credits` before a big batch. If the batch exceeds the balance, render what fits and say how many more credits are needed.

### Upload a frame
1. Call `file_upload` (contentType, filename, size) to get a ticket.
2. Upload: `curl -sS -X POST https://kling.ai/api/mcp/files -F "ticket=…" -F "file=@frame.png;type=image/png"`.
3. Take `data.url` from the response and log it in an `uploads.txt`.

### Batch pipeline
1. Write a jobs JSON: `{code, clip, model, inputs, arguments}` per clip.
2. Hand it to a background agent with strict rules:
   - submit each job **exactly**, about 6 per batch, reusing one taskTraceId
   - on "too many requests": wait 60 s with an until-loop, then resend once
   - on a content block: no retry, record the exact error
   - record generationIds after every batch
   - wait 5 min, then poll
   - save `works[0].urlWithoutWatermark` exactly
   - never resubmit
3. Parallel agents must write to **separate results files and separate helper scripts**.
4. Verify: regex-check every URL, check IDs and URLs are distinct, and spot-check 1–2 clips with your own `query_tasks` call.
5. Deliver an HTML page: a video player and a download link per clip, the line, and the Edit note. Links expire in about 24 hours, so tell the user to download.

**Moderation:** on a block, send `feedback` (CONTENT_POLICY_AMBIGUITY) once. Don't loop. Offer a plainer rewording.

**Stuck jobs** (RUNNING with finishTime set): report them, and retry only if the user asks.

### Redo pattern
1. Copy the original job.
2. Change only what's needed: the line, a targeted cue, the number style.
3. Render directly and poll.
4. Swap the new link into the full-video page and keep the old ID as `*_v1`.

---

## 12. QA checklist to give the user after each render

- C-P-A said as letters in the hooks.
- Every number said once and correctly (list the clip numbers).
- Multi-person clips: only the named speaker's lips move, and listeners react naturally.
- Longest lines aren't rushed or cut off.
- Credits used, credits left, link expiry.
