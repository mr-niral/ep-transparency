import { NextResponse } from 'next/server'
import { scrapeVillageMeetings } from '@/lib/scraper'

export async function GET() {
  try {
    const meetings = await scrapeVillageMeetings()
    return NextResponse.json(meetings)
  } catch (err) {
    console.error('Failed to scrape village meetings:', err)
    return NextResponse.json(
      { error: 'Could not load village meetings. Please try again.' },
      { status: 500 }
    )
  }
}
