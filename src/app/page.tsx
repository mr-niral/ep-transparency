'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { villages } from '@/data/villages'
import type { Meeting } from '@/types'

function ArrowRightIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#1E4D36"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

function getMeetingStatus(m: Meeting): string {
  if (m.agendaUrl && m.minutesUrl && m.videoUrl) return 'Agenda, minutes and video posted'
  if (m.agendaUrl && m.minutesUrl) return 'Agenda and minutes posted'
  if (m.agendaUrl && m.videoUrl) return 'Agenda and video posted'
  if (m.agendaUrl) return 'Agenda posted · minutes not yet available'
  return 'Meeting posted'
}

function formatMonoDate(parsedDate: string): string {
  const d = new Date(parsedDate + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function LandingInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const query = searchParams.get('q') ?? ''
  const [latestMeetings, setLatestMeetings] = useState<Meeting[]>([])

  useEffect(() => {
    fetch('/api/meetings')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setLatestMeetings(data.slice(0, 3))
      })
      .catch(() => {})
  }, [])

  function handleSearch(value: string) {
    const params = new URLSearchParams()
    if (value) params.set('q', value)
    router.replace(value ? `/?${params.toString()}` : '/', { scroll: false })
  }

  const filtered = query.trim()
    ? villages.filter(
        (v) =>
          v.name.toLowerCase().includes(query.toLowerCase()) ||
          v.state.toLowerCase().includes(query.toLowerCase()) ||
          v.zips.some((z) => z.includes(query.trim()))
      )
    : villages

  const noMatch = query.trim().length > 0 && filtered.length === 0

  return (
    <div className="min-h-screen">

      {/* ── Hero ── */}
      <section style={{ borderBottom: '3px double #15201B' }}>
        <div className="max-w-[1120px] mx-auto px-6 py-[72px] pb-16 flex flex-wrap gap-14 items-end">

          {/* Left column */}
          <div className="flex-[999_1_520px] min-w-0 flex flex-col gap-6">
            <p className="m-0 font-mono text-[13px] tracking-[0.08em] uppercase text-accent">
              Local government, small-town scale
            </p>
            <h1 className="m-0 font-display font-medium leading-[1.04] tracking-[-0.02em]" style={{ fontSize: 'clamp(40px, 6vw, 68px)' }}>
              Making local politics accountable and accessible.
            </h1>
            <p className="m-0 text-[19px] leading-[1.55] text-ink-2 max-w-[560px]">
              Agendas, minutes, votes and meeting video from the village boards, library boards
              and councils of smaller towns — the meetings big-city newsrooms rarely cover —
              gathered in one place, with plain-English summaries.
            </p>
            <form
              role="search"
              className="flex flex-col gap-2 max-w-[560px] mt-2"
              onSubmit={(e) => {
                e.preventDefault()
                const val = (e.currentTarget.elements.namedItem('q') as HTMLInputElement).value
                handleSearch(val)
              }}
            >
              <label htmlFor="muni-search" className="text-[14px] font-semibold">
                Find your municipality
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  id="muni-search"
                  name="q"
                  type="search"
                  placeholder="City, state, or ZIP"
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="flex-[1_1_260px] min-w-0 h-[52px] box-border px-4 text-[17px] text-ink bg-surface border-[1.5px] border-ink rounded"
                />
                <button
                  type="submit"
                  className="h-[52px] px-7 text-[16px] font-semibold text-white bg-accent border-0 rounded cursor-pointer hover:bg-accent-hover transition-colors"
                >
                  Search
                </button>
              </div>
            </form>
          </div>

          {/* Right column — municipalities panel */}
          <aside
            id="municipalities"
            aria-label="Now covering"
            className="flex-[1_1_340px] min-w-0 bg-surface border border-rule rounded-[6px] p-7 flex flex-col gap-5"
          >
            <p className="m-0 font-mono text-[12px] tracking-[0.08em] uppercase text-muted">
              Now covering · {filtered.length} {filtered.length === 1 ? 'municipality' : 'municipalities'}
            </p>

            {noMatch ? (
              <p className="m-0 text-[15px] text-muted">
                No municipality found for &ldquo;{query}&rdquo;.
              </p>
            ) : (
              filtered.map((village) => (
                <div key={village.slug}>
                  <div className="flex flex-col gap-1 mb-3">
                    <h2 className="m-0 font-display font-semibold text-[32px] tracking-[-0.01em] text-ink">
                      {village.name}
                    </h2>
                    <p className="m-0 text-[15px] text-muted">
                      {village.state === 'IL' ? 'Illinois' : village.state}
                      {village.county ? ` · ${village.county}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col border-t border-rule-soft">
                    {village.hasLibraryBoard && (
                      <Link
                        href={`/village/${village.slug}`}
                        className="flex items-center justify-between gap-3 py-4 border-b border-rule-soft"
                        style={{ textDecoration: 'none', color: '#15201B' }}
                      >
                        <span className="flex flex-col gap-0.5">
                          <span className="font-semibold text-[17px]">Library Board</span>
                          <span className="text-[14px] text-muted">Meetings · Summaries</span>
                        </span>
                        <ArrowRightIcon />
                      </Link>
                    )}
                    {village.hasVillageBoard && (
                      <Link
                        href={`/village/${village.slug}?board=village`}
                        className="flex items-center justify-between gap-3 py-4 border-b border-rule-soft"
                        style={{ textDecoration: 'none', color: '#15201B' }}
                      >
                        <span className="flex flex-col gap-0.5">
                          <span className="font-semibold text-[17px]">Village Board</span>
                          <span className="text-[14px] text-muted">Votes · Finances · Summaries</span>
                        </span>
                        <ArrowRightIcon />
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}

            <p id="request" className="m-0 text-[14px] text-muted leading-[1.5]">
              Don&apos;t see your town?{' '}
              <a href="#request-form">Request it</a>
            </p>
          </aside>
        </div>
      </section>

      {/* ── Request form (shown when no match) ── */}
      {noMatch && (
        <section id="request-form" className="max-w-[1120px] mx-auto px-6 py-10">
          <div className="max-w-md mx-auto">
            <form
              action="https://formspree.io/f/YOUR_FORM_ID"
              method="POST"
              className="bg-surface border border-rule rounded-[6px] p-6 flex flex-col gap-4"
            >
              <h2 className="m-0 text-base font-semibold text-ink">Request this municipality</h2>
              <input type="hidden" name="_subject" value="The Village Hall Record municipality request" />
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-muted" htmlFor="req-city">City</label>
                <input
                  id="req-city"
                  type="text"
                  name="city"
                  defaultValue={query}
                  required
                  className="h-10 border border-border-strong rounded px-3 text-[15px] bg-surface text-ink focus:outline-none focus:border-accent"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-muted" htmlFor="req-state">State</label>
                <input
                  id="req-state"
                  type="text"
                  name="state"
                  className="h-10 border border-border-strong rounded px-3 text-[15px] bg-surface text-ink focus:outline-none focus:border-accent"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-muted" htmlFor="req-email">
                  Your email <span className="text-muted font-normal">(optional)</span>
                </label>
                <input
                  id="req-email"
                  type="email"
                  name="email"
                  className="h-10 border border-border-strong rounded px-3 text-[15px] bg-surface text-ink focus:outline-none focus:border-accent"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-muted" htmlFor="req-context">
                  Any context <span className="text-muted font-normal">(optional)</span>
                </label>
                <textarea
                  id="req-context"
                  name="context"
                  rows={3}
                  placeholder="e.g. links to your municipality's meeting page, FOIA contact, etc."
                  className="border border-border-strong rounded px-3 py-2 text-[15px] bg-surface text-ink resize-none focus:outline-none focus:border-accent"
                />
              </div>
              <button
                type="submit"
                className="h-[44px] bg-accent text-white font-semibold text-[15px] rounded border-0 cursor-pointer hover:bg-accent-hover transition-colors"
              >
                Send Request
              </button>
            </form>
          </div>
        </section>
      )}

      {/* ── Latest from Elmwood Park ── */}
      {latestMeetings.length > 0 && (
        <section
          aria-labelledby="latest-h"
          className="max-w-[1120px] mx-auto px-6 pt-16 pb-6 flex flex-col gap-6"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="latest-h" className="m-0 font-display font-semibold text-[30px] tracking-[-0.01em]">
              Latest from Elmwood Park
            </h2>
            <Link href="/village/elmwood-park-il" className="text-[15px] font-semibold">
              All Library Board meetings
            </Link>
          </div>
          <ol
            className="list-none m-0 p-0 flex flex-col"
            style={{ borderTop: '1px solid #15201B' }}
          >
            {latestMeetings.map((m) => (
              <li
                key={m.parsedDate}
                className="flex flex-wrap items-center gap-4 py-5 border-b border-rule"
                style={{ columnGap: '32px' }}
              >
                <span className="font-mono text-[14px] text-ink-2 w-[132px]">
                  {formatMonoDate(m.parsedDate)}
                </span>
                <span className="flex-[1_1_260px] flex flex-col gap-0.5">
                  <span className="font-semibold text-[17px]">
                    Library Board meeting
                  </span>
                  <span className="text-[14px] text-muted">{getMeetingStatus(m)}</span>
                </span>
                <span className="flex gap-5 text-[15px] font-medium">
                  {m.agendaUrl && (
                    <a href={m.agendaUrl} target="_blank" rel="noopener noreferrer">
                      Agenda
                    </a>
                  )}
                  {m.minutesUrl && (
                    <a href={m.minutesUrl} target="_blank" rel="noopener noreferrer">
                      Minutes
                    </a>
                  )}
                  {m.videoUrl && (
                    <a href={m.videoUrl} target="_blank" rel="noopener noreferrer">
                      Video
                    </a>
                  )}
                  <Link href={`/village/elmwood-park-il/library-board/${m.parsedDate}?source=agenda`}>
                    Summary
                  </Link>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── What's in the record ── */}
      <section id="how" aria-labelledby="how-h" className="max-w-[1120px] mx-auto px-6 py-14 pb-20 flex flex-col gap-8">
        <h2 id="how-h" className="m-0 font-display font-semibold text-[30px] tracking-[-0.01em]">
          What&apos;s in the record
        </h2>
        <div className="grid gap-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(230px, 100%), 1fr))' }}>
          <div className="flex flex-col gap-2.5 border-t-2 border-ink pt-5">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1E4D36" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
              <path d="M14 3v5h5M9 13h6M9 17h6" />
            </svg>
            <h3 className="m-0 text-[18px] font-semibold">Agendas</h3>
            <p className="m-0 text-[15px] leading-[1.55] text-ink-2">
              What each board plans to discuss, posted ahead of the meeting.
            </p>
          </div>
          <div className="flex flex-col gap-2.5 border-t-2 border-ink pt-5">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1E4D36" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 11l3 3 8-8" />
              <path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" />
            </svg>
            <h3 className="m-0 text-[18px] font-semibold">Minutes and votes</h3>
            <p className="m-0 text-[15px] leading-[1.55] text-ink-2">
              The official account of what was decided, and who voted how.
            </p>
          </div>
          <div className="flex flex-col gap-2.5 border-t-2 border-ink pt-5">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1E4D36" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="6" width="13" height="12" rx="2" />
              <path d="M16 10l5-3v10l-5-3" />
            </svg>
            <h3 className="m-0 text-[18px] font-semibold">Meeting video</h3>
            <p className="m-0 text-[15px] leading-[1.55] text-ink-2">
              Recordings linked beside each meeting, where the board publishes them.
            </p>
          </div>
          <div className="flex flex-col gap-2.5 border-t-2 border-ink pt-5">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1E4D36" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 6h16M4 10h16M4 14h10M4 18h7" />
            </svg>
            <h3 className="m-0 text-[18px] font-semibold">Plain-English summaries</h3>
            <p className="m-0 text-[15px] leading-[1.55] text-ink-2">
              AI-generated explanations of long documents, always linked to the original.
            </p>
          </div>
        </div>
      </section>

    </div>
  )
}

export default function LandingPage() {
  return (
    <Suspense>
      <LandingInner />
    </Suspense>
  )
}
