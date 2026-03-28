# Who Dis? — Design Spec
**Date:** 2026-03-28
**Status:** Approved for implementation

---

## Overview

A multiplayer visual association guessing game for teams. Players submit image clues for assigned teammates before the event. During a live Zoom session, clues reveal one by one and everyone races to guess who the mystery person is.

**Primary use case:** Monthly team Zoom party, 6–20 players (typical: 16), 1–2 hours.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React + Vite + TypeScript | Component-based, clean state management, build step needed for Firebase SDK |
| Realtime state | Firebase Realtime Database | True real-time sync, no polling, generous free tier |
| Image storage | Firebase Storage | Uploaded clue images, direct from browser |
| Image similarity | Firebase Cloud Functions + OpenAI Vision API | Conceptual duplicate detection at scoring time — server-side, key not exposed |
| Hosting | GitHub Pages via GitHub Actions | `ShravanDR/who-dis` → public URL like title-check |
| Auth | None (trust-based game) | Players select their name from organizer's member list; host identity via secret host code |

---

## Game Flow

### Phase 1 — Setup (Organizer)
- Organizer adds members (name + photo URL or emoji). Supports **6–20 players**.
- System generates a unique 6-character uppercase game code (retries up to 10 on collision)
- System also generates a **host secret code** (UUID, stored in RTDB under `meta.hostSecret`) and returns it only to the organizer's browser (stored in localStorage). All host-only actions require this code — it acts as a lightweight host credential without formal auth.
- **Circular assignment:** member list is shuffled randomly; player at index N is assigned members at index N+1 and N+2 (modulo member count). Each player gives clues for exactly 2 people; each person receives clues from exactly 2 givers; no self-assignment.
- Organizer reviews auto-generated assignments; may re-shuffle (new random assignment); cannot manually edit individual pairs.
- Game stays in `clue-submission` phase until organizer starts the quiz.

### Phase 2 — Clue Submission (Async, all players)
- Players open the game URL, enter the game code, select their name from a **dropdown** of the organizer's member list (no free-text entry — prevents name collision)
- They see their 2 assigned people and upload **3 images per person** (6 uploads total)
- **Upload from device only** — no URL pasting, no image search
- **Image spec:** center-cropped to **3:4 portrait** on upload; original file is not stored
- Per-slot replacement: player replaces individual slots, not all-or-nothing. Replacement is **optimistic** — new image URL is written to RTDB immediately on upload success; old Storage file is queued for deletion asynchronously (dangling files are functionally harmless)
- **"Submitted"** = all 6 slots filled (non-null in RTDB). Partial saves do not count.
- Organizer sees live count: "13 / 16 submitted"
- **Start Quiz is always available** to the organizer — does not require 100% submission
- **Incomplete submissions at quiz start:** if a player has filled fewer than 3 slots for a target, only the uploaded images are used in that round. Empty slots are skipped during reveal (timer advances past them). `availableClueCount` for a round = **total non-null clue slots across both givers combined** (max 6, min 0). E.g., Giver A submits 3 and Giver B submits 1 → `availableClueCount = 4`. Scoring countdown adjusts to `availableClueCount`: e.g., 4 available clues → points go 4→1. The first-blood +2 bonus still applies regardless of clue count.
- No similarity warning shown — duplicate detection is silent, at scoring time

### Phase 3 — The Quiz (Live, all players)
- Organizer starts the quiz (with host secret verified via Cloud Function)
- **N rounds** in shuffled order, one per member (N = member count)
- **Each round:**
  - Only uploaded images for that target are revealed — empty slots are skipped
  - **Configurable reveal timer:** default 12 seconds between clues, adjustable by host from **8–20 seconds** (set on submission monitor screen before quiz starts; also nudgeable from host overlay mid-quiz)
  - Points countdown starts at the number of available clues for that round (max 6, min 1)
  - Host can pause/resume (freezes countdown at current value; resumes from same value) or skip to next clue manually
- **Eligible guessers:** everyone **except the 2 clue-givers** for that round. The target is eligible — they are not told which round features them.
- Clue-givers are **blocked at the data layer** (Cloud Function rejects guess submissions from ineligible players for that round). UI also hides the guess input for clue-givers.
- Players guess via autocomplete (member list, excludes own name). **Max 3 guesses per round per player.**
- **Instant feedback:** player sees ✓ or ✗ immediately after each guess
- **Points countdown:** max available pts for guessing on clue 1, decrements by 1 per clue revealed
- **Wrong guess penalties (cumulative):** 1st wrong = −1 pt, 2nd wrong = −2 pts, 3rd wrong = −3 pts. After 3 wrong guesses, player is locked out for the round. Net round score = (correct guess pts if any) − (sum of wrong guess penalties)
- First correct guesser earns **+2 bonus** (applies even if they had prior wrong guesses that round). Tie-breaking: Firebase server timestamp; lexicographic Firebase key on millisecond tie.
- Scores can go negative — intentional.
- **Live leaderboard sidebar** visible throughout — updates after each round reveal

