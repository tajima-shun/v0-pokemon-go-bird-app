"use client"

import { useState } from "react"
import { BIRDS, type BirdSpawn, RARITY_COLORS, RARITY_LABELS } from "@/lib/birds"
import { calculateDistance, getBearing } from "@/lib/geo-utils"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Camera, X, Check } from "lucide-react"
import { storage } from "@/lib/storage"

interface FirstPersonViewProps {
  userLocation: { lat: number; lng: number }
  birdSpawns: BirdSpawn[]
  heading: number
  onBirdCaptured: () => void
}

export function FirstPersonView({ userLocation, birdSpawns, heading, onBirdCaptured }: FirstPersonViewProps) {
  const [selectedBird, setSelectedBird] = useState<{
    bird: (typeof BIRDS)[0]
    spawn: BirdSpawn
  } | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [captured, setCaptured] = useState(false)
  const [failed, setFailed] = useState(false)

  const birdsWithDistance = birdSpawns.map((spawn) => {
    const bird = BIRDS.find((b) => b.id === spawn.birdId)
    const distance = calculateDistance(userLocation.lat, userLocation.lng, spawn.lat, spawn.lng)
    const bearing = getBearing(userLocation.lat, userLocation.lng, spawn.lat, spawn.lng)
    const relativeBearing = (bearing - heading + 360) % 360

    return {
      spawn,
      bird,
      distance,
      bearing: relativeBearing,
    }
  })

  // Only show birds within 100m and within 180 degree field of view (expanded from 120)
  const visibleBirds = birdsWithDistance.filter(
    (item) => item.distance <= 100 && (item.bearing >= 270 || item.bearing <= 90),
  )

  const handleBirdClick = (bird: (typeof BIRDS)[0], spawn: BirdSpawn) => {
    setSelectedBird({ bird, spawn })
  }

  const handleCapture = () => {
    if (!selectedBird || capturing) return

    setCapturing(true)

    // Simulate capture attempt with success rate based on rarity
    const successRate = {
      common: 0.8,
      uncommon: 0.6,
      rare: 0.4,
      legendary: 0.2,
    }[selectedBird.bird.rarity]

    setTimeout(() => {
      const success = Math.random() < successRate

      if (success) {
        console.log("[v0] Capturing bird:", selectedBird.bird.nameJa, selectedBird.bird.id)

        // Save caught bird
        storage.addCaughtBird({
          birdId: selectedBird.bird.id,
          caughtAt: Date.now(),
          location: {
            lat: selectedBird.spawn.lat,
            lng: selectedBird.spawn.lng,
          },
        })

        console.log("[v0] Bird saved to storage")
        console.log("[v0] Current caught birds:", storage.getCaughtBirds())

        // Remove spawn
        const spawns = storage.getBirdSpawns().filter((s) => s.id !== selectedBird.spawn.id)
        storage.setBirdSpawns(spawns)

        setCaptured(true)
        setTimeout(() => {
          setCaptured(false)
          setCapturing(false)
          setSelectedBird(null)
          onBirdCaptured()
        }, 2000)
      } else {
        setFailed(true)
        setTimeout(() => {
          setFailed(false)
          setCapturing(false)
        }, 2000)
      }
    }, 1500)
  }

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "common":
        return "border-gray-400"
      case "uncommon":
        return "border-emerald-500"
      case "rare":
        return "border-blue-500"
      case "legendary":
        return "border-amber-500"
      default:
        return "border-gray-400"
    }
  }

  return (
    <div className="relative w-full h-full">
      {/* Background - simulated camera view */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-300 via-sky-200 to-emerald-100">
        {/* Horizon line */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/30" />

        {/* Ground texture */}
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-b from-emerald-100 to-emerald-200" />
      </div>

      {/* Compass indicator */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <Card className="px-4 py-2 bg-black/50 backdrop-blur-sm border-white/20">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 relative">
              <div
                className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm"
                style={{ transform: `rotate(${-heading}deg)` }}
              >
                N
              </div>
            </div>
            <span className="text-white text-sm font-mono">{Math.round(heading)}°</span>
          </div>
        </Card>
      </div>

      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="w-8 h-8 border-2 border-white/50 rounded-full">
          <div className="absolute top-1/2 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 bg-white/50 rounded-full" />
        </div>
      </div>

      {/* Birds in view */}
      <div className="absolute inset-0">
        {visibleBirds.map((item) => {
          if (!item.bird) return null

          // Calculate position based on bearing and distance
          // Center is 0 degrees, left is negative, right is positive
          const normalizedBearing = item.bearing > 180 ? item.bearing - 360 : item.bearing
          const horizontalPosition = 50 + (normalizedBearing / 60) * 40 // -60 to +60 degrees maps to 10% to 90%

          // Closer birds appear lower and larger
          const verticalPosition = 50 - (item.distance / 100) * 20 // 0-100m maps to 30%-50%
          const scale = Math.max(0.5, 1 - item.distance / 150)

          return (
            <button
              key={item.spawn.id}
              onClick={() => handleBirdClick(item.bird!, item.spawn)}
              className="absolute transition-all duration-300 hover:scale-110"
              style={{
                left: `${horizontalPosition}%`,
                top: `${verticalPosition}%`,
                transform: `translate(-50%, -50%) scale(${scale})`,
              }}
            >
              <div className="relative">
                <div
                  className={`w-16 h-16 rounded-full border-4 ${getRarityColor(item.bird.rarity)} bg-white/90 backdrop-blur-sm shadow-lg overflow-hidden`}
                >
                  <img
                    src={item.bird.imageUrl || "/placeholder.svg"}
                    alt={item.bird.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <Card className="px-2 py-1 bg-black/70 backdrop-blur-sm border-white/20">
                    <p className="text-xs text-white font-semibold">{Math.round(item.distance)}m</p>
                  </Card>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* No birds message */}
      {visibleBirds.length === 0 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <Card className="px-6 py-4 bg-black/50 backdrop-blur-sm border-white/20">
            <p className="text-white text-center">
              周りに鳥がいません
              <br />
              <span className="text-sm text-white/70">もっと歩いてみましょう</span>
            </p>
          </Card>
        </div>
      )}

      {selectedBird && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-white p-6 relative">
            {/* Close button */}
            {!capturing && !captured && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedBird(null)}
                className="absolute top-2 right-2"
              >
                <X className="w-5 h-5" />
              </Button>
            )}

            {/* Bird display */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative mb-4">
                <div
                  className={`transition-all duration-500 ${
                    capturing ? "scale-110 animate-pulse" : "scale-100"
                  } ${captured ? "scale-150 opacity-0" : "opacity-100"}`}
                >
                  <img
                    src={selectedBird.bird.imageUrl || "/placeholder.svg"}
                    alt={selectedBird.bird.nameJa}
                    className="w-48 h-48 object-cover rounded-full shadow-2xl border-8 border-white"
                  />
                  <div
                    className="absolute -top-2 -right-2 w-10 h-10 rounded-full border-4 border-white shadow-lg flex items-center justify-center"
                    style={{ backgroundColor: RARITY_COLORS[selectedBird.bird.rarity] }}
                  >
                    <span className="text-white text-xs font-bold">
                      {selectedBird.bird.rarity === "common"
                        ? "C"
                        : selectedBird.bird.rarity === "uncommon"
                          ? "U"
                          : selectedBird.bird.rarity === "rare"
                            ? "R"
                            : "L"}
                    </span>
                  </div>
                </div>

                {/* Success animation */}
                {captured && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-emerald-500 rounded-full p-6 animate-bounce">
                      <Check className="w-12 h-12 text-white" />
                    </div>
                  </div>
                )}

                {/* Failed animation */}
                {failed && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-red-500 rounded-full p-6 animate-bounce">
                      <X className="w-12 h-12 text-white" />
                    </div>
                  </div>
                )}
              </div>

              {/* Bird info */}
              <div className="text-center mb-4">
                <h2 className="text-2xl font-bold mb-1">{selectedBird.bird.nameJa}</h2>
                <p className="text-sm text-muted-foreground mb-2">{selectedBird.bird.name}</p>
                <span
                  className="inline-block text-xs px-3 py-1 rounded-full text-white font-medium"
                  style={{ backgroundColor: RARITY_COLORS[selectedBird.bird.rarity] }}
                >
                  {RARITY_LABELS[selectedBird.bird.rarity]}
                </span>
              </div>
              <p className="text-sm text-muted-foreground text-center mb-2">{selectedBird.bird.description}</p>
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">生息地:</span> {selectedBird.bird.habitat}
              </div>
            </div>

            {/* Capture button */}
            {!captured && !failed && (
              <Button
                size="lg"
                onClick={handleCapture}
                disabled={capturing}
                className="w-full h-12 text-lg font-semibold bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                {capturing ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>捕獲中...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Camera className="w-5 h-5" />
                    <span>捕獲する</span>
                  </div>
                )}
              </Button>
            )}

            {captured && (
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600 mb-2">捕獲成功!</p>
                <p className="text-sm text-muted-foreground">図鑑に追加されました</p>
              </div>
            )}

            {failed && (
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600 mb-2">逃げられた...</p>
                <p className="text-sm text-muted-foreground">もう一度挑戦してください</p>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
