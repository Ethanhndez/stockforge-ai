import type { Metadata } from 'next'
import { Geist_Mono, IBM_Plex_Sans } from 'next/font/google'
import './globals.css'

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-ui-sans',
  weight: ['400', '500', '600', '700'],
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  title: 'StockForge AI — Stock Research Intelligence',
  description:
    'AI-powered stock research with live market context, bull and bear cases, and faster workflows for investor due diligence.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${ibmPlexSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  )
}
