/**
 * Extract trustee attendance and votes from approved minutes.
 * Processes oldest → newest so the roster builds up correctly.
 * Defaults to 2024-onwards (~150 meetings, ~$15-20 in Claude costs).
 * Subsequent runs skip already-cached meetings.
 *
 * Usage:
 *   node scripts/extract-trustees.mjs                             # all villages, 2024–present
 *   node scripts/extract-trustees.mjs --since 2025               # 2025–present only
 *   node scripts/extract-trustees.mjs --year 2026                # 2026 only (single year)
 *   node scripts/extract-trustees.mjs --year 2026 --force        # re-run 2026 even if cached
 *   node scripts/extract-trustees.mjs --village elmwood-park-il --board library
 *   EXTRACT_BASE_URL=http://localhost:3000 node scripts/extract-trustees.mjs ...
 */

const BASE_URL = process.env.EXTRACT_BASE_URL ?? 'https://villagehallrecord.org'

const ALL_VILLAGES = ['elmwood-park-il', 'riverside-il']

const ALL_BOARDS = [
  { key: 'library', slug: 'library-board' },
  { key: 'village', slug: 'village-board' },
  { key: 'school',  slug: 'school-board'  },
]

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
function getArg(flag) {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : null
}

const filterVillage = getArg('--village')
const filterBoard   = getArg('--board')
const filterYear    = getArg('--year')  ? parseInt(getArg('--year'),  10) : null
const sinceYear     = getArg('--since') ? parseInt(getArg('--since'), 10) : 2024
const forceMode     = args.includes('--force')

const villages = filterVillage ? [filterVillage] : ALL_VILLAGES
const boards   = filterBoard   ? ALL_BOARDS.filter(b => b.key === filterBoard) : ALL_BOARDS

