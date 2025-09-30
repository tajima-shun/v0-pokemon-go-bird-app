"use client"

import { useEffect, useRef } from "react"
import { BIRDS, type BirdSpawn, RARITY_COLORS } from "@/lib/birds"
import { useRouter } from "next/navigation"

interface MapViewProps {
  userLocation: { lat: number; lng: number }
  birdSpawns: BirdSpawn[]
}

export function MapView({ userLocation, birdSpawns }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const router = useRouter()

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return

    // Dynamically import Leaflet only on client side
    import("leaflet").then((L) => {
      // Initialize map only once
      if (!mapInstanceRef.current) {
        const map = L.map(mapRef.current!).setView([userLocation.lat, userLocation.lng], 15)

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map)

        // Add user location marker
        const userIcon = L.divIcon({
          className: "user-marker",
          html: `<div style="width: 20px; height: 20px; background: #3b82f6; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        })

        L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(map)

        mapInstanceRef.current = map
      }

      // Clear existing bird markers
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []

      // Add bird markers
      birdSpawns.forEach((spawn) => {
        const bird = BIRDS.find((b) => b.id === spawn.birdId)
        if (!bird) return

        const birdIcon = L.divIcon({
          className: "bird-marker",
          html: `
            <div style="position: relative; cursor: pointer;">
              <div style="
                width: 40px; 
                height: 40px; 
                background: white; 
                border: 3px solid ${RARITY_COLORS[bird.rarity]}; 
                border-radius: 50%; 
                display: flex; 
                align-items: center; 
                justify-content: center;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                overflow: hidden;
              ">
                <img src="${bird.imageUrl}" alt="${bird.nameJa}" style="width: 100%; height: 100%; object-fit: cover;" />
              </div>
              <div style="
                position: absolute;
                bottom: -8px;
                left: 50%;
                transform: translateX(-50%);
                background: ${RARITY_COLORS[bird.rarity]};
                color: white;
                font-size: 8px;
                padding: 2px 4px;
                border-radius: 4px;
                white-space: nowrap;
                font-weight: bold;
              ">${bird.nameJa}</div>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        })

        const marker = L.marker([spawn.lat, spawn.lng], { icon: birdIcon })
          .addTo(mapInstanceRef.current)
          .on("click", () => {
            router.push(`/capture?spawnId=${spawn.id}`)
          })

        markersRef.current.push(marker)
      })
    })

    return () => {
      // Cleanup markers on unmount
      markersRef.current.forEach((marker) => marker.remove())
    }
  }, [userLocation, birdSpawns, router])

  return (
    <div
      ref={mapRef}
      className="w-full h-full"
      style={{
        minHeight: "calc(100vh - 120px)",
      }}
    />
  )
}
