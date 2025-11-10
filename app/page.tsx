"use client"

import { useEffect, useRef, useState } from "react"
import { Navigation, RefreshCw, Bug, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { BottomNav } from "@/components/bottom-nav"
import { BIRDS, type BirdSpawn } from "@/lib/birds"
import { storage } from "@/lib/storage"
import { calculateDistance } from "@/lib/geo-utils"
import { mapObsToBird, type DynamicBird } from "@/lib/ebird"
import { 
  BirdRecognitionService, 
  CommunicationHelper, 
  type BirdCaptureData, 
  type LocationData 
} from "@/lib/8thwall-integration"
import { arBridge } from "@/src/utils/arBridge"
import type { ArToApp } from "@/src/types/ar"
import { pokedexStore } from "@/src/stores/pokedex"

const SPAWN_DISTANCE_THRESHOLD = 50

export default function MapPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [birdSpawns, setBirdSpawns] = useState<BirdSpawn[]>([])
  const [loading, setLoading] = useState(true)
  const [nearbyCount, setNearbyCount] = useState(0)
  const [distanceWalked, setDistanceWalked] = useState(0)
  const [dynamicBirds, setDynamicBirds] = useState<DynamicBird[] | null>(null)
  const [capturedBird, setCapturedBird] = useState<{ bird: DynamicBird; location: { lat: number; lng: number } } | null>(null)
  const [showCaptureModal, setShowCaptureModal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const birdRecognitionService = BirdRecognitionService.getInstance()

  useEffect(() => {
    // 8thwallとの通信ハンドラー（useEffect内で定義）
    const handleBirdCapture = (birdData: BirdCaptureData, location: LocationData) => {
      const processedBirdData = birdRecognitionService.processRawBirdData(birdData)
      const bird: DynamicBird = {
        id: processedBirdData.id,
        name: processedBirdData.name,
        nameJa: processedBirdData.nameJa || processedBirdData.name,
        species: processedBirdData.species || "",
        rarity: processedBirdData.rarity,
        imageUrl: processedBirdData.imageUrl || "/placeholder.jpg",
        description: processedBirdData.description || "",
        habitat: processedBirdData.habitat || "",
      }
      setCapturedBird({ bird, location })
      setShowCaptureModal(true)
      setError(null)
    }

    const handleLocationUpdate = (location: LocationData) => {
      setUserLocation(location)
      storage.setUserLocation(location)
    }

    const handleError = (errorMessage: string) => {
      setError(errorMessage)
      console.error("8thwall error:", errorMessage)
    }

    const syncExistingData = () => {
      if (!iframeRef.current) return
      const userLocation = storage.getUserLocation()
      const caughtBirds = storage.getCaughtBirds()
      const caughtBirdIds = caughtBirds.map(cb => cb.birdId)
      CommunicationHelper.sendMessageTo8thwall(iframeRef.current, {
        type: "syncData",
        userLocation: userLocation || undefined,
        caughtBirds: caughtBirdIds
      })
    }

    // 8thwallからのメッセージをリッスン（旧形式）
    const handleMessage = (event: MessageEvent) => {
      // 新しいpostMessage連携を先に試す
      const handled = arBridge.receiveFromAr(event, (message: ArToApp) => {
        console.log('📱 Map page: received AR message', message.type)
        
        switch (message.type) {
          case 'AR_READY':
            console.log('📱 Map page: AR_READY received')
            break
            
          case 'AR_BIRD_CAPTURED':
            console.log('📱 Map page: AR_BIRD_CAPTURED received, handling capture')
            handleARBirdCaptured(message.payload)
            break
            
          case 'AR_BIRD_SPAWNED':
          case 'AR_BIRD_RECOGNIZED':
          case 'AR_CAPTURE_RESULT':
            // 他のメッセージは無視（必要に応じて処理を追加）
            break
        }
      })
      
      // 新しい形式で処理されなかった場合、旧形式を試す
      if (!handled) {
        CommunicationHelper.handleMessageFrom8thwall(
          event,
          handleBirdCapture,
          handleLocationUpdate,
          handleError
        )
      }
    }

    window.addEventListener("message", handleMessage)
    console.log('📱 Map page: message listener added')
    
    // Get user location
    const savedLocation = storage.getUserLocation()
    if (savedLocation) {
      setUserLocation(savedLocation)
    } else {
      // Default to Tokyo coordinates
      const defaultLocation = { lat: 35.6762, lng: 139.6503 }
      setUserLocation(defaultLocation)
      storage.setUserLocation(defaultLocation)
    }

    const movement = storage.getUserMovement()
    setDistanceWalked(movement.totalDistance)

    // iframeの読み込み完了を検知（タイムアウト付き）
    let loadingTimeout: NodeJS.Timeout
    
    const setupIframeLoad = () => {
      const iframe = iframeRef.current
      if (iframe) {
        // 既に読み込まれている場合
        try {
          if (iframe.contentDocument?.readyState === "complete") {
            setLoading(false)
            syncExistingData()
            return
          }
        } catch (e) {
          // クロスオリジンの場合は contentDocument にアクセスできない
        }

        iframe.onload = () => {
          setLoading(false)
          syncExistingData()
          if (loadingTimeout) clearTimeout(loadingTimeout)
        }

        iframe.onerror = () => {
          console.error("Failed to load iframe")
          setLoading(false)
          if (loadingTimeout) clearTimeout(loadingTimeout)
        }
      }
    }

    // タイムアウトを設定（10秒後にフォールバック）
    loadingTimeout = setTimeout(() => {
      console.warn("Iframe loading timeout, continuing anyway")
      setLoading(false)
    }, 10000)

    // 少し遅延してから iframe の設定を行う（DOM が準備されるまで待つ）
    const timeoutId = setTimeout(setupIframeLoad, 100)

    return () => {
      window.removeEventListener("message", handleMessage)
      console.log('📱 Map page: message listener removed')
      if (loadingTimeout) clearTimeout(loadingTimeout)
      clearTimeout(timeoutId)
    }
  }, [])

  // AR_BIRD_CAPTUREDメッセージのハンドラー
  const handleARBirdCaptured = async (payload: {
    birdId: string
    species: string
    capturedAt: number
  }) => {
    console.log('📱 Map page: handleARBirdCaptured called', payload)
    
    if (!userLocation) {
      console.warn('📱 Map page: userLocation not available')
      const savedLocation = storage.getUserLocation()
      if (!savedLocation) {
        console.error('📱 Map page: no user location available')
        return
      }
    }

    const currentLocation = userLocation || storage.getUserLocation() || { lat: 35.6762, lng: 139.6503 }
    const captureId = `capture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // まず既存のカタログ（regionBirds）からspeciesでマッチする鳥を探す
    // ただし、この時点ではregionBirdsが読み込まれていない可能性があるため、
    // まずはcoal titの情報を取得し、後で図鑑ページでマッチングする
    const coalTitSpecies = 'Periparus ater'
    const coalTit = BIRDS.find((b) => b.species === coalTitSpecies || b.name === 'Coal Tit' || b.nameJa === 'コガラ') || BIRDS.find((b) => b.id === 'fallback-3') || BIRDS[2]

    try {
      const res = await fetch('/api/pokedex/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captureId,
          birdId: coalTit.id, // 一時的なID、図鑑ページでspeciesマッチングにより正しいIDにマッピングされる
          species: coalTitSpecies,
          lat: currentLocation.lat,
          lng: currentLocation.lng,
        }),
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Capture API failed: ${res.status} - ${errorText}`)
      }
      
      const apiEntry = await res.json()

      const entry = {
        ...apiEntry,
        meta: {
          ...apiEntry.meta,
          name: coalTit.name,
          nameJa: coalTit.nameJa,
          rarity: coalTit.rarity,
          imageUrl: coalTit.imageUrl,
          description: coalTit.description,
          habitat: coalTit.habitat,
        },
      }

      const added = pokedexStore.addEntry(entry, captureId)
      if (added) {
        console.log('✅ Map page: コガラを図鑑に登録しました', entry)
        // 既存のstorageにも追加
        storage.addCaughtBird({
          birdId: coalTit.id,
          caughtAt: entry.capturedAt,
          location: entry.location,
        })
      } else {
        console.warn('⚠️ Map page: 図鑑への登録がスキップされました（重複の可能性）')
      }
    } catch (err) {
      console.error('❌ Map page: 捕獲処理に失敗しました', err)
      setError(`捕獲処理に失敗しました: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

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
        spawns = generateBirdSpawns(location, 5, pool as any)
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
      const debugSpawns = generateBirdSpawns(userLocation, 3, pool as any)
      
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

  const confirmCapture = () => {
    if (!capturedBird) return

    // 図鑑に追加
    const caughtBird = {
      birdId: capturedBird.bird.id,
      caughtAt: Date.now(),
      location: capturedBird.location,
    }

    storage.addCaughtBird(caughtBird)

    // モーダルを閉じる
    setShowCaptureModal(false)
    setCapturedBird(null)

    // 8thwallに捕獲完了を通知
    if (iframeRef.current) {
      CommunicationHelper.sendMessageTo8thwall(iframeRef.current, {
        type: "captureConfirmed",
        birdId: capturedBird.bird.id
      })
    }
  }

  const cancelCapture = () => {
    setShowCaptureModal(false)
    setCapturedBird(null)

    // 8thwallにキャンセルを通知
    if (iframeRef.current) {
      CommunicationHelper.sendMessageTo8thwall(iframeRef.current, {
        type: "captureCancelled"
      })
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

      {/* エラー表示 */}
      {error && (
        <div className="absolute top-20 left-4 right-4 z-50">
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <p className="text-sm text-red-700">エラー: {error}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className="ml-auto text-red-600 hover:text-red-800"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 8thwall iframe */}
      <main className="absolute inset-0 h-[100svh] w-full pt-16">
        <iframe
          ref={iframeRef}
          src="https://tajin.8thwall.app/answer/"
          allowFullScreen
          allow="camera; microphone; geolocation; accelerometer; magnetometer; gyroscope; autoplay; clipboard-read; clipboard-write; fullscreen"
          className="w-full h-full border-none"
          style={{ marginTop: "4rem" }}
        />
      </main>

      {/* 捕獲確認モーダル */}
      {showCaptureModal && capturedBird && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-white p-6 relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={cancelCapture}
              className="absolute top-2 right-2"
            >
              <X className="w-5 h-5" />
            </Button>

            <div className="flex flex-col items-center mb-6">
              <div className="relative mb-4">
                <img
                  src={capturedBird.bird.imageUrl || "/placeholder.svg"}
                  alt={capturedBird.bird.nameJa || capturedBird.bird.name}
                  className="w-48 h-48 object-cover rounded-full shadow-2xl border-8 border-white"
                />
                <div
                  className="absolute -top-2 -right-2 w-10 h-10 rounded-full border-4 border-white shadow-lg flex items-center justify-center"
                  style={{ 
                    backgroundColor: capturedBird.bird.rarity === "common" ? "#10b981" :
                                   capturedBird.bird.rarity === "uncommon" ? "#3b82f6" :
                                   capturedBird.bird.rarity === "rare" ? "#a855f7" : "#f59e0b"
                  }}
                >
                  <span className="text-white text-xs font-bold">
                    {capturedBird.bird.rarity === "common" ? "C" :
                     capturedBird.bird.rarity === "uncommon" ? "U" :
                     capturedBird.bird.rarity === "rare" ? "R" : "L"}
                  </span>
                </div>
              </div>

              <div className="text-center mb-4">
                <h2 className="text-2xl font-bold mb-1">{capturedBird.bird.nameJa || capturedBird.bird.name}</h2>
                <p className="text-sm text-muted-foreground mb-2">{capturedBird.bird.name}</p>
                <span
                  className="inline-block text-xs px-3 py-1 rounded-full text-white font-medium"
                  style={{ 
                    backgroundColor: capturedBird.bird.rarity === "common" ? "#10b981" :
                                   capturedBird.bird.rarity === "uncommon" ? "#3b82f6" :
                                   capturedBird.bird.rarity === "rare" ? "#a855f7" : "#f59e0b"
                  }}
                >
                  {capturedBird.bird.rarity === "common" ? "コモン" :
                   capturedBird.bird.rarity === "uncommon" ? "アンコモン" :
                   capturedBird.bird.rarity === "rare" ? "レア" : "レジェンダリー"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground text-center mb-2">{capturedBird.bird.description}</p>
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">生息地:</span> {capturedBird.bird.habitat}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={cancelCapture}
                className="flex-1 h-12"
              >
                キャンセル
              </Button>
              <Button
                size="lg"
                onClick={confirmCapture}
                className="flex-1 h-12 text-lg font-semibold bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                図鑑に追加
              </Button>
            </div>
          </Card>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
