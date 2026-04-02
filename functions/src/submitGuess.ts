import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'

if (!admin.apps.length) admin.initializeApp()

export const submitGuess = functions.region('us-central1').https.onCall(
  async (data: { gameCode: string; memberId: string; roundIndex: number; answer: string }) => {
    const { gameCode, memberId, roundIndex, answer } = data
    if (answer.trim().length > 100) {
      throw new functions.https.HttpsError('invalid-argument', 'Answer must be 100 characters or fewer')
    }
    const db = admin.database()

    const [metaSnap, roundSnap, membersSnap] = await Promise.all([
      db.ref(`games/${gameCode}/meta`).once('value'),
      db.ref(`games/${gameCode}/rounds/${roundIndex}`).once('value'),
      db.ref(`games/${gameCode}/members`).once('value'),
    ])

    const meta = metaSnap.val()
    const round = roundSnap.val()
    const members = membersSnap.val() as Record<string, { name: string; givesFrom: string[] }>
    if (!round || !meta || !members) throw new functions.https.HttpsError('not-found', 'Game data not found')
    if (meta.phase !== 'quiz') throw new functions.https.HttpsError('failed-precondition', 'Not in quiz phase')
    if (!round.votingOpen) throw new functions.https.HttpsError('failed-precondition', 'Voting is closed')

    // Clue-givers cannot guess
    const targetId = round.targetMemberId
    const target = members[targetId]
    if (target?.givesFrom?.includes(memberId)) {
      throw new functions.https.HttpsError('permission-denied', 'Clue-givers cannot guess')
    }

    // Check existing guesses
    const existingSnap = await db.ref(`games/${gameCode}/rounds/${roundIndex}/guesses/${memberId}`).once('value')
    const existing = existingSnap.val() as Record<string, { correct: boolean }> | null ?? {}
    const attempts = Object.values(existing || {})
    if (attempts.length >= 3) throw new functions.https.HttpsError('failed-precondition', 'Max 3 guesses')
    if (attempts.some(g => g.correct)) throw new functions.https.HttpsError('failed-precondition', 'Already correct')

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
