import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a5f',
        },
        ground: '#F5F6F3',
        surface: '#FFFFFF',
        ink: '#15201B',
        'ink-2': '#46504A',
        muted: '#59625C',
        rule: '#D5D9D3',
        'rule-soft': '#E4E7E2',
        'border-strong': '#A9B1AB',
        accent: '#1E4D36',
        'accent-hover': '#123323',
        signal: '#8A4A12',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
