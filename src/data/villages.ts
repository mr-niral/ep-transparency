export interface VillageConfig {
  slug: string
  name: string
  state: string
  county?: string
  zips: string[]
  hasLibraryBoard: boolean
  hasVillageBoard: boolean
  features: ('votes' | 'finances' | 'summaries')[]
}

export const villages: VillageConfig[] = [
  {
    slug: 'elmwood-park-il',
    name: 'Elmwood Park',
    state: 'IL',
    county: 'Cook County',
    zips: ['60707'],
    hasLibraryBoard: true,
    hasVillageBoard: true,
    features: ['votes', 'finances', 'summaries'],
  },
]

export function findVillage(query: string): VillageConfig | undefined {
  const q = query.toLowerCase().trim()
  return villages.find(
    (v) =>
      v.name.toLowerCase().includes(q) ||
      v.slug.includes(q) ||
      v.state.toLowerCase() === q ||
      v.zips.includes(q)
  )
}
