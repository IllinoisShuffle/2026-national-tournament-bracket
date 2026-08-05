# Court Host / Court Manager Guide — Scoring a Match

This is a plain-language walkthrough of `score.html`, the page court hosts
and court managers use to keep a live running score during a match. For the
technical details, see the main [README](../README.md).

**The short version:** the players keep score on the physical chalkboard at
the court — that has not changed. This app is a convenience for spectators
watching the Live Scoreboard, not the official scorekeeping record. Keep it
matching the chalkboard as the match goes, and if you notice an obvious
mis-call in the moment ("that was an 8, not a 7"), it's fine to say
something — that's not considered coaching. When the match ends, you still
fill out that match's **Match Report Sheet**, get it signed by the winning
team, and bring it to the ATD in the DJ Booth, the same as always.

## Getting the link

There's one URL for every court host — nobody needs a link specific to their
court. Your ATD will send it to you directly (text message or QR code); it's
not listed anywhere on the public tournament site, so bookmark it once you
have it.

## Logging in

1. Open the link. You'll see **"Court Scorekeeping."**
2. Enter the **name and PIN your ATD gave you.**
3. Tap **Log in.**

Your login stays active on that device for a while (about 18 hours by
default) so you shouldn't need to log in again mid-tournament unless you
switch devices or it's been a very long time. If your PIN doesn't work, or
anything about the app itself isn't working, check with the **ATD** — they're
the technical point of contact for this whole system, and PINs are managed
on their end and can be reset without you needing a new app or link.

Only people the ATD has set up can log in — there's no free-text "type your
name" option. This is deliberate: it means every score update on the board
is attributed to a real, verified person.

## Picking your match

After logging in you'll see **"Pick your match"** — a list of every match
that isn't finished yet, across all courts.

- If your login was set up with a home court, the list is automatically
  filtered to just that court. You'll see a row of pills at the top — **All
  / Court 1 / Court 2 / …** — tap a different one any time.
- **This filter is just a convenience, not a restriction.** You can score
  any match on any court if you need to — say, covering for someone, or your
  match got moved.
- Each match card shows the match ID, court, scheduled time, and — if
  someone's already got a score going — the current frame and running score.
- If another host is actively updating that match right now, you'll see
  **"Being scored by `<name>`"** under it. That's a heads-up, not a lock —
  see "If two people try to score the same match" below.

Tap a match to open it.

## Scoring the match

You'll see both teams' names with a disc-color dot, the running score, and a
2x2 grid of buttons under each team:

| Button | Meaning |
|---|---|
| **+8** | Disc landed in the 8 zone |
| **+7** | Disc landed in the 7 zone |
| **+10** | Disc landed in the 10 zone |
| **−10** | "10 off" — a disc hanging past the line, which *costs* that team 10 |
| **+1 / −1** | Convenience nudge — bump a total up or down by one to keep the app in sync with the board |

**Tapping a button does not save immediately.** It stages a pick for the
frame currently in progress — you'll see a **"pending"** total appear under
that team's score, and the button itself gets a highlighted ring so you can
see everything you've tapped for this frame at a glance. You can tap
multiple buttons, on either side, in any order — a frame can have more than
one disc land, for either team, so there's no one-tap-per-frame limit.

Made a mistake on a single tap? Use the **"Undo last pick"** button that
appears — it removes just your most recent tap.

Want to clear everything you've staged for the current frame and start over?
Tap **Reset Frame.**

### Ending the frame

Tap the big button at the bottom when the frame's done. It's normally
labeled **"Submit Frame N & Start Frame N+1."** On a frame that ends the
match, it relabels to **"...& Complete Match"** and finishes the match in
the same tap.

Nothing landed for either team that frame (a "wash")? Submit still
advances, with no score change.

A hint line right above the button tells you exactly what tapping it will
do (e.g. "Submit records +8 for Yellow, and will start Frame 10"), so you
can always double check before committing.

### Disc colors and the frame counter

- The frame counter at the top always reads **"Playing Frame N of 16"** —
  "Playing" means frame N is the one currently underway, and the score
  shown reflects everything before it, not that frame N just finished.
- **Disc colors swap at frame 9.** The app automatically updates which
  color dot shows next to each team once you cross that line, so just keep
  tapping the same team's buttons regardless of which color disc they're
  currently shooting.

### If it goes to overtime

A match tied after frame 16 just keeps going — score it exactly the same
way you have been. The frame counter switches to **"Playing Frame N ·
Overtime,"** and disc colors stay on whatever they swapped to at frame 9
(they don't swap back).

### If you made a bigger mistake

- **Undo last pick** — reverses your most recent tap, whether or not it's
  been submitted yet.
- **Reset Frame** — clears everything staged for the frame in progress, if
  you haven't submitted it yet.
- **Reset Match** — wipes the whole match back to 0–0, Frame 1. This is for
  when something's gone seriously wrong (wrong match opened, scores way off
  from the board, etc.) — it asks you to confirm first, and it *can* erase
  frames you already submitted, so only use it as a real reset, not a
  quick undo.

## Finishing the match

Once the match is actually over, tap **Complete Match** (or it happens
automatically the moment you submit a decisive frame at frame 16 or later,
as described above). You'll see a **"Marked complete"** screen with the
final score.

**This is the step that matters most:** fill out that match's **Match
Report Sheet**, make sure it's filled out correctly, get it **signed by the
winning team**, and bring it to the **ATD in the DJ Booth**, the same way
you always have. Tapping "Complete Match" only updates what spectators see
on the Live Scoreboard — it does **not** notify the TD or ATD, does not
write anything into the official tournament sheet, and does not advance any
bracket. The on-screen note reminds you of this every time.

If you tapped Complete by mistake, there's a **"Reopen (mis-tap)"** button
to go back to live scoring.

## If two people try to score the same match

The app actively prevents two hosts from silently overwriting each other. If
you try to save a change and someone else has updated that match in the last
few minutes, you'll see:

> **`<name>` is currently scoring this — take over?**

- **Take over** — saves your update anyway. Use this if you're the one who
  should actually be scoring it right now (e.g. you're taking over the
  court, or the other update was stale/wrong).
- **Cancel** — backs out and reloads their latest score instead, so you're
  not fighting over the same match.

This is a real check, not just a warning — it can't be silently bypassed,
which is why the "Being scored by" note on the match list is worth paying
attention to before you start.

## Quick reference

| Action | Where |
|---|---|
| Log in | Enter the name + PIN your ATD gave you |
| Find your match | "Pick your match" list, filter by court if needed |
| Score a point | Tap +8 / +7 / +10 / −10 (or +1/−1 to nudge) — stages it, doesn't save yet |
| Undo a single tap | "Undo last pick" |
| Clear the whole current frame | "Reset Frame" |
| Move to the next frame | "Submit Frame N & Start Frame N+1" |
| Finish the match | "Complete Match" — **then bring the signed Match Report Sheet to the ATD in the DJ Booth** |
| Fix a mis-tapped "Complete" | "Reopen (mis-tap)" |
| Start completely over on a match | "Reset Match" (confirms first) |
| PIN doesn't work, or the app is broken | Ask the ATD — they're the technical point of contact for this system |
