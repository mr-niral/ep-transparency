export interface Meeting {
  date: string          // Human-readable, e.g. "January 12, 2026"
  parsedDate: string    // ISO string for sorting, e.g. "2026-01-12"
  year: number
  agendaUrl?: string
  minutesUrl?: string
  videoUrl?: string
  directorLetterUrl?: string
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
