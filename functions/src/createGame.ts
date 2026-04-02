import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'
import { v4 as uuidv4 } from 'uuid'

if (!admin.apps.length) admin.initializeApp()

const db = admin.database()

interface Member {
  name: string
  photo: string
  assignedTo: [string, string]
  givesFrom: [string, string]
}

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateCode(length = 6): string {
  return Array.from({ length }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join('')
}

export const createGame = functions.region('us-central1').https.onCall(
  async (data: { members: Record<string, Member> }) => {
    const { members } = data

    if (!members || Object.keys(members).length < 3) {
      throw new functions.https.HttpsError('invalid-argument', 'Need at least 3 members')
    }
    if (Object.keys(members).length > 20) {
      throw new functions.https.HttpsError('invalid-argument', 'Maximum 20 members')
    }

    // Validate each member has assignedTo and givesFrom (computed client-side)
    for (const [id, m] of Object.entries(members)) {
      if (!m.name?.trim()) throw new functions.https.HttpsError('invalid-argument', `Member ${id} missing name`)
      if (m.name.trim().length > 100) throw new functions.https.HttpsError('invalid-argument', `Member ${id} name exceeds 100 characters`)
      if (!Array.isArray(m.assignedTo) || m.assignedTo.length !== 2) {
        throw new functions.https.HttpsError('invalid-argument', `Member ${id} has invalid assignedTo`)
      }
    }

    // Generate unique game code (retry up to 10 times on collision)
    let gameCode = ''
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = generateCode()
      const existing = await db.ref(`games/${candidate}/meta`).once('value')
      if (!existing.exists()) {
        gameCode = candidate
        break
      }
    }
    if (!gameCode) throw new functions.https.HttpsError('internal', 'Could not generate unique game code')

    const hostSecret = uuidv4()

    await db.ref(`games/${gameCode}`).set({
      meta: {
        phase: 'clue-submission',
        hostSecret,
        createdAt: admin.database.ServerValue.TIMESTAMP,
        memberCount: Object.keys(members).length,
        revealIntervalSeconds: 12,
      },
      members,
    })

    return { gameCode, hostSecret }
  }
)
