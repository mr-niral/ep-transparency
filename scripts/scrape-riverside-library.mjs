/**
 * Scrape Riverside Public Library board minutes from riversidelibrary.org/board-policies
 * and save to Vercel Blob as riverside-library-minutes.json.
 *
 * Run: BLOB_READ_WRITE_TOKEN=... node scripts/scrape-riverside-library.mjs
 * Scheduled via: .github/workflows/scrape-library-board.yml (15th of each month)
 */

import { chromium } from 'playwright'
import { put, list } from '@vercel/blob'

const PAGE_URL = 'https://www.riversidelibrary.org/board-policies'
const BLOB_KEY = 'riverside-library-minutes.json'
const RL_BASE = 'https://www.riversidelibrary.org/_files/ugd/'

// Seed data: all known minutes through Nov 2026. Used when Blob is empty or scraping fails.
const SEED_DATA = [
  // 2026 (July cancelled)
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
  // 2025 (January and July not posted)
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
  // 2024 (August not posted)
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

async function getExisting() {
  try {
    const { blobs } = await list({ prefix: BLOB_KEY, limit: 1 })
    if (!blobs.length) return null
    const res = await fetch(blobs[0].url, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return await res.json()
  } catch (err) {
    console.error('getExisting error:', err)
    return null
  }
}

async function saveToBlob(data) {
  const blob = await put(BLOB_KEY, JSON.stringify(data), {
    access: 'private',
    addRandomSuffix: false,
  })
  console.log(`Saved ${data.length} entries to Blob: ${blob.url}`)
}

async function scrapeFromPage() {
  console.log('Launching Chromium...')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  // Block heavy assets to speed up page load
  await page.route('**/*.{png,jpg,jpeg,gif,woff,woff2,mp4,webm,svg}', (r) => r.abort())

  console.log('Navigating to', PAGE_URL)
  try {
    await page.goto(PAGE_URL, { waitUntil: 'networkidle', timeout: 45000 })
  } catch {
    // networkidle can time out on Wix sites — proceed anyway
    console.warn('networkidle timed out, proceeding')
  }

  // Scroll to bottom and back to trigger lazy-loaded content
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(2000)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(1000)

  // Try to expand any collapsed sections (Wix accordion / collapsibles)
  const collapsed = page.locator('[aria-expanded="false"]')
  const collapseCount = await collapsed.count()
  for (let i = 0; i < collapseCount; i++) {
    try { await collapsed.nth(i).click({ timeout: 1000 }) } catch { /* ignore */ }
  }
  if (collapseCount > 0) await page.waitForTimeout(1000)

  // Walk DOM in document order: track currentYear/currentMonth, collect PDF links
  const entries = await page.evaluate(() => {
    const MONTHS = {
      january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
      july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    }

    const result = []
    const seen = new Set()
    let currentYear = null
    let currentMonth = null

    for (const el of document.querySelectorAll('*')) {
      // Check only the element's own direct text nodes (not descendants)
      const ownText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim())
        .join(' ')
        .trim()

      if (ownText) {
        // Year: exactly a 4-digit year in the 2020s
        if (/^(202\d)$/.test(ownText)) {
          currentYear = parseInt(ownText, 10)
          currentMonth = null
        }
        // Month: exactly a month name
        const monthNum = MONTHS[ownText.toLowerCase()]
        if (monthNum) {
          currentMonth = monthNum
        }
      }

      // PDF link: /_files/ugd/ path, .pdf extension
      if (el.tagName === 'A' && currentYear && currentMonth) {
        const href = el.getAttribute('href') || ''
        if (href.includes('/_files/ugd/') && href.includes('.pdf')) {
          const key = `${currentYear}-${currentMonth}`
          if (!seen.has(key)) {
            seen.add(key)
            const url = href.startsWith('http')
              ? href
              : `https://www.riversidelibrary.org${href}`
            result.push({ year: currentYear, month: currentMonth, minutesUrl: url })
          }
        }
      }
    }

    return result
  })

  await browser.close()
  console.log(`Scraped ${entries.length} entries from page`)
  return entries
}

function mergeData(existing, scraped) {
  const map = new Map()

  // Start from seed, overlay existing Blob data, then overlay fresh scrape
  for (const e of SEED_DATA) map.set(`${e.year}-${e.month}`, e)
  if (existing) {
    for (const e of existing) {
      if (e.year && e.month && e.minutesUrl) map.set(`${e.year}-${e.month}`, e)
    }
  }
  for (const e of scraped) map.set(`${e.year}-${e.month}`, e)

  return Array.from(map.values()).sort((a, b) =>
    a.year !== b.year ? b.year - a.year : b.month - a.month
  )
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN is required')
    process.exit(1)
  }

  const existing = await getExisting()
  console.log(`Existing Blob entries: ${existing?.length ?? 0}`)

  let scraped = []
  try {
    scraped = await scrapeFromPage()
  } catch (err) {
    console.error('Scraping error:', err)
    if (!existing) {
      console.log('No existing Blob data — seeding with hardcoded entries')
      await saveToBlob(SEED_DATA)
    }
    process.exit(0)
  }

  const merged = mergeData(existing, scraped)
  const newCount = merged.length - (existing?.length ?? 0)
  console.log(`Merged: ${merged.length} entries (${newCount >= 0 ? '+' : ''}${newCount} new)`)

  await saveToBlob(merged)
  console.log('Done.')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
