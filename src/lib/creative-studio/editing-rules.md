<!--
  Marcel's Remotion editing rulebook, pasted 2026-11-03 and kept verbatim.
  It was written as a brief for a Claude Code skill; the portal's Creative
  Studio edit step (Phase 4: Remotion Lambda) follows these rules as written.
  Do not "improve" them — they are decisions paid for in re-renders.
-->

Build me a skill called **nexli-creative-studio**.

It turns raw talking-head footage into finished, captioned ad creative and
finished landscape VSLs, using ffmpeg, Whisper and Remotion. It is the codified
version of a pipeline I already run in production — the rules below are not
suggestions to improve on, they are decisions that were paid for in re-renders.
Encode them as written. Where I explain *why* a rule exists, keep the reason in
the skill: the reason is what lets you apply the rule to a case I haven't
described.

## What the skill must cover

Two product lines, one shared pipeline.

**Ad creative** — short vertical cuts for Facebook and Instagram, in four rig
types I shoot repeatedly:

| Rig | Plate | Treatment |
|---|---|---|
| Three-founder | three people, standing | Comparison ladder: title banner, a price/outcome pill per person, a client-type tag per person, red qualifier |
| Two-founder | two people, seated | Same ladder, two rungs |
| Solo | one person, seated or standing | **No ladder, no cards** — captions plus one persistent title banner, nothing else |
| Organic / POV | handheld, selfie-framed | Instagram's own white text-sticker idiom. No brand palette, no dark glass, no captions |

**VSLs** — landscape funnel videos that sit on a landing page above a calendar
embed. Three to five minutes. Minimal graphics.

## The pipeline, in order

### 1. Probe and ingest

Probe first; never assume. `ffprobe -v quiet -print_format json -show_streams`.

**Always transcode to constant frame rate at ingest**, even when the source
looks like 60fps. Phone and AI-generated footage is routinely variable frame
rate, and VFR desyncs captions progressively — invisible at 0:10, a half-second
out by 3:00.

```bash
ffmpeg -i "<src>" -map 0:v:0 -an \
  -vf "setsar=1" -fps_mode cfr -r 60 \
  -c:v libx264 -crf 16 -preset medium -pix_fmt yuv420p \
  public/<slug>-video.mov -y
```

Audio is always processed locally. Never use a third-party service that
watermarks.

```bash
ffmpeg -i "<src>" -vn -c:a aac -b:a 192k -ar 44100 \
  -af "highpass=f=80,afftdn=nf=-20,loudnorm=I=-16:TP=-1.5:LRA=11" \
  -movflags +faststart public/<slug>-audio.m4a -y
```

`highpass=80` kills rumble, `afftdn` is noise reduction, `loudnorm` targets
−16 LUFS (EBU R128). Verify the result: video and audio durations must agree
within 0.05s.

Run `silencedetect` to find head/tail dead air and false starts. Trim only what
is genuinely dead — and see the transcript section before you trim anything on
the strength of a transcript alone.

### 2. Transcribe

Whisper **large-v3**, with word timestamps, whenever the transcript drives
anything on screen. Smaller models are fine for a rough read and not for this —
captions and card timings are built off these numbers.

```bash
whisper audio.wav --model large-v3 --output_format json --word_timestamps True
```

### 3. Hunt the hallucinations — this is the step that gets skipped

Whisper large-v3 fabricates on long takes. This is the single largest source of
defects in this pipeline, it has reached delivered renders more than once, and
**reading the transcript will not catch it**, because a fabricated run still
parses as a fluent sentence.

It has a mechanical fingerprint. Before building anything, scan the raw JSON
for:

- **tokens where `start == end`** — zero-length, stacked on one timestamp
- **duplicate start timestamps** — several tokens claiming the same moment

Both indicate the decoder lost the audio and generated text instead. On a
five-minute file it can **loop**, emitting a clause three times as ~30
zero-length tokens while swallowing the real words around it.

