import path from 'path'
import fs from 'fs'
import type { BoardRoster, MeetingExtraction } from '@/types'

const DATA_ROOT = path.join(process.cwd(), 'data', 'trustees')

function rosterPath(village: string, board: string): string {
  return path.join(DATA_ROOT, village, board, 'roster.json')
}

function meetingPath(village: string, board: string, date: string): string {
  return path.join(DATA_ROOT, village, board, 'meetings', `${date}.json`)
}

function readJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
  } catch {
    return null
  }
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

export async function getRoster(village: string, board: string): Promise<BoardRoster | null> {
  return readJson<BoardRoster>(rosterPath(village, board))
}

export async function saveRoster(roster: BoardRoster): Promise<void> {
  writeJson(rosterPath(roster.village, roster.board), roster)
}

export async function getMeetingExtraction(
  village: string,
  board: string,
  date: string,
): Promise<MeetingExtraction | null> {
  return readJson<MeetingExtraction>(meetingPath(village, board, date))
}

export async function saveMeetingExtraction(
  village: string,
  board: string,
  extraction: MeetingExtraction,
): Promise<void> {
  writeJson(meetingPath(village, board, extraction.meetingDate), extraction)
}

/** Returns all meeting extractions sorted oldest→newest. */
export async function getAllMeetingExtractions(
  village: string,
  board: string,
): Promise<MeetingExtraction[]> {
  const dir = path.join(DATA_ROOT, village, board, 'meetings')
  try {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
    return files
      .map((f) => readJson<MeetingExtraction>(path.join(dir, f)))
      .filter(Boolean) as MeetingExtraction[]
  } catch {
    return []
  }
}

/** Returns the dates of all saved meeting extractions, sorted. */
export async function getMeetingExtractionDates(
  village: string,
  board: string,
): Promise<string[]> {
  const dir = path.join(DATA_ROOT, village, board, 'meetings')
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''))
      .sort()
  } catch {
    return []
  }
}
