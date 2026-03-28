import { useState } from 'react'

interface LocalPlayer {
  gameCode: string | null
  memberId: string | null
  hostSecret: string | null
  setGameCode: (code: string) => void
  setMemberId: (id: string) => void
  setHostSecret: (secret: string) => void
  clearPlayer: () => void
}

export function useLocalPlayer(): LocalPlayer {
  const [gameCode, setGameCodeState] = useState<string | null>(
    () => localStorage.getItem('whoDisGameCode')
  )
  const [memberId, setMemberIdState] = useState<string | null>(
    () => localStorage.getItem('whoDisMemberId')
  )
  const [hostSecret, setHostSecretState] = useState<string | null>(
    () => localStorage.getItem('whoDisHostSecret')
  )

  const setGameCode = (code: string) => {
    localStorage.setItem('whoDisGameCode', code)
    setGameCodeState(code)
  }
  const setMemberId = (id: string) => {
    localStorage.setItem('whoDisMemberId', id)
    setMemberIdState(id)
  }
  const setHostSecret = (secret: string) => {
    localStorage.setItem('whoDisHostSecret', secret)
    setHostSecretState(secret)
  }
  const clearPlayer = () => {
    localStorage.removeItem('whoDisGameCode')
    localStorage.removeItem('whoDisMemberId')
    localStorage.removeItem('whoDisHostSecret')
    setGameCodeState(null)
    setMemberIdState(null)
    setHostSecretState(null)
  }

  return { gameCode, memberId, hostSecret, setGameCode, setMemberId, setHostSecret, clearPlayer }
}
