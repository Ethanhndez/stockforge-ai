import type { Metadata } from 'next'
import { Space_Grotesk, DM_Mono } from 'next/font/google'
import './globals.css'

// Next.js font optimization — loads fonts at build time, no external requests
// The variable names become CSS custom properties we use throughout the app
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-space-grotesk',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-mono',
})

export const metadata: Metadata = {
  title: 'StockForge AI — Research stocks like a Wall Street analyst',
  description: 'AI-powered stock research with live market data. Get bull case, bear case, and key risks for any ticker.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // We start in dark mode by default — the theme toggle will switch this
    // The font variables are injected here so every component can access them
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} ${dmMono.variable}`}>
        {children}
      </body>
    </html>
  )
}
