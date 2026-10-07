'use client'

import { useState, useMemo, useEffect } from 'react'
import type { PaymentRecord, BudgetYear, Meeting, FinancialSnapshot } from '@/types'
import { saveSnapshot, loadAllSnapshots } from '@/lib/financialStorage'
import paymentsData from '@/data/payments.json'
import budgetData from '@/data/budget.json'

const payments = paymentsData as PaymentRecord[]
const budgetYears = budgetData as BudgetYear[]

type Tab = 'budget' | 'spending' | 'vendors' | 'legal' | 'reports'

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const CATEGORY_ORDER = ['Staff', 'Collections', 'Building', 'Technology', 'Professional Services', 'Other']
const CATEGORY_COLORS: Record<string, string> = {
  Staff: 'bg-blue-500',
  Collections: 'bg-emerald-500',
  Building: 'bg-amber-500',
  Technology: 'bg-violet-500',
  'Professional Services': 'bg-rose-500',
  Other: 'bg-gray-400',
}
const CATEGORY_TEXT: Record<string, string> = {
  Staff: 'text-blue-700',
  Collections: 'text-emerald-700',
  Building: 'text-amber-700',
  Technology: 'text-violet-700',
  'Professional Services': 'text-rose-700',
  Other: 'text-gray-600',
}

const LEGAL_CATEGORIES = [
  'General Counsel',
  'Labor and Employment',
  'Litigation',
  'Transparency Compliance',
  'Real Estate and Construction',
  'Unclassified',
]

function ExternalLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="ml-1 text-[#1F5239] hover:text-[#163d2c] text-xs"
      title="View source document"
    >
      ↗
    </a>
  )
}

function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-sm text-green-900">
      <p className="font-semibold mb-2">{title}</p>
      <div className="text-green-800 space-y-1">{children}</div>
    </div>
  )
}

// ─── Budget at a Glance ───────────────────────────────────────────────────────

