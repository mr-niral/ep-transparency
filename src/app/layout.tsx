import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Elmwood Park Library Board — Meeting Transparency',
  description:
    'Searchable archive of Elmwood Park Public Library board meeting agendas, minutes, and AI-powered plain-English summaries.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <nav className="bg-[#162d4a] text-white text-sm">
          <div className="max-w-5xl mx-auto px-4 flex gap-4 h-10 items-center">
            <a href="/" className="hover:text-blue-200 transition-colors font-medium">
              Meetings
            </a>
            <a href="/votes" className="hover:text-blue-200 transition-colors font-medium">
              Vote Tracker
            </a>
            <a href="/finances" className="hover:text-blue-200 transition-colors font-medium">
              Finances
            </a>
          </div>
        </nav>
        {children}
      </body>
    </html>
  )
}