### Phase 4 — Round Reveal (Host-controlled)
- After the last available clue drops for a round, the game **pauses automatically**
- Guesses are frozen
- Host sees a **"Reveal"** button (host secret verified by Cloud Function)
- On reveal: mystery person unmasked; all available clue images shown; per-guesser score breakdown; clue-giver scores for the round
- Host manually advances to next round (host secret verified)

### Phase 5 — Final Leaderboard
- After all N rounds
- Combined score (guessing + clue-giving) with sub-rankings: **Best Guesser**, **Best Clue-Giver**
- **Tie-breaking (all rankings):** primary = total score; secondary = number of correct guesses; tertiary = alphabetical name order
- Negative totals are possible and valid

---

## Scoring

### Guesser Points
Points for a correct guess depend on which clue index (0-based) the guess was made on:
`points = (available_clue_count - clue_index)` where clue_index is 0-based.

For a full 6-clue round: guessing on clue 1 = 6 pts, clue 2 = 5 pts, …, clue 6 = 1 pt.
For a 4-clue round: clue 1 = 4 pts, …, clue 4 = 1 pt.

| Event | Points |
|---|---|
| Correct guess | `available_clue_count - clue_index` |
| First correct guesser bonus | +2 pts (applies even with prior wrong guesses) |
| 1st wrong guess | −1 pt |
| 2nd wrong guess | −2 pts |
| 3rd wrong guess | −3 pts |
| Locked out (3 wrong, no correct) | −6 pts total for the round |

**Max 3 guesses per player per round.** Instant ✓/✗ feedback shown after each guess. Net round score = correct guess pts − sum of wrong guess penalties.

### Clue-Giver Points
The circular assignment guarantees **exactly 2 givers per target** — this is invariant by design.

Formula: `each_giver_score = Σ(correct_guesser_points_this_round) / 2`

The denominator 2 = number of givers, always. Both givers receive the same score regardless of whose images appeared first in the reveal order.

**Worked example:** 3 correct guessers scored 6, 4, and 2 pts respectively (they guessed on clues 1, 3, and 5 of a full 6-clue round). Total = 12. Each giver receives 12 / 2 = **6 pts**.

**No correct guesses:** each giver earns 0 for the round. Reveal still proceeds.

### Uniqueness Penalty
- **Scope:** for each round, 3 images from Giver A and 3 images from Giver B are compared cross-giver: a **3×3 Cartesian product = 9 image pairs per round** (intra-giver pairs are not checked)
- **Detection:** any cross-giver pair with OpenAI Vision API embedding cosine similarity ≥ **0.85** is flagged as a conceptual duplicate
- **Penalty:** −3 pts applied to the giver whose image was submitted **later** (by Firebase server timestamp on the `clues/{targetId}/{giverId}/submittedAt` field). If timestamps are equal, penalty goes to the giver with the **lexicographically greater `giverId`** (memberId string comparison — deterministic and always resolvable).
- No warning shown during submission — intentional, punishes lazy/surface-level clue choices
- **Double punishment:** lazy givers lose clue score AND reduce effective distinct clues in the round, making correct guesses less likely, further reducing shared pool

---

## Host Identity & Security

**Host credential:**
- At game creation, a UUID `hostSecret` is generated server-side (Cloud Function) and stored in `meta.hostSecret` in RTDB
- The `hostSecret` is returned once to the organizer's browser and stored in `localStorage`
- All host-only actions (start quiz, pause/resume, skip clue, trigger reveal, advance round) are routed through Cloud Functions that verify the provided `hostSecret` matches `meta.hostSecret`
- Host cannot be transferred. If the organizer's browser is closed, they can reclaim host by re-entering the game code — `hostSecret` is retrieved from localStorage. If localStorage is cleared, the quiz is stuck (no host recovery in v1).

**Known tradeoff:** `hostSecret` is stored under `meta.hostSecret` in an open-read RTDB node. Anyone with the game code can read it. Accepted for v1 — this is a trust-based team game, not a competitive environment. Mitigation in v2 would be moving host verification to a protected Cloud Function path.

**Firebase Security Rules (summary):**
- Read: any client may read any game by game code (needed for real-time sync)
- Write — enforced via Cloud Functions (not raw RTDB rules) for:
  - Guess submissions: one per player per round; rejected if player is a clue-giver for that round; rejected after round is revealed
  - Host actions: validated against `hostSecret`
  - Score writes: only writable by Cloud Functions (players cannot self-score)
- Clue uploads: direct Firebase Storage write allowed for any player in `clue-submission` phase; path scoped to `clues/{gameCode}/{targetId}/{giverId}/`
- RTDB rules set `clues/` to write-allowed during `clue-submission` phase only (phase check via rule condition)

---

## Screens

### 1. Landing
- Game title + tagline
- Two CTAs: **"Join a game"** (enter code) | **"Host a game"** (organizer)

### 2. Setup (Organizer)
- Add members: name + photo (URL or emoji)
- Review auto-generated assignments; re-shuffle button
- Confirm → game code displayed + copy button

