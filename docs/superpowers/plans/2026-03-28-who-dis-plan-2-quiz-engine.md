# Who Dis? — Plan 2: Quiz Engine + Scoring

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete live quiz experience — real-time clue reveal, multi-attempt guessing with instant feedback, host controls, round reveal, image similarity scoring via Cloud Functions, and the final leaderboard.

**Architecture:** All quiz state lives in Firebase RTDB under `games/{code}/rounds/{index}`. A server-side timer managed by a Cloud Function advances `currentClueIndex` on an interval — clients never drive time, they only listen. Guesses and host actions go through Cloud Functions for validation. Scoring (including OpenAI similarity check) runs in a Cloud Function triggered after reveal.

**Tech Stack:** React 18 + TypeScript (existing), Firebase RTDB real-time listeners, Firebase Cloud Functions v2 (Node 20), OpenAI Node SDK (image embeddings via `gpt-4o-mini` vision), Tailwind CSS (existing).

**Prerequisite:** Plan 1 complete and deployed.

---

## File Map (additions to Plan 1)

```
src/
  screens/
    Quiz.tsx                    # Main quiz screen (player + clue-giver views)
    RoundReveal.tsx             # Post-reveal breakdown
    FinalLeaderboard.tsx        # End-game rankings
  components/
    ClueFilmstrip.tsx           # 6-slot reveal strip with timer
    LeaderboardSidebar.tsx      # Live score sidebar
    PlayerChips.tsx             # Who's locked in vs thinking
    GuessInput.tsx              # Autocomplete, instant feedback, 3-attempt logic
    HostOverlay.tsx             # Floating host control panel
  hooks/
    useRound.ts                 # Current round listener + derived state
    useCountdown.ts             # Local countdown timer synced to RTDB interval

functions/src/
  advanceClue.ts                # Scheduled: advance currentClueIndex on timer
  submitGuess.ts                # Validate + record guess, return correct/wrong
  hostAction.ts                 # pause, skip, reveal, nextRound (hostSecret gated)
  scoreRound.ts                 # Calculate scores + run similarity check
  similarityCheck.ts            # OpenAI Vision cosine similarity helper
```

---

## Task 1: `useRound` and `useCountdown` hooks

**Files:**
- Create: `src/hooks/useRound.ts`
- Create: `src/hooks/useCountdown.ts`

- [ ] **Step 1: Create `src/hooks/useRound.ts`**

```ts
import { useEffect, useState } from 'react'
import { ref, onValue } from 'firebase/database'
import { db } from '../firebase'
import type { Game, Round, Member } from '../types'

export interface RoundState {
  round: Round | null
  roundIndex: number
  targetMember: Member | null
  clueUrls: (string | null)[]   // ordered array of up to 6 clue URLs (interleaved givers)
  myEligibility: 'guesser' | 'clue-giver' | 'loading'
  myGuesses: import('../types').Guess[]
}

export function useRound(game: Game | null, memberId: string): RoundState {
  const [roundState, setRoundState] = useState<RoundState>({
    round: null,
    roundIndex: -1,
    targetMember: null,
    clueUrls: [],
    myEligibility: 'loading',
    myGuesses: [],
  })

  useEffect(() => {
    if (!game?.meta?.roundOrder || game.meta.currentRound === undefined) return
    const roundIndex = game.meta.currentRound
    const targetId = game.meta.roundOrder[roundIndex]
    const round = (game.rounds?.[roundIndex] ?? null) as Round | null
    const targetMember = targetId ? game.members[targetId] : null

    // Build interleaved clue URL array from both givers
    const givers = targetMember ? game.members[targetId]?.givesFrom ?? [] : []
    const rawClues: (string | null)[] = []
    // Interleave: giver0[0], giver1[0], giver0[1], giver1[1], giver0[2], giver1[2]
    for (let slot = 0; slot < 3; slot++) {
      for (const giverId of givers) {
        const url = game.clues?.[targetId]?.[giverId]?.[slot as 0|1|2] ?? null
        if (url) rawClues.push(url)
      }
    }
    // Filter to only non-null (matches availableClueCount)
    const clueUrls = rawClues.filter(Boolean) as string[]

    // Eligibility
    const isClueGiver = targetMember?.givesFrom?.includes(memberId) ?? false
    const myEligibility: RoundState['myEligibility'] = isClueGiver ? 'clue-giver' : 'guesser'

    // My guesses this round
    const myGuesses = Object.values(round?.guesses?.[memberId] ? [round.guesses[memberId]] : []) as import('../types').Guess[]

    setRoundState({ round, roundIndex, targetMember, clueUrls, myEligibility, myGuesses })
  }, [game, memberId])

  return roundState
}
```

- [ ] **Step 2: Create `src/hooks/useCountdown.ts`**

```ts
import { useEffect, useRef, useState } from 'react'

/**
 * Local countdown from `seconds` to 0.
 * Resets whenever `resetKey` changes.
 * Paused when `paused` is true.
 */
export function useCountdown(seconds: number, paused: boolean, resetKey: unknown) {
  const [remaining, setRemaining] = useState(seconds)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setRemaining(seconds)
  }, [resetKey, seconds])

  useEffect(() => {
    if (paused) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      setRemaining(r => Math.max(0, r - 1))
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [paused, resetKey])

  return remaining
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useRound.ts src/hooks/useCountdown.ts
git commit -m "feat: useRound and useCountdown hooks"
```

---

## Task 2: `advanceClue` Cloud Function (timer engine)

**Files:**
- Create: `functions/src/advanceClue.ts`
- Modify: `functions/src/index.ts`

The quiz timer runs server-side. After each clue is set, a Firebase scheduled task or a `setTimeout` inside a Cloud Function advances `currentClueIndex`. We use a simple approach: when a clue is set to index N, a Cloud Function is called after `revealIntervalSeconds` to advance to N+1.

- [ ] **Step 1: Create `functions/src/advanceClue.ts`**

```ts
import * as admin from 'firebase-admin'
import { onCall, HttpsError } from 'firebase-functions/v2/https'

// Called by the host's client after each clue drop to schedule the next one.
// The client sets a local setTimeout of revealIntervalSeconds, then calls this.
// This function validates it's the right time and increments the index.
export const advanceClue = onCall(async (request) => {
  const { gameCode, hostSecret, roundIndex, fromClueIndex } = request.data as {
    gameCode: string
    hostSecret: string
    roundIndex: number
    fromClueIndex: number
  }

  const db = admin.database()
  const metaSnap = await db.ref(`games/${gameCode}/meta`).get()
  const meta = metaSnap.val()

  if (meta?.hostSecret !== hostSecret) throw new HttpsError('permission-denied', 'Invalid host secret')
  if (meta?.phase !== 'quiz') throw new HttpsError('failed-precondition', 'Not in quiz phase')

  const roundRef = db.ref(`games/${gameCode}/rounds/${roundIndex}`)
  const roundSnap = await roundRef.get()
  const round = roundSnap.val()

  if (!round) throw new HttpsError('not-found', 'Round not found')
  if (round.timerPaused) return { ok: false, reason: 'paused' }
  if (round.revealed) return { ok: false, reason: 'already revealed' }

  // Only advance if we're still on the expected index
  if (round.currentClueIndex !== fromClueIndex) return { ok: false, reason: 'stale' }

  const nextIndex = fromClueIndex + 1
  const isLastClue = nextIndex >= round.availableClueCount

  await roundRef.update({
    currentClueIndex: nextIndex,
    votingOpen: !isLastClue,
    // If last clue, close voting (game pauses for host reveal)
  })

  if (isLastClue) {
    await roundRef.update({ votingOpen: false })
  }

  return { ok: true, nextIndex, isLastClue }
})
```

