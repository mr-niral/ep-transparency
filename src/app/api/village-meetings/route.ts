import { NextRequest, NextResponse } from 'next/server'
import { scrapeVillageMeetings, scrapeRiversideVillageMeetings } from '@/lib/scraper'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const village = req.nextUrl.searchParams.get('village') ?? 'elmwood-park-il'
  try {
    const meetings =
      village === 'riverside-il'
        ? await scrapeRiversideVillageMeetings()
        : await scrapeVillageMeetings()
    return NextResponse.json(meetings)
  } catch (err) {
    console.error('Failed to scrape village meetings:', err)
    return NextResponse.json(
      { error: 'Could not load village meetings. Please try again.' },
      { status: 500 }
    )
  }
}