### 3. Clue Submission (Player)
- Name dropdown (organizer's member list)
- Two sections, one per assigned person: name, photo, 3 upload slots (drag/drop or file picker)
- Per-slot replacement; progress indicator ("4 / 6 uploaded")
- **Uniqueness reminder** shown on screen (not a warning about specific images — a general nudge): *"Heads up: if your clues are too similar to another player's for the same person, you'll lose points. The more unique and specific, the better."*
- Submit — can return to edit until quiz starts

### 4. Submission Monitor (Organizer)
- Grid of all members: name, photo, submission status (e.g. 2/6, 6/6)
- **Reveal timer setting:** +/− control to adjust seconds between clues (8–20s, default 12s)
- Start Quiz button (always active)

### 5. Quiz Screen — Player View
- **Header:** logo, Round N of M, player's total score
- **Mystery label:** "Who is ——?"
- **Clue filmstrip:** slots for available clues (up to 6) × 3:4 portrait; left-to-right reveal; orange outline on active slot; 12-second countdown shown between slots; locked slots show dash placeholder
- **Points badge:** current available points (decrements each clue)
- **Guess input:** autocomplete name picker (member list, excludes own name); lock-in button showing current point value; hidden after player has guessed
- **Player chips:** shows who has locked in vs. still thinking; guesses hidden until reveal
- **Leaderboard sidebar:** running total scores for all members, ranked, updates after each round

### 6. Quiz Screen — Clue-Giver View (for rounds they submitted clues for)
- Same as Player View but: guess input replaced with "You're giving clues this round"
- Guess submission blocked at data layer (Cloud Function) in addition to UI hiding

### 7. Host Control Overlay
- Floats above the quiz screen (organizer's device only, verified by hostSecret in localStorage)
- Pause / resume clue countdown
- Skip to next clue
- **+/− timer nudge** — adjusts reveal interval mid-quiz (8–20s range)
- **"Reveal"** button — appears after last clue for the round drops
- **"Next Round"** button — appears after reveal

### 8. Round Reveal — All Players
- Mystery person unmasked: large photo + name
- Full filmstrip of available clues
- Per-guesser breakdown: name, guess, ✓/✗, points earned/lost
- Clue-giver scores for the round (shared pool, any penalties noted)
- Leaderboard sidebar updates inline

### 9. Final Leaderboard
- Overall ranking + combined score
- Sub-tabs: Best Guesser | Best Clue-Giver
- Top 3 highlighted

---

## Visual Design

**Reference:** mymind.com — warm editorial minimalism, generous whitespace, one bold accent

| Token | Value |
|---|---|
| Background | `#FAF8F4` |
| Surface | `#FFFFFF` |
| Border | `#E8E0D4` |
| Text primary | `#1A1A1A` |
| Text secondary | `#888` |
| Text muted | `#C4B9A8` |
| Accent | `#E8572A` (orange) |
| Danger | `#E63946` |
| Display font | Lora (serif) |
| UI font | Plus Jakarta Sans |
| Button radius | `100px` pill |
| Card radius | `12–16px` |
| Clue image ratio | 3:4 portrait, center-cropped |

---

## Data Model (Firebase RTDB)

```
/games/{gameCode}/
  meta/
    phase: "setup" | "clue-submission" | "quiz" | "finished"
    hostSecret: string            // UUID, verified by Cloud Functions
    createdAt: number
    memberCount: number
    roundOrder: [memberId, ...]   // shuffled array, set at quiz start
    currentRound: number          // index into roundOrder

  members/{memberId}/
    name: string
    photo: string
    assignedTo: [memberId, memberId]   // this player gives clues for these two
    givesFrom: [memberId, memberId]    // these two give clues for this member

  clues/{targetMemberId}/{giverMemberId}/
    0: storageUrl | null
    1: storageUrl | null
    2: storageUrl | null
    submittedAt: number

  rounds/{roundIndex}/
    targetMemberId: string
    availableClueCount: number    // computed at round start from non-null clue slots
    timerPaused: boolean
    currentClueIndex: number      // -1 = not started; 0–(N-1) = revealing
    votingOpen: boolean
    revealed: boolean
    guesses/{guessingMemberId}/
      answer: string
      clueIndex: number
      correct: boolean
      timestamp: number

  scores/{memberId}/
    guessing: number
    clueing: number
    total: number
    correctGuessCount: number     // for tie-breaking
```

---

## Fairness Decisions

| Issue | Resolution |
|---|---|
| Clue reveal order bias | Both givers split the round's correct-guess total equally (÷ 2, invariant) |
| Uniqueness penalty surprise | Silent — intentional double punishment for laziness |
| Negative scores | Intentional |
| Target can guess | Eligible — not told which round is theirs |
| Symmetric guessing exclusions | Each player skips exactly 2 rounds (their 2 giver assignments) |
| First-correct tie | Firebase server timestamp; lexicographic Firebase key as tiebreaker |

---

## Out of Scope (v1)
- Image search / Unsplash
- Real-time chat or reactions
- Host recovery after localStorage cleared
- Mobile-first layout
- Game history / replay
- Custom round counts
- Manual assignment editing
