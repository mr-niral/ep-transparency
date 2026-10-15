import * as cheerio from 'cheerio'
import type { Meeting } from '@/types'

const BASE_URL = 'https://elmwoodparklibrary.org'
const SOURCE_URL = `${BASE_URL}/about-eppl/library-board/agendas-minutes`

const MONTHS =
  'January|February|March|April|May|June|July|August|September|October|November|December'
const DATE_PATTERN = new RegExp(`(${MONTHS})\\s+\\d{1,2},?\\s+\\d{4}`, 'i')

function absoluteUrl(href: string): string {
  if (href.startsWith('http')) return href
  return `${BASE_URL}${href}`
}

function normalizeVideoUrl(href: string): string {
  try {
    const url = new URL(href)
    // Convert youtu.be/ID → youtube.com/watch?v=ID, drop tracking params
    if (url.hostname === 'youtu.be') {
      const videoId = url.pathname.slice(1)
      return `https://www.youtube.com/watch?v=${videoId}`
    }
    // Convert embed URLs: youtube.com/embed/ID → youtube.com/watch?v=ID
    if (url.hostname.includes('youtube.com') && url.pathname.startsWith('/embed/')) {
      const videoId = url.pathname.replace('/embed/', '')
      return `https://www.youtube.com/watch?v=${videoId}`
    }
    // For other youtube.com links, strip the si= tracking parameter
    if (url.hostname.includes('youtube.com')) {
      url.searchParams.delete('si')
      return url.toString()
    }
  } catch {
    // not a valid URL, return as-is
  }
  return href
}

export async function scrapeMeetings(): Promise<Meeting[]> {
  const res = await fetch(SOURCE_URL, {
    headers: {
      'User-Agent': 'ep-transparency/1.0',
    },
    next: { revalidate: 300 }, // cache for 5 minutes
  })
  if (!res.ok) throw new Error(`Failed to fetch source page: ${res.status}`)

  const html = await res.text()
  const $ = cheerio.load(html)

  const meetingMap = new Map<string, Meeting>()

  // Strategy: find every <a> linking to a PDF or video, then walk up the DOM
  // tree to find the associated meeting date in surrounding text.
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    const linkText = $(el).text().trim().toLowerCase()

    const isPdf = href.toLowerCase().includes('.pdf')
    const isVideo =
      href.includes('youtu') ||
      href.includes('youtube') ||
      href.includes('facebook.com')

    if (!isPdf && !isVideo) return

    // Walk up to 5 ancestor elements looking for a date string
    let dateText = ''
    let current = $(el).parent()
    for (let i = 0; i < 5; i++) {
      // Get text of this element minus its children's text (just own text nodes)
      const ownText = current
        .clone()
        .find('a')
        .remove()
        .end()
        .text()
        .replace(/\s+/g, ' ')
        .trim()

      const match = ownText.match(DATE_PATTERN)
      if (match) {
        dateText = match[0].replace(/,\s*/, ' ').trim()
        break
      }
      current = current.parent()
    }

    if (!dateText) return

    const fullHref = absoluteUrl(href)

    if (!meetingMap.has(dateText)) {
      const parsed = new Date(dateText)
      meetingMap.set(dateText, {
        date: dateText,
        parsedDate: isNaN(parsed.getTime())
          ? ''
          : parsed.toISOString().split('T')[0],
        year: isNaN(parsed.getTime()) ? 0 : parsed.getFullYear(),
      })
    }

    const meeting = meetingMap.get(dateText)!

    if (linkText.includes('agenda')) {
      meeting.agendaUrl = fullHref
    } else if (linkText.includes('minutes')) {
      meeting.minutesUrl = fullHref
    } else if (isVideo) {
      meeting.videoUrl ??= normalizeVideoUrl(fullHref)
    } else if (linkText.includes('director')) {
      meeting.directorLetterUrl = fullHref
    }
  })

  return Array.from(meetingMap.values())
    .filter((m) => m.year > 0)
    .sort((a, b) => b.parsedDate.localeCompare(a.parsedDate))
}

// ─── Village of Elmwood Park Board Meetings (Granicus RSS) ───────────────────

const GRANICUS_BASE = 'https://elmwoodpark.granicus.com'
const GRANICUS_AGENDA_RSS = `${GRANICUS_BASE}/ViewPublisherRSS.php?view_id=2&mode=agendas`
const GRANICUS_MINUTES_RSS = `${GRANICUS_BASE}/ViewPublisherRSS.php?view_id=2&mode=minutes`

export async function scrapeVillageMeetings(): Promise<Meeting[]> {
  const meetingMap = new Map<string, Meeting>()

  // Fetch both RSS feeds in parallel
  const [agendasXml, minutesXml] = await Promise.all([
    fetch(GRANICUS_AGENDA_RSS, {
      headers: { 'User-Agent': 'ep-transparency/1.0' },
      next: { revalidate: 300 },
    })
      .then((r) => (r.ok ? r.text() : ''))
      .catch(() => ''),
    fetch(GRANICUS_MINUTES_RSS, {
      headers: { 'User-Agent': 'ep-transparency/1.0' },
      next: { revalidate: 300 },
    })
      .then((r) => (r.ok ? r.text() : ''))
      .catch(() => ''),
  ])

  function parseItems(xml: string, urlField: 'agendaUrl' | 'minutesUrl') {
    if (!xml) return
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let match: RegExpExecArray | null
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1]

      const titleMatch = block.match(/<title>(.*?)<\/title>/)
      const linkMatch = block.match(/<link>(.*?)<\/link>/) ?? block.match(/<guid[^>]*>(.*?)<\/guid>/)
      const pubDateMatch = block.match(/<pubDate>(.*?)<\/pubDate>/)

      if (!titleMatch || !pubDateMatch) continue

      const pubDate = new Date(pubDateMatch[1])
      if (isNaN(pubDate.getTime())) continue

      const parsedDate = pubDate.toISOString().split('T')[0]
      const title = titleMatch[1].replace(/<[^>]+>/g, '').trim()

      // Extract clip_id from the link to build viewer URL
      const rawLink = linkMatch?.[1] ?? ''
      const clipMatch = rawLink.match(/clip_id=(\d+)/)

      if (!meetingMap.has(parsedDate)) {
        meetingMap.set(parsedDate, {
          date: title,
          parsedDate,
          year: pubDate.getFullYear(),
          meetingType: 'Regular Meeting',
        })
      }

      const meeting = meetingMap.get(parsedDate)!

      if (clipMatch) {
        const clipId = clipMatch[1]
        if (urlField === 'agendaUrl') {
          meeting.agendaUrl = `${GRANICUS_BASE}/AgendaViewer.php?view_id=2&clip_id=${clipId}`
          meeting.videoUrl ??= `${GRANICUS_BASE}/MediaPlayer.php?view_id=2&clip_id=${clipId}`
        } else {
          meeting.minutesUrl = `${GRANICUS_BASE}/MinutesViewer.php?view_id=2&clip_id=${clipId}`
        }
      }
    }
  }

  parseItems(agendasXml, 'agendaUrl')
  parseItems(minutesXml, 'minutesUrl')

  return Array.from(meetingMap.values())
    .filter((m) => m.year >= 2020)
    .sort((a, b) => b.parsedDate.localeCompare(a.parsedDate))
}
