import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import { Suspense } from 'react'
import NavBar from '@/components/NavBar'
import './globals.css'

const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700'] })

export const metadata: Metadata = {
  title: 'The Village Hall Record — Local Government Transparency',
  description:
    'Making local politics accountable and accessible. Search for your municipality to get started.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${poppins.className} bg-[#F5F7F5] text-gray-900 antialiased`}>
        <Suspense>
          <NavBar />
        </Suspense>
        {children}
      </body>
    </html>
  )
}
