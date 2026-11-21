export interface Meeting {
  date: string          // Human-readable, e.g. "January 12, 2026"
  parsedDate: string    // ISO string for sorting, e.g. "2026-01-12"
  year: number
  agendaUrl?: string
  minutesUrl?: string
  videoUrl?: string
  directorLetterUrl?: string
  portalUrl?: string    // Non-PDF documents portal (e.g. Diligent Community)
  meetingType?: string  // e.g. "Regular Meeting", "Special Meeting"
}

export interface Ballot {
  [trusteeName: string]: 'yes' | 'no' | 'abstain' | 'absent'
}

export interface VoteRecord {
  motion: string
  mover: string | null
  seconder: string | null
  result: 'passed' | 'failed' | 'tabled' | 'unknown'
  ballots: Ballot
}

export interface MeetingVotes {
  meetingDate: string       // ISO "2026-01-12" — used as localStorage key
  meetingDateLabel: string  // "January 12, 2026"
  votes: VoteRecord[]
}

export interface PaymentRecord {
  date: string          // ISO "2026-08-15"
  vendor: string        // exact, consistent spelling
  amount: number        // dollars
  category: string      // "Staff" | "Collections" | "Building" | "Technology" | "Professional Services" | "Other"
  subcategory?: string  // "Legal: Labor and Employment" etc.
  fund?: string         // "General" | "Building" | "IMRF"
  description?: string  // as written on the bills list
  approvedAt?: string   // ISO meeting date "2026-09-14"
  sourceUrl?: string    // link to bills list PDF
  notes?: string
}

export interface BudgetYear {
  year: number
  totalBudget: number
  propertyTaxRevenue: number
  population?: number
  lines: { category: string; budgeted: number; actual?: number }[]
}

// ── Trustee feature ──────────────────────────────────────────────────────────

export type TrusteeRole = 'President' | 'Vice President' | 'Secretary' | 'Treasurer' | 'Trustee'

export interface TrusteeRecord {
  id: string            // slug, e.g. "balundis"
  displayName: string   // last name as shown, e.g. "Balundis"
  nameAliases: string[] // all raw spellings seen in minutes
  role: TrusteeRole     // from most recent mention
  firstSeenDate: string // ISO "2024-01-08"
  lastSeenDate: string  // ISO date of last meeting where they appeared
  isCurrent: boolean
}

export interface BoardRoster {
  village: string
  board: string
  trustees: TrusteeRecord[]
  lastUpdated: string   // ISO timestamp
}

export type MotionVote = 'yes' | 'no' | 'abstain' | 'absent'
export type VoteType = 'roll_call' | 'voice'
export type ExtractionStatus = 'ok' | 'not_available'

export interface MotionRecord {
  order: number
  description: string
  outcome: 'passed' | 'failed' | 'tabled' | 'unknown'
  voteType: VoteType
  isConsentAgenda: boolean
  mover: string | null    // trustee ID or null
  seconder: string | null // trustee ID or null
  votes: { [trusteeId: string]: MotionVote }
}

export interface MeetingExtraction {
  meetingDate: string        // ISO "2026-01-12"
  meetingDateLabel: string   // "January 12, 2026"
  status: ExtractionStatus
  reason?: string
  extractedAt: string        // ISO timestamp
  hiddenByAdmin: boolean
  rollCall: {
    present: string[]    // trustee IDs
    remote: string[]
    absent: string[]
  }
  motions: MotionRecord[]
}

// ─────────────────────────────────────────────────────────────────────────────

export interface FinancialSnapshot {
  meetingDate: string
  meetingDateLabel: string
  cashBalances: {
    generalFund: number | null
    buildingFund: number | null
    giftFund: number | null
    reserveAccount: number | null
    total: number | null
  }
  ytdExpenditures: number | null
  fiscalYear: string | null   // "2026-27"
  notableItems: {
    amount: number
    description: string
    type: 'grant' | 'purchase' | 'advance' | 'donation' | 'other'
  }[]
}