- [ ] **Step 2: Update `functions/src/index.ts`**

```ts
export { createGame } from './createGame'
export { startQuiz } from './startQuiz'
export { advanceClue } from './advanceClue'
```

- [ ] **Step 3: Commit**

```bash
git add functions/src/advanceClue.ts functions/src/index.ts
git commit -m "feat: advanceClue Cloud Function for server-side timer"
```

---

## Task 3: `submitGuess` Cloud Function

**Files:**
- Create: `functions/src/submitGuess.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Create `functions/src/submitGuess.ts`**

```ts
import * as admin from 'firebase-admin'
import { onCall, HttpsError } from 'firebase-functions/v2/https'

interface SubmitGuessRequest {
  gameCode: string
  memberId: string
  roundIndex: number
  answer: string
}

export const submitGuess = onCall(async (request) => {
  const { gameCode, memberId, roundIndex, answer } = request.data as SubmitGuessRequest
  const db = admin.database()

  const [metaSnap, roundSnap, membersSnap] = await Promise.all([
    db.ref(`games/${gameCode}/meta`).get(),
    db.ref(`games/${gameCode}/rounds/${roundIndex}`).get(),
    db.ref(`games/${gameCode}/members`).get(),
  ])

  const meta = metaSnap.val()
  const round = roundSnap.val()
  const members = membersSnap.val() as Record<string, { assignedTo: string[]; givesFrom: string[] }>

  if (!round || !meta || !members) throw new HttpsError('not-found', 'Game data not found')
  if (meta.phase !== 'quiz') throw new HttpsError('failed-precondition', 'Not in quiz phase')
  if (!round.votingOpen) throw new HttpsError('failed-precondition', 'Voting is closed')

  // Eligibility: clue-givers for this round cannot guess
  const targetId = round.targetMemberId
  const target = members[targetId]
  if (target?.givesFrom?.includes(memberId)) {
    throw new HttpsError('permission-denied', 'Clue-givers cannot guess their own round')
  }

  // Check existing guesses
  const existingGuessesSnap = await db.ref(`games/${gameCode}/rounds/${roundIndex}/guesses/${memberId}`).get()
  const existingGuesses = existingGuessesSnap.val() as Record<string, unknown> ?? {}
  const attemptCount = Object.keys(existingGuesses).length

  if (attemptCount >= 3) throw new HttpsError('failed-precondition', 'Max 3 guesses per round')

  // Check if already got a correct guess
  const alreadyCorrect = Object.values(existingGuesses).some((g: unknown) => (g as { correct: boolean }).correct)
  if (alreadyCorrect) throw new HttpsError('failed-precondition', 'Already guessed correctly')

  // Determine correctness
  const targetMember = members[targetId] as { name: string }
  const correct = answer.trim().toLowerCase() === targetMember.name.trim().toLowerCase()
  const attemptNumber = attemptCount + 1
  const clueIndex = round.currentClueIndex

  // Write guess
  await db.ref(`games/${gameCode}/rounds/${roundIndex}/guesses/${memberId}/${attemptNumber}`).set({
    answer,
    clueIndex,
    correct,
    timestamp: Date.now(),
    attemptNumber,
  })

  // Check first correct guesser
  let isFirstCorrect = false
  if (correct) {
    const allGuessesSnap = await db.ref(`games/${gameCode}/rounds/${roundIndex}/guesses`).get()
    const allGuesses = allGuessesSnap.val() as Record<string, Record<string, { correct: boolean }>> ?? {}
    const otherCorrect = Object.entries(allGuesses).some(
      ([gId, attempts]) =>
        gId !== memberId &&
        Object.values(attempts).some(a => a.correct)
    )
    isFirstCorrect = !otherCorrect
  }

  return { correct, attemptNumber, isFirstCorrect }
})
```

- [ ] **Step 2: Update `functions/src/index.ts`**

```ts
export { createGame } from './createGame'
export { startQuiz } from './startQuiz'
export { advanceClue } from './advanceClue'
export { submitGuess } from './submitGuess'
```

- [ ] **Step 3: Write tests for submitGuess**

```ts
// functions/src/submitGuess.test.ts
// Test the guess validation logic in isolation (not the full Cloud Function)
import { describe, it, expect } from 'vitest'

function isCorrectGuess(answer: string, targetName: string): boolean {
  return answer.trim().toLowerCase() === targetName.trim().toLowerCase()
}

describe('guess correctness', () => {
  it('matches case-insensitively', () => {
    expect(isCorrectGuess('Alice', 'alice')).toBe(true)
    expect(isCorrectGuess('ALICE', 'Alice')).toBe(true)
  })
  it('trims whitespace', () => {
    expect(isCorrectGuess(' Alice ', 'Alice')).toBe(true)
  })
  it('rejects wrong names', () => {
    expect(isCorrectGuess('Bob', 'Alice')).toBe(false)
  })
})
```

- [ ] **Step 4: Run tests**

```bash
cd functions && npx vitest run src/submitGuess.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add functions/src/submitGuess.ts functions/src/submitGuess.test.ts functions/src/index.ts
git commit -m "feat: submitGuess Cloud Function with eligibility + attempt limits"
```

---

## Task 4: `hostAction` Cloud Function

**Files:**
- Create: `functions/src/hostAction.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Create `functions/src/hostAction.ts`**

```ts
import * as admin from 'firebase-admin'
import { onCall, HttpsError } from 'firebase-functions/v2/https'

type HostActionType = 'pause' | 'resume' | 'skipClue' | 'reveal' | 'nextRound' | 'adjustTimer'

interface HostActionRequest {
  gameCode: string
  hostSecret: string
  action: HostActionType
  payload?: { intervalSeconds?: number }
}

export const hostAction = onCall(async (request) => {
  const { gameCode, hostSecret, action, payload } = request.data as HostActionRequest
  const db = admin.database()

  const metaSnap = await db.ref(`games/${gameCode}/meta`).get()
  const meta = metaSnap.val()
  if (!meta) throw new HttpsError('not-found', 'Game not found')
  if (meta.hostSecret !== hostSecret) throw new HttpsError('permission-denied', 'Invalid host secret')

  const roundIndex = meta.currentRound
  const roundRef = db.ref(`games/${gameCode}/rounds/${roundIndex}`)

  switch (action) {
    case 'pause':
      await roundRef.update({ timerPaused: true })
      break

    case 'resume':
      await roundRef.update({ timerPaused: false })
      break

    case 'skipClue': {
      const snap = await roundRef.get()
      const round = snap.val()
      const nextIndex = (round.currentClueIndex ?? -1) + 1
      const isLast = nextIndex >= round.availableClueCount
      await roundRef.update({
        currentClueIndex: nextIndex,
        votingOpen: !isLast,
      })
      break
    }

    case 'reveal': {
      await roundRef.update({ revealed: true, votingOpen: false })
      break
    }

    case 'nextRound': {
      const nextRound = roundIndex + 1
      const totalRounds = meta.memberCount
      if (nextRound >= totalRounds) {
        await db.ref(`games/${gameCode}/meta`).update({ phase: 'finished' })
      } else {
        await db.ref(`games/${gameCode}/meta`).update({ currentRound: nextRound })
        await db.ref(`games/${gameCode}/rounds/${nextRound}`).update({
          currentClueIndex: -1,
          votingOpen: false,
          timerPaused: false,
        })
      }
      break
    }

    case 'adjustTimer':
      if (payload?.intervalSeconds) {
        const secs = Math.min(20, Math.max(8, payload.intervalSeconds))
        await db.ref(`games/${gameCode}/meta`).update({ revealIntervalSeconds: secs })
      }
      break

    default:
      throw new HttpsError('invalid-argument', `Unknown action: ${action}`)
  }

  return { ok: true }
})
```

