import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { MeetingExtraction, MotionRecord, MotionVote, TrusteeRecord, BoardRoster } from '@/types'
import {
  getMeetingExtraction,
  saveMeetingExtraction,
  getRoster,
  saveRoster,
  getMeetingExtractionDates,
  getAllMeetingExtractions,
} from '@/lib/trusteeFileStorage'
import {
  matchName,
  updateCurrentTrustees,
  extractRole,
  sortTrustees,
  stripTitles,
} from '@/lib/trusteeRoster'

const client = new Anthropic()

// ── Claude schema returned by the extraction prompt ───────────────────────────

interface RawRollCall {
  present: string[]
  remote: string[]
  absent: string[]
}

interface RawMotion {
  order: number
  description: string
  outcome: 'passed' | 'failed' | 'tabled' | 'unknown'
  voteType: 'roll_call' | 'voice'
  isConsentAgenda: boolean
  mover: string | null
  seconder: string | null
  votes: { [rawName: string]: string }
}

interface RawExtraction {
  rollCall: RawRollCall
  motions: RawMotion[]
}

// ── GET — return cached extraction ───────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const village = searchParams.get('village') ?? 'elmwood-park-il'
  const board = searchParams.get('board') ?? 'library-board'
  const date = searchParams.get('date')

  if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 })

  const cached = await getMeetingExtraction(village, board, date)
  if (!cached) return NextResponse.json({ cached: false }, { status: 404 })

  return NextResponse.json(cached)
}

