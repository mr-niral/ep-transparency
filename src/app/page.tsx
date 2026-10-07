'use client'

import { useEffect, useState, useMemo } from 'react'
import MeetingCard from '@/components/MeetingCard'
import type { Meeting } from '@/types'

export default function Home() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/meetings')
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
  }, [])

  const years = useMemo(
    () => [...new Set(meetings.map((m) => m.year))].sort((a, b) => b - a),
    [meetings]
  )

  const filtered = useMemo(() => {
    return meetings.filter((m) => {
      const yearMatch = selectedYear === 'all' || m.year === selectedYear
      const searchMatch =
        !search || m.date.toLowerCase().includes(search.toLowerCase())
      return yearMatch && searchMatch
    })
  }, [meetings, selectedYear, search])

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-[#1F5239] text-white py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <p className="text-[#AEDCC0] text-sm font-medium mb-1 uppercase tracking-wide">
            Elmwood Park Public Library
          </p>
          <h1 className="text-3xl font-bold mb-2">Board Meeting Transparency</h1>
          <p className="text-green-100 text-sm max-w-xl">
            Browse agendas, minutes, and video recordings for every board meeting.
            Click &ldquo;Summarize&rdquo; to get a plain-English explanation powered by AI.
          </p>
          <p className="mt-3 text-xs text-[#AEDCC0]">
            Data sourced live from{' '}
            <a
              href="https://elmwoodparklibrary.org/about-eppl/library-board/agendas-minutes"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              elmwoodparklibrary.org
            </a>
          </p>
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
            <p>Loading meetings from the library site…</p>
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
            <p className="text-sm text-gray-500 mb-4">
              Showing {filtered.length} meeting{filtered.length !== 1 ? 's' : ''}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {filtered.map((meeting) => (
                <MeetingCard key={meeting.parsedDate} meeting={meeting} />
              ))}
            </div>
          </>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-8 border-t border-gray-200">
        This is an independent civic transparency tool. Not affiliated with the Elmwood Park Public Library.
      </footer>
    </div>
  )
}
