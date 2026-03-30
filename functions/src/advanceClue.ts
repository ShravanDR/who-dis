import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'

if (!admin.apps.length) admin.initializeApp()

export const advanceClue = functions.region('us-central1').https.onCall(
  async (data: { gameCode: string; hostSecret: string; roundIndex: number; fromClueIndex: number }) => {
    const { gameCode, hostSecret, roundIndex, fromClueIndex } = data
    const db = admin.database()

    const metaSnap = await db.ref(`games/${gameCode}/meta`).once('value')
    const meta = metaSnap.val()
    if (meta?.hostSecret !== hostSecret) throw new functions.https.HttpsError('permission-denied', 'Invalid host secret')
    if (meta?.phase !== 'quiz') throw new functions.https.HttpsError('failed-precondition', 'Not in quiz phase')

    const roundRef = db.ref(`games/${gameCode}/rounds/${roundIndex}`)
    const roundSnap = await roundRef.once('value')
    const round = roundSnap.val()
    if (!round) throw new functions.https.HttpsError('not-found', 'Round not found')
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
