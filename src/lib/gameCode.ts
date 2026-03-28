const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // omit O,0,1,I for readability

export function generateGameCode(length = 6): string {
  return Array.from({ length }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join('')
}
