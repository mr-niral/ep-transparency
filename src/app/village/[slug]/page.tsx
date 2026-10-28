'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import MeetingCard from '@/components/MeetingCard'
import type { Meeting } from '@/types'
import { saveSummary, hasSummary } from '@/lib/summaryStorage'
import { villages } from '@/data/villages'

function VillageMeetingsInner({ slug }: { slug: string }) {
  const village = villages.find((v) => v.slug === slug)
  const searchParams = useSearchParams()
  const board = searchParams.get('board') === 'village' ? 'village' : 'library'

  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all')
  const [search, setSearch] = useState('')
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; running: boolean }>({
    done: 0, total: 0, running: false,
  })

  // All hooks must be called unconditionally, before any early returns
  useEffect(() => {
    if (!village) return
    setLoading(true)
    setError('')
    setMeetings([])
    setSelectedYear('all')
    setSearch('')
    setBulkProgress({ done: 0, total: 0, running: false })
    const url = board === 'library' ? '/api/meetings' : '/api/village-meetings'
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setMeetings(data)
        } else {
          setError(data.error ?? 'Failed to load meetings.')
        }
      })
      .catch(() => setError('Network error. Please try again.'))
      .finally(() => setLoading(false))
  }, [board, village])

  const years = useMemo(
    () => [...new Set(meetings.map((m) => m.year))].sort((a, b) => b - a),
    [meetings]
  )

  const filtered = useMemo(() => {
    return meetings.filter((m) => {
      const yearMatch = selectedYear === 'all' || m.year === selectedYear
      const searchMatch = !search || m.date.toLowerCase().includes(search.toLowerCase())
      return yearMatch && searchMatch
    })
  }, [meetings, selectedYear, search])

  if (!village) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center px-4">
          <p className="text-4xl mb-4">🏛️</p>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Municipality not found</h1>
          <p className="text-gray-500 mb-6">This municipality isn&apos;t supported yet.</p>
          <Link href="/" className="text-[#1F5239] font-medium hover:underline">
            ← Search for your municipality
          </Link>
        </div>
      </div>
    )
  }

  async function summarizeAll2026() {
    const targets = meetings.filter((m) => m.year === 2026 && !!m.agendaUrl && !hasSummary(m.parsedDate, 'agenda'))
    if (targets.length === 0) return
    setBulkProgress({ done: 0, total: targets.length, running: true })
    let done = 0
    for (const m of targets) {
      try {
        const res = await fetch('/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfUrl: m.agendaUrl, docType: 'agenda' }),
        })
        const data = await res.json()
        if (res.ok) saveSummary(m.parsedDate, 'agenda', data.summary)
      } catch {}
      done++
      setBulkProgress({ done, total: targets.length, running: done < targets.length })
    }
  }

  const boardLabel = board === 'library' ? 'Library Board' : 'Village Board'

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-[#1F5239] text-white py-10 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-8">
          <div className="flex-1">
            <p className="text-[#AEDCC0] text-sm font-medium mb-1 uppercase tracking-wide">
              {village.name}
            </p>
            <h1 className="text-3xl font-bold mb-2">{boardLabel} Meetings</h1>
            <p className="text-green-100 text-sm max-w-xl">
              Browse agendas, minutes, and video recordings for every board meeting.
              Click &ldquo;Summarize&rdquo; to get a plain-English explanation powered by AI.
            </p>
          </div>
          <div className="hidden sm:block flex-shrink-0">
            <Image
              src="/logo.jpeg"
              alt={village.name}
              width={200}
              height={75}
              className="object-contain rounded-lg opacity-90"
            />
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex flex-wrap gap-3 items-center">
          <input
            type="search"
            placeholder="Search by date…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F5239] w-48"
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedYear('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedYear === 'all'
                  ? 'bg-[#1F5239] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All years
            </button>
            {years.map((year) => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedYear === year
                    ? 'bg-[#1F5239] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {loading && (
          <div className="text-center py-20 text-gray-500">
            <div className="text-4xl mb-3">⏳</div>
            <p>Loading meetings…</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-700">
            <p className="font-semibold mb-1">Could not load meetings</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <p>No meetings found.</p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                Showing {filtered.length} meeting{filtered.length !== 1 ? 's' : ''}
              </p>
              {board === 'library' && meetings.some((m) => m.year === 2026 && m.agendaUrl) && (
                <button
                  onClick={summarizeAll2026}
                  disabled={bulkProgress.running}
                  className="text-xs px-4 py-1.5 rounded-full bg-[#1F5239] text-white hover:bg-[#163d2c] disabled:opacity-60 transition-colors"
                >
                  {bulkProgress.running
                    ? `Summarizing… ${bulkProgress.done}/${bulkProgress.total}`
                    : bulkProgress.total > 0 && bulkProgress.done === bulkProgress.total
                    ? '✓ All 2026 agendas summarized'
                    : '✨ Summarize all 2026 agendas'}
                </button>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {filtered.map((meeting) => (
                <MeetingCard key={meeting.parsedDate} meeting={meeting} boardType={board} />
              ))}
            </div>
          </>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-8 border-t border-gray-200">
        This is an independent civic transparency tool. Not affiliated with the {village.name} Public Library.
      </footer>
    </div>
  )
}

export default function VillagePage({ params }: { params: { slug: string } }) {
  const { slug } = params
  return (
    <Suspense>
      <VillageMeetingsInner slug={slug} />
    </Suspense>
  )
}
