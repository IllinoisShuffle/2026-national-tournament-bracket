# Live Scoring, the Sheet, and the Admin Page — TD/ATD Guide

This is a plain-language guide for the Tournament Director / Assistant
Tournament Director on how the "Live Scoring" system works, why the Google
Sheet is still the only official record, and how to use the admin page to
clean up bad or stale live-score entries. For the technical/implementation
details, see the main [README](../README.md).

**The ATD is the technical point of contact for this whole system.** If
anything about the app itself isn't working — a host's PIN won't work, the
admin page won't load, a live score looks stuck or wrong — that's a question
for the ATD, not something to troubleshoot solo.

## The one rule that matters

**The Matches Google Sheet is the only source of truth. Nothing on
`score.html` or the Live Scoreboard is ever official.**

Court hosts scoring a match on their phones write to a separate, low-stakes
holding area (not the sheet). That data only exists to give spectators and
the scoreboard a rough live picture of what's happening on the courts right
now. It is never read by anything that determines bracket advancement,
seeding, or final placement. Only what the TD/ATD types into the Matches
sheet counts.

Concretely:

- The bracket pages, mobile bracket, and kiosk display always derive winners
  from the Matches sheet's `Winner` column — never from a court host's
  reported score.
- If a host's live score and the sheet ever disagree, the sheet wins,
  automatically and immediately — there's no reconciliation step you need to
  perform.
- If the live-scoring system goes down entirely (Netlify Blobs outage, a
  host's phone dies, whatever), it has **zero effect** on the tournament
  itself. Worst case, the Live Scoreboard looks empty or stale until it's
  restored. You keep running the tournament off the sheet exactly as before
  this feature existed.

## What court hosts are actually doing

Court hosts log into `score.html` (see the companion Court Host guide) and
tap in points as they happen, frame by frame. When they finish a match they
tap "Complete Match" and — this is the important part — **tell you or the
ATD the final score in person, the same way they always have.** The app
reminds them to do this on-screen. It does not notify you automatically, it
does not text you, it does not update the sheet for you. A court host
finishing a match on their phone changes nothing about your workflow: you
still write the final score and winner into the Matches sheet by hand,
exactly as before.

## The "pending" / unofficial nature of what shows up live

Once a match has no winner recorded in the sheet yet, its court-reported
score becomes eligible to show up in two places:

- **Bracket pages** (`web-bracket.html`, `mobile-bracket.html`) show a small
  live-score badge next to that match instead of "TBD."
- **The Live Scoreboard** (`scoreboard.html`) lists it under **"On the
  Courts"** with the running score, current frame ("Playing Frame 9 of 16,"
  etc.), and which team is which puck color.

This is explicitly labeled as unofficial, and behaves accordingly:

- **While a host is actively scoring it**, the card shows the live pulsing
  "LIVE" / court indicator and the running score.
- **The moment a host taps "Complete Match" on their end**, the card doesn't
  disappear — it switches to a **"Just Finished"** badge and a note reading
  "Reported by court host · awaiting official score." This is the pending
  state you asked about: it's the host's word that the match is over, shown
  to spectators as informational only, explicitly flagged as not yet
  official, and still waiting on you.
- **The instant you type that match's winner and final score into the
  Matches sheet**, it disappears from "On the Courts" entirely and reappears
  under "Past Results" with the official score — no separate action needed
  on your end beyond editing the sheet the way you already do.

There is no time limit on the "Just Finished / awaiting official score"
state — a match can sit there for as long as it takes you to get to it. It
never times out or gets treated as official on its own.

**Practical implication for you:** you can use "Just Finished" cards on the
scoreboard as a to-do list of matches waiting on your transcription, but you
should never announce a result, update seeding, or hand out a bracket
advancement based on what a court host tapped in. Always confirm the actual
final score with the court host (or check the physical chalkboard) before
writing it into the sheet — the host's app is a convenience, not a substitute
for your own verification.

## The admin page (`admin.html`)

`admin.html` is a companion tool for inspecting and clearing out the
in-progress court-score data directly — the same data that feeds "On the
Courts." It exists so you (or the ATD) can clean up test entries, a
mis-scored match, or a match where the host never tapped "Complete" and it's
stuck showing stale data — without needing any technical/CLI access.

**It is unlinked from the public site on purpose.** It won't appear on the
picker page (`index.html?choose`) or anywhere a spectator could stumble into
it. Only reachable if you go to the URL directly — bookmark it, or keep the
link somewhere private.

### Getting in

1. Go to `admin.html` directly.
2. Enter the **admin PIN** — a single shared PIN known only to the TD/ATD
   (set up in advance as a Netlify environment variable, separate from the
   individual court-host PINs). This is not per-person; anyone with the PIN
   gets full access.
3. You're in until the login expires (12 hours by default) or you close the
   browser tab — the login is intentionally not remembered across tabs/restarts
   for security, since this page can wipe every live score at once.

### What you can do

- **See every live-score entry**, including ones for matches that have
  already been finalized in the sheet (those stop showing on the public
  scoreboard, but still exist in storage until you clear them) — each row
  shows the match ID, court, who's scoring it, when it was last updated, its
  status (In Progress / Complete), and the current score.
- **Delete a single entry** — use this for a bad/stale score on one match: a
  host mis-tapped and it's now confusing, a test entry from setup, or a match
  you've already handled and want off the list.
- **Clear all** — wipes every live-score entry at once, with a confirmation
  prompt first (this cannot be undone). Good for wiping test data before the
  event starts, or as a "reset everything" button if something's badly wrong.
  This never touches the Matches sheet — it only clears the supplementary
  live feed.

### Important things to know

- **Deleting an entry here never changes the official bracket.** It only
  removes a row from the live/in-progress display. If a match was actually
  finished, you still need its result recorded in the Matches sheet the
  normal way — deleting its live entry doesn't record anything, it just
  hides the "Just Finished" card.
- **There's no per-person audit trail.** Since the PIN is shared, the app
  doesn't track who deleted what — only that someone with the PIN did.
  That's a deliberate tradeoff (no need to know who purged a stray test
  entry), so don't rely on this page for "who touched what" history.
- **Treat the PIN like a password.** Anyone with it can wipe all live scores
  for every court at once. If you ever suspect it's been shared beyond the
  TD/ATD, it should be rotated (this requires a config change on the
  hosting side — ask whoever manages the Netlify site).

## Quick reference

| Question | Answer |
|---|---|
| What's the official result of a match? | Whatever is written in the Matches Google Sheet. Always. |
| Does a court host finishing a match on their phone update the sheet? | No. They still have to tell you/the ATD in person. |
| What does "Just Finished · awaiting official score" mean? | The court host tapped "Complete," but you haven't entered the result in the sheet yet. It's a to-do reminder, not an official result. |
| Can a live score ever override or contest the sheet? | No — the sheet always wins the instant you fill it in. |
| What does `admin.html` change on the actual bracket? | Nothing. It only clears the supplementary live/in-progress score feed. |
| Where do I go to fix a wrong or stuck live score? | `admin.html`, with the TD/ATD admin PIN. |
| Something with the app is broken — who do I ask? | The ATD — they're the technical point of contact for this whole system. |
