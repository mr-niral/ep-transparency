import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import Image from 'next/image'
import './globals.css'

const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700'] })

export const metadata: Metadata = {
  title: 'Elmwood Park Library Board — Meeting Transparency',
  description:
    'Searchable archive of Elmwood Park Public Library board meeting agendas, minutes, and AI-powered plain-English summaries.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${poppins.className} bg-[#F5F7F5] text-gray-900 antialiased`}>
        <div className="bg-white border-b border-gray-200 py-4 px-4">
          <div className="max-w-5xl mx-auto">
            <a href="/">
              <Image src="/logo.jpeg" alt="EP Transparency" width={320} height={120} className="object-contain" />
            </a>
          </div>
        </div>
        <nav className="bg-[#1F5239] text-white text-sm">
          <div className="max-w-5xl mx-auto px-4 flex gap-6 h-10 items-center">
            <a href="/" className="hover:text-[#AEDCC0] transition-colors font-medium">
              Meetings
            </a>
            <a href="/votes" className="hover:text-[#AEDCC0] transition-colors font-medium">
              Vote Tracker
            </a>
            <a href="/finances" className="hover:text-[#AEDCC0] transition-colors font-medium">
              Finances
            </a>
          </div>
        </nav>
        {children}
      </body>
    </html>
  )
}
