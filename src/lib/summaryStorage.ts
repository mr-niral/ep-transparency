const KEY_PREFIX = 'summary:'
const STRUCTURED_PREFIX = 'structured:'

export function saveSummary(meetingDate: string, docType: string, text: string): void {
  localStorage.setItem(`${KEY_PREFIX}${meetingDate}:${docType}`, text)
  window.dispatchEvent(new Event('summaryUpdate'))
}

export function loadSummary(meetingDate: string, docType: string): string | null {
  return localStorage.getItem(`${KEY_PREFIX}${meetingDate}:${docType}`)
}

export function hasSummary(meetingDate: string, docType: string): boolean {
  return localStorage.getItem(`${KEY_PREFIX}${meetingDate}:${docType}`) !== null
}

export function saveStructuredSummary(key: string, data: object): void {
  localStorage.setItem(`${STRUCTURED_PREFIX}${key}`, JSON.stringify(data))
}

export function loadStructuredSummary(key: string): object | null {
  const raw = localStorage.getItem(`${STRUCTURED_PREFIX}${key}`)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function hasStructuredSummary(key: string): boolean {
  return localStorage.getItem(`${STRUCTURED_PREFIX}${key}`) !== null
}
