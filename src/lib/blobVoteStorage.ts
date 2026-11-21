import { put, head } from '@vercel/blob'
import type { MeetingVotes } from '@/types'

function blobPath(village: string, board: string, date: string) {
  return `votes/${village}/${board}/${date}.json`
}

export async function getBlobVotes(
  village: string,
  board: string,
  date: string
): Promise<MeetingVotes | null> {
  try {
    const blob = await head(blobPath(village, board, date))
    const res = await fetch(blob.url, {
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as MeetingVotes
  } catch {
    return null
  }
}

export async function saveBlobVotes(
  village: string,
  board: string,
  date: string,
  data: MeetingVotes
): Promise<void> {
  await put(blobPath(village, board, date), JSON.stringify(data), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  })
}
