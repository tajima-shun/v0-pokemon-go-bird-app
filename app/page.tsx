"use client"

import { useEffect, useState } from "react"
import { Navigation, RefreshCw, Bug } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { BottomNav } from "@/components/bottom-nav"
import { FirstPersonView } from "@/components/first-person-view"
import { BIRDS, type BirdSpawn } from "@/lib/birds"
import { storage } from "@/lib/storage"
import { calculateDistance } from "@/lib/geo-utils"
import { mapObsToBird, type DynamicBird } from "@/lib/ebird"

const SPAWN_DISTANCE_THRESHOLD = 50

export default function MapPage() {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [birdSpawns, setBirdSpawns] = useState<BirdSpawn[]>([])
  const [loading, setLoading] = useState(true)
  const [nearbyCount, setNearbyCount] = useState(0)
  const [distanceWalked, setDistanceWalked] = useState(0)
  const [mode] = useState<"ar">("ar")
  const [dynamicBirds, setDynamicBirds] = useState<DynamicBird[] | null>(null)

  useEffect(() => {
    // Get user location
    const savedLocation = storage.getUserLocation()
    if (savedLocation) {
      setUserLocation(savedLocation)
      loadBirdSpawns(savedLocation)
    } else {
      // Default to Tokyo coordinates
      const defaultLocation = { lat: 35.6762, lng: 139.6503 }
      setUserLocation(defaultLocation)
      storage.setUserLocation(defaultLocation)
      loadBirdSpawns(defaultLocation)
    }

    const movement = storage.getUserMovement()
    setDistanceWalked(movement.totalDistance)

    setLoading(false)

    
  }, [])

  useEffect(() => {
    if (!userLocation) return

    const watchId = navigator.geolocation?.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }

        const movement = storage.getUserMovement()

        // Calculate distance moved
        if (movement.lastPosition) {
          const distanceMoved = calculateDistance(
            movement.lastPosition.lat,
            movement.lastPosition.lng,
            newLocation.lat,
            newLocation.lng,
          )

          const newTotalDistance = movement.totalDistance + distanceMoved
          setDistanceWalked(newTotalDistance)

          // Check if user walked enough to spawn new birds
          if (distanceMoved >= SPAWN_DISTANCE_THRESHOLD) {
            generateNewBirds(newLocation)
            // Reset distance counter
            storage.setUserMovement({
              totalDistance: 0,
              lastPosition: newLocation,
              lastUpdateTime: Date.now(),
            })
            setDistanceWalked(0)
          } else {
            storage.setUserMovement({
              totalDistance: newTotalDistance,
              lastPosition: newLocation,
              lastUpdateTime: Date.now(),
            })
          }
        } else {
          storage.setUserMovement({
            totalDistance: 0,
            lastPosition: newLocation,
            lastUpdateTime: Date.now(),
          })
        }

        setUserLocation(newLocation)
        storage.setUserLocation(newLocation)
      },
      (error) => {
        console.error("Error watching location:", error)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000,
      },
    )

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [userLocation])

  const loadBirdSpawns = async (location: { lat: number; lng: number }) => {
    let spawns = storage.getBirdSpawns()
    const now = Date.now()

    // Remove expired spawns
    spawns = spawns.filter((spawn) => spawn.expiresAt > now)

    if (spawns.length === 0) {
      try {
        const pool = await fetchEbirdSpecies(location)
        spawns = generateBirdSpawns(location, 5, pool || undefined)
        storage.setBirdSpawns(spawns)
      } catch (error) {
        // Fallback: generate with empty pool
        spawns = generateBirdSpawns(location, 5)
        storage.setBirdSpawns(spawns)
      }
    }

    setBirdSpawns(spawns)
    setNearbyCount(spawns.length)
  }

  const generateNewBirds = async (location: { lat: number; lng: number }) => {
    const pool = await fetchEbirdSpecies(location)
    const newSpawns = generateBirdSpawns(location, 3, pool || undefined)
    const existingSpawns = storage.getBirdSpawns()
    const allSpawns = [...existingSpawns, ...newSpawns]
    storage.setBirdSpawns(allSpawns)
    setBirdSpawns(allSpawns)
    setNearbyCount(allSpawns.length)
  }

  async function resolveImage(name: string) {
    try {
      const r = await fetch(`/api/bird-image?q=${encodeURIComponent(name)}`)
      if (!r.ok) return null
      const j = await r.json()
      return j.imageUrl as string | null
    } catch {
      return null
    }
  }

  async function fetchEbirdSpecies(center: { lat: number; lng: number }) {
    const cellKey = `${center.lat.toFixed(2)},${center.lng.toFixed(2)}`
    const cached = storage.getEbirdSpeciesCache(cellKey)
    if (cached && cached.length > 0) {
      setDynamicBirds(cached)
      return cached as DynamicBird[]
    }
    try {
      const url = `/api/ebird/recent?lat=${center.lat}&lng=${center.lng}&dist=50&back=30`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`eBird fetch failed: ${res.status}`)
      const data = (await res.json()) as any[]
      
      // Map birds and enrich with images (limit to 10 for performance)
      const base = data.map(mapObsToBird)
      const enriched = await Promise.all(
        base.slice(0, 10).map(async (b) => {
          try {
            const imgRes = await fetch(`/api/bird-image?q=${encodeURIComponent(b.species || b.name)}&speciesCode=${b.id}`)
            const imgData = await imgRes.json()
            return { ...b, imageUrl: imgData.imageUrl || "/placeholder.jpg" }
          } catch {
            return { ...b, imageUrl: "/placeholder.jpg" }
          }
        })
      )
      storage.setEbirdSpeciesCache(cellKey, enriched)
      setDynamicBirds(enriched)
      return enriched
    } catch (e) {
      setDynamicBirds(null)
      return null
    }
  }

  const pickBirdList = async (center: { lat: number; lng: number }) => {
    const eb = await fetchEbirdSpecies(center)
    if (eb && eb.length > 0) return eb
    return BIRDS
  }

  const generateBirdSpawns = (center: { lat: number; lng: number }, count: number, poolOverride?: any[]): BirdSpawn[] => {
    const spawns: BirdSpawn[] = []
    const radius = 0.001 // ~100m radius
    const pool: any[] = poolOverride && poolOverride.length > 0 ? poolOverride : (dynamicBirds && dynamicBirds.length > 0 ? dynamicBirds : BIRDS)
    
    // Pre-filter birds by rarity for better performance
    const commonBirds = pool.filter((b) => b.rarity === "common")
    const uncommonBirds = pool.filter((b) => b.rarity === "uncommon")
    const rareBirds = pool.filter((b) => b.rarity === "rare")
    const legendaryBirds = pool.filter((b) => b.rarity === "legendary")

    for (let i = 0; i < count; i++) {
      const rand = Math.random()
      let bird: any
      
      if (rand < 0.5 && commonBirds.length > 0) {
        bird = commonBirds[Math.floor(Math.random() * commonBirds.length)]
      } else if (rand < 0.8 && uncommonBirds.length > 0) {
        bird = uncommonBirds[Math.floor(Math.random() * uncommonBirds.length)]
      } else if (rand < 0.95 && rareBirds.length > 0) {
        bird = rareBirds[Math.floor(Math.random() * rareBirds.length)]
      } else if (legendaryBirds.length > 0) {
        bird = legendaryBirds[Math.floor(Math.random() * legendaryBirds.length)]
      }

      if (bird) {
        spawns.push({
          id: `${Date.now()}-${i}`,
          birdId: String(bird.id),
          lat: center.lat + (Math.random() - 0.5) * radius,
          lng: center.lng + (Math.random() - 0.5) * radius,
          expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
        })
      }
    }

    return spawns
  }

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }
          setUserLocation(newLocation)
          storage.setUserLocation(newLocation)
          loadBirdSpawns(newLocation)
        },
        (error) => {
          console.error("Error getting location:", error)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      )
    }
  }

  const refreshSpawns = () => {
    if (userLocation) {
      storage.setBirdSpawns([])
      loadBirdSpawns(userLocation)
    }
  }

  const debugSpawnBirds = async () => {
    if (userLocation) {
      const pool = await fetchEbirdSpecies(userLocation)
      const debugSpawns = generateBirdSpawns(userLocation, 3, pool)
      
      // Place birds in front of user
      const distances = [20, 40, 60]
      debugSpawns.forEach((spawn, i) => {
        if (i < distances.length) {
          const distance = distances[i]
          const angle = (Math.random() - 0.5) * 0.5
          const latOffset = (distance / 111000) * Math.cos(angle)
          const lngOffset = (distance / (111000 * Math.cos((userLocation.lat * Math.PI) / 180))) * Math.sin(angle)
          spawn.lat = userLocation.lat + latOffset
          spawn.lng = userLocation.lng + lngOffset
        }
      })

      storage.setBirdSpawns(debugSpawns)
      setBirdSpawns(debugSpawns)
      setNearbyCount(debugSpawns.length)
      setDistanceWalked(0)
    }
  }

  const handleBirdCaptured = () => {
    if (userLocation) {
      const spawns = storage.getBirdSpawns()
      setBirdSpawns(spawns)
      setNearbyCount(spawns.length)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100svh] bg-background pb-[calc(env(safe-area-inset-bottom)+4rem)] relative">
      <header className="absolute top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm shadow-md">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-primary">バードGO</h1>
            <Card className="px-3 py-1 bg-emerald-500 text-white border-0">
              <p className="text-sm font-semibold">近くの鳥: {nearbyCount}</p>
            </Card>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={debugSpawnBirds}
              className="h-9 w-9 bg-amber-100 hover:bg-amber-200 border-amber-300"
              title="デバッグ: 鳥を出現させる"
            >
              <Bug className="w-4 h-4 text-amber-700" />
            </Button>
            <Button variant="outline" size="icon" onClick={refreshSpawns} className="h-9 w-9 bg-transparent">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="default" size="icon" onClick={getCurrentLocation} className="h-9 w-9">
              <Navigation className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="absolute top-20 left-4 z-50">
        <Card className="px-4 py-2 bg-white/90 backdrop-blur-sm">
          <p className="text-xs text-muted-foreground">次の鳥まで</p>
          <p className="text-lg font-bold text-primary">
            {Math.max(0, SPAWN_DISTANCE_THRESHOLD - distanceWalked).toFixed(0)}m
          </p>
        </Card>
      </div>

      <main className="h-[100svh]">
        {userLocation && (
          <FirstPersonView
            userLocation={userLocation}
            birdSpawns={birdSpawns}
            heading={0}
            onBirdCaptured={handleBirdCaptured}
            dynamicBirds={dynamicBirds}
          />
        )}
      </main>

      <BottomNav />
    </div>
  )
}
