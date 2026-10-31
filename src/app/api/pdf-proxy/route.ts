import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')

  if (!url || typeof url !== 'string') {
    return new NextResponse('Missing url', { status: 400 })
  }

  // Only proxy known village domains
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return new NextResponse('Invalid url', { status: 400 })
  }

  const allowed = [
    'elmwoodpark.org', 'www.elmwoodpark.org',
    'www.epcusd401.org', 'resources.finalsite.net',
  ]
  if (!allowed.includes(parsed.hostname)) {
    return new NextResponse('Domain not allowed', { status: 403 })
  }

  const res = await fetch(url, {
    headers: { 'User-Agent': 'ep-transparency/1.0' },
  })

  if (!res.ok) {
    return new NextResponse(`Upstream error: ${res.status}`, { status: res.status })
  }

  const body = await res.arrayBuffer()
  return new NextResponse(body, {
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'application/pdf',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
