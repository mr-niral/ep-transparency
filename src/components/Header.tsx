import Link from 'next/link'

export default function Header() {
  return (
    <header className="h-16 border-b border-rule bg-ground">
      <div className="max-w-[1120px] mx-auto px-6 h-full flex items-center justify-between gap-4 flex-wrap">
        <Link
          href="/"
          className="font-display font-semibold text-[22px] text-ink no-underline tracking-[-0.01em]"
          style={{ textDecoration: 'none', color: '#15201B' }}
        >
          The Village Hall Record
          <span
            className="font-mono font-medium tracking-wider uppercase"
            style={{ fontSize: '10px', color: '#8A4A12', border: '1px solid #8A4A12', borderRadius: '3px', padding: '1px 5px', marginLeft: '8px', verticalAlign: 'middle', position: 'relative', top: '-1px' }}
          >
            Beta
          </span>
        </Link>
        <nav aria-label="Primary" className="flex gap-7 text-[15px] font-medium">
          <Link
            href="/#municipalities"
            className="text-ink no-underline"
            style={{ textDecoration: 'none', color: '#15201B' }}
          >
            Municipalities
          </Link>
          <Link
            href="/#how"
            className="text-ink no-underline"
            style={{ textDecoration: 'none', color: '#15201B' }}
          >
            How it works
          </Link>
        </nav>
      </div>
    </header>
  )
}
