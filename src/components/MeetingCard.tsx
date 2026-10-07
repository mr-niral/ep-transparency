'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Meeting } from '@/types'

interface Props {
  meeting: Meeting
}

type DocType = 'agenda' | 'minutes' | 'director'

interface SummaryState {
  text: string
  loading: boolean
  error: string
  docType: DocType | null
}

export default function MeetingCard({ meeting }: Props) {
  const [summary, setSummary] = useState<SummaryState>({
    text: '',
    loading: false,
    error: '',
    docType: null,
  })

  async function summarize(pdfUrl: string, docType: DocType) {
    // Toggle off if same doc is already shown
    if (summary.docType === docType && summary.text) {
      setSummary({ text: '', loading: false, error: '', docType: null })
      return
    }

    setSummary({ text: '', loading: true, error: '', docType })

    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfUrl, docType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Unknown error')
      setSummary({ text: data.summary, loading: false, error: '', docType })
    } catch (err) {
      setSummary({
        text: '',
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to summarize',
        docType,
      })
    }
  }

  const formattedDate = new Date(meeting.parsedDate + 'T12:00:00').toLocaleDateString(
    'en-US',
    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  )

  return (
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
          <a
            href={meeting.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-red-50 text-red-700 rounded-full hover:bg-red-100 transition-colors"
          >
            🎥 Video
          </a>
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
            disabled={summary.loading}
            className="text-xs px-3 py-1 rounded-full border border-[#1F5239] text-[#1F5239] hover:bg-green-50 disabled:opacity-50 transition-colors"
          >
            {summary.loading && summary.docType === 'agenda'
              ? '⏳ Summarizing…'
              : summary.docType === 'agenda' && summary.text
                ? '✕ Hide summary'
                : '✨ Summarize agenda'}
          </button>
        )}
        {meeting.minutesUrl && (
          <button
            onClick={() => summarize(meeting.minutesUrl!, 'minutes')}
            disabled={summary.loading}
            className="text-xs px-3 py-1 rounded-full border border-green-300 text-green-600 hover:bg-green-50 disabled:opacity-50 transition-colors"
          >
            {summary.loading && summary.docType === 'minutes'
              ? '⏳ Summarizing…'
              : summary.docType === 'minutes' && summary.text
                ? '✕ Hide summary'
                : '✨ Summarize minutes'}
          </button>
        )}
        {meeting.directorLetterUrl && (
          <button
            onClick={() => summarize(meeting.directorLetterUrl!, 'director')}
            disabled={summary.loading}
            className="text-xs px-3 py-1 rounded-full border border-purple-300 text-purple-600 hover:bg-purple-50 disabled:opacity-50 transition-colors"
          >
            {summary.loading && summary.docType === 'director'
              ? '⏳ Summarizing…'
              : summary.docType === 'director' && summary.text
                ? '✕ Hide summary'
                : '✨ Summarize letter'}
          </button>
        )}
      </div>

      {/* Summary output */}
      {summary.error && (
        <p className="mt-3 text-xs text-red-600 bg-red-50 rounded-lg p-3">
          {summary.error}
        </p>
      )}
      {summary.text && !summary.loading && (
        <div className="mt-3 text-sm text-gray-700 bg-gray-50 rounded-lg p-4 border-l-4 border-[#AEDCC0] prose prose-sm max-w-none">
          <ReactMarkdown>{summary.text}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}
