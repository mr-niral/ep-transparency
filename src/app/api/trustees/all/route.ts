import { NextRequest, NextResponse } from 'next/server'
import { getRoster, getAllMeetingExtractions } from '@/lib/trusteeFileStorage'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const village = searchParams.get('village') ?? 'elmwood-park-il'
  const board = searchParams.get('board') ?? 'library-board'

  const [roster, extractions] = await Promise.all([
    getRoster(village, board),
    getAllMeetingExtractions(village, board),
  ])

  return NextResponse.json({ roster, extractions })
}