For every hit: cut a 3–6 second clip around it and **re-transcribe that clip
alone**. An isolated pass gets it right and hands you real timings to splice
back.

Three rules that came out of getting this wrong:

1. **Read the words on either side of the fabrication, not just the fabrication.**
   An invented run tends to sit on top of a real mishearing. One file had
   `"So you're calculating. I can't wait to see the results of this."` wedged
   before `"fills with shoppers"` — the invented sentence was obvious, but the
   isolated pass also showed `"you're calculating"` was a mishearing of
   **"your calendar"**. Cutting the invented run alone would have shipped a
   caption that still read wrong.
2. **Read the whole transcript as prose, too.** Timing scans find stacked
   tokens; they do not find a stray `"Okay."` inserted between two sentences,
   or a phantom word splitting `"the entire system"` into `"the entire. Higher
   system"`. Those are visible as nonsense on the page.
3. **Repair, never trim.** The hallucination is in the transcript, not the
   audio. The video does not need cutting.

**Judgment calls that recur:**

- When two independent passes agree on an odd-sounding word, that is evidence
  the speaker said it. Leave their phrasing alone, even if it's ungrammatical.
- **Proper nouns invert this.** One speaker appeared to say "Jeff Bozos" and
  two passes agreed — but a caption misspelling a famous name costs more than a
  dropped joke. Default to the correct spelling and tell the user you did, so
  they can revert it in one line if the gag was intentional.

### 4. Build the words file

A typed array of `{ word, start, end }`, generated by a **script with a repair
spec**, never hand-edited. The script is the record of what was changed and why,
and it lets you regenerate after a correction instead of re-editing by hand.

Repair operations the generator needs:

| Op | Purpose |
|---|---|
| `swap` | replace a token's text globally, keep timings |
| `set` | force the token at time *t* |
| `drop` | remove the token at time *t* |
| `drop_pairs` | remove one token matching **time AND text** — required where several tokens share a timestamp |
| `drop_range` | remove everything in `[a, b)` — for loops, where naming each token is unreadable |
| `retime` | move a token's timestamps |
| `merge` | join two tokens into one |
| `insert` | splice real words back at isolated-pass timings |
| `require` | assert these words survived |

Apply in that order, sort by start time, then assert. **Make the assertions
fatal**, so these fail the build instead of needing to be spotted in a still:

- no two tokens share a start timestamp
- no zero-length tokens survive
- no unmerged hyphen fragments survive (a token matching `^-\w`)
- every `require` word is present

Text conventions:

- **ALL CAPS**
- strip trailing punctuation `. , ! ? ; :` — **preserve contractions**
  (`YOU'RE`, `DON'T`, `IT'S`)
- **merge split money**: Whisper emits `$9` + `,997` as two tokens, which makes
  a 3-word caption chunk count one figure as two. Join them.
- **merge split compounds**: `follow` + `-up` → `FOLLOW-UP`. Same reason, and a
  caption reading `FOLLOW -UP` is the tell. This one has cost a full re-render.

### 5. Measure the plate

Every rig's geometry is **measured off the actual footage**, never computed from
the CSS and never assumed from a previous shoot.

The method that works: **render a still, overlay a pixel grid, read it by eye.**
Luma scans and motion diffing both fail on these plates — soft-focus office
backgrounds and low-contrast clothing defeat them.

```bash
ffmpeg -i still.jpg -vf "drawgrid=w=120:h=120:t=2:c=red@0.8" grid.jpg
```

Sample **at least four timestamps across the take**, not one representative
frame — people drift between takes, and you need the worst case, not the
average. Record:

- hairline top (the **highest** across the take — graphics must clear it at
  every frame, not on average)
- body edges
- the reach of any outstretched gesture

Then run the **footprint test**: draw each card's exact rectangle onto a still
and look at what it covers.

