import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'

if (!admin.apps.length) admin.initializeApp()

const db = admin.database()

/** Fisher-Yates shuffle (in-place) */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export const startQuiz = functions.region('us-central1').https.onCall(
  async (data: { gameCode: string; hostSecret: string; revealIntervalSeconds: number }) => {
    const { gameCode, hostSecret, revealIntervalSeconds } = data

    if (!gameCode || !hostSecret) {
      throw new functions.https.HttpsError('invalid-argument', 'gameCode and hostSecret required')
    }

    const interval = Math.max(8, Math.min(20, revealIntervalSeconds ?? 12))

    // Verify host secret
    const metaSnap = await db.ref(`games/${gameCode}/meta`).once('value')
    if (!metaSnap.exists()) throw new functions.https.HttpsError('not-found', 'Game not found')

    const meta = metaSnap.val()
    if (meta.hostSecret !== hostSecret) {
      throw new functions.https.HttpsError('permission-denied', 'Invalid host secret')
    }
    if (meta.phase !== 'clue-submission') {
      throw new functions.https.HttpsError('failed-precondition', 'Game is not in clue-submission phase')
    }

    // Build round order (shuffled member IDs)
    const membersSnap = await db.ref(`games/${gameCode}/members`).once('value')
    const members = membersSnap.val() as Record<string, { name: string }>
    const memberIds = shuffle(Object.keys(members))

    // Build rounds: compute availableClueCount per member
    const cluesSnap = await db.ref(`games/${gameCode}/clues`).once('value')
    const clues = cluesSnap.val() as Record<string, Record<string, { 0?: string | null; 1?: string | null; 2?: string | null }>> | null

    const rounds: Record<string, unknown> = {}
    memberIds.forEach((targetId, index) => {
      const memberClues = clues?.[targetId] ?? {}
      let availableClueCount = 0
      for (const giverSlots of Object.values(memberClues)) {
        for (const si of [0, 1, 2] as const) {
          if (giverSlots[si]) availableClueCount++
        }
      }
      rounds[String(index)] = {
        targetMemberId: targetId,
        availableClueCount,
        timerPaused: false,
        currentClueIndex: -1,
        votingOpen: false,
        revealed: false,
      }
    })

    // Initialise scores for all members
    const scores: Record<string, unknown> = {}
    for (const id of memberIds) {
      scores[id] = { guessing: 0, clueing: 0, total: 0, correctGuessCount: 0 }
    }

    await db.ref(`games/${gameCode}`).update({
      'meta/phase': 'quiz',
      'meta/roundOrder': memberIds,
      'meta/currentRound': 0,
      'meta/revealIntervalSeconds': interval,
      rounds,
      scores,
    })

    return { success: true }
  }
)
