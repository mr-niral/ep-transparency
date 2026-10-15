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

// ─── Village of Elmwood Park Board Meetings ───────────────────────────────────

const VILLAGE_BASE = 'https://elmwoodpark.org'
const VILLAGE_MINUTES_PAGES = [
  `${VILLAGE_BASE}/315/Board-Meeting-Minutes-2026`,
  `${VILLAGE_BASE}/314/Board-Meeting-Minutes-2025`,
]

async function resolveDocumentCenterUrl(href: string): Promise<string> {
  const url = href.startsWith('http') ? href : `${VILLAGE_BASE}${href}`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'ep-transparency/1.0' } })
    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('application/pdf')) {
      return res.url.split('?')[0] // use final redirected URL, strip ?bidId=
    }
  } catch {}
  return url
}

export async function scrapeVillageMeetings(): Promise<Meeting[]> {
  const allMeetings: Meeting[] = []

  for (const pageUrl of VILLAGE_MINUTES_PAGES) {
    const res = await fetch(pageUrl, {
      headers: { 'User-Agent': 'ep-transparency/1.0' },
      next: { revalidate: 300 },
    })
    if (!res.ok) continue

    const html = await res.text()
    const $ = cheerio.load(html)

    const rows = $('table tr').toArray().slice(1) // skip header row
    const resolvePromises = rows.map(async (row) => {
      const cells = $(row).find('td')
      if (cells.length < 2) return null

      const dateText = $(cells[0]).text().trim()
      if (!dateText) return null

      const parsed = new Date(dateText)
      if (isNaN(parsed.getTime())) return null

      const meetingType = $(cells[1]).text().trim().replace(/\s+/g, ' ') || undefined
      const minutesAnchor = $(cells[2]).find('a[href]').first()
      const minutesHref = minutesAnchor.attr('href')

      let minutesUrl: string | undefined
      if (minutesHref) {
        minutesUrl = await resolveDocumentCenterUrl(minutesHref)
      }

      return {
        date: dateText,
        parsedDate: parsed.toISOString().split('T')[0],
        year: parsed.getFullYear(),
        meetingType,
        minutesUrl,
      } as Meeting
    })

    const resolved = await Promise.all(resolvePromises)
    for (const m of resolved) {
      if (m) allMeetings.push(m)
    }
  }

  return allMeetings.sort((a, b) => b.parsedDate.localeCompare(a.parsedDate))
}
