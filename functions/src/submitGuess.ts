import * as admin from 'firebase-admin'
import { onCall, HttpsError } from 'firebase-functions/v2/https'

if (!admin.apps.length) admin.initializeApp()

export const submitGuess = onCall<{
  gameCode: string; memberId: string; roundIndex: number; answer: string
}>(
  { region: 'us-central1' },
  async (request) => {
    const { gameCode, memberId, roundIndex, answer } = request.data
    const db = admin.database()

    const [metaSnap, roundSnap, membersSnap] = await Promise.all([
      db.ref(`games/${gameCode}/meta`).once('value'),
      db.ref(`games/${gameCode}/rounds/${roundIndex}`).once('value'),
      db.ref(`games/${gameCode}/members`).once('value'),
    ])

    const meta = metaSnap.val()
    const round = roundSnap.val()
    const members = membersSnap.val() as Record<string, { name: string; givesFrom: string[] }>
    if (!round || !meta || !members) throw new HttpsError('not-found', 'Game data not found')
    if (meta.phase !== 'quiz') throw new HttpsError('failed-precondition', 'Not in quiz phase')
    if (!round.votingOpen) throw new HttpsError('failed-precondition', 'Voting is closed')

    // Clue-givers and target cannot guess
    const targetId = round.targetMemberId
    const target = members[targetId]
    if (target?.givesFrom?.includes(memberId)) {
      throw new HttpsError('permission-denied', 'Clue-givers cannot guess')
    }
    if (targetId === memberId) {
      throw new HttpsError('permission-denied', 'Target cannot guess')
    }

    // Check existing guesses
    const existingSnap = await db.ref(`games/${gameCode}/rounds/${roundIndex}/guesses/${memberId}`).once('value')
    const existing = existingSnap.val() as Record<string, { correct: boolean }> | null ?? {}
    const attempts = Object.values(existing || {})
    if (attempts.length >= 3) throw new HttpsError('failed-precondition', 'Max 3 guesses')
    if (attempts.some(g => g.correct)) throw new HttpsError('failed-precondition', 'Already correct')

    const correct = answer.trim().toLowerCase() === members[targetId].name.trim().toLowerCase()
    const attemptNumber = attempts.length + 1

    await db.ref(`games/${gameCode}/rounds/${roundIndex}/guesses/${memberId}/${attemptNumber}`).set({
      answer,
      clueIndex: round.currentClueIndex,
      correct,
      timestamp: Date.now(),
      attemptNumber,
    })

    // Check first correct
    let isFirstCorrect = false
    if (correct) {
      const allSnap = await db.ref(`games/${gameCode}/rounds/${roundIndex}/guesses`).once('value')
      const all = allSnap.val() as Record<string, Record<string, { correct: boolean }>> ?? {}
      const otherCorrect = Object.entries(all).some(
        ([gId, atts]) => gId !== memberId && Object.values(atts).some(a => a.correct)
      )
      isFirstCorrect = !otherCorrect
    }

    return { correct, attemptNumber, isFirstCorrect }
  }
)