```bash
ffmpeg -i still.jpg -vf "drawbox=x=48:y=400:w=500:h=300:color=lime:t=5" fp.jpg
```

Do this at **every card window on every plate**, not once. If a card lands on a
gesture, prefer moving its window a second or two into the neighbouring pause
over shrinking the card.

### 6. Compose

**Remotion. `<OffthreadVideo>` — never `<Video>`**, which jitters frames. Mute
the source video (`volume={0}`) and overlay the processed audio as a separate
`<Audio>` track.

**Use the variant-registry pattern.** One component plus a variants table plus a
`.map()` that registers compositions. Near-identical cuts sharing a layout are
exactly this shape.

```tsx
{variants.map((v) => (
  <Composition
    key={v.id} id={v.id} component={Rig}
    defaultProps={{ variantId: v.id }}
    durationInFrames={Math.round(FPS * v.durationSeconds)}
    fps={FPS} width={W} height={H}
  />
))}
```

**The sibling rule — the most important architectural rule here.** When a new
plate doesn't fit an existing rig, **copy the rig and adapt the copy**. Do not
generalise the original. A three-founder rig hard-codes a three-rung ladder,
three pop delays and a three-tuple of x-positions; widening it to cover two
people would touch every approved cut that already shipped, for no benefit to
any of them. Copying is cheaper and safer than a clever abstraction. Say so in
the new file's header, naming what it was copied from.

**Opt-in by absence.** Where a rig supports an alternate geometry, make it an
optional field whose *absence* means "use what the approved cuts shipped with".
Never give it a default, never make it required. Absence of the field is what
makes the already-approved cuts provably unchanged.

### 7. Render and verify

```bash
npx remotion render src/index.ts <CompositionId> ~/Desktop/<Id>.mp4 \
  --codec h264 --overwrite
```

When chaining renders, **gate each one on the previous render's completion line
in its log. Never gate on `pgrep` of the render command** — it matches wrapper
and helper processes and fires early. Never probe an output file mid-write.

**Verification gates, all of them, every time:**

1. **Footprint test passed** on every card window of every plate (see step 5).
2. **Typecheck** against a recorded baseline of known pre-existing errors. No
   new file may appear in the output.
3. **No collateral damage.** Render a still of an untouched composition before
   and after the change and confirm the two are **byte-identical** by hash.
4. **Read the captions off the delivered mp4**, not off the source data.
   Extract frames from the finished file and look at them. Check the repaired
   moments specifically, and check one near the very end — caption drift, if the
   CFR transcode failed, shows up at the tail, not the start.
5. **Specs**: resolution, `r_frame_rate` and `avg_frame_rate` both exactly
   `<fps>/1`, frame count equal to `round(fps × duration)`, audio duration
   within 0.05s of video.

Then iterate with the user until they approve. Re-render as many times as it
takes.

## Format specifications

### Vertical ad creative — 1080×1920

One master serves Facebook Reels and the 4:5 Feed crop. Two edges bind every
graphic:

- **`FB_SAFE_TOP = 285`** — the 4:5 Feed centre-crop line
- **`FB_SAFE_BOTTOM = 1248`** — Reels caption and CTA chrome

Everything lives in that 963px band. A 1:1 placement would narrow it to
420–1500 and push the title out entirely, so **1:1 is deliberately not
supported**. Treat third-party safe-area figures as provisional and verify
against the Safe Zone Guardrail in Ads Manager before committing a large batch.

**When the band runs out, stop stacking and start sequencing.** Some plates have
headroom for a title *or* the pills but not both. On those, the two share the
slot in time: the title opens, fades, and the pills come up behind it. Same
move at the bottom, where a qualifier band and a CTA share one chrome slot.
This is a general principle in this pipeline, not a special case.

Box heights must be **measured off a rendered still, not computed from the CSS**
— a font size with no explicit line-height resolves against the font's own
metrics and is not derivable from source.

