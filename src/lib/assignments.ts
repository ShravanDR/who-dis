/**
 * Circular assignment: shuffle member list, then each member at index N
 * gives clues for members at (N+1) and (N+2) modulo count.
 * Guarantees: no self-assignment, each target has exactly 2 givers,
 * each giver submits clues for exactly 2 targets.
 */
export function buildAssignments(memberIds: string[]): Record<string, string[]> {
  const n = memberIds.length
  if (n < 3) throw new Error('Need at least 3 members for circular assignment')

  // Fisher-Yates shuffle
  const shuffled = [...memberIds]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  // assignedTo[memberId] = [targetId1, targetId2]
  const assignedTo: Record<string, string[]> = {}
  for (let i = 0; i < n; i++) {
    const giver = shuffled[i]
    assignedTo[giver] = [
      shuffled[(i + 1) % n],
      shuffled[(i + 2) % n],
    ]
  }
  return assignedTo
}

/**
 * Derive givesFrom (inverse map): who are the 2 givers for each target?
 */
export function buildGivesFrom(
  assignedTo: Record<string, string[]>
): Record<string, string[]> {
  const givesFrom: Record<string, string[]> = {}
  for (const [giver, targets] of Object.entries(assignedTo)) {
    for (const target of targets) {
      if (!givesFrom[target]) givesFrom[target] = []
      givesFrom[target].push(giver)
    }
  }
  return givesFrom
}