function BudgetTab() {
  const sorted = useMemo(
    () => [...budgetYears].sort((a, b) => b.year - a.year),
    []
  )
  const latest = sorted[0]
  const prior = sorted[1]

  if (!latest) {
    return (
      <EmptyState title="No budget data yet.">
        <p>
          Add an entry to <code className="bg-green-100 px-1 rounded">src/data/budget.json</code> to
          populate this tab. Each entry should match the <code className="bg-green-100 px-1 rounded">BudgetYear</code> schema:
        </p>
        <pre className="mt-2 bg-white border border-green-200 rounded p-3 text-xs overflow-x-auto">{`{
  "year": 2026,
  "totalBudget": 2500000,
  "propertyTaxRevenue": 1800000,
  "population": 25000,
  "lines": [
    { "category": "Staff", "budgeted": 1200000, "actual": 1150000 },
    { "category": "Collections", "budgeted": 300000 }
  ]
}`}</pre>
      </EmptyState>
    )
  }

  const taxPct = ((latest.propertyTaxRevenue / latest.totalBudget) * 100).toFixed(1)
  const costPerResident =
    latest.population ? fmt.format(latest.totalBudget / latest.population) : null
  const yoyChange = prior
    ? ((latest.totalBudget - prior.totalBudget) / prior.totalBudget) * 100
    : null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card label="Total Budget" value={fmt.format(latest.totalBudget)} sub={`FY ${latest.year}`} />
        <Card
          label="Property Tax Revenue"
          value={fmt.format(latest.propertyTaxRevenue)}
          sub={`${taxPct}% of budget`}
        />
        <Card label="Tax Share of Budget" value={`${taxPct}%`} sub="funded by taxpayers" />
        {costPerResident && (
          <Card label="Cost per Resident" value={costPerResident} sub={`pop. ${latest.population!.toLocaleString()}`} />
        )}
        {yoyChange !== null && (
          <Card
            label="YoY Budget Change"
            value={`${yoyChange >= 0 ? '+' : ''}${yoyChange.toFixed(1)}%`}
            sub={`vs FY ${prior!.year}`}
            highlight={yoyChange > 5 ? 'warn' : yoyChange < -5 ? 'good' : 'neutral'}
          />
        )}
      </div>

      {latest.lines.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">FY {latest.year} Budget Lines</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2">Category</th>
                <th className="text-right px-4 py-2">Budgeted</th>
                <th className="text-right px-4 py-2">Actual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {latest.lines.map((line) => (
                <tr key={line.category} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{line.category}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt.format(line.budgeted)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-500">
                    {line.actual != null ? fmt.format(line.actual) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Card({
  label,
  value,
  sub,
  highlight = 'neutral',
}: {
  label: string
  value: string
  sub?: string
  highlight?: 'neutral' | 'warn' | 'good'
}) {
  const valueClass =
    highlight === 'warn'
      ? 'text-amber-700'
      : highlight === 'good'
      ? 'text-emerald-700'
      : 'text-gray-900'
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Where the Money Goes ─────────────────────────────────────────────────────

function SpendingTab() {
  const byYear = useMemo(() => {
    if (payments.length === 0) return {}
    const map: Record<number, Record<string, number>> = {}
    for (const p of payments) {
      const yr = new Date(p.date).getFullYear()
      if (!map[yr]) map[yr] = {}
      const cat = CATEGORY_ORDER.includes(p.category) ? p.category : 'Other'
      map[yr][cat] = (map[yr][cat] ?? 0) + p.amount
    }
    return map
  }, [])

  const years = Object.keys(byYear)
    .map(Number)
    .sort((a, b) => a - b)

  if (years.length === 0) {
    return (
      <EmptyState title="No payment data yet.">
        <p>
          Add entries to <code className="bg-green-100 px-1 rounded">src/data/payments.json</code>.
          Each payment needs at least: <code className="bg-green-100 px-1 rounded">date</code>,{' '}
          <code className="bg-green-100 px-1 rounded">vendor</code>,{' '}
          <code className="bg-green-100 px-1 rounded">amount</code>, and{' '}
          <code className="bg-green-100 px-1 rounded">category</code>.
        </p>
        <p>
          Valid categories:{' '}
          {CATEGORY_ORDER.map((c) => (
            <code key={c} className="bg-green-100 px-1 rounded mx-0.5">
              {c}
            </code>
          ))}
        </p>
      </EmptyState>
    )
  }

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {CATEGORY_ORDER.map((cat) => (
          <div key={cat} className="flex items-center gap-1.5 text-xs">
            <div className={`w-3 h-3 rounded-sm ${CATEGORY_COLORS[cat]}`} />
            <span className={CATEGORY_TEXT[cat]}>{cat}</span>
          </div>
        ))}
      </div>

      {/* Bars per year */}
      <div className="space-y-4">
        {years.map((yr) => {
          const totals = byYear[yr]
          const total = Object.values(totals).reduce((s, v) => s + v, 0)
          return (
            <div key={yr} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
              <div className="flex justify-between items-baseline mb-2">
                <span className="font-semibold text-gray-800">{yr}</span>
                <span className="text-sm text-gray-500 tabular-nums">{fmt.format(total)}</span>
              </div>
              <div className="flex rounded-full overflow-hidden h-5 bg-gray-100 min-w-0">
                {CATEGORY_ORDER.map((cat) => {
                  const val = totals[cat] ?? 0
                  if (val === 0) return null
                  const pct = (val / total) * 100
                  return (
                    <div
                      key={cat}
                      className={`${CATEGORY_COLORS[cat]} h-full`}
                      style={{ width: `${pct}%` }}
                      title={`${cat}: ${fmt.format(val)}`}
                    />
                  )
                })}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {CATEGORY_ORDER.filter((c) => (totals[c] ?? 0) > 0).map((cat) => (
                  <span key={cat} className={`text-xs tabular-nums ${CATEGORY_TEXT[cat]}`}>
                    {cat}: {fmt.format(totals[cat])}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Vendor Tracker ───────────────────────────────────────────────────────────

function VendorsTab() {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'total' | 'recent'>('total')

  const currentYear = new Date().getFullYear()

  const vendorRows = useMemo(() => {
    const map: Record<
      string,
      { total: number; thisYear: number; count: number; recent: string; sourceUrl?: string }
    > = {}
    for (const p of payments) {
      if (!map[p.vendor]) {
        map[p.vendor] = { total: 0, thisYear: 0, count: 0, recent: '', sourceUrl: undefined }
      }
      const row = map[p.vendor]
      row.total += p.amount
      row.count += 1
      if (p.date > row.recent) row.recent = p.date
      if (new Date(p.date).getFullYear() === currentYear) row.thisYear += p.amount
      if (p.sourceUrl && !row.sourceUrl) row.sourceUrl = p.sourceUrl
    }
    return Object.entries(map).map(([vendor, data]) => ({ vendor, ...data }))
  }, [currentYear])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const rows = q ? vendorRows.filter((r) => r.vendor.toLowerCase().includes(q)) : vendorRows
    return [...rows].sort((a, b) => {
      if (sortBy === 'name') return a.vendor.localeCompare(b.vendor)
      if (sortBy === 'recent') return b.recent.localeCompare(a.recent)
      return b.total - a.total
    })
  }, [vendorRows, search, sortBy])

  if (payments.length === 0) {
    return (
      <EmptyState title="No payment data yet.">
        <p>
          Add entries to <code className="bg-green-100 px-1 rounded">src/data/payments.json</code>{' '}
          to see vendors aggregated here.
        </p>
      </EmptyState>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search vendors…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <div className="flex gap-2">
          {(['total', 'name', 'recent'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sortBy === s
                  ? 'bg-[#1F5239] text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {s === 'total' ? 'By Total' : s === 'name' ? 'By Name' : 'By Recent'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2">Vendor</th>
              <th className="text-right px-4 py-2">Payments</th>
              <th className="text-right px-4 py-2">{currentYear} Total</th>
              <th className="text-right px-4 py-2">All-Time Total</th>
              <th className="text-right px-4 py-2">Last Payment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((row) => (
              <tr key={row.vendor} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium">
                  {row.vendor}
                  {row.sourceUrl && <ExternalLink href={row.sourceUrl} />}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-600">{row.count}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {row.thisYear > 0 ? fmt.format(row.thisYear) : '—'}
                </td>
                <td className="px-4 py-2 text-right tabular-nums font-medium">
                  {fmt.format(row.total)}
                </td>
                <td className="px-4 py-2 text-right text-gray-500">{row.recent}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-sm">
                  No vendors match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Legal Spending Tracker ───────────────────────────────────────────────────

function LegalTab() {
  const currentYear = new Date().getFullYear()

  const legalPayments = useMemo(
    () => payments.filter((p) => p.subcategory?.startsWith('Legal:')),
    []
  )

  const { thisYearTotal, lastYearTotal } = useMemo(() => {
    let ty = 0
    let ly = 0
    for (const p of legalPayments) {
      const yr = new Date(p.date).getFullYear()
      if (yr === currentYear) ty += p.amount
      else if (yr === currentYear - 1) ly += p.amount
    }
    return { thisYearTotal: ty, lastYearTotal: ly }
  }, [legalPayments, currentYear])

  if (legalPayments.length === 0) {
    return (
      <EmptyState title="No legal spending data yet.">
        <p>
          Add payment entries with a{' '}
          <code className="bg-green-100 px-1 rounded">subcategory</code> starting with{' '}
          <code className="bg-green-100 px-1 rounded">&quot;Legal:&quot;</code> to populate this tab.
        </p>
        <p>Recognized legal categories:</p>
        <ul className="list-disc list-inside mt-1">
          {LEGAL_CATEGORIES.map((c) => (
            <li key={c}>
              <code className="bg-green-100 px-1 rounded">Legal: {c}</code>
            </li>
          ))}
        </ul>
        <pre className="mt-2 bg-white border border-green-200 rounded p-3 text-xs overflow-x-auto">{`{
  "date": "2026-08-15",
  "vendor": "Smith & Jones LLP",
  "amount": 4500,
  "category": "Professional Services",
  "subcategory": "Legal: Litigation",
  "sourceUrl": "https://example.com/bills-aug2026.pdf"
}`}</pre>
      </EmptyState>
    )
  }

  // Group by firm then by legal category
  const byFirm: Record<
    string,
    { total: number; categories: Record<string, number>; payments: PaymentRecord[] }
  > = {}
  for (const p of legalPayments) {
    if (!byFirm[p.vendor]) byFirm[p.vendor] = { total: 0, categories: {}, payments: [] }
    const legalCat = p.subcategory!.replace(/^Legal:\s*/, '') || 'Unclassified'
    byFirm[p.vendor].total += p.amount
    byFirm[p.vendor].categories[legalCat] =
      (byFirm[p.vendor].categories[legalCat] ?? 0) + p.amount
    byFirm[p.vendor].payments.push(p)
  }

  const firms = Object.entries(byFirm).sort((a, b) => b[1].total - a[1].total)

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card label={`${currentYear} Legal Spending`} value={fmt.format(thisYearTotal)} />
        <Card label={`${currentYear - 1} Legal Spending`} value={fmt.format(lastYearTotal)} />
        <Card label="Total Legal Payments" value={String(legalPayments.length)} sub="line items" />
      </div>

      {/* Per-firm breakdown */}
      {firms.map(([firm, data]) => (
        <div
          key={firm}
          className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-semibold text-gray-800">{firm}</h3>
            <span className="text-sm font-medium tabular-nums text-gray-600">
              {fmt.format(data.total)} total
            </span>
          </div>

          {/* Category subtotals */}
          <div className="px-4 py-2 flex flex-wrap gap-3 border-b border-gray-100 bg-gray-50">
            {Object.entries(data.categories).map(([cat, amt]) => (
              <span key={cat} className="text-xs text-gray-600">
                <span className="font-medium">{cat}:</span> {fmt.format(amt)}
              </span>
            ))}
          </div>

          {/* Individual payments */}
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Legal Category</th>
                <th className="text-right px-4 py-2">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.payments
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">{p.date}</td>
                    <td className="px-4 py-2">
                      {p.subcategory!.replace(/^Legal:\s*/, '') || 'Unclassified'}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">
                      {fmt.format(p.amount)}
                      {p.sourceUrl && <ExternalLink href={p.sourceUrl} />}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

// ─── Monthly Reports ──────────────────────────────────────────────────────────

const NOTABLE_TYPE_STYLES: Record<string, { badge: string; label: string }> = {
  grant:    { badge: 'bg-green-100 text-green-800',  label: 'Grant' },
  advance:  { badge: 'bg-amber-100 text-amber-800',  label: 'Advance' },
  purchase: { badge: 'bg-blue-100 text-blue-800',    label: 'Purchase' },
  donation: { badge: 'bg-purple-100 text-purple-800', label: 'Donation' },
  other:    { badge: 'bg-gray-100 text-gray-600',    label: 'Other' },
}

function ReportsTab() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [snapshots, setSnapshots] = useState<FinancialSnapshot[]>([])
  const [loadingDates, setLoadingDates] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Load meetings and cached snapshots on mount
  useEffect(() => {
    fetch('/api/meetings')
      .then((r) => r.json())
      .then((data: Meeting[]) => {
        const filtered = data.filter((m) => m.year === 2026 && !!m.minutesUrl)
        filtered.sort((a, b) => a.parsedDate.localeCompare(b.parsedDate))
        setMeetings(filtered)
      })
      .catch(() => {/* silently ignore — user will see empty list */})

    // Load cached snapshots from localStorage
    setSnapshots(loadAllSnapshots())
  }, [])

  const snapshotMap = useMemo(() => {
    const m: Record<string, FinancialSnapshot> = {}
    for (const s of snapshots) m[s.meetingDate] = s
    return m
  }, [snapshots])

  async function handleExtract(meeting: Meeting) {
    setLoadingDates((prev) => new Set(prev).add(meeting.parsedDate))
    setErrors((prev) => { const n = { ...prev }; delete n[meeting.parsedDate]; return n })

    try {
      const res = await fetch('/api/finances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minutesUrl: meeting.minutesUrl,
          meetingDate: meeting.parsedDate,
          meetingDateLabel: meeting.date,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrors((prev) => ({ ...prev, [meeting.parsedDate]: data.error ?? 'Unknown error' }))
        return
      }
      saveSnapshot(data as FinancialSnapshot)
      setSnapshots(loadAllSnapshots())
    } catch {
      setErrors((prev) => ({ ...prev, [meeting.parsedDate]: 'Network error. Please try again.' }))
    } finally {
      setLoadingDates((prev) => { const n = new Set(prev); n.delete(meeting.parsedDate); return n })
    }
  }

  // Compute month-over-month YTD change
  const ytdRows = useMemo(() => {
    return snapshots.map((s, i) => {
      const prev = i > 0 ? snapshots[i - 1] : null
      const change =
        s.ytdExpenditures != null && prev?.ytdExpenditures != null
          ? s.ytdExpenditures - prev.ytdExpenditures
          : null
      return { snapshot: s, change }
    })
  }, [snapshots])

  const allNotable = useMemo(() => {
    const items: { date: string; label: string; item: FinancialSnapshot['notableItems'][0] }[] = []
    for (const s of snapshots) {
      for (const item of s.notableItems) {
        items.push({ date: s.meetingDate, label: s.meetingDateLabel, item })
      }
    }
    return items
  }, [snapshots])

  return (
    <div className="space-y-8">
      {/* Meeting List */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">2026 Meetings with Minutes</h3>
        </div>
        {meetings.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">Loading meetings…</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2">Meeting</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {meetings.map((m) => {
                const cached = snapshotMap[m.parsedDate]
                const loading = loadingDates.has(m.parsedDate)
                const err = errors[m.parsedDate]
                return (
                  <tr key={m.parsedDate} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{m.date}</td>
                    <td className="px-4 py-2">
                      {cached ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium">
                          Extracted{cached.fiscalYear ? ` · FY ${cached.fiscalYear}` : ''}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Not extracted</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <button
                          onClick={() => handleExtract(m)}
                          disabled={loading}
                          className="px-3 py-1 rounded-lg text-xs font-medium bg-[#1F5239] text-white hover:bg-[#163d2c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {loading ? 'Extracting…' : cached ? 'Re-extract' : 'Extract'}
                        </button>
                        {err && <p className="text-xs text-red-600 max-w-xs text-right">{err}</p>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {snapshots.length > 0 && (
        <>
          {/* Cash Balance Table */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Cash Balances by Meeting</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-2">Meeting</th>
                    <th className="text-right px-4 py-2">General Fund</th>
                    <th className="text-right px-4 py-2">Building Fund</th>
                    <th className="text-right px-4 py-2">Gift Fund</th>
                    <th className="text-right px-4 py-2">Reserve</th>
                    <th className="text-right px-4 py-2 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {snapshots.map((s) => (
                    <tr key={s.meetingDate} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-700">{s.meetingDateLabel}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {s.cashBalances.generalFund != null ? fmt.format(s.cashBalances.generalFund) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {s.cashBalances.buildingFund != null ? fmt.format(s.cashBalances.buildingFund) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {s.cashBalances.giftFund != null ? fmt.format(s.cashBalances.giftFund) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {s.cashBalances.reserveAccount != null ? fmt.format(s.cashBalances.reserveAccount) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold">
                        {s.cashBalances.total != null ? fmt.format(s.cashBalances.total) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* YTD Expenditure Tracker */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">YTD Expenditure Tracker</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2">Meeting</th>
                  <th className="text-right px-4 py-2">YTD Spent</th>
                  <th className="text-right px-4 py-2">Month-over-Month</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ytdRows.map(({ snapshot: s, change }) => (
                  <tr key={s.meetingDate} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">{s.meetingDateLabel}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">
                      {s.ytdExpenditures != null ? fmt.format(s.ytdExpenditures) : '—'}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {change != null ? (
                        <span className={change > 0 ? 'text-amber-700' : 'text-emerald-700'}>
                          {change > 0 ? '+' : ''}{fmt.format(change)}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Notable Items */}
          {allNotable.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">Notable Financial Items</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {allNotable.map(({ date, label, item }, i) => {
                  const style = NOTABLE_TYPE_STYLES[item.type] ?? NOTABLE_TYPE_STYLES.other
                  return (
                    <div key={i} className="px-4 py-3 flex items-start gap-3 hover:bg-gray-50">
                      <span className={`mt-0.5 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${style.badge}`}>
                        {style.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800">{item.description}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{label}</p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-gray-900 whitespace-nowrap">
                        {fmt.format(item.amount)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'budget', label: 'Budget at a Glance' },
  { id: 'spending', label: 'Where the Money Goes' },
  { id: 'vendors', label: 'Vendor Tracker' },
  { id: 'legal', label: 'Legal Spending' },
  { id: 'reports', label: 'Monthly Reports' },
]

export default function FinancesPage() {
  const [tab, setTab] = useState<Tab>('budget')

  return (
    <div>
      {/* Header */}
      <header className="bg-[#1F5239] text-white py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold">Money &amp; Decisions</h1>
          <p className="mt-2 text-green-100 text-sm max-w-xl">
            A plain-language view of where library tax dollars go — sourced from FOIA&apos;d bills
            lists and annual budget documents.
          </p>
        </div>
      </header>

      {/* Tab bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-[#1F5239] text-[#1F5239]'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {tab === 'budget' && <BudgetTab />}
        {tab === 'spending' && <SpendingTab />}
        {tab === 'vendors' && <VendorsTab />}
        {tab === 'legal' && <LegalTab />}
        {tab === 'reports' && <ReportsTab />}
      </main>
    </div>
  )
}
