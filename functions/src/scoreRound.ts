import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'
import { areImagesSimilar } from './similarityCheck'

if (!admin.apps.length) admin.initializeApp()

export const scoreRound = functions
  .runWith({ secrets: ['ANTHROPIC_API_KEY'] })
  .region('us-central1')
  .https.onCall(
  async (data: { gameCode: string; hostSecret: string; roundIndex: number }) => {
    const { gameCode, hostSecret, roundIndex } = data
    const db = admin.database()

    const [metaSnap, roundSnap, membersSnap, cluesSnap, scoresSnap] = await Promise.all([
      db.ref(`games/${gameCode}/meta`).once('value'),
      db.ref(`games/${gameCode}/rounds/${roundIndex}`).once('value'),
      db.ref(`games/${gameCode}/members`).once('value'),
      db.ref(`games/${gameCode}/clues`).once('value'),
      db.ref(`games/${gameCode}/scores`).once('value'),
    ])

    const meta = metaSnap.val()
    if (meta?.hostSecret !== hostSecret) throw new functions.https.HttpsError('permission-denied', 'Invalid host secret')

    const round = roundSnap.val()
    const members = membersSnap.val() as Record<string, { givesFrom: string[]; name: string }>
    const clues = cluesSnap.val() as Record<string, Record<string, Record<number, string>>>
    const existingScores = scoresSnap.val() ?? {}

    const targetId = round.targetMemberId
    const givers = members[targetId]?.givesFrom ?? []
    const guesses = (round.guesses ?? {}) as Record<string, Record<string, {
      correct: boolean; clueIndex: number; timestamp: number; attemptNumber: number
    }>>

    // Init scores from existing
    const scores: Record<string, { guessing: number; clueing: number; total: number; correctGuessCount: number }> = {}
    for (const id of Object.keys(members)) {
      scores[id] = existingScores[id] ?? { guessing: 0, clueing: 0, total: 0, correctGuessCount: 0 }
    }

    // ─── Guesser scoring ─────────────────────────────────────
    let firstCorrectTimestamp = Infinity
    let firstCorrectGuesserId = ''
    let totalCorrectGuesserPoints = 0

    for (const [guesserId, attempts] of Object.entries(guesses)) {
      let pts = 0
      let hadCorrect = false
      const sorted = Object.values(attempts).sort((a, b) => a.attemptNumber - b.attemptNumber)
      let wrongCount = 0

      for (const attempt of sorted) {
        if (attempt.correct) {
          const earned = round.availableClueCount - attempt.clueIndex
          pts += earned
          totalCorrectGuesserPoints += earned
          hadCorrect = true
          if (attempt.timestamp < firstCorrectTimestamp) {
            firstCorrectTimestamp = attempt.timestamp
            firstCorrectGuesserId = guesserId
          }
          break
        } else {
          wrongCount++
          pts -= wrongCount  // -1, -2, -3
        }
      }

      scores[guesserId].guessing += pts
      if (hadCorrect) scores[guesserId].correctGuessCount += 1
    }

    // First correct bonus +2
    if (firstCorrectGuesserId) {
      scores[firstCorrectGuesserId].guessing += 2
    }

    // ─── Clue-giver scoring ──────────────────────────────────
    const eachGiverPoints = totalCorrectGuesserPoints / 2

    // ─── Uniqueness penalty ──────────────────────────────────
    const penalties: Record<string, number> = {}

    if (givers.length === 2) {
      const [giverA, giverB] = givers
      const cluesA = clues[targetId]?.[giverA] ?? {}
      const cluesB = clues[targetId]?.[giverB] ?? {}

      const [timeASnap, timeBSnap] = await Promise.all([
        db.ref(`games/${gameCode}/clues/${targetId}/${giverA}/submittedAt`).once('value'),
        db.ref(`games/${gameCode}/clues/${targetId}/${giverB}/submittedAt`).once('value'),
      ])
      const timeA = timeASnap.val() as number ?? 0
      const timeB = timeBSnap.val() as number ?? 0
      const laterGiver = timeA > timeB ? giverA
        : timeB > timeA ? giverB
        : giverA > giverB ? giverA : giverB

      for (let slotA = 0; slotA < 3; slotA++) {
        for (let slotB = 0; slotB < 3; slotB++) {
          const urlA = cluesA[slotA]
          const urlB = cluesB[slotB]
          if (!urlA || !urlB) continue
          try {
            if (await areImagesSimilar(urlA, urlB)) {
              penalties[laterGiver] = (penalties[laterGiver] ?? 0) + 3
            }
          } catch {
            // Skip on API failure
          }
        }
      }
    }

    for (const giverId of givers) {
      const penalty = penalties[giverId] ?? 0
      scores[giverId].clueing += Math.max(-eachGiverPoints, eachGiverPoints - penalty)
    }

    // Recalculate totals
    for (const id of Object.keys(members)) {
      scores[id].total = scores[id].guessing + scores[id].clueing
    }

    await db.ref(`games/${gameCode}/scores`).update(scores)
    return { ok: true, totalCorrectGuesserPoints, penalties }
  }
)
