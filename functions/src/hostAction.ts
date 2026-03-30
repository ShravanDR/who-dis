import * as admin from 'firebase-admin'
import { onCall, HttpsError } from 'firebase-functions/v2/https'

if (!admin.apps.length) admin.initializeApp()

type ActionType = 'pause' | 'resume' | 'skipClue' | 'reveal' | 'nextRound' | 'adjustTimer' | 'startRound'

export const hostAction = onCall<{
  gameCode: string; hostSecret: string; action: ActionType; payload?: { intervalSeconds?: number }
}>(
  { region: 'us-central1' },
  async (request) => {
    const { gameCode, hostSecret, action, payload } = request.data
    const db = admin.database()

    const metaSnap = await db.ref(`games/${gameCode}/meta`).once('value')
    const meta = metaSnap.val()
    if (!meta) throw new HttpsError('not-found', 'Game not found')
    if (meta.hostSecret !== hostSecret) throw new HttpsError('permission-denied', 'Invalid host secret')

    const roundIndex = meta.currentRound
    const roundRef = db.ref(`games/${gameCode}/rounds/${roundIndex}`)

    switch (action) {
      case 'startRound': {
        await roundRef.update({ currentClueIndex: 0, votingOpen: true })
        break
      }
      case 'pause':
        await roundRef.update({ timerPaused: true })
        break
      case 'resume':
        await roundRef.update({ timerPaused: false })
        break
      case 'skipClue': {
        const snap = await roundRef.once('value')
        const round = snap.val()
        const nextIndex = (round.currentClueIndex ?? -1) + 1
        const isLast = nextIndex >= round.availableClueCount
        await roundRef.update({ currentClueIndex: nextIndex, votingOpen: !isLast })
        break
      }
      case 'reveal':
        await roundRef.update({ revealed: true, votingOpen: false })
        break
      case 'nextRound': {
        const nextRound = roundIndex + 1
        if (nextRound >= meta.memberCount) {
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
  }
)
