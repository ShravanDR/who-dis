import { useMemo } from 'react'
import type { GameState, Round, Member, GuessEntry } from '../types'

export interface RoundState {
  round: Round | null
  roundIndex: number
  targetMember: Member | null
  targetMemberId: string | null
  clueUrls: string[]
  myEligibility: 'guesser' | 'clue-giver' | 'target' | 'loading'
  myGuesses: GuessEntry[]
  isLastRound: boolean
}

export function useRound(game: GameState | null, memberId: string | null): RoundState {
  return useMemo(() => {
    if (!game?.meta?.roundOrder || game.meta.currentRound === undefined || !memberId) {
      return {
        round: null, roundIndex: -1, targetMember: null, targetMemberId: null,
        clueUrls: [], myEligibility: 'loading' as const, myGuesses: [], isLastRound: false,
      }
    }

    const roundIndex = game.meta.currentRound
    const targetId = game.meta.roundOrder[roundIndex]
    const round = game.rounds?.[roundIndex] ?? null
    const targetMember = targetId ? game.members[targetId] ?? null : null

    // Build interleaved clue URL array from both givers
    const givers = targetMember?.givesFrom ?? []
    const rawClues: string[] = []
    for (let slot = 0; slot < 3; slot++) {
      for (const giverId of givers) {
        const url = game.clues?.[targetId]?.[giverId]?.[slot as 0 | 1 | 2]
        if (url) rawClues.push(url)
      }
    }

    // Eligibility
    const isTarget = targetId === memberId
    const isClueGiver = (givers as string[]).includes(memberId)
    const myEligibility = isTarget ? 'target' as const
      : isClueGiver ? 'clue-giver' as const
      : 'guesser' as const

    // My guesses this round
    const myGuessMap = round?.guesses?.[memberId] ?? {}
    const myGuesses = Object.values(myGuessMap).sort((a, b) => a.attemptNumber - b.attemptNumber)

    const isLastRound = roundIndex >= game.meta.memberCount - 1

    return {
      round, roundIndex, targetMember, targetMemberId: targetId,
      clueUrls: rawClues, myEligibility, myGuesses, isLastRound,
    }
  }, [game, memberId])
}
