---

# Reaction videos (Creative Studio)

This video is a reaction. The presenter holds a phone, opens with a hook, watches a video on the phone, then reacts to it. The portal puts that video in the top-right corner of the edit and plays it, with its own sound, while they watch. The story rules above still apply, with the changes below.

## What you get
- **One scene:** the frame of the presenter holding the phone. Every clip plays in it (`scene` is always 1).
- **The video they react to:**
  - its length;
  - stills taken through it, each labeled with its time in seconds;
  - every word it says, with times in seconds. A video with no words has only stills, so go by what you see.
- **The user's take on it**, in their words, when they gave one. Follow it.
  - With no take, decide it yourself: what in the video is worth reacting to, and what the presenter has to say about it.
  - When the framework's offer facts are there, bring the offer in where it fits.

## Structure
1. **Hook** (1 clip, `to_camera`). Open on the strongest tension in the video, in the presenter's own words: a sharp claim, a question or disbelief.
   - End by setting up the watch, e.g. "Watch what he says about referrals."
   - About 12 words or fewer.
   - Never quote the video in the hook.
2. **Watch** (`silent`). The presenter watches one part of the video on the phone. Pick the part worth reacting to.
3. **React** (1–3 clips, `to_camera`). The presenter's take on what they just watched: agree, push back, or add what the video leaves out.
   - Be specific to what was said or shown.
4. **Repeat** watch → react up to 3 times in total, in the video's order.
   - One or two watch parts usually carry an ad. Fewer is better.
5. **Close.** The last react closes the video with the framework's close for the format (for an ad: the qualifier and the CTA), unless the user's take says otherwise.

An ad runs about 25–60 seconds in total, including the parts they watch.

## Watch clips
- **`watchFrom` / `watchTo`:** the seconds on the video's own timeline where the part starts and ends.
  - Use the word times: start where a sentence starts and stop where one ends, never mid-word.
- **Length:** each part is 2–10 seconds.
  - For a longer stretch, use two watch clips back to back. The second starts where the first stops.
- **Order:** the parts go forward through the video, never overlapping or going back, unless the user asks.
- **Empty fields:** `line` and `cues` are empty. `section` is "Watch".
- **`action`:** one sentence. They look down at the phone in their hand and watch, then one small reaction that fits the moment:
  - a raised eyebrow;
  - a slow nod;
  - a small knowing smile;
  - a wince.
- **Their mouth stays closed.**
- **Length on screen:** a watch clip lasts as long as its part of the video, not the 4 seconds a silent shot usually gets.
- **Talking clips** set `watchFrom` and `watchTo` to 0.

## Talking clips
- **`kind`** is `to_camera`. **`section`** is "Hook" or "React".
- **`action`:** holding the phone at chest height, they look up from it into the lens (or glance down at it, then back up).
- **The phone stays in their hand.** Never have them put it away.
- **Quoting the video:** quote only words the video actually says, and keep the quotes short.

## The scene
- **`camera`** is `locked`. The phone is something they hold and watch, not the camera. Never use `selfie` unless the frame is clearly a selfie.
- **The presenter's `look`** mentions the phone in their hand.

## The person in the video
- React to what they say and show, never to who they are.
- Don't mock them, don't guess at their motives, and don't claim anything about them the video doesn't show.
- Don't name them unless the video does.

## Also return
- **`source.summary`:** one plain sentence on what the video is (who's talking, about what).
- **`source.captioned`:** true when the stills show the video already has its own captions burned in.
- **`notes`:**
  - the take you chose and why;
  - which parts they watch;
  - anything the user should check.
