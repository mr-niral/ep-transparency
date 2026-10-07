import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow fetching PDFs from the library site for summarization
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ]
  },
}

export default nextConfig
