/**
 * Pre-generate and cache all 2026 summaries for both boards.
 * Run with: node scripts/prebuild-summaries.mjs
 */

const BASE_URL = 'https://villagehallrecord.org'

async function fetchMeetings(board) {
  const url = board === 'library' ? `${BASE_URL}/api/meetings` : `${BASE_URL}/api/village-meetings`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${board} meetings: ${res.status}`)
  return res.json()
}

async function generateSummary(pdfUrl, docType, boardType) {
  const res = await fetch(`${BASE_URL}/api/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdfUrl, docType, boardType, structured: true }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data
}

async function run() {
  console.log('Fetching meetings...')
  const [library, village] = await Promise.all([
    fetchMeetings('library'),
    fetchMeetings('village'),
  ])

  const meetings2026 = [
    ...library.filter(m => m.year === 2026).map(m => ({ ...m, boardType: 'library' })),
    ...village.filter(m => m.year === 2026).map(m => ({ ...m, boardType: 'village' })),
  ]

  console.log(`Found ${meetings2026.length} meetings in 2026\n`)

  const sources = [
    { key: 'agenda',   urlField: 'agendaUrl',        label: 'agenda' },
    { key: 'minutes',  urlField: 'minutesUrl',        label: 'minutes' },
    { key: 'director', urlField: 'directorLetterUrl', label: "director's letter" },
  ]

  let done = 0
  let skipped = 0
  let failed = 0

  for (const meeting of meetings2026) {
    for (const source of sources) {
      const url = meeting[source.urlField]
      if (!url) continue

      const label = `${meeting.boardType} / ${meeting.parsedDate} / ${source.label}`
      process.stdout.write(`  ${label}... `)

      try {
        const result = await generateSummary(url, source.key, meeting.boardType)
        if (result.fromCache) {
          console.log('already cached')
          skipped++
        } else {
          console.log('generated ✓')
          done++
        }
      } catch (err) {
        console.log(`FAILED: ${err.message}`)
        failed++
      }
    }
  }

  console.log(`\nDone. Generated: ${done}, Already cached: ${skipped}, Failed: ${failed}`)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
