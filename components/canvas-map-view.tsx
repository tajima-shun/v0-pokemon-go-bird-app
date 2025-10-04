"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import type { BirdSpawn } from "@/lib/birds"
import { BIRDS } from "@/lib/birds"
import { storage } from "@/lib/storage"
import { calculateDistance } from "@/lib/geo-utils"
import { fetchRoadsFromOverpass, type RoadData } from "@/utils/overpass"
import { getRoadStyle } from "@/utils/roadStyleConfig"
import type { DynamicBird } from "@/lib/ebird"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

function getRarityColor(rarity: string): string {
  switch (rarity) {
    case "common":
      return "#9ca3af"
    case "uncommon":
      return "#10b981"
    case "rare":
      return "#3b82f6"
    case "legendary":
      return "#f59e0b"
    default:
      return "#9ca3af"
  }
}

function getRarityLabel(rarity: string): string {
  switch (rarity) {
    case "common":
      return "コモン"
    case "uncommon":
      return "アンコモン"
    case "rare":
      return "レア"
    case "legendary":
      return "レジェンダリー"
    default:
      return "コモン"
  }
}

interface CanvasMapViewProps {
  userLocation: { lat: number; lng: number }
  birdSpawns: BirdSpawn[]
  onBirdCaptured?: () => void
  dynamicBirds?: DynamicBird[] | null
}

