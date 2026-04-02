import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { functions, storage } from '../firebase'
import { buildAssignments, buildGivesFrom } from '../lib/assignments'
import { useLocalPlayer } from '../hooks/useLocalPlayer'
import type { Member } from '../types'

interface MemberDraft {
  id: string
  name: string
  photo: string        // URL after upload
  photoFile?: File     // local file before upload
  photoPreview?: string // object URL for preview
}

export default function Setup() {
  const navigate = useNavigate()
  const { setGameCode: saveCode, setHostSecret } = useLocalPlayer()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    }
  }, [])

  const savedCode = localStorage.getItem('whoDisGameCode')
  const savedSecret = localStorage.getItem('whoDisHostSecret')
  const [showReturning, setShowReturning] = useState(Boolean(savedCode && savedSecret))

  const [members, setMembers] = useState<MemberDraft[]>([])
  const [name, setName] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<Record<string, string[]> | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gameCode, setGameCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setError(null)
    e.target.value = ''
  }

  function clearPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(null)
    setPhotoPreview(null)
  }

  function addMember(e: React.FormEvent) {
    e.preventDefault()
    const trimName = name.trim()
    if (!trimName) return
    if (members.some(m => m.name.toLowerCase() === trimName.toLowerCase())) {
      setError('Name already in the list')
      return
    }
    const id = `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const newMember: MemberDraft = {
      id,
      name: trimName,
      photo: '',
      photoFile: photoFile ?? undefined,
      photoPreview: photoPreview ?? undefined,
    }
    const updated = [...members, newMember]
    setMembers(updated)
    setName('')
    clearPhoto()
    setError(null)
    if (updated.length >= 3) shuffleAssignments(updated)
    else setAssignments(null)
  }

  function removeMember(id: string) {
    const member = members.find(m => m.id === id)
    if (member?.photoPreview) URL.revokeObjectURL(member.photoPreview)
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

  async function uploadMemberPhotos(gameCode: string): Promise<Record<string, string>> {
    const photoUrls: Record<string, string> = {}
    const toUpload = members.filter(m => m.photoFile)
    for (let i = 0; i < toUpload.length; i++) {
      const m = toUpload[i]
      setUploadProgress(`Uploading photo ${i + 1}/${toUpload.length}…`)
      const path = `members/${gameCode}/${m.id}.jpg`
      const sRef = storageRef(storage, path)
      await uploadBytes(sRef, m.photoFile!, { contentType: m.photoFile!.type })
      photoUrls[m.id] = await getDownloadURL(sRef)
    }
    return photoUrls
  }

  async function createGame() {
    if (!assignments || members.length < 3) return
    setCreating(true)
    setError(null)

    try {
      // Generate a temp code for photo upload path
      const tempCode = `pre_${Date.now()}`
      const photoUrls = await uploadMemberPhotos(tempCode)
      setUploadProgress(null)

      const givesFrom = buildGivesFrom(assignments)
      const membersForDb: Record<string, Member> = {}
      for (const m of members) {
        membersForDb[m.id] = {
          name: m.name,
          photo: photoUrls[m.id] || '',
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
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setCreating(false)
      setUploadProgress(null)
    }
  }

  async function copyCode() {
    if (!gameCode) return
    try {
      await navigator.clipboard.writeText(gameCode)
    } catch {
      // Fallback for contexts where clipboard API is blocked
      const ta = document.createElement('textarea')
      ta.value = gameCode
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2000)
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

  function handleNewGame() {
    localStorage.removeItem('whoDisGameCode')
    localStorage.removeItem('whoDisHostSecret')
    localStorage.removeItem('whoDisMemberId')
    setShowReturning(false)
  }

  // ─── Setup form ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-cream px-6 py-10">
      <div className="max-w-lg mx-auto">
        <button onClick={() => navigate('/')} className="text-sm text-[#888] hover:text-[#1a1a1a] mb-6 block transition-colors">
          ← Back
        </button>

        {/* Returning host prompt */}
        {showReturning && savedCode && (
          <div className="bg-white border border-[#E8E0D4] rounded-card p-5 mb-6 space-y-3">
            <h3 className="font-lora text-sm font-semibold text-[#888]">
              Welcome back
            </h3>
            <p className="text-sm text-[#1a1a1a]">
              You have an active game:{' '}
              <span className="font-lora text-accent font-bold tracking-widest">
                {savedCode}
              </span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => navigate(`/monitor/${savedCode}`)}
                className="flex-1 py-3 bg-accent text-white text-sm font-semibold rounded-pill hover:bg-[#d44d23] transition-colors"
              >
                Go to monitor →
              </button>
              <button
                onClick={handleNewGame}
                className="flex-1 py-3 border border-[#E8E0D4] text-[#1a1a1a] text-sm font-semibold rounded-pill hover:bg-[#F8F5F0] transition-colors"
              >
                New game
              </button>
            </div>
          </div>
        )}

        <h1 className="font-lora text-3xl font-bold text-[#1a1a1a] mb-1">Set up your game</h1>
        <p className="text-[#888] text-sm mb-8">Add your team members with their portrait photos.</p>

        {/* Add member form */}
        <form onSubmit={addMember} className="bg-white border border-[#E8E0D4] rounded-card p-5 mb-6">
          <p className="text-sm font-semibold mb-4">Add a member</p>

          {/* Name input */}
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Name"
            className="w-full h-11 border border-[#E8E0D4] rounded-pill px-4 text-sm outline-none focus:border-accent transition-colors mb-3"
          />

          {/* Photo upload area */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoSelect}
          />

          {photoPreview ? (
            <div className="flex items-center gap-3 bg-[#F8F5F0] rounded-card p-3 mb-4">
              <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                <img src={photoPreview} alt="" className="w-full h-full object-cover" />
              </div>
              <span className="text-sm text-[#1a1a1a] flex-1">Photo selected</span>
              <button
                type="button"
                onClick={clearPhoto}
                className="text-xs text-[#888] hover:text-danger transition-colors"
              >
                Remove
              </button>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() } }}
              aria-label="Upload portrait photo"
              className="flex items-center gap-3 border border-dashed border-[#D4C9B8] rounded-card p-3 mb-4 cursor-pointer hover:border-accent transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-[#F0ECE4] flex items-center justify-center flex-shrink-0">
                <span className="text-lg">📷</span>
              </div>
              <div>
                <span className="text-sm font-medium text-[#1a1a1a] block">Upload portrait photo</span>
                <span className="text-xs text-[#888]">Optional · stylized images work great</span>
              </div>
            </div>
          )}

          {/* Add button */}
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full h-10 border border-[#E8E0D4] text-[#1a1a1a] text-sm font-semibold rounded-pill disabled:opacity-40 hover:bg-[#F8F5F0] transition-colors"
          >
            + Add member
          </button>

          {error && <p className="text-xs text-danger mt-2">{error}</p>}
        </form>

        {/* Member list */}
        {members.length > 0 && (
          <div className="bg-white border border-[#E8E0D4] rounded-card divide-y divide-[#F0ECE4] mb-6">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-10 h-10 rounded-full bg-[#F0ECE4] flex items-center justify-center text-lg flex-shrink-0 overflow-hidden">
                  {m.photoPreview ? (
                    <img src={m.photoPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm text-[#9A8E7E]">{m.name[0]?.toUpperCase()}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium block truncate">{m.name}</span>
                  {assignments && (
                    <span className="text-xs text-[#888] block truncate">
                      → {assignments[m.id]
                        ?.map(tid => members.find(x => x.id === tid)?.name)
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  )}
                </div>
                {m.photoPreview && (
                  <span className="text-xs text-[#A5D6A7]">📷</span>
                )}
                <button
                  onClick={() => removeMember(m.id)}
                  aria-label={`Remove ${m.name}`}
                  className="text-[#9A8E7E] hover:text-danger text-lg leading-none transition-colors"
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
          {creating
            ? (uploadProgress || 'Creating…')
            : 'Create game →'}
        </button>
      </div>
    </div>
  )
}
