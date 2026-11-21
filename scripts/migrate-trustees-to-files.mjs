/**
 * One-time migration: download all trustee data from the production API
 * (which reads from Vercel Blob) and save to data/trustees/ files.
 *
 * Run BEFORE deploying the file-storage changes so production still
 * has the old Blob-reading code.
 *
 * Usage:
 *   node scripts/migrate-trustees-to-files.mjs
 */

import { list } from '@vercel/blob'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN
const BASE_URL = process.env.EXTRACT_BASE_URL ?? 'https://villagehallrecord.org'

if (!TOKEN) {
  console.error('Missing BLOB_READ_WRITE_TOKEN')
  process.exit(1)
}

async function fetchApi(path) {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function run() {
  console.log(`Listing blobs under trustees/…  (API: ${BASE_URL})`)
  const { blobs } = await list({ prefix: 'trustees/', limit: 1000 })
  console.log(`Found ${blobs.length} blobs\n`)

  // Collect unique village/board pairs
  const boards = new Set()
  for (const blob of blobs) {
    // e.g. trustees/elmwood-park-il/library-board/meetings/2024-01-08.json
    //  or  trustees/elmwood-park-il/library-board/roster.json
    const parts = blob.pathname.split('/')
    if (parts.length >= 3) boards.add(`${parts[1]}/${parts[2]}`)
  }

  let ok = 0, failed = 0

  for (const boardKey of [...boards].sort()) {
    const [village, board] = boardKey.split('/')
    console.log(`\n  ${boardKey}`)

    // Roster
    const rosterLocalPath = join(__dirname, '..', 'data', 'trustees', village, board, 'roster.json')
    process.stdout.write(`    roster  `)
    try {
      const data = await fetchApi(`/api/trustees?village=${village}&board=${board}`)
      if (!data.trustees?.length) {
        console.log('(empty)')
      } else {
        mkdirSync(dirname(rosterLocalPath), { recursive: true })
        writeFileSync(rosterLocalPath, JSON.stringify(data, null, 2), 'utf-8')
        console.log(`ok  (${data.trustees.length} trustees)`)
        ok++
      }
    } catch (err) {
      console.log(`FAILED — ${err.message}`)
      failed++
    }

    // Individual meeting extractions
    const meetingBlobs = blobs.filter(b =>
      b.pathname.startsWith(`trustees/${village}/${board}/meetings/`)
    )
    for (const blob of meetingBlobs) {
      const date = blob.pathname.split('/').pop().replace('.json', '')
      const localPath = join(__dirname, '..', 'data', blob.pathname)
      process.stdout.write(`    ${date}  `)
      try {
        const data = await fetchApi(
          `/api/trustees/extract?village=${village}&board=${board}&date=${date}`
        )
        if (data.cached === false) {
          console.log('(not found in production cache)')
        } else {
          mkdirSync(dirname(localPath), { recursive: true })
          writeFileSync(localPath, JSON.stringify(data, null, 2), 'utf-8')
          console.log('ok')
          ok++
        }
      } catch (err) {
        console.log(`FAILED — ${err.message}`)
        failed++
      }
    }
  }

  console.log(`\nDone: ${ok} saved, ${failed} failed`)
  if (ok > 0) {
    console.log('\nNext steps:')
    console.log('  git add data/trustees')
    console.log('  git commit -m "add trustee extraction data"')
    console.log('  git push && vercel deploy')
  }
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
