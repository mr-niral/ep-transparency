import { NextRequest, NextResponse } from 'next/server'
import { scrapeSchoolMeetings, scrapeRiversideSchoolMeetings } from '@/lib/scraper'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const village = req.nextUrl.searchParams.get('village') ?? 'elmwood-park-il'
  try {
    const meetings =
      village === 'riverside-il'
        ? await scrapeRiversideSchoolMeetings()
        : await scrapeSchoolMeetings()
    return NextResponse.json(meetings)
  } catch (err) {
    console.error('Failed to scrape school meetings:', err)
    return NextResponse.json(
      { error: 'Could not load school board meetings. Please try again.' },
      { status: 500 }
    )
  }
}
