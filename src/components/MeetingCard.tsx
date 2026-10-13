'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Meeting } from '@/types'
import { saveSummary, loadSummary } from '@/lib/summaryStorage'

interface Props {
  meeting: Meeting
}

type DocType = 'agenda' | 'minutes' | 'director'

interface SummaryState {
  text: string
  loading: boolean
  error: string
  docType: DocType | null
  title: string
}

const DOC_LABELS: Record<DocType, string> = {
  agenda: 'Agenda Summary',
  minutes: 'Minutes Summary',
  director: "Director's Letter Summary",
}

function toEmbedUrl(url: string): string {
  try {
    const u = new URL(url)
    let videoId = ''
    if (u.hostname === 'youtu.be') {
      videoId = u.pathname.slice(1)
    } else if (u.hostname.includes('youtube.com')) {
      videoId = u.searchParams.get('v') ?? ''
    }
    if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1`
  } catch {}
  return url
}

export default function MeetingCard({ meeting }: Props) {
  const [summary, setSummary] = useState<SummaryState>({
    text: '',
    loading: false,
    error: '',
    docType: null,
    title: '',
  })
  const [videoOpen, setVideoOpen] = useState(false)
  const [cached, setCached] = useState<Partial<Record<DocType, boolean>>>({})

  function refreshCache() {
    setCached({
      agenda: !!loadSummary(meeting.parsedDate, 'agenda'),
      minutes: !!loadSummary(meeting.parsedDate, 'minutes'),
      director: !!loadSummary(meeting.parsedDate, 'director'),
    })
  }

  useEffect(() => {
    refreshCache()
    window.addEventListener('summaryUpdate', refreshCache)
    return () => window.removeEventListener('summaryUpdate', refreshCache)
  }, [meeting.parsedDate])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSummary((s) => ({ ...s, text: '', docType: null }))
        setVideoOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function summarize(pdfUrl: string, docType: DocType) {
    // Load from cache instantly if available
    const cached = loadSummary(meeting.parsedDate, docType)
    if (cached) {
      setSummary({ text: cached, loading: false, error: '', docType, title: DOC_LABELS[docType] })
      return
    }

    setSummary({ text: '', loading: true, error: '', docType, title: DOC_LABELS[docType] })

    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfUrl, docType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Unknown error')
      saveSummary(meeting.parsedDate, docType, data.summary)
      setSummary({ text: data.summary, loading: false, error: '', docType, title: DOC_LABELS[docType] })
    } catch (err) {
      setSummary({
        text: '',
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to summarize',
        docType,
        title: DOC_LABELS[docType],
      })
    }
  }

  function closeModal() {
    setSummary({ text: '', loading: false, error: '', docType: null, title: '' })
  }

  const formattedDate = new Date(meeting.parsedDate + 'T12:00:00').toLocaleDateString(
    'en-US',
    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  )

  const modalOpen = !!(summary.text && !summary.loading)

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow p-5">
        <h3 className="font-semibold text-gray-900 text-base mb-3">{formattedDate}</h3>

        {/* Document links */}
        <div className="flex flex-wrap gap-2 mb-3">
          {meeting.agendaUrl && (
            <a
              href={meeting.agendaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-green-50 text-green-800 rounded-full hover:bg-green-100 transition-colors"
            >
              📄 Agenda
            </a>
          )}
          {meeting.minutesUrl && (
            <a
              href={meeting.minutesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-green-50 text-green-700 rounded-full hover:bg-green-100 transition-colors"
            >
              📝 Minutes
            </a>
          )}
          {meeting.videoUrl && (
            <button
              onClick={() => setVideoOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-red-50 text-red-700 rounded-full hover:bg-red-100 transition-colors"
            >
              🎥 Video
            </button>
          )}
          {meeting.directorLetterUrl && (
            <a
              href={meeting.directorLetterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-purple-50 text-purple-700 rounded-full hover:bg-purple-100 transition-colors"
            >
              ✉️ Director&apos;s Letter
            </a>
          )}
        </div>

        {/* Summarize buttons */}
        <div className="flex flex-wrap gap-2">
          {meeting.agendaUrl && (
            <button
              onClick={() => summarize(meeting.agendaUrl!, 'agenda')}
              disabled={summary.loading && summary.docType === 'agenda'}
              className={`text-xs px-3 py-1 rounded-full border transition-colors disabled:opacity-50 ${
                cached.agenda
                  ? 'border-[#1F5239] bg-[#1F5239] text-white hover:bg-[#163d2c]'
                  : 'border-[#1F5239] text-[#1F5239] hover:bg-green-50'
              }`}
            >
              {summary.loading && summary.docType === 'agenda' ? '⏳ Summarizing…' : cached.agenda ? '✓ Agenda summary' : '✨ Summarize agenda'}
            </button>
          )}
          {meeting.minutesUrl && (
            <button
              onClick={() => summarize(meeting.minutesUrl!, 'minutes')}
              disabled={summary.loading && summary.docType === 'minutes'}
              className={`text-xs px-3 py-1 rounded-full border transition-colors disabled:opacity-50 ${
                cached.minutes
                  ? 'border-green-600 bg-green-600 text-white hover:bg-green-700'
                  : 'border-green-300 text-green-600 hover:bg-green-50'
              }`}
            >
              {summary.loading && summary.docType === 'minutes' ? '⏳ Summarizing…' : cached.minutes ? '✓ Minutes summary' : '✨ Summarize minutes'}
            </button>
          )}
          {meeting.directorLetterUrl && (
            <button
              onClick={() => summarize(meeting.directorLetterUrl!, 'director')}
              disabled={summary.loading && summary.docType === 'director'}
              className={`text-xs px-3 py-1 rounded-full border transition-colors disabled:opacity-50 ${
                cached.director
                  ? 'border-purple-600 bg-purple-600 text-white hover:bg-purple-700'
                  : 'border-purple-300 text-purple-600 hover:bg-purple-50'
              }`}
            >
              {summary.loading && summary.docType === 'director' ? '⏳ Summarizing…' : cached.director ? '✓ Letter summary' : '✨ Summarize letter'}
            </button>
          )}
        </div>

        {/* Inline error */}
        {summary.error && (
          <p className="mt-3 text-xs text-red-600 bg-red-50 rounded-lg p-3">
            {summary.error}
          </p>
        )}
      </div>

      {/* Video modal */}
      {videoOpen && meeting.videoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={() => setVideoOpen(false)}
        >
          <div
            className="bg-black rounded-2xl shadow-2xl w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-white text-sm font-medium">{formattedDate} — Board Meeting</p>
              <button
                onClick={() => setVideoOpen(false)}
                className="text-white/70 hover:text-white transition-colors text-xl leading-none p-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src={toEmbedUrl(meeting.videoUrl)}
                className="absolute inset-0 w-full h-full rounded-b-2xl"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      {/* Summary modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{summary.title}</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">{formattedDate}</p>
              </div>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-700 transition-colors text-xl leading-none p-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-5 text-sm text-gray-700 prose prose-sm max-w-none">
              <ReactMarkdown>{summary.text}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
