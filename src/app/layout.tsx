import './globals.css'
import type { Metadata } from 'next'

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
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