- [ ] **Step 2: Update `functions/src/index.ts`**

```ts
export { createGame } from './createGame'
export { startQuiz } from './startQuiz'
export { advanceClue } from './advanceClue'
export { submitGuess } from './submitGuess'
export { hostAction } from './hostAction'
```

- [ ] **Step 3: Commit**

```bash
git add functions/src/hostAction.ts functions/src/index.ts
git commit -m "feat: hostAction Cloud Function (pause/resume/skip/reveal/nextRound/adjustTimer)"
```

---

## Task 5: `scoreRound` + similarity check Cloud Functions

**Files:**
- Create: `functions/src/similarityCheck.ts`
- Create: `functions/src/scoreRound.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Create `functions/src/similarityCheck.ts`**

```ts
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

/**
 * Returns cosine similarity between two image URLs using OpenAI embeddings.
 * Uses text embeddings of vision descriptions as a proxy for image similarity.
 */
async function describeImage(url: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url } },
        { type: 'text', text: 'Describe this image in 10–15 words focusing on the main subject, mood, and key visual elements.' }
      ]
    }],
    max_tokens: 60,
  })
  return response.choices[0].message.content ?? ''
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0)
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0))
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0))
  return magA && magB ? dot / (magA * magB) : 0
}

async function embedText(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return res.data[0].embedding
}

/**
 * Returns true if two image URLs are conceptually similar (cosine ≥ 0.85).
 */
export async function areImagesSimilar(urlA: string, urlB: string): Promise<boolean> {
  const [descA, descB] = await Promise.all([describeImage(urlA), describeImage(urlB)])
  const [embA, embB] = await Promise.all([embedText(descA), embedText(descB)])
  const sim = cosineSimilarity(embA, embB)
  return sim >= 0.85
}
```

- [ ] **Step 2: Set OpenAI API key in Firebase Functions config**

```bash
firebase functions:secrets:set OPENAI_API_KEY
# Enter your OpenAI API key when prompted
```

- [ ] **Step 3: Create `functions/src/scoreRound.ts`**

```ts
import * as admin from 'firebase-admin'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { areImagesSimilar } from './similarityCheck'

export const scoreRound = onCall(
  { secrets: ['OPENAI_API_KEY'] },
  async (request) => {
    const { gameCode, hostSecret, roundIndex } = request.data as {
      gameCode: string; hostSecret: string; roundIndex: number
    }
    const db = admin.database()

    const [metaSnap, roundSnap, membersSnap, cluesSnap] = await Promise.all([
      db.ref(`games/${gameCode}/meta`).get(),
      db.ref(`games/${gameCode}/rounds/${roundIndex}`).get(),
      db.ref(`games/${gameCode}/members`).get(),
      db.ref(`games/${gameCode}/clues`).get(),
    ])

    const meta = metaSnap.val()
    if (meta?.hostSecret !== hostSecret) throw new HttpsError('permission-denied', 'Invalid host secret')

    const round = roundSnap.val()
    const members = membersSnap.val() as Record<string, { givesFrom: string[]; name: string }>
    const clues = cluesSnap.val() as Record<string, Record<string, Record<number, string>>>

    const targetId = round.targetMemberId
    const givers = members[targetId]?.givesFrom ?? []
    const guesses = (round.guesses ?? {}) as Record<string, Record<string, {
      correct: boolean; clueIndex: number; timestamp: number; attemptNumber: number
    }>>

    // --- GUESSER SCORING ---
    // For each guesser, find their correct guess (if any) and all wrong guesses
    const scoreUpdates: Record<string, { guessing: number; clueing: number; total: number; correctGuessCount: number }> = {}
    const allMemberIds = Object.keys(members)

    // Init all scores to existing values
    const scoresSnap = await db.ref(`games/${gameCode}/scores`).get()
    const existingScores = scoresSnap.val() ?? {}
    for (const id of allMemberIds) {
      scoreUpdates[id] = existingScores[id] ?? { guessing: 0, clueing: 0, total: 0, correctGuessCount: 0 }
    }

    let firstCorrectTimestamp = Infinity
    let totalCorrectGuesserPoints = 0

    // Calculate guesser points
    for (const [guesserId, attempts] of Object.entries(guesses)) {
      let guesserRoundPoints = 0
      let hadCorrect = false

      const sortedAttempts = Object.values(attempts).sort((a, b) => a.attemptNumber - b.attemptNumber)
      let wrongCount = 0

      for (const attempt of sortedAttempts) {
        if (attempt.correct) {
          const pts = round.availableClueCount - attempt.clueIndex
          guesserRoundPoints += pts
          totalCorrectGuesserPoints += pts
          hadCorrect = true
          if (attempt.timestamp < firstCorrectTimestamp) {
            firstCorrectTimestamp = attempt.timestamp
          }
          break // stop counting after correct
        } else {
          wrongCount++
          guesserRoundPoints -= wrongCount // -1, -2, -3
        }
      }

      scoreUpdates[guesserId].guessing += guesserRoundPoints
      if (hadCorrect) scoreUpdates[guesserId].correctGuessCount += 1
    }

    // First correct guesser +2 bonus
    if (firstCorrectTimestamp < Infinity) {
      for (const [guesserId, attempts] of Object.entries(guesses)) {
        const correct = Object.values(attempts).find(a => a.correct)
        if (correct && correct.timestamp === firstCorrectTimestamp) {
          scoreUpdates[guesserId].guessing += 2
          break
        }
      }
    }

    // --- CLUE-GIVER SCORING ---
    const eachGiverPoints = totalCorrectGuesserPoints / 2

    // --- UNIQUENESS PENALTY ---
    // Compare each cross-giver image pair (3×3 = 9 pairs)
    const penalties: Record<string, number> = {}

    if (givers.length === 2) {
      const [giverA, giverB] = givers
      const cluesA = clues[targetId]?.[giverA] ?? {}
      const cluesB = clues[targetId]?.[giverB] ?? {}

      // Get submittedAt to determine who submitted later
      const cluesAMeta = (await db.ref(`games/${gameCode}/clues/${targetId}/${giverA}/submittedAt`).get()).val() as number ?? 0
      const cluesBMeta = (await db.ref(`games/${gameCode}/clues/${targetId}/${giverB}/submittedAt`).get()).val() as number ?? 0
      const laterGiver = cluesAMeta > cluesBMeta ? giverA
        : cluesBMeta > cluesAMeta ? giverB
        : giverA > giverB ? giverA : giverB // lexicographic tiebreak

      for (let slotA = 0; slotA < 3; slotA++) {
        for (let slotB = 0; slotB < 3; slotB++) {
          const urlA = cluesA[slotA]
          const urlB = cluesB[slotB]
          if (!urlA || !urlB) continue
          try {
            const similar = await areImagesSimilar(urlA, urlB)
            if (similar) {
              penalties[laterGiver] = (penalties[laterGiver] ?? 0) + 3
            }
          } catch {
            // OpenAI call failed — skip penalty for this pair
          }
        }
      }
    }

    // Apply clue-giver points and penalties
    for (const giverId of givers) {
      const penalty = penalties[giverId] ?? 0
      scoreUpdates[giverId].clueing += Math.max(-eachGiverPoints, eachGiverPoints - penalty)
    }

    // Recalculate totals
    for (const id of allMemberIds) {
      scoreUpdates[id].total = scoreUpdates[id].guessing + scoreUpdates[id].clueing
    }

    // Write all scores
    await db.ref(`games/${gameCode}/scores`).update(scoreUpdates)

    return { ok: true, totalCorrectGuesserPoints, penalties }
  }
)
```

- [ ] **Step 4: Update `functions/src/index.ts`**

```ts
export { createGame } from './createGame'
export { startQuiz } from './startQuiz'
export { advanceClue } from './advanceClue'
export { submitGuess } from './submitGuess'
export { hostAction } from './hostAction'
export { scoreRound } from './scoreRound'
```

- [ ] **Step 5: Deploy functions**

```bash
cd functions && npm run build && cd ..
firebase deploy --only functions
```

- [ ] **Step 6: Commit**

```bash
git add functions/src/similarityCheck.ts functions/src/scoreRound.ts functions/src/index.ts
git commit -m "feat: scoreRound with OpenAI similarity check and uniqueness penalty"
```

---

## Task 6: `ClueFilmstrip` component

**Files:**
- Create: `src/components/ClueFilmstrip.tsx`

- [ ] **Step 1: Create `src/components/ClueFilmstrip.tsx`**

```tsx
interface Props {
  clueUrls: (string | null)[]
  availableCount: number
  currentIndex: number        // -1 = not started
  timerPaused: boolean
  intervalSeconds: number
}

