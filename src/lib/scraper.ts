import * as cheerio from 'cheerio'
import { list } from '@vercel/blob'
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
    next: { revalidate: 43200 }, // cache for 5 minutes
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

// ─── Elmwood Park CUSD 401 School Board Meetings ────────────────────────────

const SCHOOL_BOARD_URL = 'https://www.epcusd401.org/board-of-education/board-meetings'
const SCHOOL_BOARD_PORTAL = 'https://epcusd401.community.diligentoneplatform.com/Portal/'

const ABBR_MONTH_MAP: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
}

// Meeting types to include (exclude executive sessions and facility tours)
const INCLUDED_TYPES = /regular|special|committee of the whole|cow/i

function normalizeSchoolMeetingType(raw: string): string {
  const t = raw.trim()
  if (/cow meeting/i.test(t)) return 'Committee of the Whole'
  if (/committee of the whole/i.test(t)) return 'Committee of the Whole'
  if (/regular meeting/i.test(t)) return 'Regular Meeting'
  if (/special meeting/i.test(t)) return 'Special Meeting'
  return t
}

// Priority order for deduplication when multiple meeting types share a date
function meetingTypePriority(type: string): number {
  if (type === 'Regular Meeting') return 0
  if (type === 'Special Meeting') return 1
  if (type === 'Committee of the Whole') return 2
  return 99
}

type PostInfo = {
  postId: string
  elementId: string
  text: string
  parsedDate: string
  year: number
  meetingType: string
  monthStr: string
  day: string
  yearStr: string
}

async function fetchSchoolPostDocs(
  elementId: string,
  postId: string
): Promise<{ agendaUrl?: string; minutesUrl?: string; videoUrl?: string }> {
  try {
    const res = await fetch(
      `https://www.epcusd401.org/fs/elements/${elementId}?is_popup=true&post_id=${postId}&show_post=true`,
      {
        headers: { 'User-Agent': 'ep-transparency/1.0' },
        next: { revalidate: 43200 },
        signal: AbortSignal.timeout(8000),
      }
    )
    if (!res.ok) return {}
    const html = await res.text()
    const $p = cheerio.load(html)
    const docs: { agendaUrl?: string; minutesUrl?: string; videoUrl?: string } = {}
    $p('a[href*="/fs/resource-manager/view/"]').each((_, el) => {
      const label = $p(el).text().trim().toLowerCase()
      const href = 'https://www.epcusd401.org' + ($p(el).attr('href') ?? '')
      if (label.includes('minute')) docs.minutesUrl = href
      else if (label.includes('agenda')) docs.agendaUrl = href
    })
    $p('a[href*="youtu"]').each((_, el) => {
      docs.videoUrl ??= normalizeVideoUrl($p(el).attr('href') ?? '')
    })
    return docs
  } catch {
    return {}
  }
}

