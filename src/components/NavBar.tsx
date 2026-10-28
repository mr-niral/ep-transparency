'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

const LIBRARY_ITEMS = [
  { label: 'Meetings', href: '/' },
  { label: 'Vote Tracker', href: '/votes' },
  { label: 'Finances', href: '/finances' },
]

export default function NavBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isVillage = pathname === '/' && searchParams.get('board') === 'village'
  const isLibrary = !isVillage

  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleMouseEnter() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(true)
  }

  function handleMouseLeave() {
    closeTimer.current = setTimeout(() => setOpen(false), 150)
  }

  return (
    <nav className="bg-[#1F5239] text-white text-sm">
      <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-10">
        <Link href="/" className="font-semibold text-[#AEDCC0] hover:text-white transition-colors">
          Elmwood Park Transparency
        </Link>

        <div className="flex items-center gap-1">
          {/* Library Board with flyout */}
          <div
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <button
              onClick={() => setOpen((o) => !o)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                isLibrary
                  ? 'bg-white/20 text-white'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              Library Board
              <svg
                className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl py-1 min-w-[160px] z-50 border border-gray-100">
                {LIBRARY_ITEMS.map((item) => {
                  const active = pathname === item.href && isLibrary
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`block px-4 py-2 text-sm transition-colors ${
                        active
                          ? 'text-[#1F5239] font-semibold bg-green-50'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-[#1F5239]'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Village Board */}
          <Link
            href="/?board=village"
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              isVillage
                ? 'bg-white/20 text-white'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            Village Board
          </Link>
        </div>
      </div>
    </nav>
  )
}
