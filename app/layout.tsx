import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import Script from "next/script"


export const metadata: Metadata = {
  title: "バードGO - 鳥観察アプリ",
  description: "ポケモンGO風の鳥観察・収集アプリ",
    generator: 'v0.app'
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
