'use client'

import { use, useEffect, useState, useMemo, Suspense, type CSSProperties } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Meeting, BoardRoster, MeetingExtraction, TrusteeRecord } from '@/types'
import { villages } from '@/data/villages'

// ── Helpers ────────────────────────────────────────────────────────────────

function getEmbedUrl(videoUrl: string): string | null {
  try {
    const url = new URL(videoUrl)
    if (url.hostname.includes('youtube.com') && url.searchParams.get('v')) {
      return `https://www.youtube.com/embed/${url.searchParams.get('v')}`
    }
  } catch {}
  return null
}

function formatShortDate(parsedDate: string): string {
  const d = new Date(parsedDate + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatWeekday(parsedDate: string): string {
  const d = new Date(parsedDate + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long' })
}

// ── SummarizeButton ────────────────────────────────────────────────────────

function SummarizeButton({
  meeting,
  slug,
  boardSlug,
  isLatest,
  asOriginals,
}: {
  meeting: Meeting
  slug: string
  boardSlug: string
  isLatest: boolean
  asOriginals?: boolean
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const sources: { label: string; key: string; url: string | undefined }[] = []
  if (meeting.agendaUrl) sources.push({ label: asOriginals ? 'Agenda' : 'From the agenda', key: 'agenda', url: meeting.agendaUrl })
  if (meeting.minutesUrl) sources.push({ label: asOriginals ? 'Minutes' : 'From the minutes', key: 'minutes', url: meeting.minutesUrl })
  if (meeting.directorLetterUrl) sources.push({ label: asOriginals ? "Director's letter" : "From the director's letter", key: 'director', url: meeting.directorLetterUrl })

  if (sources.length === 0) return null

  const buttonLabel = asOriginals ? 'Originals' : 'Summarize'

  function navigate(source: { key: string; url: string | undefined }) {
    if (asOriginals && source.url) {
      window.open(source.url, '_blank', 'noopener,noreferrer')
    } else {
      router.push(`/village/${slug}/${boardSlug}/${meeting.parsedDate}?source=${source.key}`)
    }
  }

  if (sources.length === 1) {
    if (asOriginals && sources[0].url) {
      return (
        <a
          href={sources[0].url}
          target="_blank"
          rel="noopener noreferrer"
          className="h-11 box-border px-[18px] flex items-center gap-2 text-[15px] font-semibold rounded no-underline"
          style={{
            border: isLatest ? 'none' : '1.5px solid #A9B1AB',
            background: isLatest ? '#1E4D36' : 'transparent',
            color: isLatest ? '#fff' : '#1E4D36',
          }}
        >
          {buttonLabel} ↗
        </a>
      )
    }
    return (
      <Link
        href={`/village/${slug}/${boardSlug}/${meeting.parsedDate}?source=${sources[0].key}`}
        className="h-11 box-border px-[18px] flex items-center gap-2 text-[15px] font-semibold rounded no-underline"
        style={{
          border: isLatest ? 'none' : '1.5px solid #A9B1AB',
          background: isLatest ? '#1E4D36' : 'transparent',
          color: isLatest ? '#fff' : '#1E4D36',
        }}
      >
        {buttonLabel}
      </Link>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="h-11 px-[18px] flex items-center gap-2 text-[15px] font-semibold rounded cursor-pointer"
        style={{
          border: isLatest ? 'none' : '1.5px solid #A9B1AB',
          background: isLatest ? '#1E4D36' : 'transparent',
          color: isLatest ? '#fff' : '#1E4D36',
          fontFamily: 'inherit',
        }}
      >
        {buttonLabel}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-surface border border-rule rounded shadow-lg py-1 min-w-[220px] z-20">
            {sources.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => { setOpen(false); navigate(s) }}
                className="w-full text-left px-4 py-2.5 text-[15px] font-medium text-ink hover:bg-ground cursor-pointer"
                style={{ background: 'none', border: 'none', fontFamily: 'inherit' }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── MeetingRow ─────────────────────────────────────────────────────────────

function MeetingRow({
  meeting,
  isLatest,
  slug,
  boardSlug,
  showAiLinks,
}: {
  meeting: Meeting
  isLatest: boolean
  slug: string
  boardSlug: string
  showAiLinks?: boolean
}) {
  const [videoOpen, setVideoOpen] = useState(false)
  const embedUrl = meeting.videoUrl ? getEmbedUrl(meeting.videoUrl) : null

  const missingMinutes =
    !meeting.minutesUrl &&
    new Date(meeting.parsedDate + 'T00:00:00') < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  return (
    <li
      className="flex flex-wrap items-center gap-3 border-b border-rule"
      style={{
        columnGap: '28px',
        padding: isLatest ? '20px 16px' : '20px 0',
        margin: isLatest ? '0 -16px' : '0',
        background: isLatest ? '#FFFFFF' : 'transparent',
        rowGap: videoOpen ? '12px' : undefined,
      }}
    >
      {/* Date */}
      <div className="w-[84px] flex flex-col gap-0.5" style={{ flexShrink: 0 }}>
        <span className="font-mono text-[22px] font-medium">{formatShortDate(meeting.parsedDate)}</span>
        <span className="text-[13px] text-muted">{formatWeekday(meeting.parsedDate)}</span>
      </div>

      {/* Docs */}
      <div className="flex-[1_1_280px] min-w-0 flex flex-col gap-2">
        {isLatest && (
          <span
            className="self-start font-mono text-[11px] tracking-[0.08em] uppercase text-signal border border-signal rounded-[3px] px-1.5 py-0.5"
          >
            Latest
          </span>
        )}
        <div className="flex flex-wrap gap-1.5 text-[15px] font-medium" style={{ columnGap: '20px' }}>
          {meeting.agendaUrl && (
            showAiLinks
              ? <Link href={`/village/${slug}/${boardSlug}/${meeting.parsedDate}?source=agenda`}>Agenda</Link>
              : <a href={meeting.agendaUrl} target="_blank" rel="noopener noreferrer">Agenda</a>
          )}
          {meeting.minutesUrl && (
            showAiLinks
              ? <Link href={`/village/${slug}/${boardSlug}/${meeting.parsedDate}?source=minutes`}>Minutes</Link>
              : <a href={meeting.minutesUrl} target="_blank" rel="noopener noreferrer">Minutes</a>
          )}
          {meeting.videoUrl && (
            embedUrl ? (
              <button
                type="button"
                onClick={() => setVideoOpen((o) => !o)}
                className="font-medium text-[15px] bg-transparent border-0 p-0 cursor-pointer"
                style={{ fontFamily: 'inherit', color: '#1E4D36' }}
              >
                {videoOpen ? 'Hide video' : 'Video'}
              </button>
            ) : (
              <a href={meeting.videoUrl} target="_blank" rel="noopener noreferrer">Video</a>
            )
          )}
          {meeting.directorLetterUrl && (
            showAiLinks
              ? <Link href={`/village/${slug}/${boardSlug}/${meeting.parsedDate}?source=director`}>Director&apos;s letter</Link>
              : <a href={meeting.directorLetterUrl} target="_blank" rel="noopener noreferrer">Director&apos;s letter</a>
          )}
          {meeting.portalUrl && !meeting.agendaUrl && !meeting.minutesUrl && (
            <a href={meeting.portalUrl} target="_blank" rel="noopener noreferrer">Documents</a>
          )}
          {!meeting.minutesUrl && !missingMinutes && !meeting.portalUrl && (
            <span className="text-muted font-normal">Minutes not yet posted</span>
          )}
        </div>
      </div>

      {/* Originals / Summarize */}
      <SummarizeButton
        meeting={meeting}
        slug={slug}
        boardSlug={boardSlug}
        isLatest={isLatest}
        asOriginals={showAiLinks}
      />

      {/* Inline video player */}
      {videoOpen && embedUrl && (
        <div style={{ flexBasis: '100%', width: '100%' }}>
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: '4px', overflow: 'hidden' }}>
            <iframe
              src={embedUrl}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              title={`Meeting video — ${meeting.date}`}
            />
          </div>
        </div>
      )}
    </li>
  )
}

// ── TrusteesSection ────────────────────────────────────────────────────────

type MeetingDot = 'attended' | 'absent' | 'future' | 'no-data'

interface TrusteeRow {
  trustee: TrusteeRecord
  dots: MeetingDot[]
  attended: number
  eligible: number
  absent: number
  remote: number
}

function computeTrusteeRows(
  trustees: TrusteeRecord[],
  yearMeetings: Meeting[],
  extractionMap: Map<string, MeetingExtraction>,
): TrusteeRow[] {
  const now = new Date()
  return trustees.map((trustee) => {
    let attended = 0, eligible = 0, absent = 0, remote = 0
    const dots: MeetingDot[] = []

    for (const meeting of yearMeetings) {
      const mDate = meeting.parsedDate
      const isFuture = new Date(mDate + 'T23:59:59') > now

      if (trustee.firstSeenDate > mDate) {
        dots.push('no-data')
        continue
      }

      const extraction = extractionMap.get(mDate)
      if (!extraction || extraction.status !== 'ok') {
        dots.push(isFuture ? 'future' : 'no-data')
        continue
      }

      eligible++
      if (extraction.rollCall.present.includes(trustee.id) || extraction.rollCall.remote.includes(trustee.id)) {
        attended++
        if (extraction.rollCall.remote.includes(trustee.id)) remote++
        dots.push('attended')
      } else if (extraction.rollCall.absent.includes(trustee.id)) {
        absent++
        dots.push('absent')
      } else {
        dots.push('no-data')
      }
    }

    return { trustee, dots, attended, eligible, absent, remote }
  })
}

function TrusteesSection({
  slug,
  board,
  boardSlug,
  boardType,
  meetings,
}: {
  slug: string
  board: string
  boardSlug: string
  boardType: string
  meetings: Meeting[]
}) {
  const [data, setData] = useState<{ roster: BoardRoster | null; extractions: MeetingExtraction[] }>({
    roster: null,
    extractions: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/trustees/all?village=${slug}&board=${boardSlug}`)
      .then((r) => r.ok ? r.json() : { roster: null, extractions: [] })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [slug, boardSlug])

  // Build extraction map
  const extractionMap = useMemo(() => {
    const map = new Map<string, MeetingExtraction>()
    for (const e of data.extractions) map.set(e.meetingDate, e)
    return map
  }, [data.extractions])

  // Years available: derived from extraction data (not from scraper, which can fail)
  const years = useMemo(
    () =>
      [...new Set(data.extractions.map((e) => parseInt(e.meetingDate.slice(0, 4))))]
        .sort((a, b) => b - a),
    [data.extractions]
  )

  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)

  // Ensure selectedYear is in available years
  const activeYear = years.includes(selectedYear) ? selectedYear : years[0] ?? currentYear

  // Trustees who served during the selected year (includes former trustees)
  const currentTrustees = useMemo(() => {
    const yearStart = `${activeYear}-01-01`
    const yearEnd = `${activeYear}-12-31`
    return (data.roster?.trustees ?? []).filter(
      (t) => t.firstSeenDate <= yearEnd && t.lastSeenDate >= yearStart
    )
  }, [data.roster, activeYear])

  // Build yearMeetings from extraction dates, enriched with scraper data when available
  const yearMeetings = useMemo(() => {
    const scraperMap = new Map(
      meetings.filter((m) => m.year === activeYear).map((m) => [m.parsedDate, m])
    )
    return data.extractions
      .filter((e) => parseInt(e.meetingDate.slice(0, 4)) === activeYear)
      .map((e) => scraperMap.get(e.meetingDate) ?? {
        date: e.meetingDate,
        parsedDate: e.meetingDate,
        year: activeYear,
        minutesUrl: e.meetingDate, // non-null: extraction exists means minutes were processed
        agendaUrl: undefined,
        videoUrl: undefined,
      } as Meeting)
      .sort((a, b) => a.parsedDate.localeCompare(b.parsedDate))
  }, [meetings, data.extractions, activeYear])

  // Year stats
  const yearStats = useMemo(() => {
    const now = new Date()
    const withMinutes = yearMeetings.filter((m) => m.minutesUrl).length
    const awaiting = yearMeetings.filter(
      (m) => !m.minutesUrl && new Date(m.parsedDate + 'T23:59:59') < now
    ).length
    return { total: yearMeetings.length, withMinutes, awaiting }
  }, [yearMeetings])

  const rows = useMemo(
    () => computeTrusteeRows(currentTrustees, yearMeetings, extractionMap),
    [currentTrustees, yearMeetings, extractionMap]
  )

  const boardLabel = boardType === 'library' ? 'Library Board' : boardType === 'village' ? 'Village Board' : 'School Board'

  if (loading) {
    return (
      <main className="max-w-[1120px] mx-auto px-6 pt-10 pb-20 flex flex-col gap-7">
        <div className="animate-pulse flex flex-col gap-4">
          <div className="h-8 w-48 bg-rule rounded" />
          <div className="h-[200px] bg-rule-soft rounded-[6px]" />
        </div>
      </main>
    )
  }

  if (!data.roster || (data.roster.trustees ?? []).length === 0) {
    return (
      <main className="max-w-[1120px] mx-auto px-6 pt-10 pb-20">
        <p className="text-muted text-[15px]">
          Trustee attendance data is not yet available for this board.
        </p>
      </main>
    )
  }

  return (
    <main className="max-w-[1120px] mx-auto px-6 pt-10 pb-20 flex flex-col gap-7">
      {/* Year header */}
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-1.5">
          <h2 className="m-0 font-display font-semibold text-[34px]">
            Attendance in {activeYear}
          </h2>
          <p className="m-0 text-[15px] text-ink-2">
            {yearStats.total} meetings held · {yearStats.withMinutes} with approved minutes
            {yearStats.awaiting > 0 && ` · ${yearStats.awaiting} awaiting minutes`}
          </p>
        </div>
        {years.length > 1 && (
          <div role="group" aria-label="Year" className="flex gap-1.5 font-mono text-[14px]">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                aria-pressed={y === activeYear}
                onClick={() => setSelectedYear(y)}
                className="h-11 px-4 rounded cursor-pointer"
                style={{
                  fontFamily: 'inherit',
                  background: y === activeYear ? '#1E4D36' : '#FFFFFF',
                  color: y === activeYear ? '#FFFFFF' : '#15201B',
                  border: y === activeYear ? 'none' : '1px solid #D5D9D3',
                }}
              >
                {y}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-surface border border-rule rounded-[6px]">
        <table className="border-collapse text-[15px]" style={{ width: '100%', minWidth: '840px' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #15201B' }}>
              <th scope="col" className="px-5 py-4 text-[13px] font-semibold text-ink-2">Trustee</th>
              <th scope="col" className="px-3 py-4 text-[13px] font-semibold text-ink-2 text-center">Meetings attended</th>
              <th scope="col" className="px-3 py-4 text-[13px] font-semibold text-ink-2 text-center">Absent</th>
              <th scope="col" className="px-3 py-4 text-[13px] font-semibold text-ink-2 text-center">Remote</th>
              <th scope="col" className="px-3 py-4 text-[13px] font-semibold text-ink-2">
                <span className="flex gap-1 font-mono font-medium text-[11px] tracking-[0.04em]">
                  {yearMeetings.map((m) => (
                    <span key={m.parsedDate} style={{ width: '12px', textAlign: 'center' }}>
                      {new Date(m.parsedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'narrow' })}
                    </span>
                  ))}
                </span>
              </th>
              <th scope="col" className="px-5 py-4 pl-3">
                <span className="sr-only">Voting record</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ trustee, dots, attended, absent, remote }) => {
              return (
                <tr key={trustee.id} style={{ borderBottom: '1px solid #E4E7E2' }}>
                  <th scope="row" className="px-5 py-4 text-left font-normal">
                    <Link
                      href={`/village/${slug}/${boardSlug}/trustees/${trustee.id}`}
                      className="block font-semibold text-[16px] no-underline"
                      style={{ color: '#15201B', textDecoration: 'none' }}
                    >
                      {trustee.displayName}
                    </Link>
                    <span className="text-[13px] text-muted">{trustee.role}</span>
                  </th>
                  <td className="px-3 py-4 text-center">
                    <span className="font-display font-semibold text-[22px]">{attended}</span>
                  </td>
                  <td className="px-3 py-4 text-center"><span className="font-display font-semibold text-[22px]">{absent}</span></td>
                  <td className="px-3 py-4 text-center"><span className="font-display font-semibold text-[22px]">{remote}</span></td>
                  <td className="px-3 py-4">
                    <span className="flex gap-1 items-center">
                      {dots.map((dot, i) => {
                        const style: CSSProperties =
                          dot === 'attended' ? { background: '#1E4D36' } :
                          dot === 'absent'   ? { background: '#B91C1C' } :
                          dot === 'future'   ? { border: '1.5px solid #D5D9D3', background: 'transparent' } :
                                               { background: '#E4E7E2' }
                        return (
                          <span
                            key={i}
                            style={{ width: '12px', height: '12px', borderRadius: '2px', flexShrink: 0, boxSizing: 'border-box', ...style }}
                          />
                        )
                      })}
                    </span>
                  </td>
                  <td className="px-5 py-4 pl-3 text-right whitespace-nowrap">
                    <Link
                      href={`/village/${slug}/${boardSlug}/trustees/${trustee.id}`}
                      className="font-semibold text-[14px]"
                    >
                      Voting record
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>


      {/* How we count */}
      <section
        aria-labelledby="how-h"
        className="flex flex-col gap-3 border-t border-rule pt-6"
        style={{ maxWidth: '760px' }}
      >
        <h2 id="how-h" className="m-0 text-[16px] font-semibold">How we count</h2>
        <ul className="m-0 pl-5 flex flex-col gap-1.5 text-[15px] leading-[1.55] text-ink-2">
          <li>Attendance comes from the roll call in approved minutes. Meetings without approved minutes aren&apos;t counted yet.</li>
          <li>Full board meetings only, regular and special. Committee meetings don&apos;t count.</li>
          <li>Current trustees are the members listed in the roll call of the most recent approved minutes. Each trustee is counted from the first meeting they appear in.</li>
          <li>If a roll call can&apos;t be read clearly, or the vote counts don&apos;t add up, that meeting is marked &ldquo;not available&rdquo; instead of guessed.</li>
          <li>Minutes don&apos;t always say why a trustee was absent, so we don&apos;t label absences excused or unexcused.</li>
        </ul>
      </section>
    </main>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

function VillageMeetingsInner({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const village = villages.find((v) => v.slug === slug)
  const searchParams = useSearchParams()
  const boardParam = searchParams.get('board')
  const section = searchParams.get('section') ?? 'meetings'
  const board = boardParam === 'village' ? 'village' : boardParam === 'school' ? 'school' : 'library'
  const boardSlug = board === 'library' ? 'library-board' : board === 'village' ? 'village-board' : 'school-board'
  const showAiLinks = true

  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all')
  const [search, setSearch] = useState('')
  const [filterMinutes, setFilterMinutes] = useState(false)
  const [filterVideo, setFilterVideo] = useState(false)
  const [filterDirector, setFilterDirector] = useState(false)
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!village) return
    setLoading(true)
    setError('')
    setMeetings([])
    setSelectedYear('all')
    setSearch('')
    setFilterMinutes(false)
    setFilterVideo(false)
    setFilterDirector(false)
    setExpandedYears(new Set())
    const url = board === 'library' ? `/api/meetings?village=${slug}` : board === 'village' ? `/api/village-meetings?village=${slug}` : `/api/school-meetings?village=${slug}`
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMeetings(data)
        else setError(data.error ?? 'Failed to load meetings.')
      })
      .catch(() => setError('Network error. Please try again.'))
      .finally(() => setLoading(false))
  }, [board, village, slug])

  const years = useMemo(
    () => [...new Set(meetings.map((m) => m.year))].sort((a, b) => b - a),
    [meetings]
  )

  const filtered = useMemo(() => {
    return meetings.filter((m) => {
      if (selectedYear !== 'all' && m.year !== selectedYear) return false
      if (search && !m.date.toLowerCase().includes(search.toLowerCase())) return false
      if (filterMinutes && !m.minutesUrl) return false
      if (filterVideo && !m.videoUrl) return false
      if (filterDirector && !m.directorLetterUrl) return false
      return true
    })
  }, [meetings, selectedYear, search, filterMinutes, filterVideo, filterDirector])

  const byYear = useMemo(() => {
    const map = new Map<number, Meeting[]>()
    for (const m of filtered) {
      if (!map.has(m.year)) map.set(m.year, [])
      map.get(m.year)!.push(m)
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0])
  }, [filtered])

  // Stats
  const archiveMin = meetings.length ? Math.min(...meetings.map((m) => m.year)) : null

  if (!village) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-2xl font-bold text-ink mb-2">Municipality not found</h1>
          <p className="text-muted mb-6">This municipality isn&apos;t supported yet.</p>
          <Link href="/" className="font-medium hover:underline">
            ← Search for your municipality
          </Link>
        </div>
      </div>
    )
  }

  const boardLabel = board === 'library' ? 'Library Board' : board === 'village' ? 'Village Board' : 'School Board'
  const pageTitle = `${village.name} ${boardLabel}`

  const sourceLinks: Record<string, Record<string, string>> = {
    'elmwood-park-il': {
      library: 'https://elmwoodparklibrary.org/about-eppl/library-board/agendas-minutes',
      village: 'https://elmwoodpark.org/290/Board-Meeting-Minutes',
      school: 'https://www.epcusd401.org/board-of-education/board-meetings',
    },
    'riverside-il': {
      library: 'https://www.riversidelibrary.org/board-policies',
      village: 'https://www.riverside.il.us/AgendaCenter',
      school: 'https://meetings.boardbook.org/Public/Organization/1668',
    },
  }
  const sourceHref = sourceLinks[slug]?.[board]

  // Trustees tab available for boards that have extraction data
  const hasTrustees = slug !== 'riverside-il'

  // Section tab URLs
  const meetingsHref = boardParam ? `/village/${slug}?board=${boardParam}` : `/village/${slug}`
  const trusteesHref = boardParam ? `/village/${slug}?board=${boardParam}&section=trustees` : `/village/${slug}?section=trustees`

  return (
    <div className="min-h-screen">

      {/* ── Page header ── */}
      <section style={{ borderBottom: '3px double #15201B' }}>
        <div className="max-w-[1120px] mx-auto px-6 pt-10 flex flex-col gap-7">

          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="text-[14px] text-muted flex gap-2 flex-wrap">
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{village.name}, {village.state}</span>
          </nav>

          {/* Title + stats */}
          <div className="flex flex-wrap gap-8 items-end justify-between">
            <div className="flex-[999_1_520px] min-w-0 flex flex-col gap-3.5">
              <h1
                className="m-0 font-display font-medium leading-[1.05] tracking-[-0.02em]"
                style={{ fontSize: 'clamp(38px, 5vw, 56px)' }}
              >
                {pageTitle}
              </h1>
              <p className="m-0 text-[18px] leading-[1.55] text-ink-2 max-w-[620px]">
                {section === 'trustees'
                  ? <>Trustee attendance and votes, extracted automatically from the roll call in each meeting&apos;s approved minutes.</>
                  : board === 'school' && slug === 'elmwood-park-il'
                  ? <>Meeting dates for the EPCUSD 401 School Board{archiveMin ? ` since ${archiveMin}` : ''}. Agendas and minutes on the <a href="https://epcusd401.community.diligentoneplatform.com/Portal/" target="_blank" rel="noopener noreferrer">Diligent Community portal</a>.</>
                  : <>Agendas, minutes{board === 'library' ? '' : ', video'} and{board === 'library' ? " director\u2019s letters" : ' other documents'} for every board meeting{archiveMin ? ` since ${archiveMin}` : ''}.</>
                }
              </p>
            </div>

            <div className="flex-[1_1_300px] flex flex-col gap-6 items-start">
            {sourceHref && section !== 'trustees' && (
              <a
                href={sourceHref}
                target="_blank"
                rel="noopener noreferrer"
                className="h-11 px-[18px] flex items-center text-[15px] font-semibold text-accent bg-transparent rounded no-underline"
                style={{ border: '1.5px solid #1E4D36' }}
              >
                View Source ↗
              </a>
            )}
            </div>
          </div>

          {/* Board tabs */}
          <nav aria-label="Boards" className="flex gap-8 flex-wrap">
            {village.hasLibraryBoard && (
              <Link
                href={`/village/${village.slug}`}
                aria-current={board === 'library' ? 'page' : undefined}
                className="py-3.5 font-semibold text-[16px] no-underline"
                style={{
                  color: board === 'library' ? '#15201B' : '#59625C',
                  borderBottom: board === 'library' ? '3px solid #1E4D36' : '3px solid transparent',
                  textDecoration: 'none',
                  marginBottom: '-3px',
                  paddingLeft: '4px',
                  paddingRight: '4px',
                }}
              >
                Library Board
              </Link>
            )}
            {village.hasSchoolBoard && (
              <Link
                href={`/village/${village.slug}?board=school`}
                aria-current={board === 'school' ? 'page' : undefined}
                className="py-3.5 no-underline"
                style={{
                  color: board === 'school' ? '#15201B' : '#59625C',
                  borderBottom: board === 'school' ? '3px solid #1E4D36' : '3px solid transparent',
                  textDecoration: 'none',
                  marginBottom: '-3px',
                  fontWeight: board === 'school' ? 600 : 500,
                  fontSize: '16px',
                  paddingLeft: '4px',
                  paddingRight: '4px',
                }}
              >
                School Board
              </Link>
            )}
            {village.hasVillageBoard && (
              <Link
                href={`/village/${village.slug}?board=village`}
                aria-current={board === 'village' ? 'page' : undefined}
                className="py-3.5 no-underline"
                style={{
                  color: board === 'village' ? '#15201B' : '#59625C',
                  borderBottom: board === 'village' ? '3px solid #1E4D36' : '3px solid transparent',
                  textDecoration: 'none',
                  marginBottom: '-3px',
                  fontWeight: board === 'village' ? 600 : 500,
                  fontSize: '16px',
                  paddingLeft: '4px',
                  paddingRight: '4px',
                }}
              >
                Village Board
              </Link>
            )}
          </nav>

          {/* Section tabs (Meetings | Trustees) */}
          {hasTrustees && (
            <nav aria-label="Board sections" className="flex gap-7 flex-wrap" style={{ marginTop: '-12px' }}>
              <Link
                href={meetingsHref}
                aria-current={section !== 'trustees' ? 'page' : undefined}
                className="py-3.5 no-underline"
                style={{
                  color: section !== 'trustees' ? '#15201B' : '#59625C',
                  borderBottom: section !== 'trustees' ? '3px solid #1E4D36' : '3px solid transparent',
                  textDecoration: 'none',
                  marginBottom: '-3px',
                  fontWeight: section !== 'trustees' ? 600 : 500,
                  fontSize: '16px',
                  paddingLeft: '4px',
                  paddingRight: '4px',
                }}
              >
                Meetings
              </Link>
              <Link
                href={trusteesHref}
                aria-current={section === 'trustees' ? 'page' : undefined}
                className="py-3.5 no-underline"
                style={{
                  color: section === 'trustees' ? '#15201B' : '#59625C',
                  borderBottom: section === 'trustees' ? '3px solid #1E4D36' : '3px solid transparent',
                  textDecoration: 'none',
                  marginBottom: '-3px',
                  fontWeight: section === 'trustees' ? 600 : 500,
                  fontSize: '16px',
                  paddingLeft: '4px',
                  paddingRight: '4px',
                }}
              >
                Trustees
              </Link>
            </nav>
          )}
        </div>
      </section>

      {/* ── Trustees section ── */}
      {section === 'trustees' && (
        <TrusteesSection
          slug={slug}
          board={board}
          boardSlug={boardSlug}
          boardType={board}
          meetings={meetings}
        />
      )}

      {/* ── Meetings section ── */}
      {section !== 'trustees' && (
        <div className="max-w-[1120px] mx-auto px-6 pt-10 pb-20 flex flex-wrap gap-12 items-start">

          {/* Sidebar */}
          <aside
            aria-label="Filter meetings"
            className="flex-[1_1_220px] min-w-0 flex flex-col gap-7"
            style={{ maxWidth: '260px' }}
          >
            {/* Search */}
            <div className="flex flex-col gap-2">
              <label htmlFor="date-q" className="text-[14px] font-semibold">
                Search meetings
              </label>
              <input
                id="date-q"
                type="search"
                placeholder="e.g. March 2024"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 box-border px-3 text-[15px] bg-surface border border-border-strong rounded text-ink focus:outline-none focus:border-accent"
              />
            </div>

            {/* Year picker */}
            <div className="flex flex-col gap-1">
              <p className="m-0 mb-1.5 text-[14px] font-semibold">Year</p>
              <div
                className="grid gap-1.5 font-mono text-[14px]"
                style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedYear('all')}
                  aria-current={selectedYear === 'all' ? 'true' : undefined}
                  className="col-span-3 py-2.5 px-3 text-left rounded cursor-pointer text-[14px]"
                  style={{
                    fontFamily: 'inherit',
                    border: '1px solid #D5D9D3',
                    background: selectedYear === 'all' ? '#15201B' : '#FFFFFF',
                    color: selectedYear === 'all' ? '#FFFFFF' : '#59625C',
                  }}
                >
                  All years
                </button>
                {years.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => setSelectedYear(year)}
                    aria-current={selectedYear === year ? 'true' : undefined}
                    className="py-2.5 text-center rounded cursor-pointer text-[14px] font-mono"
                    style={{
                      fontFamily: 'inherit',
                      border: '1px solid #D5D9D3',
                      background: selectedYear === year ? '#15201B' : 'transparent',
                      color: selectedYear === year ? '#FFFFFF' : '#15201B',
                    }}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>

            {/* Has document checkboxes */}
            <fieldset className="m-0 p-0 border-0 flex flex-col gap-2.5 text-[15px]">
              <legend className="text-[14px] font-semibold mb-2">Has document</legend>
              <label className="flex gap-2.5 items-center">
                <input
                  type="checkbox"
                  checked={filterMinutes}
                  onChange={(e) => setFilterMinutes(e.target.checked)}
                  className="w-[18px] h-[18px]"
                  style={{ accentColor: '#1E4D36' }}
                />
                Minutes
              </label>
              <label className="flex gap-2.5 items-center">
                <input
                  type="checkbox"
                  checked={filterVideo}
                  onChange={(e) => setFilterVideo(e.target.checked)}
                  className="w-[18px] h-[18px]"
                  style={{ accentColor: '#1E4D36' }}
                />
                Video
              </label>
              <label className="flex gap-2.5 items-center">
                <input
                  type="checkbox"
                  checked={filterDirector}
                  onChange={(e) => setFilterDirector(e.target.checked)}
                  className="w-[18px] h-[18px]"
                  style={{ accentColor: '#1E4D36' }}
                />
                Director&apos;s letter
              </label>
            </fieldset>

            {/* AI disclaimer */}
            <p className="m-0 text-[13px] leading-[1.55] text-muted border-t border-rule pt-4">
              Summaries are AI-generated from the official documents. Always check the original before citing.
            </p>
          </aside>

          {/* Main */}
          <main className="flex-[999_1_560px] min-w-0 flex flex-col gap-14">

            {loading && (
              <div className="py-20 text-muted text-center">
                <p>Loading meetings…</p>
              </div>
            )}

            {error && (
              <div className="bg-surface border border-rule rounded-[6px] p-6 text-center text-signal">
                <p className="font-semibold mb-1">Could not load meetings</p>
                <p className="text-[14px] text-ink-2">{error}</p>
              </div>
            )}

            {!loading && !error && filtered.length === 0 && (
              <div className="py-20 text-center text-muted">
                <p>No meetings found.</p>
              </div>
            )}

            {!loading && !error && byYear.map(([year, yearMeetings]) => {
              const isExpanded = expandedYears.has(year)
              const LIMIT = 6
              const visible = isExpanded ? yearMeetings : yearMeetings.slice(0, LIMIT)
              const hasMore = yearMeetings.length > LIMIT

              return (
                <section key={year} id={`y${year}`} aria-labelledby={`h${year}`} className="flex flex-col">
                  {/* Year header */}
                  <div
                    className="flex flex-wrap items-baseline justify-between gap-3 pb-3.5"
                    style={{ borderBottom: '2px solid #15201B' }}
                  >
                    <h2
                      id={`h${year}`}
                      className="m-0 font-display font-semibold text-[34px] flex items-baseline gap-3.5"
                    >
                      {year}
                      <span className="font-sans text-[15px] font-normal text-muted">
                        {yearMeetings.length} meetings
                      </span>
                    </h2>
                  </div>

                  {/* Meetings list */}
                  <ol className="list-none m-0 p-0 flex flex-col">
                    {visible.map((m, i) => (
                      <MeetingRow
                        key={m.parsedDate}
                        meeting={m}
                        isLatest={i === 0 && year === byYear[0][0] && !selectedYear && !search}
                        slug={slug}
                        boardSlug={boardSlug}
                        showAiLinks={showAiLinks}
                      />
                    ))}
                  </ol>

                  {/* Show more / show less */}
                  {hasMore && (
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedYears((prev) => {
                          const next = new Set(prev)
                          if (isExpanded) next.delete(year)
                          else next.add(year)
                          return next
                        })
                      }}
                      className="self-start mt-4 text-[15px] font-semibold bg-transparent border-0 cursor-pointer p-0"
                      style={{ fontFamily: 'inherit', color: '#1E4D36' }}
                    >
                      {isExpanded
                        ? `Hide older ${year} meetings`
                        : `Show ${yearMeetings.length - LIMIT} earlier ${year} meetings`}
                    </button>
                  )}
                </section>
              )
            })}
          </main>
        </div>
      )}
    </div>
  )
}

export default function VillagePage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense>
      <VillageMeetingsInner params={params} />
    </Suspense>
  )
}
