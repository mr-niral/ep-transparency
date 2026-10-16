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

const VILLAGE_BASE = 'https://www.elmwoodpark.org'
// Pages listing village board meeting minutes PDFs (add new year pages as they appear)
const VILLAGE_MINUTES_PAGES = [
  `${VILLAGE_BASE}/314/Board-Meeting-Minutes-2025`,
  `${VILLAGE_BASE}/315/Board-Meeting-Minutes-2026`,
]

/** Scrape village website minutes pages and return a map of parsedDate → PDF URL.
 *  Prefers "Regular Meeting" minutes when multiple documents share the same date. */
async function scrapeVillageMinutesUrls(): Promise<Map<string, string>> {
  const result = new Map<string, string>()

  for (const pageUrl of VILLAGE_MINUTES_PAGES) {
    let html: string
    try {
      const res = await fetch(pageUrl, {
        headers: { 'User-Agent': 'ep-transparency/1.0' },
        next: { revalidate: 300 },
      })
      if (!res.ok) continue
      html = await res.text()
    } catch {
      continue
    }

    const $ = cheerio.load(html)

    $('a[href*="/DocumentCenter/View/"]').each((_, el) => {
      const href = $(el).attr('href') ?? ''
      const linkText = $(el).text().trim()
      const isRegular = !/special|budget|hearing|pzd/i.test(linkText)

      // Check link text first, then walk up the DOM for a date
      let dateStr = ''
      const linkDateMatch = linkText.match(DATE_PATTERN)
      if (linkDateMatch) {
        dateStr = linkDateMatch[0].trim()
      } else {
        let current = $(el).parent()
        for (let i = 0; i < 6; i++) {
          const text = current.text().replace(/\s+/g, ' ').trim()
          const match = text.match(DATE_PATTERN)
          if (match) {
            dateStr = match[0].trim()
            break
          }
          current = current.parent()
        }
      }

      if (!dateStr) return

      // Parse date manually to avoid timezone issues
      const m = dateStr.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/)
      if (!m) return
      const monthIdx = [
        'january','february','march','april','may','june',
        'july','august','september','october','november','december',
      ].indexOf(m[1].toLowerCase())
      if (monthIdx === -1) return
      const parsedDate = `${m[3]}-${String(monthIdx + 1).padStart(2, '0')}-${String(parseInt(m[2])).padStart(2, '0')}`

      const fullUrl = href.startsWith('http') ? href : `${VILLAGE_BASE}${href}`

      // Set if not set yet, or overwrite with a regular meeting URL
      if (!result.has(parsedDate) || isRegular) {
        result.set(parsedDate, fullUrl)
      }
    })
  }

  return result
}

export async function scrapeVillageMeetings(): Promise<Meeting[]> {
  const meetingMap = new Map<string, Meeting>()

  // Fetch Granicus RSS feeds and village minutes pages in parallel
  const [agendasXml, minutesXml, minutesUrls] = await Promise.all([
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
    scrapeVillageMinutesUrls(),
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

  // Merge minutes from village website (Granicus minutes RSS is empty)
  for (const [parsedDate, minutesUrl] of minutesUrls) {
    if (meetingMap.has(parsedDate)) {
      meetingMap.get(parsedDate)!.minutesUrl ??= minutesUrl
    }
  }

  return Array.from(meetingMap.values())
    .filter((m) => m.year >= 2020)
    .sort((a, b) => b.parsedDate.localeCompare(a.parsedDate))
}