export async function scrapeSchoolMeetings(): Promise<Meeting[]> {
  const res = await fetch(SCHOOL_BOARD_URL, {
    headers: { 'User-Agent': 'ep-transparency/1.0' },
    next: { revalidate: 43200 },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Failed to fetch school board page: ${res.status}`)

  const html = await res.text()
  const $ = cheerio.load(html)

  // Collect all relevant posts: element ID + post ID + parsed date/type
  const posts: PostInfo[] = []

  $('div.fsPostElement[id^="fsEl_"]').each((_, el) => {
    const elementId = ($(el).attr('id') ?? '').replace('fsEl_', '')
    if (!elementId) return

    $(el).find('article[data-post-id]').each((_, article) => {
      const postId = $(article).attr('data-post-id') ?? ''
      const text = $(article).find('a.fsPostLink').text().trim()
      if (!postId || !text) return
      if (/cancel/i.test(text)) return

      const match = text.match(/^(\w+)\.?\s+(\d{1,2}),?\s+(\d{4})\s*\|\s*(.+)$/)
      if (!match) return

      const [, monthStr, day, yearStr, typeRaw] = match
      const monthNum = ABBR_MONTH_MAP[monthStr.toLowerCase()]
      if (!monthNum) return

      const meetingType = normalizeSchoolMeetingType(typeRaw)
      if (!INCLUDED_TYPES.test(meetingType)) return

      const parsedDate = `${yearStr}-${String(monthNum).padStart(2, '0')}-${String(parseInt(day)).padStart(2, '0')}`
      posts.push({ postId, elementId, text, parsedDate, year: parseInt(yearStr), meetingType, monthStr, day, yearStr })
    })
  })

  // Fetch document links for all posts in parallel
  const docResults = await Promise.all(
    posts.map((p) => fetchSchoolPostDocs(p.elementId, p.postId))
  )

  // Merge into meeting map — one entry per date, preferring Regular > Special > COW
  const meetingMap = new Map<string, Meeting>()
  for (let i = 0; i < posts.length; i++) {
    const p = posts[i]
    const docs = docResults[i]
    const existing = meetingMap.get(p.parsedDate)
    if (!existing || meetingTypePriority(p.meetingType) < meetingTypePriority(existing.meetingType ?? '')) {
      meetingMap.set(p.parsedDate, {
        date: `${p.monthStr} ${parseInt(p.day)}, ${p.yearStr}`,
        parsedDate: p.parsedDate,
        year: p.year,
        meetingType: p.meetingType,
        ...docs,
        // Fall back to portal link only if no direct docs found
        portalUrl: (!docs.agendaUrl && !docs.minutesUrl) ? SCHOOL_BOARD_PORTAL : undefined,
      })
    }
  }

  return Array.from(meetingMap.values())
    .filter((m) => m.year >= 2020)
    .sort((a, b) => b.parsedDate.localeCompare(a.parsedDate))
}

// ─── Riverside Village Board Meetings (CivicPlus Agenda Center) ─────────────

const RIVERSIDE_BASE = 'https://www.riverside.il.us'
const RIVERSIDE_AGENDA_CENTER = `${RIVERSIDE_BASE}/AgendaCenter`
const RIVERSIDE_TRUSTEES_CAT_ID = 2 // Board of Trustees

// CivicPlus date format: "Nov 5, 2026  — Posted Nov 3, 2026 10:36 AM"
const CIVICPLUS_DATE_PATTERN = /^(\w{3})\s+(\d{1,2}),\s+(\d{4})/

const ABBR_MONTH_TO_NUM: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

function parseCivicPlusDate(h3Text: string): { parsedDate: string; year: number; displayDate: string } | null {
  const m = h3Text.trim().match(CIVICPLUS_DATE_PATTERN)
  if (!m) return null
  const [, monthAbbr, day, yearStr] = m
  const monthNum = ABBR_MONTH_TO_NUM[monthAbbr.toLowerCase()]
  if (!monthNum) return null
  const parsedDate = `${yearStr}-${String(monthNum).padStart(2, '0')}-${String(parseInt(day)).padStart(2, '0')}`
  return { parsedDate, year: parseInt(yearStr), displayDate: `${monthAbbr} ${parseInt(day)}, ${yearStr}` }
}

/** Fetch one year's meeting HTML from CivicPlus UpdateCategoryList endpoint */
async function fetchCivicPlusYear(catId: number, year: number): Promise<string> {
  try {
    const res = await fetch(`${RIVERSIDE_AGENDA_CENTER}/UpdateCategoryList`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'village-hall-record/1.0',
        Referer: RIVERSIDE_AGENDA_CENTER,
      },
      body: `year=${year}&catID=${catId}`,
      next: { revalidate: 43200 },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return ''
    return res.text()
  } catch {
    return ''
  }
}

/** Parse CivicPlus Agenda Center HTML into Meeting objects */
function parseCivicPlusHtml(html: string, meetingMap: Map<string, Meeting>) {
  if (!html) return
  const $ = cheerio.load(html)

  // Find every agenda/minutes link then walk up to find the associated h3 date
  $('a[href*="/AgendaCenter/ViewFile/"]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    const isAgenda = href.includes('/ViewFile/Agenda/')
    const isMinutes = href.includes('/ViewFile/Minutes/')
    if (!isAgenda && !isMinutes) return

    const fullUrl = `${RIVERSIDE_BASE}${href}`

    // Walk up max 6 ancestors to find an h3 with a date
    let dateInfo: ReturnType<typeof parseCivicPlusDate> | null = null
    let current = $(el).parent()
    for (let i = 0; i < 6; i++) {
      current.find('h3').addBack('h3').each((_, h3) => {
        if (dateInfo) return
        dateInfo = parseCivicPlusDate($(h3).text())
      })
      if (dateInfo) break
      // Also check the h3 as a preceding sibling
      const prevH3 = current.prevAll('h3').first()
      if (prevH3.length) {
        dateInfo = parseCivicPlusDate(prevH3.text())
        if (dateInfo) break
      }
      current = current.parent()
    }

    if (!dateInfo) return
    const { parsedDate, year, displayDate } = dateInfo

    if (!meetingMap.has(parsedDate)) {
      meetingMap.set(parsedDate, {
        date: displayDate,
        parsedDate,
        year,
      })
    }

    const meeting = meetingMap.get(parsedDate)!
    if (isAgenda) meeting.agendaUrl ??= fullUrl
    if (isMinutes) meeting.minutesUrl ??= fullUrl
  })

  // Also pick up YouTube links
  $('a[href*="youtu"]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    let dateInfo: ReturnType<typeof parseCivicPlusDate> | null = null
    let current = $(el).parent()
    for (let i = 0; i < 6; i++) {
      current.find('h3').addBack('h3').each((_, h3) => {
        if (dateInfo) return
        dateInfo = parseCivicPlusDate($(h3).text())
      })
      if (dateInfo) break
      const prevH3 = current.prevAll('h3').first()
      if (prevH3.length) {
        dateInfo = parseCivicPlusDate(prevH3.text())
        if (dateInfo) break
      }
      current = current.parent()
    }
    if (!dateInfo) return
    const { parsedDate } = dateInfo
    if (meetingMap.has(parsedDate)) {
      meetingMap.get(parsedDate)!.videoUrl ??= normalizeVideoUrl(href)
    }
  })
}

export async function scrapeRiversideVillageMeetings(): Promise<Meeting[]> {
  // Fetch main page to get the list of available years for Board of Trustees
  let mainHtml = ''
  try {
    const res = await fetch(RIVERSIDE_AGENDA_CENTER, {
      headers: { 'User-Agent': 'village-hall-record/1.0' },
      next: { revalidate: 43200 },
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) mainHtml = await res.text()
  } catch { /* continue with empty */ }

  // Extract available years from the Board of Trustees section
  const years: number[] = []
  if (mainHtml) {
    const $ = cheerio.load(mainHtml)
    $(`#section${RIVERSIDE_TRUSTEES_CAT_ID} a`).each((_, el) => {
      const onclick = $(el).attr('onclick') ?? $(el).attr('href') ?? ''
      const m = onclick.match(/changeYear\((\d{4}),/)
      if (m) {
        const y = parseInt(m[1])
        if (!years.includes(y)) years.push(y)
      }
    })
  }

  // Always include current and recent years as a fallback
  const currentYear = new Date().getFullYear()
  for (let y = currentYear; y >= 2020; y--) {
    if (!years.includes(y)) years.push(y)
  }
  years.sort((a, b) => b - a)

  const meetingMap = new Map<string, Meeting>()

  // Parse current year from main page — extract only the Board of Trustees section
  if (mainHtml) {
    const $main = cheerio.load(mainHtml)
    const sectionHtml = $main(`#section${RIVERSIDE_TRUSTEES_CAT_ID}`).html() ?? ''
    if (sectionHtml) parseCivicPlusHtml(sectionHtml, meetingMap)
  }

  // Fetch each prior year in parallel (skip current year — already in main page)
  const priorYears = years.filter((y) => y !== currentYear && y >= 2020)
  const yearHtmls = await Promise.all(priorYears.map((y) => fetchCivicPlusYear(RIVERSIDE_TRUSTEES_CAT_ID, y)))
  for (const html of yearHtmls) {
    parseCivicPlusHtml(html, meetingMap)
  }

  return Array.from(meetingMap.values())
    .filter((m) => m.year >= 2020)
    .sort((a, b) => b.parsedDate.localeCompare(a.parsedDate))
}