### Landscape VSL — 1920×1080 at 60fps

Speaker is centre-frame behind a desk. Headroom is typically 30–60px, so **there
is no top-banner slot** — everything lives in a left column, in one slot,
sequenced in time.

Starting geometry, to be re-verified per plate: left edge 48, panel max width
500, vertically centred around 51%. Size panels to their content
(`width: fit-content`) with the max as a ceiling rather than a fixed width — a
fixed width pushes every card out to its full extent whether it needs the room
or not, and that is what puts a card behind someone's raised hand.

### Captions — universal across every rig

- **3-word chunks.** Universal. Do not vary this per rig.
- Font **Outfit**, weight 800, ALL CAPS
- Karaoke highlight: active word in the brand gradient, past words solid white,
  future words white at 50%
- Money in green
- Sizes by rig: 46–54px vertical, 48px landscape VSL
- A bottom scrim behind captions where the plate is light

## Creative rules

These are about what earns a place on screen.

**No card may restate the caption running underneath it.** This is the rule that
governs everything else. Captions already carry her words; a card that repeats
them is the same line twice, and it reads as clutter rather than emphasis. A
card earns its place only where it carries something the voice cannot.

Three ways that plays out:

- **Hooks are distillations, not quotes.** Write the hook using words that do
  not appear in the script at that moment, or at all. If she says the idea out
  loud in the first ten seconds, the card takes a sharper version of the same
  thought, not an echo.
- **Move a card off the line that says it.** If a qualifier is spoken at 2:10,
  put the band at 0:10 where it does the filtering job before the viewer has
  invested three minutes — not at 2:10 where it is the caption twice.
- **Replace a redundant subline with a directional cue.** A CTA card that says
  "pick a time below" while she narrates the next page doesn't need her second
  sentence under it. An arrow does the job.

**Message match the funnel.** A funnel-page VSL's hook should match the hook of
the ad driving traffic to it, **word for word**. They clicked that line; the
page should pay it off.

**Minimal means sequenced, not just few.** When the brief is minimal, put every
element in one slot and sequence them in time so two are never on screen at
once. Long unadorned stretches are the point, not a gap to fill.

**Solo cuts get captions and one title, nothing else.** No sticker cards echoing
the caption line.

**Organic / POV cuts are a different idiom entirely.** Instagram's own white
text-sticker look: white rounded card, black text, no brand palette, no dark
glass, no captions, light top scrim only. Anything heavier reads as an ad, which
defeats the format.

## Brand — Nexli

| | |
|---|---|
| Gradient | `#2563EB` blue → `#06B6D4` cyan |
| Money / positive | `#22C55E` green |
| Negative / warning | `#EF4444` |
| Qualifier band | `#DC2626` → `#991B1B` |
| Panel ground | `rgba(10, 14, 30, 0.95)` |
| Fonts | Outfit, Plus Jakarta Sans |
| Watermark | **None.** No logo on video. |

Spring animation, used consistently: `damping: 13, stiffness: 145, mass: 0.8`
for card pop-ins.

## How the skill should behave

- Work through the pipeline in order. When fixing something, jump to the
  relevant step rather than restarting.
- **Review the word script with me before the first render**, and accept
  transcript corrections after it — expect to iterate.
- Tell me when you make a judgment call on an ambiguous word, and say how to
  revert it.
- Flag a conflict you can see between what I asked for and the footage, state
  it once, then build what I asked for anyway. Don't silently narrow scope.
- Report honestly: if a verification gate failed, say so with the output.
- Don't pad a creative with graphics to fill time. Silence on screen is a
  legitimate choice.

## Deliverables

Structure the skill with a `SKILL.md` carrying the pipeline and rules, plus
supporting reference files for anything long enough to crowd it — the safe-area
geometry, the hallucination protocol, and a reusable words-file generator script
with the repair ops and assertions already implemented.

Ask me about anything above that is ambiguous before you write it.