export function CanvasMapView({ userLocation, birdSpawns, onBirdCaptured, dynamicBirds }: CanvasMapViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [roadData, setRoadData] = useState<RoadData | null>(null)
  const [selectedBird, setSelectedBird] = useState<{ spawn: BirdSpawn; bird: any } | null>(null)
  const [captureSuccess, setCaptureSuccess] = useState(false)
  const birdImagesRef = useRef<Map<string, HTMLImageElement>>(new Map())

  useEffect(() => {
    // Cache road data to prevent flickering
    const cacheKey = `${userLocation.lat.toFixed(3)},${userLocation.lng.toFixed(3)}`
    const cached = sessionStorage.getItem(`roads_${cacheKey}`)
    
    if (cached) {
      try {
        setRoadData(JSON.parse(cached))
      } catch {
        // If parsing fails, fetch fresh data
        fetchRoadsFromOverpass(userLocation.lat, userLocation.lng, 500).then((data) => {
          if (data) {
            sessionStorage.setItem(`roads_${cacheKey}`, JSON.stringify(data))
            setRoadData(data)
          }
        })
      }
    } else {
      fetchRoadsFromOverpass(userLocation.lat, userLocation.lng, 500).then((data) => {
        if (data) {
          sessionStorage.setItem(`roads_${cacheKey}`, JSON.stringify(data))
          setRoadData(data)
        }
      })
    }
  }, [userLocation])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    // Set canvas to fill entire container
    canvas.style.width = '100%'
    canvas.style.height = '100%'

    const zoom = 18
    const tileSize = 256
    const scale = Math.pow(2, zoom)
    const centerX = ((userLocation.lng + 180) / 360) * scale
    const centerY =
      ((1 -
        Math.log(Math.tan((userLocation.lat * Math.PI) / 180) + 1 / Math.cos((userLocation.lat * Math.PI) / 180)) /
          Math.PI) /
        2) *
      scale

    const pixelsPerTile = tileSize
    const metersPerPixel = (40075016.686 * Math.cos((userLocation.lat * Math.PI) / 180)) / (pixelsPerTile * scale)

    function latLngToCanvas(lat: number, lng: number): { x: number; y: number } {
      const x = ((lng + 180) / 360) * scale
      const y =
        ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * scale

      const canvasX = (x - centerX) * pixelsPerTile + rect.width / 2
      const canvasY = (y - centerY) * pixelsPerTile + rect.height / 2

      return { x: canvasX, y: canvasY }
    }

    ctx.clearRect(0, 0, rect.width, rect.height)

    // Draw background - top-down view with subtle gradient
    const gradient = ctx.createRadialGradient(rect.width/2, rect.height/2, 0, rect.width/2, rect.height/2, Math.max(rect.width, rect.height)/2)
    gradient.addColorStop(0, "#f0f9ff")
    gradient.addColorStop(0.7, "#e0f2fe")
    gradient.addColorStop(1, "#bae6fd")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, rect.width, rect.height)

    // Draw roads (simplified and stable)
    if (roadData && roadData.features.length > 0) {
      // Group roads by type for better performance
      const roadsByType: Record<string, typeof roadData.features> = {}
      roadData.features.forEach((feature) => {
        const highway = feature.properties.highway
        if (!roadsByType[highway]) {
          roadsByType[highway] = []
        }
        roadsByType[highway].push(feature)
      })

      // Draw roads by type
      Object.entries(roadsByType).forEach(([highway, features]) => {
        const style = getRoadStyle(highway)
        
        // Draw outline (dark border)
        ctx.strokeStyle = style.outline.color
        ctx.lineWidth = style.outline.width
        ctx.lineCap = "round"
        ctx.lineJoin = "round"

        features.forEach((feature) => {
          const coords = feature.geometry.coordinates
          if (coords.length < 2) return
          
          ctx.beginPath()
          coords.forEach((coord, i) => {
            const pos = latLngToCanvas(coord[1], coord[0])
            if (i === 0) ctx.moveTo(pos.x, pos.y)
            else ctx.lineTo(pos.x, pos.y)
          })
          ctx.stroke()
        })

        // Draw fill (road surface)
        ctx.strokeStyle = style.fill.color
        ctx.lineWidth = style.fill.width
        ctx.lineCap = "round"
        ctx.lineJoin = "round"

        features.forEach((feature) => {
          const coords = feature.geometry.coordinates
          if (coords.length < 2) return
          
          ctx.beginPath()
          coords.forEach((coord, i) => {
            const pos = latLngToCanvas(coord[1], coord[0])
            if (i === 0) ctx.moveTo(pos.x, pos.y)
            else ctx.lineTo(pos.x, pos.y)
          })
          ctx.stroke()
        })

        // Draw centerline (white dashed line)
        if (style.centerline) {
          ctx.strokeStyle = style.centerline.color
          ctx.lineWidth = style.centerline.width
          ctx.setLineDash(style.centerline.dashArray)
          ctx.lineCap = "round"
          ctx.lineJoin = "round"

          features.forEach((feature) => {
            const coords = feature.geometry.coordinates
            if (coords.length < 2) return
            
            ctx.beginPath()
            coords.forEach((coord, i) => {
              const pos = latLngToCanvas(coord[1], coord[0])
              if (i === 0) ctx.moveTo(pos.x, pos.y)
              else ctx.lineTo(pos.x, pos.y)
            })
            ctx.stroke()
          })
          ctx.setLineDash([])
        }
      })
    }

    // Draw bird markers
    birdSpawns.forEach((spawn) => {
      const pos = latLngToCanvas(spawn.lat, spawn.lng)
      const distance = calculateDistance(userLocation.lat, userLocation.lng, spawn.lat, spawn.lng)

      const allBirds = dynamicBirds && dynamicBirds.length > 0 ? dynamicBirds : BIRDS
      const bird = allBirds.find((b) => String(b.id) === spawn.birdId)
      if (!bird) return

      // Skip birds that are too far away
      if (distance > 150) return

      // Draw marker circle (larger size like original)
      const markerRadius = 40
      const borderColors: Record<string, string> = {
        common: "#9ca3af",
        uncommon: "#10b981",
        rare: "#3b82f6",
        legendary: "#f59e0b",
      }

      ctx.beginPath()
      ctx.arc(pos.x, pos.y, markerRadius, 0, Math.PI * 2)
      ctx.fillStyle = "white"
      ctx.fill()
      ctx.strokeStyle = borderColors[bird.rarity] || "#9ca3af"
      ctx.lineWidth = 4
      ctx.stroke()

      // Draw bird image (larger size like original)
      const imageKey = `${bird.id}`
      let img = birdImagesRef.current.get(imageKey)

      if (!img) {
        img = new Image()
        img.crossOrigin = "anonymous"
        img.src = bird.imageUrl || "/placeholder.svg?height=100&width=100"
        img.onload = () => {
          const canvas = canvasRef.current
          if (canvas) {
            const event = new Event("imageLoaded")
            canvas.dispatchEvent(event)
          }
        }
        birdImagesRef.current.set(imageKey, img)
      }

      if (img.complete) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, markerRadius - 4, 0, Math.PI * 2)
        ctx.clip()
        ctx.drawImage(
          img,
          pos.x - markerRadius + 4,
          pos.y - markerRadius + 4,
          (markerRadius - 4) * 2,
          (markerRadius - 4) * 2,
        )
        ctx.restore()
      }

      // Draw distance text (like original)
      ctx.fillStyle = "#ef4444"
      ctx.fillRect(pos.x - 30, pos.y + markerRadius + 10, 60, 24)
      ctx.fillStyle = "white"
      ctx.font = "bold 12px sans-serif"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(`${Math.round(distance)}m`, pos.x, pos.y + markerRadius + 22)

      // Draw click area indicator (for debugging - can be removed later)
      if (Math.random() < 0.1) { // Only show occasionally to avoid clutter
        ctx.strokeStyle = "rgba(255, 0, 0, 0.3)"
        ctx.lineWidth = 1
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, 50, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
      }
    })

    // Draw player position - top-down view
    const playerPos = latLngToCanvas(userLocation.lat, userLocation.lng)
    
    // Outer ring
    ctx.fillStyle = "rgba(59, 130, 246, 0.2)"
    ctx.beginPath()
    ctx.arc(playerPos.x, playerPos.y, 25, 0, Math.PI * 2)
    ctx.fill()
    
    // Inner ring
    ctx.fillStyle = "rgba(59, 130, 246, 0.6)"
    ctx.beginPath()
    ctx.arc(playerPos.x, playerPos.y, 15, 0, Math.PI * 2)
    ctx.fill()
    
    // Center dot
    ctx.fillStyle = "#3b82f6"
    ctx.beginPath()
    ctx.arc(playerPos.x, playerPos.y, 6, 0, Math.PI * 2)
    ctx.fill()
    
    // Direction indicator (small arrow)
    ctx.fillStyle = "#1d4ed8"
    ctx.beginPath()
    ctx.moveTo(playerPos.x, playerPos.y - 12)
    ctx.lineTo(playerPos.x - 4, playerPos.y - 6)
    ctx.lineTo(playerPos.x + 4, playerPos.y - 6)
    ctx.closePath()
    ctx.fill()

    const handleImageLoaded = () => {
      requestAnimationFrame(() => {
        if (canvasRef.current) {
          const event = new Event("redraw")
          canvasRef.current.dispatchEvent(event)
        }
      })
    }

    canvas.addEventListener("imageLoaded", handleImageLoaded)

    return () => {
      canvas.removeEventListener("imageLoaded", handleImageLoaded)
    }
  }, [userLocation, birdSpawns, roadData, dynamicBirds])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Prevent event bubbling to avoid conflicts
    e.stopPropagation()

    const zoom = 17
    const tileSize = 256
    const scale = Math.pow(2, zoom)
    const centerX = ((userLocation.lng + 180) / 360) * scale
    const centerY =
      ((1 -
        Math.log(Math.tan((userLocation.lat * Math.PI) / 180) + 1 / Math.cos((userLocation.lat * Math.PI) / 180)) /
          Math.PI) /
        2) *
      scale

    const pixelsPerTile = tileSize

    function latLngToCanvas(lat: number, lng: number): { x: number; y: number } {
      const x = ((lng + 180) / 360) * scale
      const y =
        ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * scale

      const canvasX = (x - centerX) * pixelsPerTile + rect.width / 2
      const canvasY = (y - centerY) * pixelsPerTile + rect.height / 2

      return { x: canvasX, y: canvasY }
    }

    // Sort birds by distance to click point for better selection
    const birdsWithDistance = birdSpawns.map((spawn) => {
      const pos = latLngToCanvas(spawn.lat, spawn.lng)
      const distance = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2))
      return { spawn, distance, pos }
    }).sort((a, b) => a.distance - b.distance)

    // Check for bird clicks with larger hit area
    for (const { spawn, distance, pos } of birdsWithDistance) {
      // Increase click area based on marker size
      const clickRadius = 50 // Increased from 20 to 50
      
      if (distance < clickRadius) {
        const allBirds = dynamicBirds && dynamicBirds.length > 0 ? dynamicBirds : BIRDS
        const bird = allBirds.find((b) => String(b.id) === spawn.birdId)
        if (bird) {
          setSelectedBird({ spawn, bird })
          break
        }
      }
    }
  }

  const handleCapture = () => {
    if (!selectedBird) return

    const distance = calculateDistance(
      userLocation.lat,
      userLocation.lng,
      selectedBird.spawn.lat,
      selectedBird.spawn.lng,
    )

    if (distance > 50) {
      alert("鳥が遠すぎます！もっと近づいてください。")
      return
    }

    const captureChance = Math.random()
    const rarityThresholds = {
      common: 0.8,
      uncommon: 0.6,
      rare: 0.4,
      legendary: 0.2,
    }

    const threshold = rarityThresholds[selectedBird.bird.rarity as keyof typeof rarityThresholds] || 0.5

    if (captureChance < threshold) {
      storage.addCaughtBird({
        birdId: selectedBird.bird.id,
        caughtAt: Date.now(),
        location: { lat: selectedBird.spawn.lat, lng: selectedBird.spawn.lng },
      })

      const spawns = storage.getBirdSpawns().filter((s) => s.id !== selectedBird.spawn.id)
      storage.setBirdSpawns(spawns)

      setCaptureSuccess(true)
      setTimeout(() => {
        setCaptureSuccess(false)
        setSelectedBird(null)
        onBirdCaptured?.()
      }, 2000)
    } else {
      alert("捕獲に失敗しました！もう一度試してください。")
      setSelectedBird(null)
    }
  }

  return (
    <>
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onTouchEnd={(e) => {
            // Handle touch events for mobile
            e.preventDefault()
            const touch = e.changedTouches[0]
            if (touch) {
              const rect = canvasRef.current?.getBoundingClientRect()
              if (rect) {
                const syntheticEvent = {
                  clientX: touch.clientX,
                  clientY: touch.clientY,
                  stopPropagation: () => {},
                } as React.MouseEvent<HTMLCanvasElement>
                handleCanvasClick(syntheticEvent)
              }
            }
          }}
          className="w-full h-full cursor-pointer touch-none"
        />
      </div>

      {selectedBird && !captureSuccess && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-white p-6 relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedBird(null)}
              className="absolute top-2 right-2"
            >
              <X className="w-5 h-5" />
            </Button>

            <div className="flex flex-col items-center mb-6">
              <div className="relative mb-4">
                <img
                  src={selectedBird.bird.imageUrl || "/placeholder.svg"}
                  alt={selectedBird.bird.nameJa || selectedBird.bird.name}
                  className="w-48 h-48 object-cover rounded-full shadow-2xl border-8 border-white"
                />
                <div
                  className="absolute -top-2 -right-2 w-10 h-10 rounded-full border-4 border-white shadow-lg flex items-center justify-center"
                  style={{ backgroundColor: getRarityColor(selectedBird.bird.rarity) }}
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

              <div className="text-center mb-4">
                <h2 className="text-2xl font-bold mb-1">{selectedBird.bird.nameJa || selectedBird.bird.name}</h2>
                <p className="text-sm text-muted-foreground mb-2">{selectedBird.bird.name}</p>
                <span
                  className="inline-block text-xs px-3 py-1 rounded-full text-white font-medium"
                  style={{ backgroundColor: getRarityColor(selectedBird.bird.rarity) }}
                >
                  {getRarityLabel(selectedBird.bird.rarity)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground text-center mb-2">{selectedBird.bird.description}</p>
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">生息地:</span> {selectedBird.bird.habitat}
              </div>
            </div>

            <Button
              size="lg"
              onClick={handleCapture}
              className="w-full h-12 text-lg font-semibold bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              <div className="flex items-center gap-2">
                <span>捕獲する</span>
              </div>
            </Button>
          </Card>
        </div>
      )}

      {captureSuccess && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-white p-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-600 mb-2">捕獲成功!</p>
              <p className="text-sm text-muted-foreground">図鑑に追加されました</p>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
