import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: 32,
        height: 32,
        background: '#1E4D36',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width="24" height="22" viewBox="0 0 24 22" xmlns="http://www.w3.org/2000/svg">
        <polygon points="0,8 12,0 24,8" fill="#F5F6F3" />
        <rect x="0" y="8" width="24" height="2" fill="#F5F6F3" />
        <rect x="1"  y="10" width="2" height="8" fill="#F5F6F3" />
        <rect x="6"  y="10" width="2" height="8" fill="#F5F6F3" />
        <rect x="11" y="10" width="2" height="8" fill="#F5F6F3" />
        <rect x="16" y="10" width="2" height="8" fill="#F5F6F3" />
        <rect x="21" y="10" width="2" height="8" fill="#F5F6F3" />
        <rect x="0"  y="18" width="24" height="2" fill="#F5F6F3" />
        <rect x="-1" y="20" width="26" height="2" fill="#F5F6F3" />
      </svg>
    </div>,
    { width: 32, height: 32 }
  )
}
