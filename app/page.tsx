"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { Trophy, Award, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { BottomNav } from "@/components/bottom-nav"
import { BattleModal } from "@/components/battle-modal"
import { LevelUpModal } from "@/components/level-up-modal"
import { BattleLoading } from "@/components/battle-loading"
import { BadgeNotification } from "@/components/badge-notification"
import type { BirdSpawn } from "@/lib/birds"
import { storage } from "@/lib/storage"
import { pokedexStore } from "@/src/stores/pokedex"
import { levelStore } from "@/src/stores/level"
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

// バッジの種類と閾値を定義
type BadgeType = {
  name: string
  threshold: number
  color: string
  bgColor: string
}

const BADGES: BadgeType[] = [
  { name: "ブロンズ", threshold: 5, color: "#CD7F32", bgColor: "#FFF4E6" },
  { name: "シルバー", threshold: 10, color: "#C0C0C0", bgColor: "#F5F5F5" },
  { name: "ゴールド", threshold: 15, color: "#FFD700", bgColor: "#FFFACD" },
  { name: "プラチナ", threshold: 20, color: "#E5E4E2", bgColor: "#F8F8F8" },
  { name: "ダイヤモンド", threshold: 25, color: "#B9F2FF", bgColor: "#E6F7FF" },
]

// 獲得したバッジを計算する関数
const getEarnedBadges = (uniqueCount: number): BadgeType[] => {
  return BADGES.filter(badge => uniqueCount >= badge.threshold)
}

// 次のバッジまでの残り種類数を取得
const getNextBadgeProgress = (uniqueCount: number): { nextBadge: BadgeType | null; remaining: number } => {
  const nextBadge = BADGES.find(badge => uniqueCount < badge.threshold)
  if (!nextBadge) {
    return { nextBadge: null, remaining: 0 }
  }
  return {
    nextBadge,
    remaining: nextBadge.threshold - uniqueCount
  }
}

