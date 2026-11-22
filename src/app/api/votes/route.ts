import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { MeetingVotes } from '@/types'
import { getBlobVotes, saveBlobVotes } from '@/lib/blobVoteStorage'

const client = new Anthropic()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const village = searchParams.get('village') ?? 'elmwood-park-il'
  const board = searchParams.get('board') ?? 'library-board'
  const date = searchParams.get('date')

  if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 })

  const cached = await getBlobVotes(village, board, date)
  if (!cached) return NextResponse.json({ cached: false }, { status: 404 })

  return NextResponse.json(cached)
}

export async function POST(req: NextRequest) {
  const { minutesUrl, meetingDate, meetingDateLabel, village = 'elmwood-park-il', board = 'library-board' } = await req.json()

  if (!minutesUrl || typeof minutesUrl !== 'string') {
    return NextResponse.json({ error: 'Missing minutesUrl' }, { status: 400 })
  }
  if (!meetingDate || !meetingDateLabel) {
    return NextResponse.json({ error: 'Missing meetingDate or meetingDateLabel' }, { status: 400 })
  }

  // Resolve the actual PDF URL — BoardBook Minutes pages serve an HTML viewer,
  // not a PDF directly. We need to extract the document ID and hit DownloadPDF.
  let resolvedUrl = minutesUrl
  if (minutesUrl.includes('meetings.boardbook.org/Public/Minutes/')) {
    try {
      const htmlRes = await fetch(minutesUrl, { headers: { 'User-Agent': 'village-hall-record/1.0' } })
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
        { status: 502 }
      )
    }
  }

  // Fetch the PDF
  let pdfBuffer: Buffer
  try {
    const res = await fetch(resolvedUrl, { headers: { 'User-Agent': 'ep-transparency/1.0' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    pdfBuffer = Buffer.from(await res.arrayBuffer())
  } catch (err) {
    console.error('Failed to fetch PDF:', err)
    return NextResponse.json(
      { error: 'Could not retrieve the minutes PDF. It may no longer be available.' },
      { status: 502 }
    )
  }

  const base64Pdf = pdfBuffer.toString('base64')

  const prompt = `You are extracting structured vote data from public board meeting minutes.

Return ONLY a valid JSON object — no markdown, no explanation, no surrounding text. The JSON must match this exact schema:

{
  "meetingDate": "${meetingDate}",
  "meetingDateLabel": "${meetingDateLabel}",
  "votes": [
    {
      "motion": "string describing the motion",
      "mover": "Trustee Name or null",
      "seconder": "Trustee Name or null",
      "result": "passed" | "failed" | "tabled" | "unknown",
      "ballots": {
        "Trustee Name": "yes" | "no" | "abstain" | "absent"
      }
    }
  ]
}

Rules:
- Include every motion that had a recorded vote, EXCEPT motions to adjourn — skip those entirely.
- If the minutes show a roll call vote, list each trustee's vote in "ballots".
- If the minutes only show a voice vote with no individual names, leave "ballots" as {}.
- If no individual votes are recorded anywhere in the document, return "votes": [].
- Use the exact trustee names as written in the minutes.
- Do not invent or guess any data.`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Pdf,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''

    let parsed: MeetingVotes
    try {
      parsed = JSON.parse(raw)
    } catch {
      console.error('Claude returned non-JSON:', raw)
      return NextResponse.json(
        { error: 'Claude returned malformed data. Please try again.' },
        { status: 500 }
      )
    }

    if (!Array.isArray(parsed.votes)) {
      return NextResponse.json(
        { error: 'Claude response missing votes array.' },
        { status: 500 }
      )
    }

    try {
      await saveBlobVotes(village, board, meetingDate, parsed)
    } catch (cacheErr) {
      console.error('Failed to cache votes to Blob:', cacheErr)
    }
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('Claude API error:', err)
    return NextResponse.json(
      { error: 'Could not extract votes. Please try again.' },
      { status: 500 }
    )
  }
}
