import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import { buildAssignments, buildGivesFrom } from '../lib/assignments'
import { useLocalPlayer } from '../hooks/useLocalPlayer'
import type { Member } from '../types'

interface MemberDraft {
  id: string
  name: string
  photo: string
}

const EMOJIS = ['🦁', '🐯', '🦊', '🐺', '🦋', '🐬', '🦄', '🐙', '🦜', '🦩', '🐸', '🦉']

export default function Setup() {
  const navigate = useNavigate()
  const { setGameCode: saveCode, setHostSecret } = useLocalPlayer()

  const [members, setMembers] = useState<MemberDraft[]>([])
  const [name, setName] = useState('')
  const [photo, setPhoto] = useState('')
  const [assignments, setAssignments] = useState<Record<string, string[]> | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gameCode, setGameCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function addMember(e: React.FormEvent) {
    e.preventDefault()
    const trimName = name.trim()
    if (!trimName) return
    if (members.some(m => m.name.toLowerCase() === trimName.toLowerCase())) {
      setError('Name already in the list')
      return
    }
    const id = `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const emoji = photo.trim() || EMOJIS[members.length % EMOJIS.length]
    setMembers(prev => [...prev, { id, name: trimName, photo: emoji }])
    setName('')
    setPhoto('')
    setError(null)
    // Auto-shuffle assignments when list changes
    if (members.length + 1 >= 3) {
      shuffleAssignments([...members, { id, name: trimName, photo: emoji }])
    } else {
      setAssignments(null)
    }
  }

  function removeMember(id: string) {
    const next = members.filter(m => m.id !== id)
    setMembers(next)
    if (next.length >= 3) shuffleAssignments(next)
    else setAssignments(null)
  }

  function shuffleAssignments(list = members) {
    if (list.length < 3) return
    const assignedTo = buildAssignments(list.map(m => m.id))
    setAssignments(assignedTo)
  }

  async function createGame() {
    if (!assignments || members.length < 3) return
    setCreating(true)
    setError(null)

    try {
      const givesFrom = buildGivesFrom(assignments)
      const membersForDb: Record<string, Member> = {}
      for (const m of members) {
        membersForDb[m.id] = {
          name: m.name,
          photo: m.photo,
          assignedTo: assignments[m.id] as [string, string],
          givesFrom: givesFrom[m.id] as [string, string],
        }
      }

      const createGameFn = httpsCallable<
        { members: Record<string, Member> },
        { gameCode: string; hostSecret: string }
      >(functions, 'createGame')

      const result = await createGameFn({ members: membersForDb })
      const { gameCode: code, hostSecret: secret } = result.data

      saveCode(code)
      setHostSecret(secret)
      setGameCode(code)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create game')
    } finally {
      setCreating(false)
    }
  }

  function copyCode() {
    if (gameCode) {
      navigator.clipboard.writeText(gameCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // ─── Post-creation: show code ──────────────────────────────
  if (gameCode) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#FFF0EB] text-3xl mb-4">🎉</div>
            <h2 className="font-lora text-3xl font-bold text-[#1a1a1a] mb-2">Game created!</h2>
            <p className="text-[#888] text-sm">Share this code with your team</p>
          </div>

          <div className="bg-white border border-[#E8E0D4] rounded-card p-6 mb-4">
            <div className="font-lora text-5xl font-bold tracking-widest text-accent mb-4">{gameCode}</div>
            <button
              onClick={copyCode}
              className="w-full py-3 border border-[#E8E0D4] rounded-pill text-sm font-semibold hover:bg-[#F8F5F0] transition-colors"
            >
              {copied ? '✓ Copied!' : 'Copy code'}
            </button>
          </div>

          <button
            onClick={() => navigate(`/monitor/${gameCode}`)}
            className="w-full py-4 bg-accent text-white font-semibold rounded-pill hover:bg-[#d44d23] transition-colors"
          >
            Go to submission monitor →
          </button>
        </div>
      </div>
    )
  }

  // ─── Setup form ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-cream px-6 py-10">
      <div className="max-w-lg mx-auto">
        <button onClick={() => navigate('/')} className="text-sm text-[#888] hover:text-[#1a1a1a] mb-6 block transition-colors">
          ← Back
        </button>
        <h1 className="font-lora text-3xl font-bold text-[#1a1a1a] mb-1">Set up your game</h1>
        <p className="text-[#888] text-sm mb-8">Add 6–20 team members. Assignments are generated automatically.</p>

        {/* Add member form */}
        <form onSubmit={addMember} className="bg-white border border-[#E8E0D4] rounded-card p-5 mb-6">
          <p className="text-sm font-semibold mb-3">Add a member</p>
          <div className="flex gap-2 mb-2">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Name"
              className="flex-1 h-10 border border-[#E8E0D4] rounded-pill px-4 text-sm outline-none focus:border-accent transition-colors"
            />
            <input
              value={photo}
              onChange={e => setPhoto(e.target.value)}
              placeholder="Photo URL or emoji"
              className="w-40 h-10 border border-[#E8E0D4] rounded-pill px-4 text-sm outline-none focus:border-accent transition-colors"
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="h-10 px-5 bg-accent text-white text-sm font-semibold rounded-pill disabled:opacity-40 hover:bg-[#d44d23] transition-colors"
            >
              Add
            </button>
          </div>
          {error && <p className="text-xs text-danger mt-1">{error}</p>}
        </form>

        {/* Member list */}
        {members.length > 0 && (
          <div className="bg-white border border-[#E8E0D4] rounded-card divide-y divide-[#F0ECE4] mb-6">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-9 h-9 rounded-full bg-[#F0ECE4] flex items-center justify-center text-lg flex-shrink-0 overflow-hidden">
                  {m.photo.startsWith('http') ? (
                    <img src={m.photo} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{m.photo}</span>
                  )}
                </div>
                <span className="flex-1 text-sm font-medium">{m.name}</span>
                {assignments && (
                  <span className="text-xs text-[#888]">
                    Gives clues for:{' '}
                    {assignments[m.id]
                      ?.map(tid => members.find(x => x.id === tid)?.name)
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                )}
                <button
                  onClick={() => removeMember(m.id)}
                  className="text-[#C4B9A8] hover:text-danger text-lg leading-none transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Count + shuffle */}
        {members.length >= 3 && (
          <div className="flex items-center justify-between mb-6">
            <span className="text-sm text-[#888]">{members.length} members · {members.length} rounds</span>
            <button
              onClick={() => shuffleAssignments()}
              className="text-sm text-accent font-semibold hover:underline"
            >
              Re-shuffle assignments
            </button>
          </div>
        )}

        {members.length > 0 && members.length < 3 && (
          <p className="text-sm text-[#888] mb-6">Add at least {3 - members.length} more member{3 - members.length !== 1 ? 's' : ''} to generate assignments.</p>
        )}

        {/* Create button */}
        <button
          onClick={createGame}
          disabled={!assignments || members.length < 3 || creating}
          className="w-full py-4 bg-accent text-white font-semibold rounded-pill disabled:opacity-40 hover:bg-[#d44d23] transition-colors"
        >
          {creating ? 'Creating…' : 'Create game →'}
        </button>
      </div>
    </div>
  )
}
