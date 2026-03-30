import * as admin from 'firebase-admin'
import { onCall, HttpsError } from 'firebase-functions/v2/https'

if (!admin.apps.length) admin.initializeApp()

export const advanceClue = onCall<{
  gameCode: string; hostSecret: string; roundIndex: number; fromClueIndex: number
}>(
  { region: 'us-central1' },
  async (request) => {
    const { gameCode, hostSecret, roundIndex, fromClueIndex } = request.data
    const db = admin.database()

    const metaSnap = await db.ref(`games/${gameCode}/meta`).once('value')
    const meta = metaSnap.val()
    if (meta?.hostSecret !== hostSecret) throw new HttpsError('permission-denied', 'Invalid host secret')
    if (meta?.phase !== 'quiz') throw new HttpsError('failed-precondition', 'Not in quiz phase')

    const roundRef = db.ref(`games/${gameCode}/rounds/${roundIndex}`)
    const roundSnap = await roundRef.once('value')
    const round = roundSnap.val()
    if (!round) throw new HttpsError('not-found', 'Round not found')
    if (round.timerPaused) return { ok: false, reason: 'paused' }
    if (round.revealed) return { ok: false, reason: 'already revealed' }
    if (round.currentClueIndex !== fromClueIndex) return { ok: false, reason: 'stale' }

    const nextIndex = fromClueIndex + 1
    const isLastClue = nextIndex >= round.availableClueCount

    await roundRef.update({
      currentClueIndex: nextIndex,
      votingOpen: !isLastClue,
    })

    return { ok: true, nextIndex, isLastClue }
  }
)
