import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const { pdfUrl, docType } = await req.json()

  if (!pdfUrl || typeof pdfUrl !== 'string') {
    return NextResponse.json({ error: 'Missing pdfUrl' }, { status: 400 })
  }

  // Fetch the PDF from the library site
  let pdfBuffer: Buffer
  try {
    const res = await fetch(pdfUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    pdfBuffer = Buffer.from(await res.arrayBuffer())
  } catch (err) {
    console.error('Failed to fetch PDF:', err)
    return NextResponse.json(
      { error: 'Could not retrieve the document. It may no longer be available.' },
      { status: 502 }
    )
  }

  const base64Pdf = pdfBuffer.toString('base64')

  const typeLabel =
    docType === 'agenda'
      ? 'meeting agenda'
      : docType === 'director'
        ? "director's letter"
        : 'meeting minutes'

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
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
              text: `This is a public library board ${typeLabel}. Please summarize it in plain, accessible English for a community member who wants to understand what was discussed or decided. Use bullet points for the key topics or decisions. Keep it under 300 words. Avoid jargon.`,
            },
          ],
        },
      ],
    })

    const summary =
      message.content[0].type === 'text' ? message.content[0].text : ''

    return NextResponse.json({ summary })
  } catch (err) {
    console.error('Claude API error:', err)
    return NextResponse.json(
      { error: 'Could not generate summary. Please try again.' },
      { status: 500 }
    )
  }
}
