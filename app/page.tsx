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

const SPAWN_DISTANCE_THRESHOLD = 50

export default function MapPage() {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [birdSpawns, setBirdSpawns] = useState<BirdSpawn[]>([])
  const [loading, setLoading] = useState(true)
  const [nearbyCount, setNearbyCount] = useState(0)
  const [distanceWalked, setDistanceWalked] = useState(0)
  const [heading, setHeading] = useState(0)

  useEffect(() => {
    // Get user location
    const savedLocation = storage.getUserLocation()
    if (savedLocation) {
      console.log("[v0] Loaded saved location:", savedLocation)
      setUserLocation(savedLocation)
      loadBirdSpawns(savedLocation)
    } else {
      // Default to Tokyo coordinates
      const defaultLocation = { lat: 35.6762, lng: 139.6503 }
      console.log("[v0] Using default location:", defaultLocation)
      setUserLocation(defaultLocation)
      storage.setUserLocation(defaultLocation)
      loadBirdSpawns(defaultLocation)
    }

    const movement = storage.getUserMovement()
    setDistanceWalked(movement.totalDistance)

    setLoading(false)

    if (typeof window !== "undefined" && "DeviceOrientationEvent" in window) {
      const handleOrientation = (event: DeviceOrientationEvent) => {
        if (event.alpha !== null) {
          setHeading(event.alpha)
        }
      }
      window.addEventListener("deviceorientation", handleOrientation)
      return () => window.removeEventListener("deviceorientation", handleOrientation)
    }
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

  const loadBirdSpawns = (location: { lat: number; lng: number }) => {
    let spawns = storage.getBirdSpawns()
    const now = Date.now()

    console.log("[v0] Loading bird spawns, current count:", spawns.length)

    // Remove expired spawns
    spawns = spawns.filter((spawn) => spawn.expiresAt > now)

    if (spawns.length === 0) {
      console.log("[v0] No spawns found, generating new ones")
      spawns = generateBirdSpawns(location, 5)
      storage.setBirdSpawns(spawns)
    }

    console.log("[v0] Final spawns count:", spawns.length)
    setBirdSpawns(spawns)
    setNearbyCount(spawns.length)
  }

  const generateNewBirds = (location: { lat: number; lng: number }) => {
    console.log("[v0] Generating new birds at location:", location)
    const newSpawns = generateBirdSpawns(location, 3) // Generate 3 new birds
    console.log("[v0] Generated new spawns:", newSpawns.length)
    const existingSpawns = storage.getBirdSpawns()
    const allSpawns = [...existingSpawns, ...newSpawns]
    console.log("[v0] Total spawns after generation:", allSpawns.length)
    storage.setBirdSpawns(allSpawns)
    setBirdSpawns(allSpawns)
    setNearbyCount(allSpawns.length)
  }

  const generateBirdSpawns = (center: { lat: number; lng: number }, count: number): BirdSpawn[] => {
    console.log("[v0] generateBirdSpawns called with count:", count)
    const spawns: BirdSpawn[] = []
    const radius = 0.001 // Reduced radius to ~100m for better visibility

    for (let i = 0; i < count; i++) {
      // Random bird based on rarity
      const rand = Math.random()
      let bird
      if (rand < 0.5) {
        // 50% common
        bird = BIRDS.filter((b) => b.rarity === "common")[
          Math.floor(Math.random() * BIRDS.filter((b) => b.rarity === "common").length)
        ]
      } else if (rand < 0.8) {
        // 30% uncommon
        bird = BIRDS.filter((b) => b.rarity === "uncommon")[
          Math.floor(Math.random() * BIRDS.filter((b) => b.rarity === "uncommon").length)
        ]
      } else if (rand < 0.95) {
        // 15% rare
        bird = BIRDS.filter((b) => b.rarity === "rare")[
          Math.floor(Math.random() * BIRDS.filter((b) => b.rarity === "rare").length)
        ]
      } else {
        // 5% legendary
        bird = BIRDS.filter((b) => b.rarity === "legendary")[
          Math.floor(Math.random() * BIRDS.filter((b) => b.rarity === "legendary").length)
        ]
      }

      if (bird) {
        spawns.push({
          id: `${Date.now()}-${i}`,
          birdId: bird.id,
          lat: center.lat + (Math.random() - 0.5) * radius,
          lng: center.lng + (Math.random() - 0.5) * radius,
          expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
        })
      }
    }

    console.log("[v0] Generated spawns:", spawns)
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
      )
    }
  }

  const refreshSpawns = () => {
    if (userLocation) {
      storage.setBirdSpawns([])
      loadBirdSpawns(userLocation)
    }
  }

  const debugSpawnBirds = () => {
    console.log("[v0] Debug spawn button clicked")
    console.log("[v0] Current userLocation:", userLocation)
    if (userLocation) {
      // Generate birds directly in front of the user (within 50m and in view)
      const debugSpawns: BirdSpawn[] = []
      const distances = [20, 40, 60] // Different distances for variety

      for (let i = 0; i < 3; i++) {
        const rand = Math.random()
        let bird
        if (rand < 0.5) {
          bird = BIRDS.filter((b) => b.rarity === "common")[
            Math.floor(Math.random() * BIRDS.filter((b) => b.rarity === "common").length)
          ]
        } else if (rand < 0.8) {
          bird = BIRDS.filter((b) => b.rarity === "uncommon")[
            Math.floor(Math.random() * BIRDS.filter((b) => b.rarity === "uncommon").length)
          ]
        } else if (rand < 0.95) {
          bird = BIRDS.filter((b) => b.rarity === "rare")[
            Math.floor(Math.random() * BIRDS.filter((b) => b.rarity === "rare").length)
          ]
        } else {
          bird = BIRDS.filter((b) => b.rarity === "legendary")[
            Math.floor(Math.random() * BIRDS.filter((b) => b.rarity === "legendary").length)
          ]
        }

        if (bird) {
          // Place birds in front of user (small offset in lat/lng)
          const distance = distances[i]
          const angle = (Math.random() - 0.5) * 0.5 // Small angle variation (-0.25 to 0.25 radians)
          const latOffset = (distance / 111000) * Math.cos(angle) // Convert meters to degrees
          const lngOffset = (distance / (111000 * Math.cos((userLocation.lat * Math.PI) / 180))) * Math.sin(angle)

          debugSpawns.push({
            id: `debug-${Date.now()}-${i}`,
            birdId: bird.id,
            lat: userLocation.lat + latOffset,
            lng: userLocation.lng + lngOffset,
            expiresAt: Date.now() + 30 * 60 * 1000,
          })
        }
      }

      console.log("[v0] Generated debug spawns:", debugSpawns)
      storage.setBirdSpawns(debugSpawns)
      setBirdSpawns(debugSpawns)
      setNearbyCount(debugSpawns.length)
      setDistanceWalked(0)
      console.log("[v0] Birds spawned successfully in front of user")
    } else {
      console.log("[v0] No user location available")
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
            heading={heading}
            onBirdCaptured={handleBirdCaptured}
          />
        )}
      </main>

      <BottomNav />
    </div>
  )
}
