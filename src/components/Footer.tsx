import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-rule">
      <div className="max-w-[1120px] mx-auto px-6 py-8 pb-12 flex flex-wrap justify-between gap-4 text-[14px] text-muted">
        <span>
          <span className="font-display font-semibold text-ink">The Village Hall Record</span>
          {' '}— an independent civic transparency platform.
        </span>
        <span className="flex gap-6">
          <Link href="/about">About</Link>
          <a href="mailto:villagehallrecord@gmail.com">Contact</a>
        </span>
      </div>
    </footer>
  )
}
