/**
 * Pre-generate and cache AI summaries for all villages and boards.
 * Run with: node scripts/prebuild-summaries.mjs
 */

const BASE_URL = 'https://villagehallrecord.org'

const VILLAGES = ['elmwood-park-il', 'riverside-il']

async function fetchMeetings(village, board) {
  const url =
    board === 'library'
      ? `${BASE_URL}/api/meetings?village=${village}`
      : board === 'village'
        ? `${BASE_URL}/api/village-meetings?village=${village}`
        : `${BASE_URL}/api/school-meetings?village=${village}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${village}/${board} meetings: ${res.status}`)
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
  const currentYear = new Date().getFullYear()
  console.log(`Fetching meetings for year ${currentYear}...\n`)

  const sources = [
    { key: 'agenda',   urlField: 'agendaUrl',        label: 'agenda' },
    { key: 'minutes',  urlField: 'minutesUrl',        label: 'minutes' },
    { key: 'director', urlField: 'directorLetterUrl', label: "director's letter" },
  ]

  let done = 0
  let skipped = 0
  let failed = 0

  for (const village of VILLAGES) {
    console.log(`── ${village} ──`)

    let library = [], village_meetings = [], school = []
    try {
      ;[library, village_meetings, school] = await Promise.all([
        fetchMeetings(village, 'library'),
        fetchMeetings(village, 'village'),
        fetchMeetings(village, 'school'),
      ])
    } catch (err) {
      console.error(`  Failed to fetch meetings for ${village}:`, err.message)
      continue
    }

    const meetings = [
      ...library.filter(m => m.year === currentYear).map(m => ({ ...m, boardType: 'library' })),
      ...village_meetings.filter(m => m.year === currentYear).map(m => ({ ...m, boardType: 'village' })),
      ...school.filter(m => m.year === currentYear).map(m => ({ ...m, boardType: 'school' })),
    ]

    console.log(`  ${meetings.length} meetings in ${currentYear}`)

    for (const meeting of meetings) {
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
          } else if (result.cacheError) {
            console.log(`generated but cache FAILED: ${result.cacheError}`)
            done++
          } else {
            console.log('generated + cached ✓')
            done++
          }
        } catch (err) {
          console.log(`FAILED: ${err.message}`)
          failed++
        }
      }
    }

    console.log()
  }

  console.log(`Done. Generated: ${done}, Already cached: ${skipped}, Failed: ${failed}`)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
