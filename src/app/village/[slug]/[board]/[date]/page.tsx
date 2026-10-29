'use client'

import { use, useEffect, useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { villages } from '@/data/villages'
import type { Meeting } from '@/types'
import { saveStructuredSummary, loadStructuredSummary } from '@/lib/summaryStorage'

// ── Types ───────────────────────────────────────────────────────────────────

interface KeyFigure {
  label: string
  value: string
}

interface Decision {
  status: 'approved' | 'failed' | 'tabled'
  motion: string
  notes?: string
}

interface SummarySection {
  heading: string
  body: string
}

interface StructuredSummary {
  key_figures: KeyFigure[]
  decisions: Decision[]
  sections: SummarySection[]
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatLongDate(parsedDate: string): string {
  const d = new Date(parsedDate + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatShortDate(parsedDate: string): string {
  const d = new Date(parsedDate + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function statusColor(status: Decision['status']): string {
  if (status === 'approved') return '#1E4D36'
  if (status === 'failed') return '#8A4A12'
  return '#46504A'
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="flex flex-col gap-10 animate-pulse">
      <div className="flex flex-col gap-4 pb-7" style={{ borderBottom: '3px double #D5D9D3' }}>
        <div className="h-3 w-48 bg-rule rounded" />
        <div className="h-12 w-3/4 bg-rule rounded" />
        <div className="h-4 w-64 bg-rule-soft rounded" />
      </div>
      <div className="grid gap-px bg-rule border border-rule rounded-[6px] overflow-hidden" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))' }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-surface p-5 flex flex-col gap-2">
            <div className="h-3 w-24 bg-rule-soft rounded" />
            <div className="h-8 w-20 bg-rule rounded" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <div className="h-6 w-28 bg-rule rounded" />
        {[0, 1].map((i) => (
          <div key={i} className="py-4 border-b border-rule flex gap-5">
            <div className="h-3 w-20 bg-rule-soft rounded mt-1" />
            <div className="flex-1 flex flex-col gap-2">
              <div className="h-5 bg-rule rounded" />
              <div className="h-3 w-3/4 bg-rule-soft rounded" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-3">
            <div className="h-6 w-32 bg-rule rounded" />
            <div className="h-4 bg-rule-soft rounded" />
            <div className="h-4 w-5/6 bg-rule-soft rounded" />
            <div className="h-4 w-4/6 bg-rule-soft rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page inner ──────────────────────────────────────────────────────────────

function SummaryPageInner({
  params,
}: {
  params: Promise<{ slug: string; board: string; date: string }>
}) {
  const { slug, board, date } = use(params)
  const searchParams = useSearchParams()
  const source = searchParams.get('source') ?? 'agenda'

  const village = villages.find((v) => v.slug === slug)
  const boardType = board === 'village-board' ? 'village' : 'library'
  const boardLabel = boardType === 'library' ? 'Library Board' : 'Village Board'
  const sourceLabel =
    source === 'minutes' ? 'Minutes' : source === 'director' ? "Director's letter" : 'Agenda'

  const [allMeetings, setAllMeetings] = useState<Meeting[]>([])
  const [summary, setSummary] = useState<StructuredSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [docUrl, setDocUrl] = useState<string | null>(null)

  // All hooks before any early return
  const meeting = useMemo(
    () => allMeetings.find((m) => m.parsedDate === date) ?? null,
    [allMeetings, date]
  )

  const meetingIndex = useMemo(
    () => allMeetings.findIndex((m) => m.parsedDate === date),
    [allMeetings, date]
  )

  const prevMeeting = meetingIndex > 0 ? allMeetings[meetingIndex - 1] : null
  const nextMeeting =
    meetingIndex >= 0 && meetingIndex < allMeetings.length - 1
      ? allMeetings[meetingIndex + 1]
      : null

  const availableSources = useMemo(() => {
    if (!meeting) return []
    const s: { key: string; label: string; url: string }[] = []
    if (meeting.agendaUrl) s.push({ key: 'agenda', label: 'From the agenda', url: meeting.agendaUrl })
    if (meeting.minutesUrl) s.push({ key: 'minutes', label: 'From the minutes', url: meeting.minutesUrl })
    if (meeting.directorLetterUrl) s.push({ key: 'director', label: "From the director's letter", url: meeting.directorLetterUrl })
    return s
  }, [meeting])

  // Fetch meetings list
  useEffect(() => {
    if (!village) return
    const url = boardType === 'library' ? '/api/meetings' : '/api/village-meetings'
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAllMeetings(data)
      })
      .catch(() => {})
  }, [village, boardType])

  // Load or fetch structured summary
  useEffect(() => {
    if (!meeting) return

    const cacheKey = `${date}:${source}`
    const cached = loadStructuredSummary(cacheKey)
    if (cached) {
      setSummary(cached as StructuredSummary)
      setLoading(false)
      return
    }

    const pdfUrl =
      source === 'minutes'
        ? meeting.minutesUrl
        : source === 'director'
        ? meeting.directorLetterUrl
        : meeting.agendaUrl

    if (!pdfUrl) {
      setError(`No ${source} document available for this meeting.`)
      setLoading(false)
      return
    }

    setDocUrl(pdfUrl)
    setLoading(true)
    setError('')

    fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfUrl, docType: source, boardType, structured: true }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.summary) {
          try {
            // Strip markdown code fences if Claude wrapped the JSON
            const raw = data.summary
              .replace(/^```(?:json)?\s*/i, '')
              .replace(/\s*```$/, '')
              .trim()
            const parsed = JSON.parse(raw) as StructuredSummary
            saveStructuredSummary(cacheKey, parsed)
            setSummary(parsed)
            setDocUrl(pdfUrl)
          } catch {
            setError('Summary was generated but could not be parsed. Please try again.')
          }
        } else if (data.error) {
          setError(data.error)
        }
      })
      .catch(() => setError('Failed to generate summary. Please try again.'))
      .finally(() => setLoading(false))
  }, [meeting, source, date, boardType])

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

  return (
    <div className="min-h-screen">
      <div className="max-w-[1120px] mx-auto px-4 pt-10">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="text-[14px] text-muted flex gap-2 flex-wrap">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span>{village.name}, {village.state}</span>
          <span aria-hidden="true">/</span>
          <Link href={`/village/${slug}${boardType === 'village' ? '?board=village' : ''}`}>
            {boardLabel}
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{formatShortDate(date)}</span>
        </nav>
      </div>

      <div className="max-w-[1120px] mx-auto px-4 pt-8 pb-24 flex flex-wrap gap-10 items-start">

        {/* ── Article ── */}
        <article className="flex-[999_1_600px] min-w-0 flex flex-col gap-10">

          {/* Article header */}
          <header className="flex flex-col gap-4 pb-7" style={{ borderBottom: '3px double #15201B' }}>
            <p className="m-0 font-mono text-[13px] tracking-[0.08em] uppercase text-accent">
              {sourceLabel} summary · {boardLabel}
            </p>
            <h1
              className="m-0 font-display font-medium leading-[1.06] tracking-[-0.02em]"
              style={{ fontSize: 'clamp(36px, 5vw, 52px)' }}
            >
              {formatLongDate(date)}
            </h1>
            <p className="m-0 text-[15px] leading-[1.55] text-ink-2 flex flex-wrap gap-1.5 items-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A4A12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5M12 16.5v.01" />
              </svg>
              <span>AI-generated from the official {source}. See original {source} for official source.</span>
              {docUrl && (
                <a href={docUrl} target="_blank" rel="noopener noreferrer" className="font-semibold">
                  Read the {source}
                </a>
              )}
            </p>
          </header>

          {loading && <Skeleton />}

          {error && (
            <div className="bg-surface border border-rule rounded-[6px] p-6 text-center">
              <p className="font-semibold text-signal mb-1">Could not generate summary</p>
              <p className="text-[14px] text-ink-2">{error}</p>
            </div>
          )}

          {!loading && !error && summary && (
            <>
              {/* At a glance */}
              {summary.key_figures.length > 0 && (
                <section aria-labelledby="glance-h" className="flex flex-col gap-4">
                  <h2
                    id="glance-h"
                    className="m-0 font-mono text-[12px] font-medium tracking-[0.08em] uppercase text-muted"
                  >
                    At a glance
                  </h2>
                  <dl
                    className="m-0 grid gap-px border border-rule rounded-[6px] overflow-hidden"
                    style={{
                      gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))',
                      background: '#D5D9D3',
                    }}
                  >
                    {summary.key_figures.map((kf) => (
                      <div key={kf.label} className="bg-surface px-5 py-[18px] flex flex-col gap-1 min-w-0">
                        <dt className="text-[13px] text-muted leading-snug">{kf.label}</dt>
                        <dd
                          className="m-0 font-display font-semibold leading-tight"
                          style={{ fontSize: 'clamp(17px, 2.5vw, 22px)', overflowWrap: 'break-word', wordBreak: 'break-word' }}
                        >
                          {kf.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}

              {/* Decisions */}
              {summary.decisions.length > 0 && (
                <section aria-labelledby="votes-h" className="flex flex-col gap-4">
                  <h2
                    id="votes-h"
                    className="m-0 font-display font-semibold text-[28px] tracking-[-0.01em]"
                  >
                    Decisions
                  </h2>
                  <ol className="list-none m-0 p-0 flex flex-col" style={{ borderTop: '1px solid #15201B' }}>
                    {summary.decisions.map((d, i) => (
                      <li
                        key={i}
                        className="flex flex-wrap gap-2 py-[18px] border-b border-rule"
                        style={{ columnGap: '20px' }}
                      >
                        <span
                          className="w-[92px] font-mono text-[12px] tracking-[0.06em] uppercase pt-1"
                          style={{ flexShrink: 0, color: statusColor(d.status) }}
                        >
                          {d.status}
                        </span>
                        <div className="flex-[1_1_360px] min-w-0 flex flex-col gap-1">
                          <p className="m-0 text-[17px] leading-[1.5] font-semibold">{d.motion}</p>
                          {d.notes && (
                            <p className="m-0 text-[15px] leading-[1.55] text-ink-2">{d.notes}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {/* Narrative sections */}
              {summary.sections.length > 0 && (
                <div className="flex flex-col gap-8 text-[18px] leading-[1.65]" style={{ maxWidth: '680px' }}>
                  {summary.sections.map((s) => (
                    <div key={s.heading} className="flex flex-col gap-2.5">
                      <h2 className="m-0 font-display font-semibold text-[24px]">{s.heading}</h2>
                      <p className="m-0">{s.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Article footer */}
          {!loading && (
            <footer className="flex flex-wrap justify-between gap-4 pt-6 border-t border-rule text-[15px]">
              <span className="flex gap-6 font-medium">
                {nextMeeting && (
                  <Link href={`/village/${slug}/${board}/${nextMeeting.parsedDate}?source=${source}`}>
                    ← {formatShortDate(nextMeeting.parsedDate)}
                  </Link>
                )}
                {prevMeeting && (
                  <Link href={`/village/${slug}/${board}/${prevMeeting.parsedDate}?source=${source}`}>
                    {formatShortDate(prevMeeting.parsedDate)} →
                  </Link>
                )}
              </span>
            </footer>
          )}
        </article>

        {/* ── Sidebar ── */}
        <aside
          aria-label="About this meeting"
          className="flex-[1_1_260px] min-w-0 flex flex-col gap-7"
          style={{ maxWidth: '320px' }}
        >
          {/* Official documents */}
          {meeting && (
            <div className="flex flex-col gap-3 bg-surface border border-rule rounded-[6px] p-6">
              <h2 className="m-0 font-mono text-[12px] font-medium tracking-[0.08em] uppercase text-muted">
                Official documents
              </h2>
              <ul className="list-none m-0 p-0 flex flex-col text-[16px] font-medium">
                {meeting.minutesUrl && (
                  <li className="border-b border-rule-soft">
                    <a
                      href={meeting.minutesUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex justify-between items-center py-3 no-underline"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      Minutes
                      <ExternalLinkIcon />
                    </a>
                  </li>
                )}
                {meeting.agendaUrl && (
                  <li className="border-b border-rule-soft">
                    <a
                      href={meeting.agendaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex justify-between items-center py-3 no-underline"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      Agenda
                      <ExternalLinkIcon />
                    </a>
                  </li>
                )}
                {meeting.videoUrl && (
                  <li className="border-b border-rule-soft">
                    <a
                      href={meeting.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex justify-between items-center py-3 no-underline"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      Video recording
                      <ExternalLinkIcon />
                    </a>
                  </li>
                )}
                {meeting.directorLetterUrl && (
                  <li>
                    <a
                      href={meeting.directorLetterUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex justify-between items-center py-3 no-underline"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      Director&apos;s letter
                      <ExternalLinkIcon />
                    </a>
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Other summaries */}
          {availableSources.length > 1 && (
            <div className="flex flex-col gap-3">
              <h2 className="m-0 font-mono text-[12px] font-medium tracking-[0.08em] uppercase text-muted">
                Other summaries
              </h2>
              <div role="tablist" aria-label="Summary source" className="flex flex-col gap-1.5">
                {availableSources.map((s) => (
                  <Link
                    key={s.key}
                    href={`/village/${slug}/${board}/${date}?source=${s.key}`}
                    aria-current={source === s.key ? 'page' : undefined}
                    className="py-3 px-3.5 font-medium text-[15px] no-underline rounded"
                    style={{
                      textDecoration: 'none',
                      background: source === s.key ? '#1E4D36' : 'transparent',
                      color: source === s.key ? '#FFFFFF' : 'inherit',
                      border: source === s.key ? 'none' : '1px solid #D5D9D3',
                      fontWeight: source === s.key ? 600 : 500,
                    }}
                  >
                    {s.label}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Copy link */}
          <div className="flex flex-col gap-2.5">
            <h2 className="m-0 font-mono text-[12px] font-medium tracking-[0.08em] uppercase text-muted">
              Share
            </h2>
            <CopyLinkButton />
          </div>
        </aside>
      </div>
    </div>
  )
}

function ExternalLinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17L17 7M9 7h8v8" />
    </svg>
  )
}

function CopyLinkButton() {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="h-11 px-4 flex items-center justify-center gap-2 text-[15px] font-semibold text-accent rounded cursor-pointer"
      style={{
        fontFamily: 'inherit',
        background: 'transparent',
        border: '1.5px solid #A9B1AB',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
        <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
      </svg>
      {copied ? 'Copied!' : 'Copy link'}
    </button>
  )
}

export default function SummaryPage({
  params,
}: {
  params: Promise<{ slug: string; board: string; date: string }>
}) {
  return (
    <Suspense>
      <SummaryPageInner params={params} />
    </Suspense>
  )
}