// Year predicate: single year wins; otherwise use since
function inScope(year) {
  if (filterYear !== null) return year === filterYear
  return year >= sinceYear
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchMeetings(village, boardKey) {
  const path =
    boardKey === 'library' ? '/api/meetings' :
    boardKey === 'village' ? '/api/village-meetings' :
                             '/api/school-meetings'
  const res = await fetch(`${BASE_URL}${path}?village=${village}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function extract(village, boardSlug, meeting, force = false) {
  const res = await fetch(`${BASE_URL}/api/trustees/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      minutesUrl:       meeting.minutesUrl,
      meetingDate:      meeting.parsedDate,
      meetingDateLabel: meeting.date,
      village,
      board: boardSlug,
      force,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data
}

async function fetchRoster(village, boardSlug) {
  const res = await fetch(`${BASE_URL}/api/trustees?village=${village}&board=${boardSlug}`)
  return res.json()
}

function hr(char = '─', len = 64) { return char.repeat(len) }

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\nTarget: ${BASE_URL}`)
  console.log(`Range: ${filterYear ? `${filterYear} only` : `${sinceYear}–present`}`)
  if (filterVillage) console.log(`Village filter: ${filterVillage}`)
  if (filterBoard)   console.log(`Board filter: ${filterBoard}`)
  if (forceMode)     console.log(`Mode: FORCE (re-running cached meetings)`)

  let grandTotal = { done: 0, skipped: 0, notAvailable: 0, failed: 0 }

  for (const village of villages) {
    console.log(`\n${hr('═')}\n  ${village}\n${hr('═')}`)

    for (const board of boards) {
      let allMeetings
      try {
        allMeetings = await fetchMeetings(village, board.key)
      } catch (err) {
        console.log(`\n  [${board.slug}] ✗ Could not fetch meetings: ${err.message}`)
        continue
      }

      // Filter to meetings with minutes in scope, sort oldest→newest
      const withMinutes = allMeetings
        .filter(m => m.minutesUrl && inScope(m.year))
        .sort((a, b) => a.parsedDate.localeCompare(b.parsedDate))

      if (withMinutes.length === 0) {
        const range = filterYear ? `in ${filterYear}` : `since ${sinceYear}`
        console.log(`\n  [${board.slug}] No meetings with minutes ${range}`)
        continue
      }

      console.log(`\n  ${hr()}`)
      console.log(`  ${board.slug}  —  ${withMinutes.length} meetings with minutes to process`)
      console.log(`  ${hr()}`)

      let done = 0, skipped = 0, notAvailable = 0, failed = 0
      const mergeLog = []
      const notAvailableLog = []
      const downgradedLog = []

      for (const meeting of withMinutes) {
        process.stdout.write(`  ${meeting.parsedDate}  `)
        try {
          const result = await extract(village, board.slug, meeting, forceMode)

          if (result.fromCache) {
            console.log('(cached)')
            skipped++
            continue
          }

          if (result.status === 'not_available') {
            console.log(`NOT AVAILABLE — ${result.reason ?? 'unknown reason'}`)
            notAvailable++
            notAvailableLog.push({ date: meeting.parsedDate, reason: result.reason })
            continue
          }

          // ok
          const parts = []
          if (result.log?.newTrustees?.length) {
            parts.push(`new: ${result.log.newTrustees.join(', ')}`)
          }
          if (result.log?.mergedAliases?.length) {
            for (const m of result.log.mergedAliases) {
              mergeLog.push({ date: meeting.parsedDate, alias: m.addedAlias, trustee: m.trustee })
            }
            parts.push(`alias-merged: ${result.log.mergedAliases.map(m => m.addedAlias).join(', ')}`)
          }
          if (result.log?.downgradedMotions?.length) {
            for (const d of result.log.downgradedMotions) {
              downgradedLog.push({ date: meeting.parsedDate, ...d })
            }
            parts.push(`⚠ ${result.log.downgradedMotions.length} motion(s) → voice`)
          }
          const rollTotal =
            (result.rollCall?.present?.length ?? 0) +
            (result.rollCall?.remote?.length ?? 0) +
            (result.rollCall?.absent?.length ?? 0)
          parts.push(`roll call: ${rollTotal}`)
          parts.push(`motions: ${result.motions?.length ?? 0}`)

          console.log(`ok  ${parts.join('  ·  ')}`)
          done++
        } catch (err) {
          console.log(`FAILED — ${err.message}`)
          failed++
        }
      }

      grandTotal.done        += done
      grandTotal.skipped     += skipped
      grandTotal.notAvailable += notAvailable
      grandTotal.failed      += failed

      // ── Roster ──────────────────────────────────────────────────────────
      console.log()
      const roster = await fetchRoster(village, board.slug)
      const allTrustees = roster.trustees ?? []
      const current = allTrustees.filter(t => t.isCurrent)
      const former  = allTrustees.filter(t => !t.isCurrent)

      if (allTrustees.length === 0) {
        console.log('  Roster: (empty — no extractions succeeded)')
      } else {
        console.log(`  Roster — ${current.length} current, ${former.length} former`)
        console.log(`  ${'Name'.padEnd(18)} ${'Role'.padEnd(18)} ${'First seen'.padEnd(12)} ${'Last seen'.padEnd(12)} Aliases`)
        console.log(`  ${hr('-', 90)}`)
        for (const t of allTrustees) {
          const mark = t.isCurrent ? '●' : '○'
          const name = (mark + ' ' + t.displayName).padEnd(18)
          const role = t.role.padEnd(18)
          const first = t.firstSeenDate.padEnd(12)
          const last  = t.lastSeenDate.padEnd(12)
          const aliases = t.nameAliases.join(' · ')
          console.log(`  ${name} ${role} ${first} ${last} ${aliases}`)
        }
      }

      // ── Name merges ──────────────────────────────────────────────────────
      if (mergeLog.length) {
        console.log(`\n  Alias merges (verify these are the same person):`)
        for (const m of mergeLog) {
          console.log(`    ${m.date}  "${m.alias}"  →  ${m.trustee}`)
        }
      }

      // ── Not available ────────────────────────────────────────────────────
      if (notAvailableLog.length) {
        console.log(`\n  Not available (excluded from attendance totals):`)
        for (const m of notAvailableLog) {
          console.log(`    ${m.date}  ${m.reason ?? ''}`)
        }
      }

      // ── Downgraded motions ───────────────────────────────────────────────
      if (downgradedLog.length) {
        console.log(`\n  Motions downgraded to voice (shown as "no individual votes"):`)
        for (const d of downgradedLog) {
          console.log(`    ${d.date}  motion #${d.order}  —  ${d.reason}`)
        }
      }

      console.log(`\n  Result: ${done} extracted · ${skipped} cached · ${notAvailable} not_available · ${failed} failed`)
    }
  }

  console.log(`\n${hr('═')}`)
  console.log(`  Grand total: ${grandTotal.done} extracted · ${grandTotal.skipped} cached · ${grandTotal.notAvailable} not_available · ${grandTotal.failed} failed`)
  console.log(hr('═'))
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
