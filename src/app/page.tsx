'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { villages } from '@/data/villages'

function LandingInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const query = searchParams.get('q') ?? ''

  function handleSearch(value: string) {
    const params = new URLSearchParams()
    if (value) params.set('q', value)
    router.replace(value ? `/?${params.toString()}` : '/', { scroll: false })
  }

  const filtered = query.trim()
    ? villages.filter(
        (v) =>
          v.name.toLowerCase().includes(query.toLowerCase()) ||
          v.state.toLowerCase().includes(query.toLowerCase()) ||
          v.zips.some((z) => z.includes(query.trim()))
      )
    : villages

  const noMatch = query.trim().length > 0 && filtered.length === 0

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <header className="bg-[#1F5239] text-white py-20 px-4 text-center">
        <h1 className="text-4xl font-bold mb-3">The Village Hall Record</h1>
        <p className="text-green-100 text-lg mb-8 max-w-xl mx-auto">
          Making village politics transparent and accessible.
        </p>
        <div className="max-w-md mx-auto">
          <input
            type="search"
            placeholder="Search by city, state, or zip…"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-lg px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-white/60"
          />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10">
        {noMatch ? (
          <div className="max-w-md mx-auto">
            <p className="text-gray-600 mb-1 text-center">
              <strong>{query}</strong> isn&apos;t available yet.
            </p>
            <p className="text-sm text-gray-500 mb-8 text-center">
              We&apos;re adding new municipalities over time. Request yours below.
            </p>

            {/* Request form — replace YOUR_FORM_ID with your Formspree form ID */}
            <form
              action="https://formspree.io/f/YOUR_FORM_ID"
              method="POST"
              className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm"
            >
              <h2 className="text-base font-semibold text-gray-800">Request this municipality</h2>
              <input type="hidden" name="_subject" value="The Village Hall Record municipality request" />

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                <input
                  type="text"
                  name="city"
                  defaultValue={query}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F5239]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                <input
                  type="text"
                  name="state"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F5239]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Your email <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="email"
                  name="email"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F5239]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Any context <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  name="context"
                  rows={3}
                  placeholder="e.g. links to your municipality's meeting page, FOIA contact, etc."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F5239] resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#1F5239] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#163d2c] transition-colors"
              >
                Send Request
              </button>
            </form>
          </div>
        ) : (
          <>
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">
              {query.trim() ? 'Matching municipalities' : 'Supported municipalities'}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {filtered.map((village) => (
                <Link
                  key={village.slug}
                  href={`/village/${village.slug}`}
                  className="bg-white border border-gray-200 rounded-xl p-5 hover:border-[#1F5239] hover:shadow-md transition-all group"
                >
                  <p className="text-xs font-medium text-[#1F5239] uppercase tracking-wide mb-1">
                    {village.state}
                  </p>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 group-hover:text-[#1F5239] transition-colors">
                    {village.name}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {village.features.map((f) => (
                      <span
                        key={f}
                        className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium capitalize"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-8 border-t border-gray-200 mt-4">
        The Village Hall Record — an independent civic transparency platform.
      </footer>
    </div>
  )
}

export default function LandingPage() {
  return (
    <Suspense>
      <LandingInner />
    </Suspense>
  )
}
