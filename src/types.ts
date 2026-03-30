// ─── Game phases ──────────────────────────────────────────────
export type GamePhase = 'setup' | 'clue-submission' | 'quiz' | 'finished'

// ─── Members ──────────────────────────────────────────────────
export interface Member {
  name: string
  photo: string           // URL or emoji
  assignedTo: [string, string]   // memberIds this player submits clues FOR
  givesFrom: [string, string]    // memberIds who submit clues FOR this member
}

// ─── Clues ────────────────────────────────────────────────────
export interface ClueSlots {
  0: string | null
  1: string | null
  2: string | null
  submittedAt: number
}

// ─── Rounds ───────────────────────────────────────────────────
export interface GuessEntry {
  answer: string
  clueIndex: number
  correct: boolean
  timestamp: number
  attemptNumber: number
}

export interface Round {
  targetMemberId: string
  availableClueCount: number
  timerPaused: boolean
  currentClueIndex: number    // -1 = not started; 0–N = revealing
  votingOpen: boolean
  revealed: boolean
  guesses: Record<string, Record<string, GuessEntry>>  // [memberId][attemptNumber]
}

// ─── Scores ───────────────────────────────────────────────────
export interface MemberScore {
  guessing: number
  clueing: number
  total: number
  correctGuessCount: number
}

// ─── Game meta ────────────────────────────────────────────────
export interface GameMeta {
  phase: GamePhase
  hostSecret: string
  createdAt: number
  memberCount: number
  roundOrder?: string[]       // set at quiz start
  currentRound?: number       // index into roundOrder
  revealIntervalSeconds: number
}

// ─── Full game snapshot ───────────────────────────────────────
export interface GameState {
  meta: GameMeta
  members: Record<string, Member>
  clues: Record<string, Record<string, ClueSlots>>  // [targetId][giverId]
  rounds: Record<string, Round>
  scores: Record<string, MemberScore>
}
