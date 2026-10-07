import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { MeetingVotes } from '@/types'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const { minutesUrl, meetingDate, meetingDateLabel } = await req.json()

  if (!minutesUrl || typeof minutesUrl !== 'string') {
    return NextResponse.json({ error: 'Missing minutesUrl' }, { status: 400 })
  }
  if (!meetingDate || !meetingDateLabel) {
    return NextResponse.json({ error: 'Missing meetingDate or meetingDateLabel' }, { status: 400 })
  }

  // Fetch the PDF
  let pdfBuffer: Buffer
  try {
    const res = await fetch(minutesUrl)
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

  const prompt = `You are extracting structured vote data from public library board meeting minutes.

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
- Include every motion that had a recorded vote.
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

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('Claude API error:', err)
    return NextResponse.json(
      { error: 'Could not extract votes. Please try again.' },
      { status: 500 }
    )
  }
}
