'use client'

import { use, useEffect, useState, useMemo, Suspense, type CSSProperties } from 'react'
import Link from 'next/link'
import { villages } from '@/data/villages'
import type { BoardRoster, MeetingExtraction, TrusteeRecord, MotionVote } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatShortDate(parsedDate: string): string {
  const d = new Date(parsedDate + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function voteChipStyle(vote: MotionVote): string {
  if (vote === 'yes') return 'background: #E3EEE7; color: #1E4D36;'
  if (vote === 'no') return 'background: #F6E7DA; color: #8A4A12;'
  if (vote === 'abstain') return 'background: #ECEDEA; color: #46504A;'
  return 'border: 1.5px dashed #A9B1AB; color: #59625C;'
}

function voteLabel(vote: MotionVote): string {
  if (vote === 'yes') return 'Yes'
  if (vote === 'no') return 'No'
  if (vote === 'abstain') return 'Abstained'
  return 'Absent'
}

function isSplitVote(votes: Record<string, MotionVote>): boolean {
  const vals = Object.values(votes)
  if (vals.length === 0) return false
  const first = vals[0]
  return vals.some((v) => v !== first)
}

function outcomeLabel(outcome: string, votes: Record<string, MotionVote>): string {
  const yes = Object.values(votes).filter((v) => v === 'yes').length
  const no = Object.values(votes).filter((v) => v === 'no').length
  const abstain = Object.values(votes).filter((v) => v === 'abstain').length
  const absent = Object.values(votes).filter((v) => v === 'absent').length
  const cap = outcome === 'passed' ? 'Passed' : outcome === 'failed' ? 'Failed' : outcome === 'tabled' ? 'Tabled' : outcome
  const parts = [
    yes > 0 && `${yes} yes`,
    no > 0 && `${no} no`,
    abstain > 0 && `${abstain} abstained`,
    absent > 0 && `${absent} absent`,
  ].filter(Boolean)
  return parts.length > 0 ? `${cap} · ${parts.join(', ')}` : cap
}

// ── VoteRow ───────────────────────────────────────────────────────────────────

interface VoteEntry {
  date: string
  motion: string
  outcome: string
  votes: Record<string, MotionVote>
  trusteevote: MotionVote
  boardSlug: string
  slug: string
}

function VoteRow({ entry }: { entry: VoteEntry }) {
  return (
    <li
      className="flex flex-wrap items-start gap-y-2.5 py-[18px] border-b border-rule"
      style={{ columnGap: '24px' }}
    >
      <Link
        href={`/village/${entry.slug}/${entry.boardSlug}/${entry.date}?source=minutes`}
        className="font-mono text-[14px] no-underline"
        style={{ width: '96px', flexShrink: 0, paddingTop: '2px' }}
      >
        {formatShortDate(entry.date)}
      </Link>
      <div className="flex-[1_1_300px] min-w-0 flex flex-col gap-1">
        <span className="text-[16px] font-semibold leading-[1.45]">{entry.motion}</span>
        <span className="text-[14px] text-muted">{outcomeLabel(entry.outcome, entry.votes)}</span>
      </div>
      <span
        className="font-semibold text-[14px] rounded text-center"
        style={{
          ...parseCss(
            'flex: none; min-width: 76px; padding: 6px 12px; border-radius: 4px; font-size: 14px; font-weight: 600; box-sizing: border-box; ' +
              voteChipStyle(entry.trusteevote)
          ),
        }}
      >
        {voteLabel(entry.trusteevote)}
      </span>
    </li>
  )
}

function parseCss(css: string): CSSProperties {
  const result: Record<string, string> = {}
  for (const part of css.split(';')) {
    const idx = part.indexOf(':')
    if (idx === -1) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (k && v) result[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v
  }
  return result as React.CSSProperties
}

// ── ProfileInner ──────────────────────────────────────────────────────────────

function ProfileInner({
  params,
}: {
  params: Promise<{ slug: string; board: string; trusteeId: string }>
}) {
  const { slug, board, trusteeId } = use(params)
  const village = villages.find((v) => v.slug === slug)

  const boardType = board === 'village-board' ? 'village' : board === 'school-board' ? 'school' : 'library'
  const boardLabel =
    boardType === 'library' ? 'Library Board' : boardType === 'village' ? 'Village Board' : 'School Board'

  const [data, setData] = useState<{ roster: BoardRoster | null; extractions: MeetingExtraction[] }>({
    roster: null,
    extractions: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!village) return
    setLoading(true)
    fetch(`/api/trustees/all?village=${slug}&board=${board}`)
      .then((r) => (r.ok ? r.json() : { roster: null, extractions: [] }))
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [slug, board, village])

  const trustee: TrusteeRecord | undefined = data.roster?.trustees.find((t) => t.id === trusteeId)

  // All roll-call votes involving this trustee, newest first (2024+ only)
  const allVotes = useMemo<VoteEntry[]>(() => {
    const entries: VoteEntry[] = []
    for (const extraction of [...data.extractions].reverse()) {
      if (extraction.status !== 'ok') continue
      if (extraction.meetingDate < '2024-01-01') continue
      for (const motion of extraction.motions) {
        if (motion.voteType !== 'roll_call') continue
        if (!(trusteeId in motion.votes)) continue
        entries.push({
          date: extraction.meetingDate,
          motion: motion.description,
          outcome: motion.outcome,
          votes: motion.votes,
          trusteevote: motion.votes[trusteeId],
          boardSlug: board,
          slug,
        })
      }
    }
    return entries
  }, [data.extractions, trusteeId, board, slug])

  // Attendance by year (2024+ only)
  const attendanceByYear = useMemo(() => {
    if (!trustee) return []
    const map = new Map<number, { attended: number; eligible: number }>()
    for (const extraction of data.extractions.filter((e) => e.meetingDate >= '2024-01-01')) {
      if (extraction.status !== 'ok') continue
      if (trustee.firstSeenDate > extraction.meetingDate) continue
      const year = parseInt(extraction.meetingDate.slice(0, 4))
      if (!map.has(year)) map.set(year, { attended: 0, eligible: 0 })
      const entry = map.get(year)!
      entry.eligible++
      if (
        extraction.rollCall.present.includes(trusteeId) ||
        extraction.rollCall.remote.includes(trusteeId)
      ) {
        entry.attended++
      }
    }
    return [...map.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([year, { attended, eligible }]) => ({ year, attended, eligible }))
  }, [data.extractions, trustee, trusteeId])

  // This-year stats
  const currentYear = new Date().getFullYear()
  const thisYearStats = attendanceByYear.find((y) => y.year === currentYear) ?? { attended: 0, eligible: 0 }
  const thisYearVotesCast = useMemo(
    () => allVotes.filter((v) => v.date.startsWith(String(currentYear)) && v.trusteevote !== 'absent').length,
    [allVotes, currentYear]
  )
  const thisYearVotedNo = useMemo(
    () => allVotes.filter((v) => v.date.startsWith(String(currentYear)) && v.trusteevote === 'no').length,
    [allVotes, currentYear]
  )

  // Vote filter
  type VoteFilter = 'all' | 'no' | 'abstain' | 'absent' | 'split'
  const [filter, setFilter] = useState<VoteFilter>('all')
  const PAGE_SIZE = 20
  const [page, setPage] = useState(1)

  const filteredVotes = useMemo(() => {
    return allVotes.filter((v) => {
      if (filter === 'no') return v.trusteevote === 'no'
      if (filter === 'abstain') return v.trusteevote === 'abstain'
      if (filter === 'absent') return v.trusteevote === 'absent'
      if (filter === 'split') return isSplitVote(v.votes)
      return true
    })
  }, [allVotes, filter])

  const visibleVotes = filteredVotes.slice(0, page * PAGE_SIZE)
  const hasMore = visibleVotes.length < filteredVotes.length

  if (!village) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-2xl font-bold text-ink mb-2">Municipality not found</h1>
          <Link href="/" className="font-medium">← Back to home</Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="max-w-[1120px] mx-auto px-6 pt-10">
          <div className="animate-pulse flex flex-col gap-4">
            <div className="h-3 w-64 bg-rule-soft rounded" />
            <div className="h-14 w-72 bg-rule rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (!trustee) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-xl font-bold text-ink mb-2">Trustee not found</h1>
          <Link href={`/village/${slug}?${boardType !== 'library' ? `board=${boardType}&` : ''}section=trustees`} className="font-medium">
            ← Back to trustees
          </Link>
        </div>
      </div>
    )
  }

  const trusteesHref =
    boardType === 'village'
      ? `/village/${slug}?board=village&section=trustees`
      : boardType === 'school'
      ? `/village/${slug}?board=school&section=trustees`
      : `/village/${slug}?section=trustees`

  const boardHref =
    boardType === 'village'
      ? `/village/${slug}?board=village`
      : boardType === 'school'
      ? `/village/${slug}?board=school`
      : `/village/${slug}`

  const filters: { key: VoteFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'no', label: 'Voted no' },
    { key: 'abstain', label: 'Abstained' },
    { key: 'absent', label: 'Absent' },
    { key: 'split', label: 'Split votes only' },
  ]

  const maxEligible = Math.max(...attendanceByYear.map((y) => y.eligible), 1)

  return (
    <div className="min-h-screen">
      {/* Breadcrumb */}
      <div className="max-w-[1120px] mx-auto px-6 pt-10">
        <nav aria-label="Breadcrumb" className="text-[14px] text-muted flex gap-2 flex-wrap">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span>{village.name}, {village.state}</span>
          <span aria-hidden="true">/</span>
          <Link href={boardHref}>{boardLabel}</Link>
          <span aria-hidden="true">/</span>
          <Link href={trusteesHref}>Trustees</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{trustee.displayName}</span>
        </nav>
      </div>

      {/* Header */}
      <section style={{ borderBottom: '3px double #15201B' }}>
        <div
          className="max-w-[1120px] mx-auto px-6 pt-7 pb-9 flex flex-wrap gap-8 items-end justify-between"
        >
          <div className="flex-[999_1_460px] min-w-0 flex flex-col gap-2.5">
            <p className="m-0 font-mono text-[13px] tracking-[0.08em] uppercase text-accent">
              {trustee.role} · {boardLabel}
            </p>
            <h1
              className="m-0 font-display font-medium leading-[1.04] tracking-[-0.02em]"
              style={{ fontSize: 'clamp(40px, 5vw, 60px)' }}
            >
              {trustee.displayName}
            </h1>
          </div>

          <dl className="flex-[1_1_360px] m-0 flex flex-wrap gap-8">
            <div className="flex flex-col gap-0.5">
              <dt className="text-[13px] text-muted">Attendance, {currentYear}</dt>
              <dd className="m-0 font-display font-semibold text-[30px]">{thisYearStats.attended}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-[13px] text-muted">Votes cast, {currentYear}</dt>
              <dd className="m-0 font-display font-semibold text-[30px]">{thisYearVotesCast}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-[13px] text-muted">Voted no</dt>
              <dd className="m-0 font-display font-semibold text-[30px]">{thisYearVotedNo}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Body */}
      <div className="max-w-[1120px] mx-auto px-6 pt-10 pb-20 flex flex-wrap gap-14 items-start">

        {/* Attendance by year */}
        <section
          aria-labelledby="att-h"
          className="flex-[1_1_280px] min-w-0 flex flex-col gap-4"
          style={{ maxWidth: '320px' }}
        >
          <h2 id="att-h" className="m-0 font-display font-semibold text-[26px]">
            Attendance by year
          </h2>
          {attendanceByYear.length === 0 ? (
            <p className="m-0 text-[15px] text-muted">No attendance data available.</p>
          ) : (
            <ol className="list-none m-0 p-0 flex flex-col" style={{ borderTop: '1px solid #15201B' }}>
              {attendanceByYear.map(({ year, attended, eligible }) => {
                const pct = eligible > 0 ? (attended / eligible) * 100 : 0
                return (
                  <li key={year} className="flex flex-col gap-2 py-3.5 border-b border-rule">
                    <span className="flex justify-between text-[15px]">
                      <span className="font-mono font-medium">{year}</span>
                      <span>
                        <strong>{attended}</strong> meetings attended
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="rounded"
                      style={{ height: '8px', background: '#E4E7E2', overflow: 'hidden', display: 'flex' }}
                    >
                      <span
                        style={{
                          width: `${(eligible / maxEligible) * 100}%`,
                          background: '#E4E7E2',
                          display: 'flex',
                          alignItems: 'stretch',
                        }}
                      >
                        <span
                          style={{
                            width: `${pct}%`,
                            background: '#1E4D36',
                            borderRadius: '4px',
                          }}
                        />
                      </span>
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        {/* Voting record */}
        <section
          aria-labelledby="votes-h"
          className="flex-[999_1_560px] min-w-0 flex flex-col gap-5"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="votes-h" className="m-0 font-display font-semibold text-[26px]">
              Voting record
            </h2>
            <div role="group" aria-label="Filter votes" className="flex flex-wrap gap-1.5 text-[14px] font-medium">
              {filters.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  onClick={() => { setFilter(key); setPage(1) }}
                  className="h-10 px-3.5 rounded-full cursor-pointer"
                  style={{
                    fontFamily: 'inherit',
                    color: filter === key ? '#FFFFFF' : '#15201B',
                    background: filter === key ? '#15201B' : '#FFFFFF',
                    border: filter === key ? '1px solid #15201B' : '1px solid #D5D9D3',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filteredVotes.length === 0 ? (
            <p className="m-0 text-[15px] text-muted py-6">No votes match this filter.</p>
          ) : (
            <ol className="list-none m-0 p-0 flex flex-col" style={{ borderTop: '1px solid #15201B' }}>
              {visibleVotes.map((entry, i) => (
                <VoteRow key={`${entry.date}-${i}`} entry={entry} />
              ))}
            </ol>
          )}

          {hasMore && (
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              className="self-start text-[15px] font-semibold bg-transparent border-0 cursor-pointer p-0"
              style={{ fontFamily: 'inherit', color: '#1E4D36' }}
            >
              Show earlier votes
            </button>
          )}

          <p className="m-0 text-[13px] leading-[1.55] text-muted" style={{ maxWidth: '640px' }}>
            Extracted automatically from approved minutes. Only roll-call votes appear here; motions passed by voice vote (&ldquo;all in favor&rdquo;) don&apos;t record how each trustee voted.{' '}
          </p>
        </section>
      </div>
    </div>
  )
}

export default function TrusteeProfilePage({
  params,
}: {
  params: Promise<{ slug: string; board: string; trusteeId: string }>
}) {
  return (
    <Suspense>
      <ProfileInner params={params} />
    </Suspense>
  )
}
