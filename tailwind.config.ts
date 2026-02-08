import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        body: ['var(--font-body)'],
        display: ['var(--font-display)'],
        brand: ['var(--font-brand)', 'var(--font-display)', 'serif']
      },
      colors: {
        slate: {
          50: '#f9f9f9',
          100: '#f1f1f1',
          200: '#ebebeb',
          300: '#d5d5d5',
          400: '#b8b8b8',
          500: '#8d8d8d',
          600: '#6b6b6b',
          700: '#474747',
          800: '#2b2b2b',
          900: '#1b1b1b'
        },
        brand: {
          50: '#f9eef0',
          100: '#f1d7db',
          200: '#e2aeb6',
          300: '#d1848f',
          400: '#ba5a67',
          500: '#a03340',
          600: '#8b1522',
          700: '#74121d',
          800: '#5b0e17',
          900: '#3e0a10'
        }
      }
    }
  },
  plugins: []
}

export default config
