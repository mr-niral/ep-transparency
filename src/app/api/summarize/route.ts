import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import * as cheerio from 'cheerio'

export const maxDuration = 60

const client = new Anthropic()

const UNPUBLISHED_PHRASES = [
  'not currently published',
  'not been published',
  'please try again later',
  'contact the publisher',
]

function isGranicusViewerUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      parsed.hostname.includes('granicus.com') &&
      (parsed.pathname.includes('AgendaViewer') || parsed.pathname.includes('MinutesViewer'))
    )
  } catch {
    return false
  }
}

function extractGranicusText(html: string): string {
  const $ = cheerio.load(html)
  $('script, style, noscript, head').remove()
  return $('body').text().replace(/\s+/g, ' ').trim()
}


export async function POST(req: NextRequest) {
  const { pdfUrl, docType, boardType } = await req.json()

  if (!pdfUrl || typeof pdfUrl !== 'string') {
    return NextResponse.json({ error: 'Missing pdfUrl' }, { status: 400 })
  }

  const boardLabel = boardType === 'village' ? 'village board' : 'public library board'
  const typeLabel =
    docType === 'agenda'
      ? 'meeting agenda'
      : docType === 'director'
        ? "director's letter"
        : 'meeting minutes'

  const prompt = `This is a ${boardLabel} ${typeLabel}. Please summarize it in plain, accessible English for a community member who wants to understand what was discussed or decided. Use bullet points for the key topics or decisions. Keep it under 300 words. Avoid jargon.`

  // Granicus viewer pages return HTML — extract text and send as plain text to Claude
  if (isGranicusViewerUrl(pdfUrl)) {
    let htmlText: string
    try {
      const res = await fetch(pdfUrl, {
        headers: { 'User-Agent': 'ep-transparency/1.0' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      htmlText = await res.text()
    } catch (err) {
      console.error('Failed to fetch Granicus page:', pdfUrl, err)
      return NextResponse.json(
        { error: 'Step 1 failed: could not retrieve the agenda page.' },
        { status: 502 }
      )
    }

    const text = extractGranicusText(htmlText)
    const lowerText = text.toLowerCase()

    console.log(`Granicus text length for ${pdfUrl}: ${text.length}`)

    if (
      !text ||
      text.length < 200 ||
      UNPUBLISHED_PHRASES.some((p) => lowerText.includes(p))
    ) {
      return NextResponse.json(
        { error: 'This document has not been published yet.' },
        { status: 404 }
      )
    }

    try {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `${prompt}\n\n---\n\n${text.slice(0, 12000)}`,
              },
            ],
          },
        ],
      })

      const summary = message.content[0].type === 'text' ? message.content[0].text : ''
      return NextResponse.json({ summary })
    } catch (err) {
      console.error('Claude API error (Granicus):', err)
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json(
        { error: `Step 2 failed: ${msg}` },
        { status: 500 }
      )
    }
  }

  // PDF path — fetch binary and send as base64 document to Claude
  // Fetch directly; this runs server-side so no CORS proxy is needed.
  let pdfBuffer: Buffer
  try {
    const res = await fetch(pdfUrl, {
      headers: { 'User-Agent': 'ep-transparency/1.0' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('pdf') && !contentType.includes('octet-stream')) {
      console.error('Unexpected content-type for PDF fetch:', contentType, pdfUrl)
      return NextResponse.json(
        { error: 'Could not retrieve the document. It may no longer be available.' },
        { status: 502 }
      )
    }
    pdfBuffer = Buffer.from(await res.arrayBuffer())
  } catch (err) {
    console.error('Failed to fetch PDF:', err)
    return NextResponse.json(
      { error: 'Could not retrieve the document. It may no longer be available.' },
      { status: 502 }
    )
  }

  const base64Pdf = pdfBuffer.toString('base64')

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
              text: prompt,
            },
          ],
        },
      ],
    })

    const summary = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ summary })
  } catch (err) {
    console.error('Claude API error:', err)
    return NextResponse.json(
      { error: 'Could not generate summary. Please try again.' },
      { status: 500 }
    )
  }
}
