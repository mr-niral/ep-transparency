import type { TrusteeRecord, TrusteeRole, MeetingExtraction } from '@/types'

// ── Name normalization ────────────────────────────────────────────────────────

// Order matters: longer phrases first so "Vice President" beats "President"
const TITLE_PREFIXES = [
  'Vice President',
  'President',
  'Secretary',
  'Treasurer',
  'Trustee',
  'Mr.',
  'Ms.',
  'Mrs.',
  'Dr.',
]

export function stripTitles(raw: string): string {
  let s = raw.trim()
  for (const title of TITLE_PREFIXES) {
    if (
      s.toLowerCase().startsWith(title.toLowerCase() + ' ') ||
      s.toLowerCase() === title.toLowerCase()
    ) {
      s = s.slice(title.length).trim()
    }
  }
  return s.trim()
}

export function extractRole(raw: string): TrusteeRole {
  const s = raw.trim().toLowerCase()
  if (s.startsWith('vice president ') || s === 'vice president') return 'Vice President'
  if (s.startsWith('president ') || s === 'president') return 'President'
  if (s.startsWith('secretary ') || s === 'secretary') return 'Secretary'
  if (s.startsWith('treasurer ') || s === 'treasurer') return 'Treasurer'
  return 'Trustee'
}

function getLastName(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts[parts.length - 1].toLowerCase()
}

function getFirstInitial(name: string): string | null {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2 && parts[0].length > 0) return parts[0][0].toUpperCase()
  return null
}

function makeId(name: string): string {
  return getLastName(stripTitles(name)).replace(/[^a-z0-9]/g, '')
}

// ── Matching ──────────────────────────────────────────────────────────────────

export interface MatchResult {
  id: string
  isNew: boolean
  wasMerge: boolean // true if an alias was added to an existing trustee
}

/**
 * Match a raw name from the minutes to the roster.
 * Mutates `roster` to add new trustees or new aliases.
 */
export function matchName(
  rawName: string,
  roster: TrusteeRecord[],
  meetingDate: string,
): MatchResult {
  const stripped = stripTitles(rawName)
  const lname = getLastName(stripped)
  const fi = getFirstInitial(stripped)

  // 1. Exact alias match (case-insensitive)
  const exact = roster.find((t) =>
    t.nameAliases.some((a) => a.toLowerCase() === rawName.toLowerCase()),
  )
  if (exact) return { id: exact.id, isNew: false, wasMerge: false }

  // 2. Last-name match across all existing aliases
  const lastNameMatches = roster.filter(
    (t) =>
      getLastName(stripTitles(t.displayName)) === lname ||
      t.nameAliases.some((a) => getLastName(stripTitles(a)) === lname),
  )

  let matched: TrusteeRecord | null = null

  if (lastNameMatches.length === 1) {
    matched = lastNameMatches[0]
  } else if (lastNameMatches.length > 1 && fi) {
    // Disambiguate by first initial
    matched =
      lastNameMatches.find((t) => {
        const tFi = getFirstInitial(stripTitles(t.displayName))
        return tFi === fi
      }) ?? null
  }

  if (matched) {
    const wasMerge = !matched.nameAliases.some(
      (a) => a.toLowerCase() === rawName.toLowerCase(),
    )
    if (wasMerge) matched.nameAliases.push(rawName)
    return { id: matched.id, isNew: false, wasMerge }
  }

  // 3. New trustee
  let id = makeId(rawName)
  let suffix = 2
  while (roster.find((t) => t.id === id)) id = `${makeId(rawName)}-${suffix++}`

  const role = extractRole(rawName)
  // Use the last word of the stripped name as the display name
  const displayName = stripped.split(/\s+/).pop() ?? stripped

  const newTrustee: TrusteeRecord = {
    id,
    displayName,
    nameAliases: [rawName],
    role,
    firstSeenDate: meetingDate,
    lastSeenDate: meetingDate,
    isCurrent: true,
  }
  roster.push(newTrustee)
  return { id, isNew: true, wasMerge: false }
}

// ── Current-trustee logic ─────────────────────────────────────────────────────

/**
 * Update isCurrent on every trustee.
 * Current = appeared in at least one of the two most recent 'ok' extractions.
 */
export function updateCurrentTrustees(
  roster: TrusteeRecord[],
  extractions: Pick<MeetingExtraction, 'meetingDate' | 'status' | 'rollCall'>[],
): void {
  const okExtractions = [...extractions]
    .filter((e) => e.status === 'ok')
    .sort((a, b) => a.meetingDate.localeCompare(b.meetingDate))

  if (okExtractions.length === 0) return

  const lastTwo = okExtractions.slice(-2)
  const seenRecently = new Set<string>()
  for (const e of lastTwo) {
    for (const id of [
      ...e.rollCall.present,
      ...e.rollCall.remote,
      ...e.rollCall.absent,
    ]) {
      seenRecently.add(id)
    }
  }

  for (const trustee of roster) {
    trustee.isCurrent = seenRecently.has(trustee.id)
  }
}

// ── Sort order ────────────────────────────────────────────────────────────────

export const ROLE_ORDER: Record<TrusteeRole, number> = {
  President: 0,
  'Vice President': 1,
  Secretary: 2,
  Treasurer: 3,
  Trustee: 4,
}

export function sortTrustees(trustees: TrusteeRecord[]): TrusteeRecord[] {
  return [...trustees].sort((a, b) => {
    const ro = ROLE_ORDER[a.role] - ROLE_ORDER[b.role]
    if (ro !== 0) return ro
    return a.displayName.localeCompare(b.displayName)
  })
}
