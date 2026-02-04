import './globals.css'
import { Cormorant_Garamond, Manrope } from 'next/font/google'
import type { Metadata } from 'next'

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  variable: '--font-body'
})
const cormorant = Cormorant_Garamond({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-display'
})

export const metadata: Metadata = {
  title: 'Maiu Inventory',
  description: 'Internal inventory, operations, and finance tracker'
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body className={`${manrope.variable} ${cormorant.variable} min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  )
}
