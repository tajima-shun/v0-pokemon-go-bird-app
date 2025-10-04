"use client"

import { useEffect, useRef, useState } from "react"

interface Props {
  alt: string
  sciOrCommonName: string
  className?: string
  placeholderSrc?: string
}

export function LazyBirdImage({ alt, sciOrCommonName, className, placeholderSrc = "/placeholder.jpg" }: Props) {
  const ref = useRef<HTMLImageElement>(null)
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let observer: IntersectionObserver | null = null
    const cacheKey = `birdImg:${sciOrCommonName}`
    const cached = typeof window !== "undefined" ? sessionStorage.getItem(cacheKey) : null
    if (cached) {
      setSrc(cached)
      return
    }

    const load = async () => {
      try {
        const r = await fetch(`/api/bird-image?q=${encodeURIComponent(sciOrCommonName)}`)
        const j = await r.json()
        if (j?.imageUrl) {
          setSrc(j.imageUrl)
          sessionStorage.setItem(cacheKey, j.imageUrl)
        } else {
          setSrc(placeholderSrc)
        }
      } catch {
        setSrc(placeholderSrc)
      }
    }

    if (ref.current && "IntersectionObserver" in window) {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          load()
          observer?.disconnect()
        }
      })
      observer.observe(ref.current)
    } else {
      // Fallback: load immediately
      load()
    }

    return () => observer?.disconnect()
  }, [sciOrCommonName, placeholderSrc])

  return <img ref={ref} src={src ?? placeholderSrc} alt={alt} className={className} />
}




