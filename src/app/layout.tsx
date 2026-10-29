import type { Metadata } from 'next'
import { Newsreader, Public_Sans, IBM_Plex_Mono } from 'next/font/google'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import './globals.css'

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-display',
  display: 'swap',
})

const publicSans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: '500',
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'The Village Hall Record — Local Government Transparency',
  description:
    'Making local politics accessible. Search for your municipality to get started.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${publicSans.variable} ${newsreader.variable} ${ibmPlexMono.variable} font-sans bg-ground text-ink antialiased`}
      >
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  )
}
