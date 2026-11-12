import { NextRequest, NextResponse } from 'next/server'
import { scrapeMeetings, scrapeRiversideLibraryMeetings } from '@/lib/scraper'

export async function GET(req: NextRequest) {
  const village = req.nextUrl.searchParams.get('village') ?? 'elmwood-park-il'
  try {
    const meetings =
      village === 'riverside-il'
        ? await scrapeRiversideLibraryMeetings()
        : await scrapeMeetings()
    return NextResponse.json(meetings)
  } catch (err) {
    console.error('Failed to scrape meetings:', err)
    return NextResponse.json(
      { error: 'Could not load meetings. Please try again.' },
      { status: 500 }
    )
  }
}
