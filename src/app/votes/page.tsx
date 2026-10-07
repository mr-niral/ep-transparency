'use client'

import { useEffect, useState, useMemo } from 'react'
import type { Meeting, MeetingVotes } from '@/types'
import { saveVotes, loadVotes, loadAllVotes } from '@/lib/voteStorage'

type Tab = 'extract' | 'attendance'

const VOTE_DISPLAY: Record<string, { label: string; className: string }> = {
  yes: { label: '✓ Yes', className: 'text-green-700 font-medium' },
  no: { label: '✗ No', className: 'text-red-700 font-medium' },
  abstain: { label: '~ Abstain', className: 'text-yellow-700 font-medium' },
  absent: { label: '— Absent', className: 'text-gray-400' },
}

export default function VotesPage() {
  const [tab, setTab] = useState<Tab>('extract')
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loadingMeetings, setLoadingMeetings] = useState(true)
  const [meetingsError, setMeetingsError] = useState('')
  const [extracting, setExtracting] = useState<string | null>(null)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [cachedDates, setCachedDates] = useState<Set<string>>(new Set())
  const [allVotes, setAllVotes] = useState<MeetingVotes[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Load meetings and cached state on mount
  useEffect(() => {
    fetch('/api/meetings')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setMeetings(data)
        } else {
          setMeetingsError(data.error ?? 'Failed to load meetings.')
        }
      })
      .catch(() => setMeetingsError('Network error. Please try again.'))
      .finally(() => setLoadingMeetings(false))

    refreshCache()
  }, [])

  function refreshCache(autoSelectDate?: string) {
    const saved = loadAllVotes()
    const sorted = saved.sort((a, b) => b.meetingDate.localeCompare(a.meetingDate))
    setCachedDates(new Set(sorted.map((v) => v.meetingDate)))
    setAllVotes(sorted)
    if (autoSelectDate) {
      setSelectedDate(autoSelectDate)
    }
  }

  const cutoffYear = new Date().getFullYear() - 4
  const meetingsWithMinutes = meetings.filter((m) => m.year >= cutoffYear)

  async function handleExtract(meeting: Meeting) {
    if (!meeting.minutesUrl) return
    setExtracting(meeting.parsedDate)
    setExtractError(null)

    try {
      const res = await fetch('/api/votes', {
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
        setExtractError(data.error ?? 'Extraction failed.')
      } else {
        saveVotes(data as MeetingVotes)
        refreshCache(meeting.parsedDate)
      }
    } catch {
      setExtractError('Network error. Please try again.')
    } finally {
      setExtracting(null)
    }
  }

  // Attendance data: per meeting, derive each trustee's attendance status.
  // A trustee "attended" if they cast any yes/no/abstain vote in that meeting;
  // "absent" if every ballot they appear in is 'absent'.
  const attendanceByYear = useMemo(() => {
    // meetingDate → { trusteeName → 'attended' | 'absent' }
    const perMeeting = new Map<string, Record<string, 'attended' | 'absent'>>()
    for (const mv of allVotes) {
      const status: Record<string, 'attended' | 'absent'> = {}
      for (const vr of mv.votes) {
        for (const [name, vote] of Object.entries(vr.ballots)) {
          if (!(name in status)) {
            status[name] = vote === 'absent' ? 'absent' : 'attended'
          } else if (status[name] === 'absent' && vote !== 'absent') {
            status[name] = 'attended'
          }
        }
      }
      perMeeting.set(mv.meetingDate, status)
    }

    // Group meetings by year
    const byYear = new Map<number, MeetingVotes[]>()
    for (const mv of allVotes) {
      const year = parseInt(mv.meetingDate.slice(0, 4))
      if (!byYear.has(year)) byYear.set(year, [])
      byYear.get(year)!.push(mv)
    }

    // All trustee names across all meetings
    const allTrusteeNames = [...new Set(
      [...perMeeting.values()].flatMap((s) => Object.keys(s))
    )].sort()

    // Build yearly summary: year → trustee → { attended, absent }
    const years = [...byYear.keys()].sort((a, b) => b - a)
    const summary = years.map((year) => {
      const meetings = byYear.get(year)!.sort((a, b) => b.meetingDate.localeCompare(a.meetingDate))
      const trustees = allTrusteeNames.map((name) => {
        let attended = 0, absent = 0
        for (const mv of meetings) {
          const status = perMeeting.get(mv.meetingDate)
          if (!status || !(name in status)) continue
          if (status[name] === 'attended') attended++
          else absent++
        }
        return { name, attended, absent, total: attended + absent }
      }).filter((t) => t.total > 0)
      return { year, meetings, trustees }
    })

    return { summary, allTrusteeNames }
  }, [allVotes])

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-[#1e3a5f] text-white py-10 px-4">
        <div className="max-w-5xl mx-auto">
          <p className="text-blue-300 text-sm font-medium mb-1 uppercase tracking-wide">
            Elmwood Park Public Library
          </p>
          <h1 className="text-3xl font-bold mb-2">Vote Tracker</h1>
          <p className="text-blue-200 text-sm max-w-xl">
            Extract trustee votes from meeting minutes and track attendance over time.
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 flex gap-0">
          {(['extract', 'attendance'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-[#1e3a5f] text-[#1e3a5f]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'extract' ? 'Extract Votes' : 'Trustee Attendance'}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* EXTRACT TAB */}
        {tab === 'extract' && (
          <div>
            <p className="text-sm text-gray-500 mb-5">
              Select a meeting to extract individual trustee votes from its minutes PDF.
              Results are cached in your browser.
            </p>

            {extractError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {extractError}
              </div>
            )}

            {loadingMeetings && (
              <div className="text-center py-16 text-gray-500">Loading meetings…</div>
            )}

            {meetingsError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-700 text-sm">
                {meetingsError}
              </div>
            )}

            {!loadingMeetings && !meetingsError && meetingsWithMinutes.length === 0 && (
              <div className="text-center py-16 text-gray-400">No meetings found.</div>
            )}

            {!loadingMeetings && !meetingsError && meetingsWithMinutes.length > 0 && (
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                {meetingsWithMinutes.map((m) => {
                  const isCached = cachedDates.has(m.parsedDate)
                  const isExtracting = extracting === m.parsedDate
                  const isSelected = selectedDate === m.parsedDate
                  const cached = isCached ? loadVotes(m.parsedDate) : null
                  return (
                    <div key={m.parsedDate}>
                      <div className="flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          {isCached ? (
                            <button
                              onClick={() => setSelectedDate(isSelected ? null : m.parsedDate)}
                              className="text-sm font-medium text-[#1e3a5f] hover:underline text-left"
                            >
                              {m.date}
                            </button>
                          ) : (
                            <span className="text-sm font-medium text-gray-800">{m.date}</span>
                          )}
                          {isCached && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                              {cached?.votes.length ?? 0} motions
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!m.minutesUrl && (
                            <span className="text-xs text-gray-400 italic">No minutes posted</span>
                          )}
                          {isCached && (
                            <button
                              onClick={() => setSelectedDate(isSelected ? null : m.parsedDate)}
                              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                            >
                              {isSelected ? 'Hide' : 'View'}
                            </button>
                          )}
                          {m.minutesUrl && (
                            <button
                              onClick={() => handleExtract(m)}
                              disabled={isExtracting}
                              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                                isExtracting
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : isCached
                                  ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  : 'bg-[#1e3a5f] text-white hover:bg-[#162d4a]'
                              }`}
                            >
                              {isExtracting ? 'Extracting…' : isCached ? 'Re-extract' : 'Extract votes'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline vote breakdown */}
                      {isSelected && cached && (
                        <div className="bg-gray-50 border-t border-gray-100 px-4 py-4">
                          {cached.votes.length === 0 ? (
                            <p className="text-sm text-gray-500">
                              No individual votes recorded in these minutes.
                            </p>
                          ) : (
                            <div className="space-y-4">
                              {cached.votes.map((vr, i) => {
                                const trustees = Object.keys(vr.ballots)
                                return (
                                  <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                    {/* Motion header */}
                                    <div className="px-4 py-3 border-b border-gray-100">
                                      <p className="text-sm font-semibold text-gray-800">{vr.motion}</p>
                                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-gray-500">
                                        <span>
                                          Result:{' '}
                                          <span
                                            className={
                                              vr.result === 'passed'
                                                ? 'text-green-700 font-medium'
                                                : vr.result === 'failed'
                                                ? 'text-red-700 font-medium'
                                                : 'text-gray-600 font-medium'
                                            }
                                          >
                                            {vr.result.charAt(0).toUpperCase() + vr.result.slice(1)}
                                          </span>
                                        </span>
                                        {vr.mover && <span>Moved by {vr.mover}</span>}
                                        {vr.seconder && <span>Seconded by {vr.seconder}</span>}
                                      </div>
                                    </div>
                                    {/* Vote table */}
                                    {trustees.length > 0 && (
                                      <table className="w-full text-sm">
                                        <tbody className="divide-y divide-gray-50">
                                          {trustees.map((name) => {
                                            const vote = vr.ballots[name]
                                            const display = VOTE_DISPLAY[vote] ?? { label: vote, className: 'text-gray-600' }
                                            return (
                                              <tr key={name} className="hover:bg-gray-50">
                                                <td className="px-4 py-2 text-gray-700">{name}</td>
                                                <td className={`px-4 py-2 text-right ${display.className}`}>
                                                  {display.label}
                                                </td>
                                              </tr>
                                            )
                                          })}
                                        </tbody>
                                      </table>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ATTENDANCE TAB */}
        {tab === 'attendance' && (
          <div>
            {allVotes.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="mb-2">No votes extracted yet.</p>
                <p className="text-sm">
                  Switch to the{' '}
                  <button onClick={() => setTab('extract')} className="text-[#1e3a5f] underline">
                    Extract Votes
                  </button>{' '}
                  tab to get started.
                </p>
              </div>
            ) : attendanceByYear.summary.length === 0 || attendanceByYear.allTrusteeNames.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p>No individual ballots found in extracted meetings.</p>
                <p className="text-sm mt-1">These minutes may only record voice votes without individual names.</p>
              </div>
            ) : (
              <div className="space-y-8">
                <p className="text-sm text-gray-500">
                  Attendance is derived from roll-call votes in extracted minutes.
                  Meetings with only voice votes are not counted.
                </p>
                {attendanceByYear.summary.map(({ year, meetings, trustees }) => (
                  <div key={year} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    {/* Year header */}
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-baseline gap-3">
                      <h2 className="text-base font-semibold text-gray-800">{year}</h2>
                      <span className="text-xs text-gray-500">{meetings.length} meeting{meetings.length !== 1 ? 's' : ''} extracted</span>
                    </div>

                    {/* Trustee rows */}
                    <div className="divide-y divide-gray-100">
                      {trustees.map(({ name, attended, absent, total }) => {
                        const attendedPct = total > 0 ? (attended / total) * 100 : 0
                        const absentPct = total > 0 ? (absent / total) * 100 : 0
                        return (
                          <div key={name} className="px-5 py-3 flex items-center gap-4">
                            <div className="w-40 shrink-0 text-sm font-medium text-gray-800 truncate">
                              {name}
                            </div>
                            {/* Bar */}
                            <div className="flex-1 flex rounded-full overflow-hidden h-4 bg-gray-100 min-w-0">
                              {attended > 0 && (
                                <div
                                  className="bg-green-500 h-full"
                                  style={{ width: `${attendedPct}%` }}
                                  title={`${attended} attended`}
                                />
                              )}
                              {absent > 0 && (
                                <div
                                  className="bg-red-400 h-full"
                                  style={{ width: `${absentPct}%` }}
                                  title={`${absent} absent`}
                                />
                              )}
                            </div>
                            {/* Counts */}
                            <div className="shrink-0 text-xs text-right w-36">
                              <span className="text-green-700 font-medium">{attended} attended</span>
                              {absent > 0 && (
                                <span className="text-red-600 font-medium"> · {absent} absent</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-8 border-t border-gray-200 mt-8">
        This is an independent civic transparency tool. Not affiliated with the Elmwood Park Public Library.
      </footer>
    </div>
  )
}
