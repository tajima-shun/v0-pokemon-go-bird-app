import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import Script from "next/script"


export const metadata: Metadata = {
  title: "WildSpot - ポケモンGOの実際の生き物版",
  description: "ポケモンGOの実際の生き物版",
  generator: 'v0.app',
  openGraph: {
    title: "WildSpot",
    description: "ポケモンGOの実際の生き物版",
    url: "https://wildspot.vercel.app",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WildSpot",
    description: "ポケモンGOの実際の生き物版",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <head>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="antialiased">
        {children}
        <Script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" strategy="beforeInteractive" />
      </body>
    </html>
  )
}
