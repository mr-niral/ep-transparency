import { NextResponse } from 'next/server'
import { scrapeMeetings } from '@/lib/scraper'

export async function GET() {
  try {
    const meetings = await scrapeMeetings()
    return NextResponse.json(meetings)
  } catch (err) {
    console.error('Failed to scrape meetings:', err)
    return NextResponse.json(
      { error: 'Could not load meetings. Please try again.' },
      { status: 500 }
    )
  }
}
