import { useParams } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { useGame } from '../hooks/useGame'
import { useLocalPlayer } from '../hooks/useLocalPlayer'
import { useRound } from '../hooks/useRound'
import ClueFilmstrip from '../components/ClueFilmstrip'
import GuessInput from '../components/GuessInput'
import PlayerChips from '../components/PlayerChips'
import LeaderboardSidebar from '../components/LeaderboardSidebar'
import HostOverlay from '../components/HostOverlay'
import OrbitalLoader from '../components/OrbitalLoader'
import RoundReveal from './RoundReveal'
import FinalLeaderboard from './FinalLeaderboard'

export default function Quiz() {
  const { code = '' } = useParams<{ code: string }>()
  const { game, loading } = useGame(code)
  const { memberId, hostSecret } = useLocalPlayer()
  const roundState = useRound(game, memberId)

  // Local reveal state — we control when this flips so we can wrap it in startViewTransition
  const round = roundState.round
  const isRevealed = round?.revealed ?? false

  // Track if we've seen this round in its non-revealed state (so we can animate the transition)
  const seenUnrevealed = useRef(false)
  const [showRevealed, setShowRevealed] = useState(isRevealed)
  const lastRoundIndex = useRef(roundState.roundIndex)

  useEffect(() => {
    // Round changed — reset
    if (roundState.roundIndex !== lastRoundIndex.current) {
      lastRoundIndex.current = roundState.roundIndex
      seenUnrevealed.current = !isRevealed
      setShowRevealed(isRevealed)
      return
    }

    // Track that we've seen this round un-revealed
    if (!isRevealed) {
      seenUnrevealed.current = true
      setShowRevealed(false)
      return
    }

    // Round just became revealed
    if (isRevealed && !showRevealed) {
      // Only animate if we saw the filmstrip (not on initial page load where round was already revealed)
      if (!seenUnrevealed.current) {
        setShowRevealed(true)
        return
      }

      const startVT = (document as unknown as Record<string, unknown>).startViewTransition as
        ((cb: () => void) => { finished: Promise<void> }) | undefined

      if (startVT) {
        try {
          startVT(() => {
            flushSync(() => setShowRevealed(true))
          })
        } catch {
          setShowRevealed(true)
        }
      } else {
        setShowRevealed(true)
      }
    }
  }, [isRevealed, roundState.roundIndex, showRevealed])

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <OrbitalLoader size={80} />
      </div>
    )
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="text-[#888]">Game not found</p>
      </div>
    )
  }

  // Game finished
  if (game.meta.phase === 'finished') {
    return <FinalLeaderboard game={game} memberId={memberId} />
  }

  const { roundIndex, targetMember, targetMemberId, clueUrls, myEligibility, myGuesses, isLastRound } = roundState

  // Waiting for quiz to start — no rounds yet
  if (!round || !targetMember || !targetMemberId) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <OrbitalLoader size={64} className="mx-auto mb-6" />
          <h2 className="font-lora text-2xl font-bold mb-2">Waiting for quiz to start...</h2>
        </div>
      </div>
    )
  }

  // Round revealed → show breakdown with view transition
  if (showRevealed) {
    return (
      <>
        <RoundReveal
          game={game}
          round={round}
          roundIndex={roundIndex}
          targetMember={targetMember}
          targetMemberId={targetMemberId}
        />
        {hostSecret && (
          <HostOverlay
            gameCode={code}
            hostSecret={hostSecret}
            round={round}
            roundIndex={roundIndex}
            intervalSeconds={game.meta.revealIntervalSeconds}
            isLastRound={isLastRound}
          />
        )}
      </>
    )
  }

  // Active quiz round
  return (
    <div className="min-h-screen bg-cream">
      <div className="flex gap-6 p-6 max-w-6xl mx-auto">
        {/* Main area */}
        <div className="flex-1 min-w-0">
          {/* Round header */}
          <div className="flex items-center justify-between mb-6">
            <div className="inline-flex items-center gap-2 bg-white border border-[#E8E0D4] rounded-pill px-4 py-1.5">
              <span className="text-xs text-[#888] uppercase tracking-wider font-semibold">Round</span>
              <span className="font-lora text-base font-bold text-accent">{roundIndex + 1}/{game.meta.memberCount}</span>
            </div>
            <h2 className="font-lora text-xl font-bold text-[#1a1a1a]">Who Dis?</h2>
          </div>

          {/* Filmstrip */}
          <div className="mb-6">
            <ClueFilmstrip
              clueUrls={clueUrls}
              availableCount={round.availableClueCount}
              currentIndex={round.currentClueIndex}
              timerPaused={round.timerPaused}
              intervalSeconds={game.meta.revealIntervalSeconds}
            />
          </div>

          {/* Guess area or status */}
          <div className="mb-6">
            {round.currentClueIndex === -1 ? (
              <div className="bg-white border border-[#E8E0D4] rounded-card p-6 text-center">
                <p className="text-[#888]">Waiting for host to start this round...</p>
              </div>
            ) : myEligibility === 'guesser' ? (
              <GuessInput
                gameCode={code}
                memberId={memberId!}
                roundIndex={roundIndex}
                members={game.members}
                myGuesses={myGuesses}
                votingOpen={round.votingOpen}
              />
            ) : myEligibility === 'clue-giver' ? (
              <div className="bg-[#FFF8F5] border border-[#FFD5C8] rounded-card p-4 text-center">
                <p className="text-sm text-accent font-medium">You gave clues for this round</p>
                <p className="text-xs text-[#888] mt-1">Sit back and watch them guess!</p>
              </div>
            ) : null}
          </div>

          {/* Player chips */}
          {round.currentClueIndex >= 0 && (
            <div className="mb-6">
              <p className="text-xs text-[#888] font-semibold uppercase tracking-wider mb-2">Players</p>
              <PlayerChips round={round} members={game.members} targetMemberId={targetMemberId} />
            </div>
          )}

          {/* Mobile leaderboard — visible below lg */}
          <div className="lg:hidden">
            <LeaderboardSidebar
              scores={game.scores ?? {}}
              members={game.members}
              currentMemberId={memberId}
            />
          </div>
        </div>

        {/* Sidebar: Leaderboard — desktop */}
        <div className="w-64 flex-shrink-0 hidden lg:block">
          <LeaderboardSidebar
            scores={game.scores ?? {}}
            members={game.members}
            currentMemberId={memberId}
          />
        </div>
      </div>

      {/* Host controls */}
      {hostSecret && (
        <HostOverlay
          gameCode={code}
          hostSecret={hostSecret}
          round={round}
          roundIndex={roundIndex}
          intervalSeconds={game.meta.revealIntervalSeconds}
          isLastRound={isLastRound}
        />
      )}
    </div>
  )
}