// ─── Riverside School Board Meetings (BoardBook Premier, District 96) ────────

const BOARDBOOK_BASE = 'https://meetings.boardbook.org'
const RIVERSIDE_D96_ORG_ID = 1668

export async function scrapeRiversideSchoolMeetings(): Promise<Meeting[]> {
  let html = ''
  try {
    const res = await fetch(`${BOARDBOOK_BASE}/Public/Organization/${RIVERSIDE_D96_ORG_ID}`, {
      headers: { 'User-Agent': 'village-hall-record/1.0' },
      next: { revalidate: 43200 },
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) html = await res.text()
  } catch { /* continue */ }

  if (!html) return []

  const $ = cheerio.load(html)
  const meetingMap = new Map<string, Meeting>()

  // Each row has: date+type cell, location cell, links cell
  $('tr').each((_, row) => {
    const cells = $(row).find('td')
    if (cells.length < 2) return

    const firstCell = $(cells[0]).text().trim()
    // Format: "November 11, 2026 at 5:30 PM - SPECIAL BOARD MEETING"
    const dateMatch = firstCell.match(/^(\w+ \d{1,2}, \d{4})/)
    if (!dateMatch) return

    const dateStr = dateMatch[1]
    const parsed = new Date(dateStr)
    if (isNaN(parsed.getTime())) return

    const parsedDate = parsed.toISOString().split('T')[0]
    const year = parsed.getFullYear()
    if (year < 2020) return

    const typeMatch = firstCell.match(/- (.+)$/)
    const meetingType = typeMatch
      ? typeMatch[1].replace(/REGULAR BUSINESS MEETING/i, 'Regular Meeting')
          .replace(/SPECIAL BOARD MEETING/i, 'Special Meeting')
          .replace(/COMMITTEE OF THE WHOLE/i, 'Committee of the Whole')
      : 'Regular Meeting'

    // Skip cancelled meetings
    if (/cancel/i.test(firstCell)) return

    const links: { agendaUrl?: string; minutesUrl?: string } = {}
    $(row).find('a[href*="/Public/Agenda/"]').each((_, a) => {
      const href = $(a).attr('href') ?? ''
      links.agendaUrl ??= `${BOARDBOOK_BASE}${href}`
    })
    $(row).find('a[href*="/Public/Minutes/"]').each((_, a) => {
      const href = $(a).attr('href') ?? ''
      links.minutesUrl ??= `${BOARDBOOK_BASE}${href}`
    })

    if (!meetingMap.has(parsedDate)) {
      meetingMap.set(parsedDate, {
        date: dateStr,
        parsedDate,
        year,
        meetingType,
        ...links,
      })
    } else {
      // Prefer Regular meetings over special ones on same date
      const existing = meetingMap.get(parsedDate)!
      if (!/regular/i.test(existing.meetingType ?? '') && /regular/i.test(meetingType)) {
        meetingMap.set(parsedDate, { date: dateStr, parsedDate, year, meetingType, ...links })
      }
    }
  })

  return Array.from(meetingMap.values())
    .filter((m) => m.year >= 2020)
    .sort((a, b) => b.parsedDate.localeCompare(a.parsedDate))
}

// ─── Riverside Library Board ─────────────────────────────────────────────────
// riversidelibrary.org is Wix (JS-rendered). PDFs are static Wix CDN URLs
// extracted manually from the board-policies page and keyed by year/month.
// Update this list when new minutes are posted.

const RL_BASE = 'https://www.riversidelibrary.org/_files/ugd/'

// Each entry is the PRIMARY (first-part) minutes PDF for that month.
// Months with multiple parts: only the first is linked here.
const RIVERSIDE_LIBRARY_MINUTES: { year: number; month: number; minutesUrl: string }[] = [
  // ── 2026 (July cancelled) ──
  { year: 2026, month: 1,  minutesUrl: `${RL_BASE}7325e5_a82ddca389ba4ceb87e28312e2e25477.pdf` },
  { year: 2026, month: 2,  minutesUrl: `${RL_BASE}7325e5_acbfa7cf32334f538e912b381a926921.pdf` },
  { year: 2026, month: 3,  minutesUrl: `${RL_BASE}7325e5_38acd68df31040be872e05b38a95631b.pdf` },
  { year: 2026, month: 4,  minutesUrl: `${RL_BASE}7325e5_242bb1b1b98f4900b68379542b192e73.pdf` },
  { year: 2026, month: 5,  minutesUrl: `${RL_BASE}7325e5_7708be4bdf2c48d09490ede249f6b647.pdf` },
  { year: 2026, month: 6,  minutesUrl: `${RL_BASE}7325e5_5b96e6aeac3b490eb11c61df55024c51.pdf` },
  { year: 2026, month: 8,  minutesUrl: `${RL_BASE}7325e5_e3c4ed80eb4742308f68edad62c350d3.pdf` },
  { year: 2026, month: 9,  minutesUrl: `${RL_BASE}7325e5_12325bcef42742ab928bd68339582367.pdf` },
  { year: 2026, month: 10, minutesUrl: `${RL_BASE}7325e5_c68c8e00db774fadb6bec47489397806.pdf` },
  { year: 2026, month: 11, minutesUrl: `${RL_BASE}7325e5_be60bf2957ed402ca5946a69ffa5ea6c.pdf` },
  // ── 2025 (January and July not posted) ──
  { year: 2025, month: 2,  minutesUrl: `${RL_BASE}7325e5_f9759297723f4299af67c56d63c5dc8e.pdf` },
  { year: 2025, month: 3,  minutesUrl: `${RL_BASE}7325e5_4ad6fbd117034a73a9e13c94574b15ac.pdf` },
  { year: 2025, month: 4,  minutesUrl: `${RL_BASE}7325e5_6f2667fa076740c6b2e4f3c52dd71983.pdf` },
  { year: 2025, month: 5,  minutesUrl: `${RL_BASE}7325e5_6e7f0ebfb0544e84ab4245d05012be70.pdf` },
  { year: 2025, month: 6,  minutesUrl: `${RL_BASE}7325e5_b1568a220a624122ae21c54914e4edcf.pdf` },
  { year: 2025, month: 8,  minutesUrl: `${RL_BASE}7325e5_895bf30ac1114fb5a717234449dce2fe.pdf` },
  { year: 2025, month: 9,  minutesUrl: `${RL_BASE}7325e5_0ddfaeea706c4e059f3bff5c9ba9c2a7.pdf` },
  { year: 2025, month: 10, minutesUrl: `${RL_BASE}7325e5_fea871e51fc1491eba9ce7337dcfb562.pdf` },
  { year: 2025, month: 11, minutesUrl: `${RL_BASE}7325e5_c4116e0bbfe040a9a0e9663633d5c613.pdf` },
  { year: 2025, month: 12, minutesUrl: `${RL_BASE}7325e5_2652d08894fb416090be6cec442e6881.pdf` },
  // ── 2024 (August not posted) ──
  { year: 2024, month: 1,  minutesUrl: `${RL_BASE}7325e5_7df744bf2f634f9f8fa11fd4a1e17aa1.pdf` },
  { year: 2024, month: 2,  minutesUrl: `${RL_BASE}7325e5_e416dddd3ba24261ae7822971cbb8014.pdf` },
  { year: 2024, month: 3,  minutesUrl: `${RL_BASE}1a9a9c_b52625db28e34229b104ea7c2e2398fe.pdf` },
  { year: 2024, month: 4,  minutesUrl: `${RL_BASE}7325e5_1ae04dd9d54c48cc8e57ce15e3aec846.pdf` },
  { year: 2024, month: 5,  minutesUrl: `${RL_BASE}7325e5_4d87e34ad2dd4151ab521960f2bdadf6.pdf` },
  { year: 2024, month: 6,  minutesUrl: `${RL_BASE}7325e5_110487a89f0b42348ec291145069bd40.pdf` },
  { year: 2024, month: 7,  minutesUrl: `${RL_BASE}7325e5_07b51e2e015d4244abc02a75857c6ab9.pdf` },
  { year: 2024, month: 9,  minutesUrl: `${RL_BASE}7325e5_8dc64e26761a49048550fc81e9a037b3.pdf` },
  { year: 2024, month: 10, minutesUrl: `${RL_BASE}7325e5_01664b00a8ab4bcd98e47ae0d0aeccff.pdf` },
  { year: 2024, month: 11, minutesUrl: `${RL_BASE}7325e5_257a502d333641b18ec8cd218b915af8.pdf` },
  { year: 2024, month: 12, minutesUrl: `${RL_BASE}1a9a9c_a1950ca2626a48739ac71e61890b8f16.pdf` },
]

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

/** Returns the ISO date of the second Tuesday of a given year/month (1-indexed). */
function secondTuesdayOf(year: number, month: number): string {
  const firstDay = new Date(year, month - 1, 1)
  const dow = firstDay.getDay() // 0=Sun … 6=Sat
  const daysToTue = (2 - dow + 7) % 7
  const secondTue = 1 + daysToTue + 7
  return `${year}-${String(month).padStart(2, '0')}-${String(secondTue).padStart(2, '0')}`
}

const RIVERSIDE_LIBRARY_BLOB_KEY = 'riverside-library-minutes.json'

export async function scrapeRiversideLibraryMeetings(): Promise<Meeting[]> {
  // Try Vercel Blob first — kept current by GitHub Actions cron on the 15th
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { blobs } = await list({ prefix: RIVERSIDE_LIBRARY_BLOB_KEY, limit: 1 })
      if (blobs.length > 0) {
        const res = await fetch(blobs[0].url, {
          headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
          cache: 'no-store',
        })
        if (res.ok) {
          const data = (await res.json()) as { year: number; month: number; minutesUrl: string }[]
          if (Array.isArray(data) && data.length > 0) {
            return data
              .map(({ year, month, minutesUrl }) => ({
                date: `${MONTH_NAMES[month - 1]} ${year}`,
                parsedDate: secondTuesdayOf(year, month),
                year,
                minutesUrl,
              }))
              .sort((a, b) => b.parsedDate.localeCompare(a.parsedDate))
          }
        }
      }
    } catch (err) {
      console.error('[scrapeRiversideLibraryMeetings] Blob error:', err)
    }
  }

  // Fall back to hardcoded list
  return RIVERSIDE_LIBRARY_MINUTES.map(({ year, month, minutesUrl }) => ({
    date: `${MONTH_NAMES[month - 1]} ${year}`,
    parsedDate: secondTuesdayOf(year, month),
    year,
    minutesUrl,
  })).sort((a, b) => b.parsedDate.localeCompare(a.parsedDate))
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
        next: { revalidate: 43200 },
        signal: AbortSignal.timeout(8000),
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
  const signal8s = AbortSignal.timeout(8000)
  const [agendasXml, minutesXml, minutesUrls] = await Promise.all([
    fetch(GRANICUS_AGENDA_RSS, {
      headers: { 'User-Agent': 'ep-transparency/1.0' },
      next: { revalidate: 43200 },
      signal: signal8s,
    })
      .then((r) => (r.ok ? r.text() : ''))
      .catch(() => ''),
    fetch(GRANICUS_MINUTES_RSS, {
      headers: { 'User-Agent': 'ep-transparency/1.0' },
      next: { revalidate: 43200 },
      signal: signal8s,
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
