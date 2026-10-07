import type { FinancialSnapshot } from '@/types'

const KEY_PREFIX = 'finances:'

export function saveSnapshot(snapshot: FinancialSnapshot): void {
  localStorage.setItem(`${KEY_PREFIX}${snapshot.meetingDate}`, JSON.stringify(snapshot))
}

export function loadSnapshot(meetingDate: string): FinancialSnapshot | null {
  const raw = localStorage.getItem(`${KEY_PREFIX}${meetingDate}`)
  if (!raw) return null
  try {
    return JSON.parse(raw) as FinancialSnapshot
  } catch {
    return null
  }
}

export function loadAllSnapshots(): FinancialSnapshot[] {
  const results: FinancialSnapshot[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(KEY_PREFIX)) continue
    const raw = localStorage.getItem(key)
    if (!raw) continue
    try {
      results.push(JSON.parse(raw) as FinancialSnapshot)
    } catch {
      // skip malformed entries
    }
  }
  return results.sort((a, b) => a.meetingDate.localeCompare(b.meetingDate))
}