export function ClueFilmstrip({ clueUrls, availableCount, currentIndex, timerPaused, intervalSeconds }: Props) {
  const slots = Array.from({ length: availableCount }, (_, i) => clueUrls[i] ?? null)

  return (
    <div className="flex gap-3 w-full">
      {slots.map((url, i) => {
        const isRevealed = i <= currentIndex
        const isActive = i === currentIndex
        const isLocked = i > currentIndex

        return (
          <div
            key={i}
            className={`flex-1 aspect-[3/4] rounded-xl overflow-hidden relative border-2 transition-all duration-300 ${
              isActive
                ? 'border-accent shadow-lg scale-105'
                : isRevealed
                ? 'border-transparent'
                : 'border-dashed border-border bg-[#F8F5F0]'
            }`}
          >
            {isRevealed && url ? (
              <img src={url} alt={`Clue ${i + 1}`} className="w-full h-full object-cover" />
            ) : isLocked ? (
              <div className="w-full h-full flex items-center justify-center text-muted text-lg">—</div>
            ) : null}

            {/* Clue number badge */}
            {isRevealed && (
              <div className={`absolute top-2 left-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                isActive ? 'bg-accent text-white' : 'bg-black/40 text-white'
              }`}>
                {i + 1}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ClueFilmstrip.tsx
git commit -m "feat: ClueFilmstrip component"
```

---

## Task 7: `GuessInput` component

**Files:**
- Create: `src/components/GuessInput.tsx`

- [ ] **Step 1: Create `src/components/GuessInput.tsx`**

```tsx
import { useState, useRef } from 'react'
import type { Guess } from '../types'

interface Props {
  memberNames: { id: string; name: string }[]
  myGuesses: Guess[]
  availablePoints: number
  votingOpen: boolean
  onGuess: (answer: string) => Promise<{ correct: boolean; isFirstCorrect: boolean }>
}

export function GuessInput({ memberNames, myGuesses, availablePoints, votingOpen, onGuess }: Props) {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<typeof memberNames>([])
  const [loading, setLoading] = useState(false)
  const [lastResult, setLastResult] = useState<{ correct: boolean; isFirstCorrect: boolean } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const attemptCount = myGuesses.length
  const hasCorrect = myGuesses.some(g => g.correct)
  const isLockedOut = attemptCount >= 3 || hasCorrect || !votingOpen

  const wrongPenalty = [0, 1, 3, 6][attemptCount] // cumulative: 0, -1, -3, -6
  const nextPenalty = [1, 2, 3][attemptCount] ?? 0 // next wrong costs this much

  function handleInput(val: string) {
    setInput(val)
    setLastResult(null)
    if (val.length < 1) { setSuggestions([]); return }
    const matches = memberNames.filter(m =>
      m.name.toLowerCase().startsWith(val.toLowerCase())
    )
    setSuggestions(matches.slice(0, 5))
  }

  async function handleSubmit(name: string) {
    if (!name.trim() || loading || isLockedOut) return
    setLoading(true)
    setSuggestions([])
    setInput('')
    try {
      const result = await onGuess(name)
      setLastResult(result)
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  if (isLockedOut && hasCorrect) {
    return (
      <div className="flex items-center gap-3 py-3">
        <div className="w-8 h-8 rounded-full bg-[#EDFAF3] flex items-center justify-center text-[#1A9E5C] font-bold">✓</div>
        <span className="font-semibold text-[#1A9E5C]">
          Correct!{lastResult?.isFirstCorrect && <span className="text-accent ml-2">First guess +2 🎯</span>}
        </span>
      </div>
    )
  }

  if (isLockedOut && !hasCorrect) {
    return (
      <div className="flex items-center gap-3 py-3">
        <div className="w-8 h-8 rounded-full bg-[#FFF0EB] flex items-center justify-center text-danger font-bold">✗</div>
        <span className="text-[#888]">{attemptCount >= 3 ? 'Out of guesses' : 'Voting closed'}</span>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Attempt feedback dots */}
      {attemptCount > 0 && (
        <div className="flex gap-1.5 mb-2">
          {Array.from({ length: 3 }).map((_, i) => {
            const guess = myGuesses[i]
            return (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  !guess ? 'bg-border'
                  : guess.correct ? 'bg-[#1A9E5C]'
                  : 'bg-danger'
                }`}
              />
            )
          })}
          {lastResult && !lastResult.correct && (
            <span className="text-xs text-danger ml-2">Wrong — try again ({3 - attemptCount} left)</span>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            value={input}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && suggestions.length > 0) handleSubmit(suggestions[0].name) }}
            placeholder="Type a name…"
            disabled={loading}
            className="w-full h-14 px-6 border border-border rounded-full bg-white text-[#1a1a1a] placeholder:text-muted focus:outline-none focus:border-[#1a1a1a] transition-colors text-sm font-semibold"
          />
          {suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-border rounded-2xl overflow-hidden shadow-lg z-10">
              {suggestions.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleSubmit(s.name)}
                  className="w-full text-left px-5 py-3 text-sm font-semibold hover:bg-[#F8F5F0] transition-colors"
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => suggestions[0] && handleSubmit(suggestions[0].name)}
          disabled={!input || loading}
          className="h-14 px-6 bg-[#1a1a1a] text-cream font-semibold rounded-full disabled:opacity-40 hover:opacity-85 transition-opacity whitespace-nowrap text-sm"
        >
          {loading ? '…' : `Lock in · ${availablePoints} pts`}
        </button>
      </div>

      <p className="text-xs text-muted mt-2">
        Wrong guess costs <span className="text-danger font-semibold">−{nextPenalty} pt{nextPenalty !== 1 ? 's' : ''}</span>
        {attemptCount > 0 && <span className="ml-2">(already lost {wrongPenalty} this round)</span>}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/GuessInput.tsx
git commit -m "feat: GuessInput with instant feedback and 3-attempt escalating penalties"
```

---

## Task 8: `LeaderboardSidebar` + `PlayerChips` components

**Files:**
- Create: `src/components/LeaderboardSidebar.tsx`
- Create: `src/components/PlayerChips.tsx`

- [ ] **Step 1: Create `src/components/LeaderboardSidebar.tsx`**

```tsx
import type { Game } from '../types'

interface Props {
  game: Game
  currentMemberId: string
}

export function LeaderboardSidebar({ game, currentMemberId }: Props) {
  const members = Object.entries(game.members)
  const scores = game.scores ?? {}

  const ranked = members
    .map(([id, m]) => ({
      id,
      name: m.name,
      photo: m.photo,
      total: scores[id]?.total ?? 0,
      correctGuessCount: scores[id]?.correctGuessCount ?? 0,
    }))
    .sort((a, b) =>
      b.total - a.total ||
      b.correctGuessCount - a.correctGuessCount ||
      a.name.localeCompare(b.name)
    )

  return (
    <div className="w-56 flex-shrink-0">
      <p className="text-xs font-bold tracking-[1.5px] uppercase text-muted mb-3">Standings</p>
      <div className="flex flex-col gap-1.5">
        {ranked.map((m, i) => (
          <div
            key={m.id}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors ${
              m.id === currentMemberId ? 'bg-[#1a1a1a] text-cream' : 'bg-white border border-border'
            }`}
          >
            <span className={`text-xs font-bold w-4 ${m.id === currentMemberId ? 'text-muted' : 'text-muted'}`}>{i + 1}</span>
            <span className="text-base">{m.photo.startsWith('http') ? '👤' : m.photo}</span>
            <span className="flex-1 text-sm font-semibold truncate">{m.name}</span>
            <span className={`text-sm font-bold font-lora ${m.total < 0 ? 'text-danger' : ''}`}>{m.total}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/PlayerChips.tsx`**

```tsx
import type { Game, Round } from '../types'

interface Props {
  game: Game
  round: Round
  currentMemberId: string
}

export function PlayerChips({ game, round, currentMemberId }: Props) {
  const members = Object.entries(game.members)
  const targetId = round.targetMemberId
  const clueGivers = game.members[targetId]?.givesFrom ?? []

  const eligible = members.filter(([id]) => !clueGivers.includes(id))

  return (
    <div className="flex flex-wrap gap-2">
      {eligible.map(([id, m]) => {
        const guesses = round.guesses?.[id]
        const hasGuessed = guesses && Object.keys(guesses).length > 0
        const hasCorrect = guesses && Object.values(guesses).some(g => (g as { correct: boolean }).correct)
        const isSelf = id === currentMemberId

        return (
          <div
            key={id}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              hasCorrect
                ? 'bg-[#EDFAF3] border-[#1A9E5C] text-[#1A9E5C]'
                : hasGuessed
                ? 'bg-[#F0ECE4] border-border text-[#888]'
                : 'bg-white border-border text-[#888]'
            } ${isSelf ? 'ring-2 ring-[#1a1a1a] ring-offset-1' : ''}`}
          >
            <span>{m.photo.startsWith('http') ? '👤' : m.photo}</span>
            <span>{m.name}</span>
            {hasCorrect && <span>✓</span>}
            {hasGuessed && !hasCorrect && <span className="text-[#C4B9A8]">✓</span>}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/LeaderboardSidebar.tsx src/components/PlayerChips.tsx
git commit -m "feat: LeaderboardSidebar and PlayerChips components"
```

---

## Task 9: `HostOverlay` component

**Files:**
- Create: `src/components/HostOverlay.tsx`

- [ ] **Step 1: Create `src/components/HostOverlay.tsx`**

```tsx
import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import type { Round } from '../types'

interface Props {
  gameCode: string
  hostSecret: string
  round: Round
  roundIndex: number
  intervalSeconds: number
}

export function HostOverlay({ gameCode, hostSecret, round, roundIndex, intervalSeconds }: Props) {
  const [busy, setBusy] = useState(false)
  const fn = httpsCallable(functions, 'hostAction')

  async function act(action: string, payload?: object) {
    if (busy) return
    setBusy(true)
    try {
      await fn({ gameCode, hostSecret, action, roundIndex, payload })
    } finally {
      setBusy(false)
    }
  }

  const allCluesDropped = round.currentClueIndex >= round.availableClueCount - 1
  const canReveal = allCluesDropped && !round.revealed && !round.votingOpen
  const canNext = round.revealed

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-[#1a1a1a] rounded-2xl px-5 py-4 flex items-center gap-3 shadow-2xl">
        <span className="text-xs font-bold text-[#888] uppercase tracking-wider mr-1">Host</span>

        {/* Pause / Resume */}
        <button
          onClick={() => act(round.timerPaused ? 'resume' : 'pause')}
          disabled={busy || round.revealed}
          className="px-4 py-2 rounded-full bg-white/10 text-cream text-xs font-semibold hover:bg-white/20 transition-colors disabled:opacity-40"
        >
          {round.timerPaused ? '▶ Resume' : '⏸ Pause'}
        </button>

        {/* Skip clue */}
        <button
          onClick={() => act('skipClue')}
          disabled={busy || allCluesDropped || round.revealed}
          className="px-4 py-2 rounded-full bg-white/10 text-cream text-xs font-semibold hover:bg-white/20 transition-colors disabled:opacity-40"
        >
          Skip →
        </button>

        {/* Timer nudge */}
        <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-2">
          <button onClick={() => act('adjustTimer', { intervalSeconds: intervalSeconds - 1 })} className="text-cream text-xs font-bold w-4 disabled:opacity-40" disabled={intervalSeconds <= 8}>−</button>
          <span className="text-cream text-xs font-semibold w-6 text-center">{intervalSeconds}s</span>
          <button onClick={() => act('adjustTimer', { intervalSeconds: intervalSeconds + 1 })} className="text-cream text-xs font-bold w-4 disabled:opacity-40" disabled={intervalSeconds >= 20}>+</button>
        </div>

        {/* Reveal */}
        {canReveal && (
          <button
            onClick={() => act('reveal')}
            disabled={busy}
            className="px-5 py-2 rounded-full bg-accent text-white text-xs font-bold hover:opacity-85 transition-opacity"
          >
            Reveal ✦
          </button>
        )}

        {/* Next Round */}
        {canNext && (
          <button
            onClick={() => act('nextRound')}
            disabled={busy}
            className="px-5 py-2 rounded-full bg-accent text-white text-xs font-bold hover:opacity-85 transition-opacity"
          >
            Next Round →
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/HostOverlay.tsx
git commit -m "feat: HostOverlay component"
```

---

## Task 10: Quiz screen

**Files:**
- Create: `src/screens/Quiz.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/screens/Quiz.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import { useGame } from '../hooks/useGame'
import { useLocalPlayer } from '../hooks/useLocalPlayer'
import { useRound } from '../hooks/useRound'
import { useCountdown } from '../hooks/useCountdown'
import { ClueFilmstrip } from '../components/ClueFilmstrip'
import { GuessInput } from '../components/GuessInput'
import { PlayerChips } from '../components/PlayerChips'
import { LeaderboardSidebar } from '../components/LeaderboardSidebar'
import { HostOverlay } from '../components/HostOverlay'

export function Quiz() {
  const { code } = useParams<{ code: string }>()
  const { game, loading } = useGame(code)
  const { player, isHost } = useLocalPlayer()
  const navigate = useNavigate()

  const memberId = player?.memberId ?? ''
  const { round, roundIndex, clueUrls, myEligibility, myGuesses } = useRound(game, memberId)

  const intervalSeconds = game?.meta.revealIntervalSeconds ?? 12
  const currentClueIndex = round?.currentClueIndex ?? -1
  const timerPaused = round?.timerPaused ?? false

  // Local countdown — resets on each new clue
  const countdown = useCountdown(intervalSeconds, timerPaused || !round?.votingOpen, currentClueIndex)

  // Host: call advanceClue when countdown hits 0
  const advanceRef = useRef(false)
  useEffect(() => {
    if (!isHost(code ?? '') || countdown > 0 || !round?.votingOpen || advanceRef.current) return
    advanceRef.current = true
    const fn = httpsCallable(functions, 'advanceClue')
    fn({
      gameCode: code,
      hostSecret: player?.hostSecret,
      roundIndex,
      fromClueIndex: currentClueIndex,
    }).finally(() => { advanceRef.current = false })
  }, [countdown])

  // Host: kick off first clue reveal when round starts
  const startedRef = useRef<number>(-1)
  useEffect(() => {
    if (!isHost(code ?? '') || !round || currentClueIndex !== -1 || startedRef.current === roundIndex) return
    startedRef.current = roundIndex
    const fn = httpsCallable(functions, 'advanceClue')
    fn({ gameCode: code, hostSecret: player?.hostSecret, roundIndex, fromClueIndex: -1 })
  }, [roundIndex, currentClueIndex])

  // Redirect when game finishes
  useEffect(() => {
    if (game?.meta.phase === 'finished') navigate(`/results/${code}`)
  }, [game?.meta.phase])

  // Trigger scoring when round is revealed — guard against double-call on re-renders
  const scoredRoundRef = useRef<number>(-1)
  useEffect(() => {
    if (!isHost(code ?? '') || !round?.revealed) return
    if (scoredRoundRef.current === roundIndex) return  // already scored this round
    scoredRoundRef.current = roundIndex
    const fn = httpsCallable(functions, 'scoreRound')
    fn({ gameCode: code, hostSecret: player?.hostSecret, roundIndex })
  }, [round?.revealed, roundIndex])

  if (loading || !game || !round) return <Loading />

  const memberNames = Object.entries(game.members).map(([id, m]) => ({ id, name: m.name }))
  const availablePoints = round.availableClueCount - Math.max(0, currentClueIndex)

  async function handleGuess(answer: string) {
    const fn = httpsCallable(functions, 'submitGuess')
    const result = await fn({ gameCode: code, memberId, roundIndex, answer })
    return result.data as { correct: boolean; isFirstCorrect: boolean }
  }

  if (round.revealed) {
    return <RoundRevealRedirect code={code!} />
  }

  return (
    <div className="min-h-screen bg-cream flex">
      {/* Main quiz area */}
      <div className="flex-1 flex flex-col px-8 py-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <span className="font-lora text-2xl font-bold">who <span className="text-accent">dis</span>?</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#888]">
              Round <span className="font-bold text-[#1a1a1a]">{roundIndex + 1}</span> of {game.meta.memberCount}
            </span>
            <div className="bg-[#1a1a1a] text-cream text-sm font-bold px-4 py-2 rounded-full">
              {(game.scores?.[memberId]?.total ?? 0)} pts
            </div>
          </div>
        </div>

        {/* Mystery label */}
        <div className="mb-6">
          <p className="text-xs font-bold tracking-[2px] uppercase text-muted mb-1">Mystery Person</p>
          <h2 className="font-lora text-5xl font-bold tracking-tight">Who is <span className="bg-[#1a1a1a] text-[#1a1a1a] rounded-md px-1 select-none">————</span>?</h2>
        </div>

        {/* Filmstrip */}
        <div className="mb-4">
          <ClueFilmstrip
            clueUrls={clueUrls}
            availableCount={round.availableClueCount}
            currentIndex={currentClueIndex}
            timerPaused={timerPaused}
            intervalSeconds={intervalSeconds}
          />
        </div>

        {/* Points + countdown */}
        <div className="flex items-center gap-4 mb-6">
          <div className="bg-[#FFF0EB] border border-[#FFD5C8] text-accent font-lora text-3xl font-bold px-5 py-2 rounded-2xl">
            {availablePoints}
            <span className="text-sm font-jakarta font-semibold ml-1 text-[#E8572A]/70">pts</span>
          </div>
          {round.votingOpen && !timerPaused && (
            <div className="text-sm text-muted">
              Next clue in <span className="font-bold text-[#1a1a1a]">{countdown}s</span>
            </div>
          )}
        </div>

        {/* Guess input or clue-giver message */}
        {myEligibility === 'guesser' ? (
          <div className="mb-6">
            <GuessInput
              memberNames={memberNames.filter(m => m.id !== memberId)}
              myGuesses={myGuesses}
              availablePoints={availablePoints}
              votingOpen={round.votingOpen}
              onGuess={handleGuess}
            />
          </div>
        ) : (
          <div className="mb-6 h-14 flex items-center">
            <span className="text-[#888] text-sm font-semibold italic">You're giving clues this round — sit back and watch 👀</span>
          </div>
        )}

        {/* Player chips */}
        <PlayerChips game={game} round={round} currentMemberId={memberId} />
      </div>

      {/* Leaderboard sidebar */}
      <div className="hidden lg:flex flex-col px-6 py-6 border-l border-border">
        <LeaderboardSidebar game={game} currentMemberId={memberId} />
      </div>

      {/* Host overlay */}
      {isHost(code ?? '') && player?.hostSecret && (
        <HostOverlay
          gameCode={code!}
          hostSecret={player.hostSecret}
          round={round}
          roundIndex={roundIndex}
          intervalSeconds={intervalSeconds}
        />
      )}
    </div>
  )
}

function RoundRevealRedirect({ code }: { code: string }) {
  const navigate = useNavigate()
  useEffect(() => { navigate(`/reveal/${code}`) }, [])
  return null
}

function Loading() {
  return <div className="min-h-screen bg-cream flex items-center justify-center text-muted">Loading…</div>
}
```

- [ ] **Step 2: Update `src/App.tsx`**

```tsx
import { Quiz } from './screens/Quiz'
// ...
<Route path="/quiz/:code" element={<Quiz />} />
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/Quiz.tsx src/App.tsx
git commit -m "feat: Quiz screen with real-time clue reveal and host timer control"
```

---

## Task 11: Round Reveal screen

**Files:**
- Create: `src/screens/RoundReveal.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/screens/RoundReveal.tsx`**

```tsx
import { useParams } from 'react-router-dom'
import { useGame } from '../hooks/useGame'
import { useLocalPlayer } from '../hooks/useLocalPlayer'
import { useRound } from '../hooks/useRound'
import { LeaderboardSidebar } from '../components/LeaderboardSidebar'
import { HostOverlay } from '../components/HostOverlay'

export function RoundReveal() {
  const { code } = useParams<{ code: string }>()
  const { game, loading } = useGame(code)
  const { player, isHost } = useLocalPlayer()
  const memberId = player?.memberId ?? ''
  const { round, roundIndex, targetMember, clueUrls } = useRound(game, memberId)

  if (loading || !game || !round || !targetMember) return <Loading />

  const guesses = round.guesses ?? {}
  const scores = game.scores ?? {}

  // Sort guessers: correct first (by timestamp), then wrong
  const guesserResults = Object.entries(guesses)
    .map(([id, attempts]) => {
      const attemptsArr = Object.values(attempts as Record<string, { correct: boolean; clueIndex: number; timestamp: number; answer: string }>)
      const correct = attemptsArr.find(a => a.correct)
      const wrongs = attemptsArr.filter(a => !a.correct)
      const pts = correct ? (round.availableClueCount - correct.clueIndex) : 0
      const penalty = wrongs.reduce((s, _, i) => s + (i + 1), 0)
      return { id, name: game.members[id]?.name ?? id, correct: !!correct, pts, penalty, timestamp: correct?.timestamp ?? Infinity }
    })
    .sort((a, b) => {
      if (a.correct !== b.correct) return a.correct ? -1 : 1
      return a.timestamp - b.timestamp
    })

  return (
    <div className="min-h-screen bg-cream flex">
      <div className="flex-1 px-8 py-10 max-w-3xl">
        {/* Header */}
        <p className="text-xs font-bold tracking-[2px] uppercase text-muted mb-2">Round {roundIndex + 1} reveal</p>

        {/* Revealed person */}
        <div className="flex items-center gap-5 mb-10">
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-border flex-shrink-0 bg-[#F0ECE4] flex items-center justify-center">
            {targetMember.photo.startsWith('http')
              ? <img src={targetMember.photo} alt={targetMember.name} className="w-full h-full object-cover" />
              : <span className="text-4xl">{targetMember.photo}</span>
            }
          </div>
          <div>
            <p className="text-muted text-sm mb-1">The mystery person was…</p>
            <h1 className="font-lora text-5xl font-bold tracking-tight">{targetMember.name}</h1>
          </div>
        </div>

        {/* All clues revealed */}
        <div className="flex gap-3 mb-10">
          {clueUrls.map((url, i) => (
            <div key={i} className="flex-1 aspect-[3/4] rounded-xl overflow-hidden bg-[#F0ECE4]">
              {url && <img src={url} alt={`Clue ${i + 1}`} className="w-full h-full object-cover" />}
            </div>
          ))}
        </div>

        {/* Guesser results */}
        <p className="text-xs font-bold tracking-[1.5px] uppercase text-muted mb-3">Guessers</p>
        <div className="flex flex-col gap-2 mb-8">
          {guesserResults.map(r => (
            <div key={r.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${r.correct ? 'border-[#1A9E5C] bg-[#EDFAF3]' : 'border-border bg-white'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${r.correct ? 'bg-[#1A9E5C] text-white' : 'bg-[#F0ECE4] text-muted'}`}>
                {r.correct ? '✓' : '✗'}
              </span>
              <span className="flex-1 font-semibold text-sm">{r.name}</span>
              {r.correct && <span className="text-[#1A9E5C] font-bold text-sm">+{r.pts} pts</span>}
              {r.penalty > 0 && <span className="text-danger text-xs">−{r.penalty} wrong</span>}
            </div>
          ))}
        </div>

        {/* Clue-giver scores */}
        {(() => {
          const givers = game.members[round.targetMemberId]?.givesFrom ?? []
          const totalCorrect = guesserResults.reduce((s, r) => s + (r.correct ? r.pts : 0), 0)
          const eachGiverPts = totalCorrect / 2
          const roundScores = game.scores ?? {}
          return givers.length > 0 ? (
            <>
              <p className="text-xs font-bold tracking-[1.5px] uppercase text-muted mb-3">Clue-givers</p>
              <div className="flex flex-col gap-2">
                {givers.map(giverId => {
                  const giver = game.members[giverId]
                  if (!giver) return null
                  return (
                    <div key={giverId} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-white">
                      <span className="text-lg">{giver.photo.startsWith('http') ? '👤' : giver.photo}</span>
                      <span className="flex-1 font-semibold text-sm">{giver.name}</span>
                      <span className="text-sm font-bold text-accent">+{eachGiverPts.toFixed(1)} pts</span>
                      <span className="text-xs text-muted">(shared pool)</span>
                    </div>
                  )
                })}
              </div>
            </>
          ) : null
        })()}
      </div>

      {/* Sidebar */}
      <div className="hidden lg:flex flex-col px-6 py-6 border-l border-border">
        <LeaderboardSidebar game={game} currentMemberId={memberId} />
      </div>

      {/* Host next-round control */}
      {isHost(code ?? '') && player?.hostSecret && (
        <HostOverlay
          gameCode={code!}
          hostSecret={player.hostSecret}
          round={round}
          roundIndex={roundIndex}
          intervalSeconds={game.meta.revealIntervalSeconds}
        />
      )}
    </div>
  )
}

function Loading() {
  return <div className="min-h-screen bg-cream flex items-center justify-center text-muted">Loading…</div>
}
```

- [ ] **Step 2: Update `src/App.tsx`**

```tsx
import { RoundReveal } from './screens/RoundReveal'
// ...
<Route path="/reveal/:code" element={<RoundReveal />} />
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/RoundReveal.tsx src/App.tsx
git commit -m "feat: RoundReveal screen"
```

---

## Task 12: Final Leaderboard screen

**Files:**
- Create: `src/screens/FinalLeaderboard.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/screens/FinalLeaderboard.tsx`**

```tsx
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useGame } from '../hooks/useGame'
import { useLocalPlayer } from '../hooks/useLocalPlayer'

type Tab = 'overall' | 'guesser' | 'cluegiver'

export function FinalLeaderboard() {
  const { code } = useParams<{ code: string }>()
  const { game, loading } = useGame(code)
  const { player } = useLocalPlayer()
  const [tab, setTab] = useState<Tab>('overall')

  if (loading || !game) return <Loading />

  const members = Object.entries(game.members)
  const scores = game.scores ?? {}

  function getRanked(tab: Tab) {
    return members
      .map(([id, m]) => ({
        id,
        name: m.name,
        photo: m.photo,
        total: scores[id]?.total ?? 0,
        guessing: scores[id]?.guessing ?? 0,
        clueing: scores[id]?.clueing ?? 0,
        correctGuessCount: scores[id]?.correctGuessCount ?? 0,
      }))
      .sort((a, b) => {
        const aVal = tab === 'guesser' ? a.guessing : tab === 'cluegiver' ? a.clueing : a.total
        const bVal = tab === 'guesser' ? b.guessing : tab === 'cluegiver' ? b.clueing : b.total
        if (bVal !== aVal) return bVal - aVal
        if (b.correctGuessCount !== a.correctGuessCount) return b.correctGuessCount - a.correctGuessCount
        return a.name.localeCompare(b.name)
      })
  }

  const ranked = getRanked(tab)
  const tabs: { key: Tab; label: string }[] = [
    { key: 'overall', label: 'Overall' },
    { key: 'guesser', label: 'Best Guesser' },
    { key: 'cluegiver', label: 'Best Clue-Giver' },
  ]

  return (
    <div className="min-h-screen bg-cream px-6 py-12 max-w-2xl mx-auto">
      <p className="text-xs font-bold tracking-[2px] uppercase text-muted mb-2">Game over</p>
      <h1 className="font-lora text-5xl font-bold tracking-tight mb-10">
        Final <span className="text-accent">standings</span>
      </h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 bg-[#F0ECE4] p-1 rounded-full w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
              tab === t.key ? 'bg-[#1a1a1a] text-cream' : 'text-[#888] hover:text-[#1a1a1a]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Podium (top 3) */}
      {ranked.length >= 3 && (
        <div className="flex items-end justify-center gap-4 mb-10">
          {[ranked[1], ranked[0], ranked[2]].map((m, podiumPos) => {
            const height = podiumPos === 1 ? 'h-28' : 'h-20'
            const place = podiumPos === 1 ? 1 : podiumPos === 0 ? 2 : 3
            const score = tab === 'guesser' ? m.guessing : tab === 'cluegiver' ? m.clueing : m.total
            return (
              <div key={m.id} className="flex flex-col items-center gap-2">
                <span className="text-2xl">{m.photo.startsWith('http') ? '👤' : m.photo}</span>
                <span className="text-sm font-bold">{m.name}</span>
                <span className={`font-lora text-xl font-bold ${score < 0 ? 'text-danger' : 'text-accent'}`}>{score} pts</span>
                <div className={`${height} w-20 rounded-t-xl flex items-center justify-center font-lora text-3xl font-bold ${
                  place === 1 ? 'bg-[#1a1a1a] text-cream' : 'bg-[#E8E0D4] text-[#888]'
                }`}>{place}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Full list */}
      <div className="flex flex-col gap-2">
        {ranked.map((m, i) => {
          const score = tab === 'guesser' ? m.guessing : tab === 'cluegiver' ? m.clueing : m.total
          const isSelf = m.id === player?.memberId
          return (
            <div
              key={m.id}
              className={`flex items-center gap-4 px-5 py-4 rounded-2xl border ${
                isSelf ? 'border-[#1a1a1a] bg-white' : 'border-border bg-white'
              }`}
            >
              <span className="text-sm font-bold text-muted w-6">{i + 1}</span>
              <span className="text-xl">{m.photo.startsWith('http') ? '👤' : m.photo}</span>
              <span className="flex-1 font-semibold">{m.name}</span>
              {tab === 'overall' && (
                <div className="text-right">
                  <div className={`font-lora text-xl font-bold ${score < 0 ? 'text-danger' : ''}`}>{score}</div>
                  <div className="text-xs text-muted">{m.guessing}g + {m.clueing}c</div>
                </div>
              )}
              {tab !== 'overall' && (
                <span className={`font-lora text-xl font-bold ${score < 0 ? 'text-danger' : ''}`}>{score}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Loading() {
  return <div className="min-h-screen bg-cream flex items-center justify-center text-muted">Loading…</div>
}
```

- [ ] **Step 2: Update `src/App.tsx`**

```tsx
import { FinalLeaderboard } from './screens/FinalLeaderboard'
// ...
<Route path="/results/:code" element={<FinalLeaderboard />} />
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/FinalLeaderboard.tsx src/App.tsx
git commit -m "feat: FinalLeaderboard with Overall / Best Guesser / Best Clue-Giver tabs"
```

---

## Task 13: Full deploy + integration smoke test

- [ ] **Step 1: Build and deploy all functions**

```bash
cd functions && npm run build && cd ..
firebase deploy --only functions,database,storage
```

- [ ] **Step 2: Ensure `.superpowers/` is in `.gitignore` before staging**

```bash
grep -q ".superpowers" .gitignore || echo ".superpowers/" >> .gitignore
```

- [ ] **Step 3: Build and push frontend**

```bash
npm run build
git add src/ functions/ .gitignore
git commit -m "feat: complete quiz engine — Plan 2 done"
git push
```

- [ ] **Step 3: Smoke test on live URL** (`https://shravandr.github.io/who-dis/`)

Run through the full game with 2 browser windows:

1. Window A: Create game at `/setup` → 6 members → land on `/monitor`
2. Window B: Join at `/join/:code` → select member → land on `/submit` → upload 6 images
3. Window A: Verify submission count updates → Start quiz
4. Both windows: Verify round starts, clues reveal on timer, countdown visible
5. Window B: Submit correct guess → verify ✓ instant feedback and points
6. Window B: Submit wrong guess in next round → verify ✗ and −1 pt
7. Window A (host): Pause timer → clues stop; Resume → clues continue
8. Window A (host): After last clue → hit Reveal → mystery person shown
9. Window A (host): Hit Next Round → new round starts
10. Complete all rounds → land on `/results` → leaderboard shows

- [ ] **Step 4: Add `.superpowers` to `.gitignore`**

```bash
echo ".superpowers/" >> .gitignore
git add .gitignore
git commit -m "chore: ignore .superpowers brainstorm files"
git push
```

---

## Plan 2 Complete ✓

The game is fully playable at `https://shravandr.github.io/who-dis/`:
- Real-time clue reveal with host-controlled timer
- Multi-attempt guessing with instant feedback and escalating penalties
- Host reveal + next round controls
- Score calculation with uniqueness penalty via OpenAI Vision
- Final leaderboard with sub-rankings
