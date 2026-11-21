import { NextRequest, NextResponse } from 'next/server'
import { getRoster } from '@/lib/trusteeFileStorage'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const village = searchParams.get('village') ?? 'elmwood-park-il'
  const board = searchParams.get('board') ?? 'library-board'

  const roster = await getRoster(village, board)
  if (!roster) return NextResponse.json({ trustees: [] })
  return NextResponse.json(roster)
}
