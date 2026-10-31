import { NextResponse } from 'next/server'
import { scrapeSchoolMeetings } from '@/lib/scraper'

export const maxDuration = 30

export async function GET() {
  try {
    const meetings = await scrapeSchoolMeetings()
    return NextResponse.json(meetings)
  } catch (err) {
    console.error('Failed to scrape school meetings:', err)
    return NextResponse.json(
      { error: 'Could not load school board meetings. Please try again.' },
      { status: 500 }
    )
  }
}
