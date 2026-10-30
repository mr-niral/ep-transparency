import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import * as cheerio from 'cheerio'
import { list, put } from '@vercel/blob'
import { createHash } from 'crypto'

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

function extractJsonFromText(text: string): string {
  // Strip markdown code fences
  let s = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  // Extract just the outermost JSON object in case there's surrounding prose
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start !== -1 && end > start) s = s.slice(start, end + 1)
  return s
}

function blobCacheKey(pdfUrl: string, structured: boolean): string {
  const hash = createHash('sha256').update(pdfUrl).digest('hex').slice(0, 40)
  return `summaries/${structured ? 'structured' : 'plain'}/${hash}.txt`
}

async function getFromCache(key: string): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null
  try {
    const { blobs } = await list({ prefix: key, limit: 1 })
    if (blobs.length > 0) {
      const res = await fetch(blobs[0].url, { cache: 'no-store' })
      if (res.ok) {
        const text = await res.text()
        console.log('[cache] hit:', key)
        return text
      }
    }
  } catch (err) {
    console.error('[cache] getFromCache error:', err)
  }
  return null
}

async function saveToCache(key: string, content: string): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return
  try {
    await put(key, content, { access: 'public', addRandomSuffix: false })
  } catch (err) {
    console.error('Failed to save to blob cache:', err)
  }
}

const STRUCTURED_PROMPT = `Respond with a single raw JSON object and nothing else — no markdown fences, no explanation, no text before or after the JSON. Use this exact shape:
{"key_figures":[{"label":"...","value":"..."}],"decisions":[{"status":"approved","motion":"...","notes":"..."}],"sections":[{"heading":"...","body":"..."}]}
Rules:
- key_figures: 2–4 items with notable numbers, dollar amounts, or counts from the document.
- decisions: every formal motion or vote, status must be exactly "approved", "failed", or "tabled".
- sections: 3–6 short narrative paragraphs covering the main topics.
- No preamble, no date restatement, no "Here is a summary" opener. Plain text only inside JSON string values.`

export async function POST(req: NextRequest) {
  const { pdfUrl, docType, boardType, structured } = await req.json()

  if (!pdfUrl || typeof pdfUrl !== 'string') {
    return NextResponse.json({ error: 'Missing pdfUrl' }, { status: 400 })
  }

  // Check blob cache first
  const cacheKey = blobCacheKey(pdfUrl, !!structured)
  const cached = await getFromCache(cacheKey)
  if (cached) {
    return NextResponse.json({ summary: cached, fromCache: true })
  }

  const boardLabel = boardType === 'village' ? 'village board' : 'public library board'
  const typeLabel =
    docType === 'agenda'
      ? 'meeting agenda'
      : docType === 'director'
        ? "director's letter"
        : 'meeting minutes'

  const prompt = structured
    ? `This is a ${boardLabel} ${typeLabel}.\n${STRUCTURED_PROMPT}`
    : `This is a ${boardLabel} ${typeLabel}. Please summarize it in plain, accessible English for a community member who wants to understand what was discussed or decided. Use bullet points for the key topics or decisions. Keep it under 300 words. Avoid jargon.`

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
        max_tokens: structured ? 4096 : 1024,
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

      const raw = message.content[0].type === 'text' ? message.content[0].text : ''
      if (structured) console.log('[summarize] raw structured output:', raw.slice(0, 500))
      const summary = structured ? extractJsonFromText(raw) : raw
      await saveToCache(cacheKey, summary)
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
      max_tokens: structured ? 4096 : 1024,
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
    if (structured) console.log('[summarize] raw PDF structured output:', raw.slice(0, 500))
    const summary = structured ? extractJsonFromText(raw) : raw
    await saveToCache(cacheKey, summary)
    return NextResponse.json({ summary })
  } catch (err) {
    console.error('Claude API error:', err)
    return NextResponse.json(
      { error: 'Could not generate summary. Please try again.' },
      { status: 500 }
    )
  }
}
