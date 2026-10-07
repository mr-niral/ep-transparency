import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { FinancialSnapshot } from '@/types'

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

  const prompt = `You are extracting structured financial data from public library board meeting minutes.

Return ONLY a valid JSON object — no markdown, no explanation, no surrounding text. The JSON must match this exact schema:

{
  "meetingDate": "${meetingDate}",
  "meetingDateLabel": "${meetingDateLabel}",
  "cashBalances": {
    "generalFund": number or null,
    "buildingFund": number or null,
    "giftFund": number or null,
    "reserveAccount": number or null,
    "total": number or null
  },
  "ytdExpenditures": number or null,
  "fiscalYear": "YYYY-YY" or null,
  "notableItems": [
    {
      "amount": number,
      "description": "string describing the item",
      "type": "grant" | "purchase" | "advance" | "donation" | "other"
    }
  ]
}

Rules:
- Look for a treasurer's report or financial report section.
- Extract cash balances for: General Fund (Checking), Building Fund, Gift Fund, Reserve Account, and Total Cash on Hand.
- All dollar amounts should be numbers (no $ signs, no commas). E.g. "$210,480.00" → 210480.
- For ytdExpenditures, look for "YTD Expenditures", "Expenditures to Date", or similar. Extract the number.
- For fiscalYear, look for the fiscal year period (e.g. "FY 2026-27") and return it as "2026-27". Return null if not found.
- For notableItems, include significant one-time dollar amounts mentioned: grants received, intergovernmental advances, large purchases, donations, etc. Only include items with a specific dollar amount explicitly stated.
- Use type "grant" for grants and per capita payments, "advance" for intergovernmental advances or loans, "purchase" for equipment or capital purchases, "donation" for donations, "other" for anything else.
- If a field is not found in the document, use null (for numbers/strings) or [] (for arrays).
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

    let parsed: FinancialSnapshot
    try {
      parsed = JSON.parse(raw)
    } catch {
      console.error('Claude returned non-JSON:', raw)
      return NextResponse.json(
        { error: 'Claude returned malformed data. Please try again.' },
        { status: 500 }
      )
    }

    if (!parsed.cashBalances || !Array.isArray(parsed.notableItems)) {
      return NextResponse.json(
        { error: 'Claude response missing required fields.' },
        { status: 500 }
      )
    }

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('Claude API error:', err)
    return NextResponse.json(
      { error: 'Could not extract financial data. Please try again.' },
      { status: 500 }
    )
  }
}
