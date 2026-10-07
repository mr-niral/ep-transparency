import type { MeetingVotes } from '@/types'

const KEY_PREFIX = 'votes:'

export function saveVotes(data: MeetingVotes): void {
  localStorage.setItem(`${KEY_PREFIX}${data.meetingDate}`, JSON.stringify(data))
}

export function loadVotes(meetingDate: string): MeetingVotes | null {
  const raw = localStorage.getItem(`${KEY_PREFIX}${meetingDate}`)
  if (!raw) return null
  try {
    return JSON.parse(raw) as MeetingVotes
  } catch {
    return null
  }
}

export function loadAllVotes(): MeetingVotes[] {
  const results: MeetingVotes[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(KEY_PREFIX)) continue
    const raw = localStorage.getItem(key)
    if (!raw) continue
    try {
      results.push(JSON.parse(raw) as MeetingVotes)
    } catch {
      // skip malformed entries
    }
  }
  return results
}
