"use client"

import { useEffect, useState } from "react"
import { Trophy, Calendar, MapPin } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BottomNav } from "@/components/bottom-nav"
import { BIRDS, RARITY_COLORS, RARITY_LABELS } from "@/lib/birds"
import type { DynamicBird } from "@/lib/ebird"
import { storage, type CaughtBird } from "@/lib/storage"
import { LazyBirdImage } from "@/components/lazy-bird-image"

export default function PokedexPage() {
  const [caughtBirds, setCaughtBirds] = useState<CaughtBird[]>([])
  const [selectedBird, setSelectedBird] = useState<string | null>(null)
  const [regionBirds, setRegionBirds] = useState<DynamicBird[] | null>(null)
  const [regionName, setRegionName] = useState<string>("")

  useEffect(() => {
    const loadBirds = () => {
      const birds = storage.getCaughtBirds()
      setCaughtBirds(birds)
    }

    // Load on mount
    loadBirds()

    // Also fetch region species from eBird by current location
    const loc = storage.getUserLocation()
    if (loc) {
      fetch(`/api/geocode?lat=${loc.lat}&lng=${loc.lng}`)
        .then((r) => r.json())
        .then(async (geo) => {
          const state = geo?.state as string | undefined
          if (state) setRegionName(state)
          // Pull recent species around user and use as region birds (pragmatic approximation)
          const res = await fetch(`/api/ebird/recent?lat=${loc.lat}&lng=${loc.lng}&dist=50&back=30`)
          if (res.ok) {
            const arr = await res.json()
            // Skip image enrichment for now - use placeholder
            const mapped: DynamicBird[] = arr.slice(0, 60).map((o: any) => ({
              id: o.speciesCode,
              name: o.comName,
              nameJa: o.comName,
              species: o.sciName,
              rarity: "common",
              imageUrl: "/placeholder.jpg",
              description: "",
              habitat: "",
            }))
            setRegionBirds(mapped)
          }
        })
        .catch(() => {})
    }

    // Reload when page becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) loadBirds()
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [])

  const getCaughtCount = (birdId: string) => {
    return caughtBirds.filter((cb) => cb.birdId === birdId).length
  }

  const getFirstCaught = (birdId: string) => {
    const caught = caughtBirds.find((cb) => cb.birdId === birdId)
    return caught ? new Date(caught.caughtAt) : null
  }

  const totalCaught = caughtBirds.length
  const uniqueCaught = new Set(caughtBirds.map((cb) => cb.birdId)).size
  const catalog = regionBirds ?? BIRDS
  const completionRate = Math.round((uniqueCaught / catalog.length) * 100)

  return (
    <div className="min-h-[100svh] bg-background pb-[calc(env(safe-area-inset-bottom)+5rem)]">
      <header className="bg-primary text-primary-foreground p-4 sticky top-0 z-40 shadow-md">
        <div className="max-w-md mx-auto">
          <h1 className="text-xl font-bold mb-1">鳥図鑑</h1>
          <p className="text-xs opacity-90">{regionName ? `${regionName} 付近の観測種 (eBird)` : "地域の観測種を取得中..."}</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-primary-foreground/10 rounded-lg p-2">
              <p className="text-2xl font-bold">{uniqueCaught}</p>
              <p className="text-xs opacity-90">種類</p>
            </div>
            <div className="bg-primary-foreground/10 rounded-lg p-2">
              <p className="text-2xl font-bold">{totalCaught}</p>
              <p className="text-xs opacity-90">総捕獲数</p>
            </div>
            <div className="bg-primary-foreground/10 rounded-lg p-2">
              <p className="text-2xl font-bold">{completionRate}%</p>
              <p className="text-xs opacity-90">完成度</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 pb-24">
        <div className="grid grid-cols-2 gap-3">
          {catalog.map((bird) => {
            const count = getCaughtCount(bird.id)
            const firstCaught = getFirstCaught(bird.id)
            const isCaught = count > 0

            return (
              <Card
                key={bird.id}
                className={`p-4 cursor-pointer transition-all hover:shadow-lg ${
                  selectedBird === bird.id ? "ring-2 ring-primary" : ""
                } ${!isCaught ? "opacity-50" : ""}`}
                onClick={() => setSelectedBird(selectedBird === bird.id ? null : bird.id)}
              >
                <div className="relative mb-3">
                  <LazyBirdImage
                    sciOrCommonName={bird.species || bird.name}
                    alt={isCaught ? bird.nameJa : "???"}
                    className={`w-full h-32 object-cover rounded-lg ${!isCaught ? "filter brightness-0" : ""}`}
                  />
                  <div
                    className="absolute top-2 right-2 w-6 h-6 rounded-full border-2 border-white shadow-md"
                    style={{ backgroundColor: RARITY_COLORS[bird.rarity] }}
                  />
                  {count > 1 && (
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full font-semibold">
                      ×{count}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="font-semibold text-sm truncate">{isCaught ? bird.nameJa : "???"}</h3>
                  <p className="text-xs text-muted-foreground truncate">{isCaught ? bird.name : "Unknown"}</p>
                  <Badge
                    variant="secondary"
                    className="text-xs"
                    style={{
                      backgroundColor: isCaught ? RARITY_COLORS[bird.rarity] : "#9ca3af",
                      color: "white",
                    }}
                  >
                    {isCaught ? RARITY_LABELS[bird.rarity] : "未発見"}
                  </Badge>
                </div>

                {selectedBird === bird.id && isCaught && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2 text-xs">
                    <p className="text-muted-foreground leading-relaxed">{bird.description}</p>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      <span>{bird.habitat}</span>
                    </div>
                    {firstCaught && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>初捕獲: {firstCaught.toLocaleDateString("ja-JP")}</span>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>

        {uniqueCaught === BIRDS.length && (
          <Card className="mt-6 p-6 bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
            <div className="text-center">
              <Trophy className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-amber-900 mb-2">図鑑コンプリート!</h3>
              <p className="text-sm text-amber-700">すべての鳥を捕獲しました。おめでとうございます!</p>
            </div>
          </Card>
        )}

        {uniqueCaught === 0 && (
          <Card className="mt-6 p-6 text-center">
            <p className="text-muted-foreground mb-4">まだ鳥を捕獲していません</p>
            <p className="text-sm text-muted-foreground">マップから近くの鳥を探して捕獲しましょう!</p>
          </Card>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
