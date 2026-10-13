const KEY_PREFIX = 'summary:'

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
