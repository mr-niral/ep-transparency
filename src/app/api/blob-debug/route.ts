import { NextResponse } from 'next/server'
import { list } from '@vercel/blob'

export async function GET() {
  const hasToken = !!process.env.BLOB_READ_WRITE_TOKEN
  const tokenPrefix = process.env.BLOB_READ_WRITE_TOKEN?.slice(0, 20) ?? 'none'
  try {
    const { blobs } = await list({ prefix: 'summaries/' })
    return NextResponse.json({ hasToken, tokenPrefix, count: blobs.length, samples: blobs.slice(0, 3).map(b => b.pathname) })
  } catch (err) {
    return NextResponse.json({ hasToken, tokenPrefix, error: String(err) })
  }
}