// ── POST — run extraction ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    minutesUrl,
    meetingDate,
    meetingDateLabel,
    village = 'elmwood-park-il',
    board = 'library-board',
    force = false,
  } = body as {
    minutesUrl: string
    meetingDate: string
    meetingDateLabel: string
    village?: string
    board?: string
    force?: boolean
  }

  if (!minutesUrl || typeof minutesUrl !== 'string') {
    return NextResponse.json({ error: 'Missing minutesUrl' }, { status: 400 })
  }
  if (!meetingDate || !meetingDateLabel) {
    return NextResponse.json({ error: 'Missing meetingDate or meetingDateLabel' }, { status: 400 })
  }

  // Return cached unless forced
  if (!force) {
    const cached = await getMeetingExtraction(village, board, meetingDate)
    if (cached) return NextResponse.json({ ...cached, fromCache: true })
  }

  // ── Resolve BoardBook viewer → actual PDF ─────────────────────────────────
  let resolvedUrl = minutesUrl
  if (minutesUrl.includes('meetings.boardbook.org/Public/Minutes/')) {
    try {
      const htmlRes = await fetch(minutesUrl, {
        headers: { 'User-Agent': 'village-hall-record/1.0' },
      })
      if (!htmlRes.ok) throw new Error(`HTTP ${htmlRes.status}`)
      const html = await htmlRes.text()
      const docIdMatch = html.match(/id="NewDocumentViewerDocumentID"[^>]*value="(\d+)"/)
      if (!docIdMatch) throw new Error('Could not find document ID in BoardBook viewer page.')
      const docId = docIdMatch[1]
      const orgMatch = new URL(minutesUrl).pathname.match(/\/(\d+)(?:\/|$)/)
      const orgId = orgMatch ? orgMatch[1] : ''
      resolvedUrl = `https://meetings.boardbook.org/Documents/DownloadPDF/${docId}?org=${orgId}`
    } catch (err) {
      console.error('Failed to resolve BoardBook PDF URL:', err)
      return NextResponse.json(
        { error: 'Could not retrieve the minutes PDF. It may no longer be available.' },
        { status: 502 },
      )
    }
  }

  // ── Fetch PDF ─────────────────────────────────────────────────────────────
  let pdfBuffer: Buffer
  try {
    const res = await fetch(resolvedUrl, { headers: { 'User-Agent': 'ep-transparency/1.0' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    pdfBuffer = Buffer.from(await res.arrayBuffer())
  } catch (err) {
    console.error('Failed to fetch PDF:', err)
    return NextResponse.json(
      { error: 'Could not retrieve the minutes PDF. It may no longer be available.' },
      { status: 502 },
    )
  }

  const base64Pdf = pdfBuffer.toString('base64')

  // ── Call Claude ───────────────────────────────────────────────────────────
  const prompt = `You are extracting structured data from public board meeting minutes.

Return ONLY a valid JSON object — no markdown, no explanation. Use this exact schema:

{
  "rollCall": {
    "present": ["name exactly as written, including title if given, e.g. 'President Pesko', 'Trustee Balundis'"],
    "remote": ["same format — only if the minutes explicitly note remote/virtual attendance"],
    "absent": ["same format"]
  },
  "motions": [
    {
      "order": 1,
      "description": "one-sentence plain-English description of what was voted on",
      "outcome": "passed",
      "voteType": "roll_call",
      "isConsentAgenda": false,
      "mover": "name exactly as written, or null",
      "seconder": "name exactly as written, or null",
      "votes": {
        "name exactly as written": "yes"
      }
    }
  ]
}

Rules:
- outcome must be one of: "passed", "failed", "tabled", "unknown"
- voteType: "roll_call" if individual votes are recorded by name; "voice" if minutes say "all in favor", "unanimous", or no names are listed
- For voice votes, set votes to {}
- For roll-call votes, include every board member's vote
- vote values must be: "yes", "no", "abstain", or "absent"
- isConsentAgenda: true only if the minutes explicitly use the phrase "consent agenda"
- Skip motions to adjourn entirely
- If no roll call is recorded in these minutes, return rollCall with all three arrays empty
- Use names exactly as written in the minutes — do not normalize or abbreviate
- Do not invent or guess any data`

  let raw: RawExtraction
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64Pdf },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    raw = JSON.parse(text) as RawExtraction
  } catch (err) {
    console.error('Claude extraction error:', err)
    return NextResponse.json({ error: 'Could not extract data. Please try again.' }, { status: 500 })
  }

  if (!raw.rollCall || !Array.isArray(raw.motions)) {
    return NextResponse.json({ error: 'Claude returned unexpected data structure.' }, { status: 500 })
  }

  // ── Load roster + previous extractions ───────────────────────────────────
  const existingRoster = await getRoster(village, board)
  const trustees: TrusteeRecord[] = existingRoster?.trustees ? [...existingRoster.trustees] : []

  const log: {
    newTrustees: string[]
    mergedAliases: { trustee: string; addedAlias: string }[]
    downgradedMotions: { order: number; reason: string }[]
    notAvailableReason?: string
  } = { newTrustees: [], mergedAliases: [], downgradedMotions: [] }

  // ── Build roll call with trustee IDs ─────────────────────────────────────
  const rollCallIds = { present: [] as string[], remote: [] as string[], absent: [] as string[] }

  for (const [key, rawNames] of Object.entries(raw.rollCall) as [
    keyof typeof rollCallIds,
    string[],
  ][]) {
    for (const rawName of rawNames) {
      if (!rawName.trim()) continue
      const result = matchName(rawName, trustees, meetingDate)
      rollCallIds[key].push(result.id)
      if (result.isNew) log.newTrustees.push(result.id)
      if (result.wasMerge) log.mergedAliases.push({ trustee: result.id, addedAlias: rawName })

      // Update lastSeenDate and role
      const t = trustees.find((x) => x.id === result.id)!
      if (t.lastSeenDate < meetingDate) t.lastSeenDate = meetingDate
      const role = extractRole(rawName)
      if (role !== 'Trustee') t.role = role
    }
  }

  // ── Check roll call size change ───────────────────────────────────────────
  const totalRollCall =
    rollCallIds.present.length + rollCallIds.remote.length + rollCallIds.absent.length

  let status: 'ok' | 'not_available' = 'ok'
  let reason: string | undefined

  if (totalRollCall > 0) {
    const prevDates = await getMeetingExtractionDates(village, board)
    const prevDate = prevDates.filter((d) => d < meetingDate).pop()
    if (prevDate) {
      const prevExtraction = await getMeetingExtraction(village, board, prevDate)
      if (prevExtraction && prevExtraction.status === 'ok') {
        const prevTotal =
          prevExtraction.rollCall.present.length +
          prevExtraction.rollCall.remote.length +
          prevExtraction.rollCall.absent.length
        // Only check the delta if the previous meeting actually recorded a roll call.
        // prevTotal === 0 means no roll call was captured, not that the board had 0 members.
        if (prevTotal > 0 && Math.abs(totalRollCall - prevTotal) > 2) {
          status = 'not_available'
          reason = `Roll call size changed from ${prevTotal} to ${totalRollCall} — too large a change to process automatically.`
          log.notAvailableReason = reason
          console.warn(`[trustees/extract] ${village}/${board}/${meetingDate}: ${reason}`)
        }
      }
    }
  }

  // ── Build and validate motions ────────────────────────────────────────────
  const rollCallSet = new Set([
    ...rollCallIds.present,
    ...rollCallIds.remote,
    ...rollCallIds.absent,
  ])

  const motions: MotionRecord[] = raw.motions.map((rm) => {
    const mover = rm.mover ? matchName(rm.mover, trustees, meetingDate).id : null
    const seconder = rm.seconder ? matchName(rm.seconder, trustees, meetingDate).id : null

    if (rm.voteType !== 'roll_call' || Object.keys(rm.votes).length === 0) {
      return {
        order: rm.order,
        description: rm.description,
        outcome: rm.outcome,
        voteType: 'voice',
        isConsentAgenda: rm.isConsentAgenda,
        mover,
        seconder,
        votes: {},
      }
    }

    // Map raw vote names → trustee IDs, validate
    const votes: { [id: string]: MotionVote } = {}
    let invalidVoter = false

    for (const [rawVoterName, rawVote] of Object.entries(rm.votes)) {
      const result = matchName(rawVoterName, trustees, meetingDate)
      if (!rollCallSet.has(result.id)) {
        invalidVoter = true
        log.downgradedMotions.push({
          order: rm.order,
          reason: `Voter "${rawVoterName}" (→ ${result.id}) not in roll call`,
        })
        break
      }
      const voteValue = ['yes', 'no', 'abstain', 'absent'].includes(rawVote.toLowerCase())
        ? (rawVote.toLowerCase() as MotionVote)
        : 'abstain'
      votes[result.id] = voteValue
    }

    if (invalidVoter) {
      return {
        order: rm.order,
        description: rm.description,
        outcome: rm.outcome,
        voteType: 'voice' as const,
        isConsentAgenda: rm.isConsentAgenda,
        mover,
        seconder,
        votes: {},
      }
    }

    // Check count: yes+no+abstain+absent must equal total roll call
    const voteTotal = Object.values(votes).length
    if (totalRollCall > 0 && voteTotal !== totalRollCall) {
      log.downgradedMotions.push({
        order: rm.order,
        reason: `Vote count ${voteTotal} ≠ roll call size ${totalRollCall}`,
      })
      return {
        order: rm.order,
        description: rm.description,
        outcome: rm.outcome,
        voteType: 'voice' as const,
        isConsentAgenda: rm.isConsentAgenda,
        mover,
        seconder,
        votes: {},
      }
    }

    return {
      order: rm.order,
      description: rm.description,
      outcome: rm.outcome,
      voteType: 'roll_call' as const,
      isConsentAgenda: rm.isConsentAgenda,
      mover,
      seconder,
      votes,
    }
  })

  // ── Build extraction ──────────────────────────────────────────────────────
  const extraction: MeetingExtraction = {
    meetingDate,
    meetingDateLabel,
    status,
    reason,
    extractedAt: new Date().toISOString(),
    hiddenByAdmin: false,
    rollCall: rollCallIds,
    motions,
  }

  // ── Update isCurrent on roster ────────────────────────────────────────────
  // Load all past extractions + this new one to determine who is current
  const allPastExtractions = await getAllMeetingExtractions(village, board)
  const allExtractions = [
    ...allPastExtractions.filter((e) => e.meetingDate !== meetingDate),
    extraction,
  ]
  updateCurrentTrustees(trustees, allExtractions)

  // ── Save ──────────────────────────────────────────────────────────────────
  const updatedRoster: BoardRoster = {
    village,
    board,
    trustees: sortTrustees(trustees),
    lastUpdated: new Date().toISOString(),
  }

  try {
    await saveMeetingExtraction(village, board, extraction)
  } catch (err) {
    console.error('Failed to save extraction:', err)
  }
  try {
    await saveRoster(updatedRoster)
  } catch (err) {
    console.error('Failed to save roster:', err)
  }

  return NextResponse.json({ ...extraction, fromCache: false, log })
}
