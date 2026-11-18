import { put, list } from '@vercel/blob'
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
    const { blobs } = await list({ prefix: blobPath(village, board, date) })
    if (blobs.length === 0) return null
    const res = await fetch(blobs[0].url, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
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
    contentType: 'application/json',
  })
}
