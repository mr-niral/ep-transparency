import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

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

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function resolvedFetchUrl(pdfUrl: string, req: NextRequest): string {
  try {
    const parsed = new URL(pdfUrl)
    const villageHosts = ['elmwoodpark.org', 'www.elmwoodpark.org']
    if (villageHosts.includes(parsed.hostname)) {
      const base = req.nextUrl.origin
      return `${base}/api/pdf-proxy?url=${encodeURIComponent(pdfUrl)}`
    }
  } catch {}
  return pdfUrl
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
      console.error('Failed to fetch Granicus page:', err)
      return NextResponse.json(
        { error: 'Could not retrieve the document. It may no longer be available.' },
        { status: 502 }
      )
    }

    const text = stripHtml(htmlText)
    if (!text || text.length < 100) {
      return NextResponse.json(
        { error: 'Minutes have not been published for this meeting yet.' },
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
            content: `${prompt}\n\n---\n\n${text.slice(0, 12000)}`,
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

  // PDF path — fetch binary and send as base64 document to Claude
  const fetchUrl = resolvedFetchUrl(pdfUrl, req)

  let pdfBuffer: Buffer
  try {
    const res = await fetch(fetchUrl, {
      headers: fetchUrl === pdfUrl ? { 'User-Agent': 'ep-transparency/1.0' } : {},
    })
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
