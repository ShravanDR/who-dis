import { useParams } from 'react-router-dom'
import { useGame } from '../hooks/useGame'
import { useLocalPlayer } from '../hooks/useLocalPlayer'
import { useRound } from '../hooks/useRound'
import ClueFilmstrip from '../components/ClueFilmstrip'
import GuessInput from '../components/GuessInput'
import PlayerChips from '../components/PlayerChips'
import LeaderboardSidebar from '../components/LeaderboardSidebar'
import HostOverlay from '../components/HostOverlay'
import RoundReveal from './RoundReveal'
import FinalLeaderboard from './FinalLeaderboard'

export default function Quiz() {
  const { code = '' } = useParams<{ code: string }>()
  const { game, loading } = useGame(code)
  const { memberId, hostSecret } = useLocalPlayer()
  const roundState = useRound(game, memberId)

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
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

  const { round, roundIndex, targetMember, targetMemberId, clueUrls, myEligibility, myGuesses, isLastRound } = roundState

  if (!round || !targetMember || !targetMemberId) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <p className="text-5xl mb-4">&#9203;</p>
          <h2 className="font-lora text-2xl font-bold mb-2">Waiting for quiz to start...</h2>
        </div>
      </div>
    )
  }

  // Round revealed → show breakdown
  if (round.revealed) {
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
            <h2 className="font-lora text-xl font-bold text-[#1a1a1a]">Who is this?</h2>
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
            ) : myEligibility === 'target' ? (
              <div className="bg-[#F3E5F5] border border-[#CE93D8] rounded-card p-4 text-center">
                <p className="text-sm text-[#7B1FA2] font-medium">This round is about you!</p>
                <p className="text-xs text-[#888] mt-1">Let's see who knows you best</p>
              </div>
            ) : null}
          </div>

          {/* Player chips */}
          {round.currentClueIndex >= 0 && (
            <div>
              <p className="text-xs text-[#888] font-semibold uppercase tracking-wider mb-2">Players</p>
              <PlayerChips round={round} members={game.members} targetMemberId={targetMemberId} />
            </div>
          )}
        </div>

        {/* Sidebar: Leaderboard */}
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