export default function MapPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [birdSpawns, setBirdSpawns] = useState<BirdSpawn[]>([])
  const [loading, setLoading] = useState(true)
  const [dynamicBirds, setDynamicBirds] = useState<DynamicBird[] | null>(null)
  const [capturedBird, setCapturedBird] = useState<{ bird: DynamicBird; location: { lat: number; lng: number } } | null>(null)
  const [showCaptureModal, setShowCaptureModal] = useState(false)
  const [battleTarget, setBattleTarget] = useState<{ id: string; name: string; nameJa: string; species: string; imageUrl: string; rarity: "common" | "uncommon" | "rare" | "legendary" } | null>(null)
  const [isBattleLoading, setIsBattleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [levelUpInfo, setLevelUpInfo] = useState<{ level: number } | null>(null)
  const [levelState, setLevelState] = useState(levelStore.getState())
  const [xpProgress, setXpProgress] = useState(levelStore.getXpProgress())
  const [newBadge, setNewBadge] = useState<BadgeType | null>(null)
  const [prevEarnedBadges, setPrevEarnedBadges] = useState<BadgeType[]>([])
  const birdRecognitionService = BirdRecognitionService.getInstance()

  // バッジの計算（リアクティブに更新するため、stateを使用）
  const [uniqueCaught, setUniqueCaught] = useState(pokedexStore.getEntryCount())

  const earnedBadges = useMemo(() => {
    return getEarnedBadges(uniqueCaught)
  }, [uniqueCaught])

  const nextBadgeProgress = useMemo(() => {
    return getNextBadgeProgress(uniqueCaught)
  }, [uniqueCaught])

  // バッジの更新を検知
  useEffect(() => {
    const checkBadges = () => {
      const currentCount = pokedexStore.getEntryCount()
      setUniqueCaught(currentCount)
      
      const currentEarnedBadges = getEarnedBadges(currentCount)
      const prevBadgeNames = new Set(prevEarnedBadges.map(b => b.name))
      const newBadges = currentEarnedBadges.filter(b => !prevBadgeNames.has(b.name))
      
      if (newBadges.length > 0) {
        // 最新のバッジを表示
        setNewBadge(newBadges[newBadges.length - 1])
        setPrevEarnedBadges(currentEarnedBadges)
      } else if (prevEarnedBadges.length === 0 && currentEarnedBadges.length > 0) {
        // 初回のバッジ取得時は通知しない
        setPrevEarnedBadges(currentEarnedBadges)
      }
    }

    // 初期チェック
    checkBadges()

    // 定期的にチェック（localStorageの変更を検知）
    const interval = setInterval(checkBadges, 1000)
    
    // storageイベントをリッスン（他のタブからの変更を検知）
    window.addEventListener('storage', checkBadges)

    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', checkBadges)
    }
  }, [prevEarnedBadges])

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
    
    // レベルストアの変更を監視
    const unsubscribe = levelStore.subscribe(() => {
      setLevelState(levelStore.getState())
      setXpProgress(levelStore.getXpProgress())
    })
    
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
      unsubscribe()
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

    // 図鑑に登録があるかチェック（先にチェックして、バトルが必要かどうかを判断）
    const pokedexEntries = pokedexStore.getAllEntries()
    const needsBattle = pokedexEntries.length > 0

    // バトルが必要な場合は、即座にロード画面を表示
    if (needsBattle) {
      setIsBattleLoading(true)
    }

    // 位置情報から取得した鳥のリストを取得
    let availableBirds: DynamicBird[] = []
    
    // まず、位置情報からeBird APIで鳥を取得（図鑑ページと同じロジック）
    const loc = userLocation || storage.getUserLocation()
    if (loc) {
      try {
        const res = await fetch(`/api/ebird/recent?lat=${loc.lat}&lng=${loc.lng}&dist=50&back=30`)
        if (res.ok) {
          const arr = await res.json()
          // mapObsToBirdを使ってDynamicBird形式に変換
          const { mapObsToBird } = await import('@/lib/ebird')
          const base = arr.map(mapObsToBird)
          
          // 画像取得を最適化：バトルが必要な場合は最初の1件だけ画像を取得し、残りは後で
          if (needsBattle && base.length > 0) {
            // バトル用：最初の1件だけ画像を取得
            const firstBird = base[0]
            try {
              const imgRes = await fetch(`/api/bird-image?q=${encodeURIComponent(firstBird.species || firstBird.name)}&speciesCode=${firstBird.id}`)
              const imgData = await imgRes.json()
              availableBirds = [{
                ...firstBird,
                imageUrl: imgData.imageUrl || "/placeholder.jpg",
                nameJa: imgData.nameJa || firstBird.nameJa || firstBird.name,
                name: imgData.name || firstBird.name,
              }]
            } catch {
              availableBirds = [{ ...firstBird, imageUrl: "/placeholder.jpg" }]
            }
            
            // 残りの鳥は画像なしで追加（バックグラウンドで画像を取得）
            availableBirds = [
              ...availableBirds,
              ...base.slice(1, 30).map(b => ({ ...b, imageUrl: "/placeholder.jpg" }))
            ]
            
            // バックグラウンドで画像を取得（非同期、バトル表示をブロックしない）
            Promise.all(
              base.slice(1, 30).map(async (b) => {
                try {
                  const imgRes = await fetch(`/api/bird-image?q=${encodeURIComponent(b.species || b.name)}&speciesCode=${b.id}`)
                  const imgData = await imgRes.json()
                  return { 
                    ...b, 
                    imageUrl: imgData.imageUrl || "/placeholder.jpg",
                    nameJa: imgData.nameJa || b.nameJa || b.name,
                    name: imgData.name || b.name,
                  }
                } catch {
                  return { ...b, imageUrl: "/placeholder.jpg" }
                }
              })
            ).then(images => {
              // 画像が取得できたら更新（ただし、バトル画面には影響しない）
              console.log('Background images loaded:', images.length)
            })
          } else {
            // バトル不要な場合：通常通り全件取得
            availableBirds = await Promise.all(
              base.slice(0, 30).map(async (b) => {
                try {
                  const imgRes = await fetch(`/api/bird-image?q=${encodeURIComponent(b.species || b.name)}&speciesCode=${b.id}`)
                  const imgData = await imgRes.json()
                  return { 
                    ...b, 
                    imageUrl: imgData.imageUrl || "/placeholder.jpg",
                    nameJa: imgData.nameJa || b.nameJa || b.name,
                    name: imgData.name || b.name,
                  }
                } catch {
                  return { ...b, imageUrl: "/placeholder.jpg" }
                }
              })
            )
          }
        }
      } catch (error) {
        console.error('Failed to fetch birds from location:', error)
      }
    }

    // 位置情報から取得できなかった場合、図鑑に既に登録されている鳥から選択
    if (availableBirds.length === 0) {
      const pokedexEntries = pokedexStore.getAllEntries()
      if (pokedexEntries.length > 0) {
        availableBirds = pokedexEntries.map(entry => ({
          id: entry.birdId,
          name: entry.meta?.name || 'Unknown',
          nameJa: entry.meta?.nameJa || '不明',
          species: entry.species,
          rarity: (entry.meta?.rarity as "common" | "uncommon" | "rare" | "legendary") || "common",
          imageUrl: entry.meta?.imageUrl || "/placeholder.jpg",
          description: entry.meta?.description || "",
          habitat: entry.meta?.habitat || "",
        }))
      }
    }

    // BIRDSのフォールバックは使用しない（APIから取得した情報のみを使用）
    // 位置情報が取得できない場合は、空のリストのままにする

    // ランダムに1つ選択
    if (availableBirds.length === 0) {
      console.warn('📱 Map page: No birds available from API or pokedex')
      setIsBattleLoading(false)
      return
    }

    let randomBird = availableBirds[Math.floor(Math.random() * availableBirds.length)]
    console.log('📱 Map page: Selected random bird:', randomBird)

    // 選択した鳥の画像が取得されていない場合（placeholderの場合）、画像を取得
    if (randomBird.imageUrl === "/placeholder.jpg" && randomBird.species) {
      try {
        const imgRes = await fetch(`/api/bird-image?q=${encodeURIComponent(randomBird.species || randomBird.name)}&speciesCode=${randomBird.id}`)
        const imgData = await imgRes.json()
        randomBird = {
          ...randomBird,
          imageUrl: imgData.imageUrl || "/placeholder.jpg",
          nameJa: imgData.nameJa || randomBird.nameJa || randomBird.name,
          name: imgData.name || randomBird.name,
        }
        console.log('📱 Map page: Image fetched for selected bird:', randomBird)
      } catch (error) {
        console.error('Failed to fetch image for selected bird:', error)
        // エラーでも続行（placeholderのまま）
      }
    }

    // 図鑑に何も登録されていない場合は、バトルをせずに直接登録
    if (pokedexEntries.length === 0) {
      console.log('📱 Map page: Pokedex is empty, capturing directly without battle')
      // 直接捕獲処理を実行
      const currentLocation = userLocation || storage.getUserLocation() || { lat: 35.6762, lng: 139.6503 }
      const captureId = `capture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      try {
        const res = await fetch('/api/pokedex/capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            captureId,
            birdId: randomBird.id,
            species: randomBird.species,
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
            name: randomBird.name,
            nameJa: randomBird.nameJa,
            rarity: randomBird.rarity,
            imageUrl: randomBird.imageUrl,
            description: '',
            habitat: '',
          },
        }

        const added = pokedexStore.addEntry(entry, captureId)
        if (added) {
          console.log('✅ Map page: 鳥を図鑑に登録しました', entry)
          storage.addCaughtBird({
            birdId: randomBird.id,
            caughtAt: entry.capturedAt,
            location: entry.location,
          })
          
          // XPを付与（基本XP: 50、レアリティに応じて調整）
          const { leveledUp, newLevel } = levelStore.addXp(50, randomBird.rarity)
          if (leveledUp) {
            console.log(`🎉 レベルアップ！ レベル ${newLevel} に到達しました！`)
            setLevelUpInfo({ level: newLevel })
          }
          
          // バッジの更新をチェック
          setUniqueCaught(pokedexStore.getEntryCount())
          
          // 捕獲確認モーダルを表示
          setCapturedBird({
            bird: randomBird,
            location: currentLocation,
          })
          setShowCaptureModal(true)
        } else {
          console.warn('⚠️ Map page: 図鑑への登録がスキップされました（重複の可能性）')
        }
      } catch (err) {
        console.error('❌ Map page: 捕獲処理に失敗しました', err)
        setError(`捕獲処理に失敗しました: ${err instanceof Error ? err.message : String(err)}`)
      }
      return
    }

    // 図鑑に登録がある場合は、バトル対象として設定
    setBattleTarget({
      id: randomBird.id,
      name: randomBird.name,
      nameJa: randomBird.nameJa,
      species: randomBird.species,
      imageUrl: randomBird.imageUrl,
      rarity: randomBird.rarity,
    })
    
    // ロード画面を非表示にする（バトル画面が表示される）
    setIsBattleLoading(false)
  }

  // バトル勝利時の処理
  const handleBattleVictory = async () => {
    if (!battleTarget) return

    if (!userLocation) {
      console.warn('📱 Map page: userLocation not available')
      const savedLocation = storage.getUserLocation()
      if (!savedLocation) {
        console.error('📱 Map page: no user location available')
        setBattleTarget(null)
        return
      }
    }

    const currentLocation = userLocation || storage.getUserLocation() || { lat: 35.6762, lng: 139.6503 }
    const captureId = `capture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    try {
      const res = await fetch('/api/pokedex/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captureId,
          birdId: battleTarget.id,
          species: battleTarget.species,
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
          name: battleTarget.name,
          nameJa: battleTarget.nameJa,
          rarity: battleTarget.rarity,
          imageUrl: battleTarget.imageUrl,
          description: '',
          habitat: '',
        },
      }

      const added = pokedexStore.addEntry(entry, captureId)
      if (added) {
        console.log('✅ Map page: コガラを図鑑に登録しました', entry)
        // 既存のstorageにも追加
        storage.addCaughtBird({
          birdId: battleTarget.id,
          caughtAt: entry.capturedAt,
          location: entry.location,
        })
        
        // XPを付与（基本XP: 50、レアリティに応じて調整）
        const { leveledUp, newLevel } = levelStore.addXp(50, battleTarget.rarity)
        if (leveledUp) {
          console.log(`🎉 レベルアップ！ レベル ${newLevel} に到達しました！`)
          setLevelUpInfo({ level: newLevel })
        }
        
        // バッジの更新をチェック
        setUniqueCaught(pokedexStore.getEntryCount())
      } else {
        console.warn('⚠️ Map page: 図鑑への登録がスキップされました（重複の可能性）')
      }

      setBattleTarget(null)
    } catch (err) {
      console.error('❌ Map page: 捕獲処理に失敗しました', err)
      setError(`捕獲処理に失敗しました: ${err instanceof Error ? err.message : String(err)}`)
      setBattleTarget(null)
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

          // Check if user walked enough to spawn new birds
          const SPAWN_DISTANCE_THRESHOLD = 50
          if (distanceMoved >= SPAWN_DISTANCE_THRESHOLD) {
            generateNewBirds(newLocation)
            // Reset distance counter
            storage.setUserMovement({
              totalDistance: 0,
              lastPosition: newLocation,
              lastUpdateTime: Date.now(),
            })
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
  }

  const generateNewBirds = async (location: { lat: number; lng: number }) => {
    const pool = await fetchEbirdSpecies(location)
    const newSpawns = generateBirdSpawns(location, 3, pool || undefined)
    const existingSpawns = storage.getBirdSpawns()
        const allSpawns = [...existingSpawns, ...newSpawns]
        storage.setBirdSpawns(allSpawns)
        setBirdSpawns(allSpawns)
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
    return [] // BIRDSのフォールバックは使用しない
  }

  const generateBirdSpawns = (center: { lat: number; lng: number }, count: number, poolOverride?: any[]): BirdSpawn[] => {
    const spawns: BirdSpawn[] = []
    const radius = 0.001 // ~100m radius
    const pool: any[] = poolOverride && poolOverride.length > 0 ? poolOverride : (dynamicBirds && dynamicBirds.length > 0 ? dynamicBirds : [])
    
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
    }
  }

  const confirmCapture = () => {
    if (!capturedBird) return

    // 既に図鑑に登録済みの場合は、追加処理をスキップ（最初の捕獲時は既に登録済み）
    const existingEntry = pokedexStore.getEntry(capturedBird.bird.id)
    
    // バッジの更新をチェック（捕獲確認後）
    setUniqueCaught(pokedexStore.getEntryCount())
    
    if (!existingEntry) {
      // 図鑑に追加（通常の捕獲フローの場合）
      const caughtBird = {
        birdId: capturedBird.bird.id,
        caughtAt: Date.now(),
        location: capturedBird.location,
      }
      storage.addCaughtBird(caughtBird)
    }

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
      {/* レベル表示（オーバーレイ） */}
      <div className="absolute top-4 left-4 z-50 bg-black/80 backdrop-blur-md rounded-xl p-3 min-w-[160px] border border-yellow-400/30 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <div className="absolute inset-0 bg-yellow-400/30 rounded-full blur-sm animate-pulse" />
            </div>
            <div>
              <span className="text-xs font-semibold text-white/90">Lv.</span>
              <span className="text-lg font-black bg-gradient-to-br from-yellow-400 to-amber-500 bg-clip-text text-transparent ml-0.5">
                {levelState.level}
              </span>
            </div>
          </div>
        </div>
        <div className="relative w-full bg-white/20 rounded-full h-2 mb-1.5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 relative overflow-hidden"
            style={{ width: `${xpProgress.percentage}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/80 font-semibold">
            {xpProgress.current}/{xpProgress.required}
          </span>
          <span className="text-yellow-400/90 font-bold">
            {xpProgress.percentage}%
          </span>
        </div>
      </div>

      {/* バッジ表示（オーバーレイ） - 右上 */}
      <div className="absolute top-4 right-4 z-50 bg-black/80 backdrop-blur-md rounded-xl p-3 max-w-[280px] border border-indigo-400/30 shadow-xl">
        <div className="flex items-center gap-2 mb-2">
          <Award className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-white/90">獲得バッジ</span>
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          {earnedBadges.length > 0 ? (
            earnedBadges.map((badge) => (
              <div
                key={badge.name}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shadow-md"
                style={{
                  backgroundColor: badge.bgColor,
                  color: badge.color,
                  border: `2px solid ${badge.color}`,
                }}
              >
                <Award className="w-3 h-3" style={{ color: badge.color }} />
                <span>{badge.name}</span>
              </div>
            ))
          ) : (
            <div className="text-xs text-white/60 italic">まだバッジを獲得していません</div>
          )}
        </div>
        {nextBadgeProgress.nextBadge && (
          <div className="text-xs text-white/80 pt-2 border-t border-white/10">
            次のバッジ: <span style={{ color: nextBadgeProgress.nextBadge.color, fontWeight: 700 }}>
              {nextBadgeProgress.nextBadge.name}
            </span> (あと{nextBadgeProgress.remaining}種類)
          </div>
        )}
      </div>

      {/* 8thwall iframe */}
      <main className="absolute inset-0 h-[100svh] w-full">
        <iframe
          ref={iframeRef}
          src="https://tajin.8thwall.app/answer/"
          allowFullScreen
          allow="camera; microphone; geolocation; accelerometer; magnetometer; gyroscope; autoplay; clipboard-read; clipboard-write; fullscreen"
          className="w-full h-full border-none"
        />
      </main>

      {/* バトルロード画面 */}
      {isBattleLoading && <BattleLoading />}

      {/* バトルモーダル */}
      {battleTarget && (
        <BattleModal
          targetBird={battleTarget}
          onVictory={handleBattleVictory}
          onCancel={() => {
            setBattleTarget(null)
            setIsBattleLoading(false)
          }}
        />
      )}

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
                <div className="mb-3">
                  <span className="inline-block px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold">
                    {pokedexStore.getEntry(capturedBird.bird.id) ? '獲得しました！' : '捕獲しました！'}
                  </span>
                </div>
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
                size="lg"
                onClick={confirmCapture}
                className="flex-1 h-12 text-lg font-semibold bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                {pokedexStore.getEntry(capturedBird.bird.id) ? '閉じる' : '図鑑に追加'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* レベルアップモーダル */}
      {levelUpInfo && (
        <LevelUpModal
          newLevel={levelUpInfo.level}
          onClose={() => setLevelUpInfo(null)}
        />
      )}

      {/* バッジ通知モーダル */}
      {newBadge && (
        <BadgeNotification
          badge={newBadge}
          onClose={() => setNewBadge(null)}
        />
      )}

      <BottomNav />
    </div>
  )
}
