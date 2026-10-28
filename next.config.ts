import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/votes',
        destination: '/village/elmwood-park-il/votes',
        permanent: true,
      },
      {
        source: '/finances',
        destination: '/village/elmwood-park-il/finances',
        permanent: true,
      },
    ]
  },
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
