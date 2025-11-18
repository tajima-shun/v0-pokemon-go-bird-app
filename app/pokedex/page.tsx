"use client"

import { useEffect, useState, useMemo } from "react"
import { Trophy, Calendar, MapPin, Award } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BottomNav } from "@/components/bottom-nav"
import { BIRDS, RARITY_COLORS, RARITY_LABELS } from "@/lib/birds"
import type { DynamicBird } from "@/lib/ebird"
import { storage, type CaughtBird } from "@/lib/storage"
import { LazyBirdImage } from "@/components/lazy-bird-image"
import { pokedexStore } from "@/src/stores/pokedex"
import { levelStore } from "@/src/stores/level"

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

export default function PokedexPage() {
  // ★ mounted フラグで「クライアントでのマウント完了」を判定
  const [mounted, setMounted] = useState(false)
  const [caughtBirds, setCaughtBirds] = useState<CaughtBird[]>([])
  const [selectedBird, setSelectedBird] = useState<string | null>(null)
  const [regionBirds, setRegionBirds] = useState<DynamicBird[] | null>(null)
  const [regionName, setRegionName] = useState<string>("")
  const [isLoadingBirds, setIsLoadingBirds] = useState(true)
  const [levelState, setLevelState] = useState(levelStore.getState())
  const [xpProgress, setXpProgress] = useState(levelStore.getXpProgress())
  const [birdDescriptions, setBirdDescriptions] = useState<Map<string, { description: string | null; descriptionJa: string | null; loading: boolean }>>(new Map())

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const loadBirds = () => {
      // 既存のstorageから取得
      const storageBirds = storage.getCaughtBirds()
      
      // 新しいpokedexStoreから取得
      const pokedexEntries = pokedexStore.getAllEntries()
      
      // pokedexStoreのエントリをCaughtBird形式に変換して統合
      const pokedexBirds: CaughtBird[] = pokedexEntries.map(entry => ({
        birdId: entry.birdId,
        caughtAt: entry.capturedAt,
        location: entry.location,
      }))
      
      // 重複を避けて統合（pokedexStoreを優先）
      const allBirds = [...pokedexBirds]
      storageBirds.forEach(storageBird => {
        if (!pokedexBirds.find(pb => pb.birdId === storageBird.birdId)) {
          allBirds.push(storageBird)
        }
      })
      
      setCaughtBirds(allBirds)
    }

    // Load on mount
    loadBirds()

    // Also fetch region species from eBird by current location
    const loc = storage.getUserLocation()
    if (loc) {
      setIsLoadingBirds(true)
      fetch(`/api/geocode?lat=${loc.lat}&lng=${loc.lng}`)
        .then((r) => r.json())
        .then(async (geo) => {
          const state = geo?.state as string | undefined
          if (state) setRegionName(state)
          // Pull recent species around user and use as region birds (pragmatic approximation)
          const res = await fetch(`/api/ebird/recent?lat=${loc.lat}&lng=${loc.lng}&dist=50&back=30`)
          if (res.ok) {
            const arr = await res.json()
            // mapObsToBirdを使ってDynamicBird形式に変換
            const { mapObsToBird } = await import('@/lib/ebird')
            const base = arr.map(mapObsToBird)
            // 画像を取得（最初の30件のみ）
            const mapped: DynamicBird[] = await Promise.all(
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
            setRegionBirds(mapped)
            setIsLoadingBirds(false)
            // regionBirdsが読み込まれたら、再度loadBirdsを呼び出してマッピングを更新
            setTimeout(loadBirds, 100)
          } else {
            setIsLoadingBirds(false)
          }
        })
        .catch(() => {
          setIsLoadingBirds(false)
        })
    } else {
      // 位置情報が取得できない場合は、位置情報を取得してから再試行
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const newLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            }
            storage.setUserLocation(newLocation)
            // 位置情報を取得したら、再度読み込み
            loadBirds()
          },
          () => {
            setIsLoadingBirds(false)
          }
        )
      } else {
        setIsLoadingBirds(false)
      }
    }

    // Reload when page becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadBirds()
        setLevelState(levelStore.getState())
        setXpProgress(levelStore.getXpProgress())
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    
    // レベルストアの変更を監視
    const unsubscribe = levelStore.subscribe(() => {
      setLevelState(levelStore.getState())
      setXpProgress(levelStore.getXpProgress())
    })
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      unsubscribe()
    }
  }, [])

  const getCaughtCount = (birdId: string) => {
    return caughtBirds.filter((cb) => cb.birdId === birdId).length
  }

  const getFirstCaught = (birdId: string) => {
    const caught = caughtBirds.find((cb) => cb.birdId === birdId)
    return caught ? new Date(caught.caughtAt) : null
  }

  const { catalog, completionRate, totalCaught, uniqueCaught, earnedBadges, nextBadgeProgress } = useMemo(() => {
    const totalCaught = caughtBirds.length
    const uniqueCaught = new Set(caughtBirds.map((cb) => cb.birdId)).size
    
    // 捕獲された鳥のIDを取得
    const caughtBirdIds = new Set(caughtBirds.map((cb) => cb.birdId))
    
    // ベースのカタログ（位置情報が取得できた場合はregionBirds、取得できない場合は空配列）
    // 位置情報が取得されるまで、BIRDSは使用しない
    const baseCatalog = regionBirds ?? (isLoadingBirds ? [] : [])
    
    // 捕獲された鳥で、カタログに含まれていないものを追加
    // ただし、speciesでマッチする場合は既存のカタログエントリを使用
    const caughtBirdsNotInCatalog: DynamicBird[] = []
    caughtBirdIds.forEach(birdId => {
      const inCatalogById = baseCatalog.find(b => b.id === birdId)
      if (inCatalogById) {
        // 既にカタログに存在する場合はスキップ
        return
      }
      
      // pokedexStoreから情報を取得
      const pokedexEntry = pokedexStore.getEntry(birdId)
      if (pokedexEntry) {
        // speciesで既存のカタログを検索
        const matchingBird = baseCatalog.find(b => 
          b.species === pokedexEntry.species || 
          b.species?.toLowerCase().includes(pokedexEntry.species.toLowerCase()) ||
          pokedexEntry.species.toLowerCase().includes(b.species?.toLowerCase() || '')
        )
        
        if (matchingBird) {
          // 既存のカタログエントリが見つかった場合、そのIDでstorageを更新
          // ただし、これは表示のみの変更なので、実際のstorage更新は不要
          // ここでは表示用のマッピングのみ
          console.log(`Found matching bird in catalog: ${matchingBird.id} for species ${pokedexEntry.species}`)
          return
        }
        
        // マッチするものが見つからない場合のみ追加
        caughtBirdsNotInCatalog.push({
          id: pokedexEntry.birdId,
          name: pokedexEntry.meta?.name || 'Unknown',
          nameJa: pokedexEntry.meta?.nameJa || '不明',
          species: pokedexEntry.species,
          rarity: (pokedexEntry.meta?.rarity as "common" | "uncommon" | "rare" | "legendary") || "common",
          imageUrl: pokedexEntry.meta?.imageUrl || "/placeholder.jpg",
          description: pokedexEntry.meta?.description || "",
          habitat: pokedexEntry.meta?.habitat || "",
        })
      } else {
        // pokedexStoreにない場合は、APIから情報を取得するか、スキップ
        // BIRDSのフォールバックは使用しない（APIから取得した情報のみを使用）
        console.log(`Bird ${birdId} not found in pokedexStore, skipping (will use API data if available)`)
      }
    })
    
    // カタログに捕獲された鳥を追加
    const catalog = [...baseCatalog, ...caughtBirdsNotInCatalog]
    const completionRate = catalog.length > 0 ? Math.round((uniqueCaught / catalog.length) * 100) : 0
    
    // バッジの計算
    const earnedBadges = getEarnedBadges(uniqueCaught)
    const nextBadgeProgress = getNextBadgeProgress(uniqueCaught)
    
    return { catalog, completionRate, totalCaught, uniqueCaught, earnedBadges, nextBadgeProgress }
  }, [caughtBirds, regionBirds, isLoadingBirds])

  // 選択された鳥の説明を取得（catalogの定義の後に配置、捕獲済みの鳥のみ）
  useEffect(() => {
    if (!selectedBird) return

    // 選択された鳥をcatalogから見つける
    const selectedBirdData = catalog.find(b => b.id === selectedBird)
    if (!selectedBirdData) return

    // 捕獲済みかどうかをチェック
    const caughtCount = caughtBirds.filter((cb) => cb.birdId === selectedBirdData.id).length
    const matchingPokedexEntry = pokedexStore.getAllEntries().find(entry => {
      if (!entry.species || !selectedBirdData.species) return false
      const entrySpecies = entry.species.toLowerCase().trim()
      const birdSpecies = selectedBirdData.species.toLowerCase().trim()
      return entrySpecies === birdSpecies || 
             entrySpecies.includes(birdSpecies) ||
             birdSpecies.includes(entrySpecies)
    })
    const matchingCaughtBird = caughtBirds.find(cb => {
      const entry = pokedexStore.getEntry(cb.birdId)
      if (entry && selectedBirdData.species) {
        const entrySpecies = entry.species?.toLowerCase().trim() || ''
        const birdSpecies = selectedBirdData.species.toLowerCase().trim()
        return entrySpecies === birdSpecies || 
               entrySpecies.includes(birdSpecies) ||
               birdSpecies.includes(entrySpecies)
      }
      return false
    })
    const isCaught = caughtCount > 0 || !!matchingPokedexEntry || !!matchingCaughtBird

    // 捕獲済みでない場合は説明を取得しない
    if (!isCaught) return

    const birdKey = `${selectedBirdData.id}-${selectedBirdData.species || selectedBirdData.name}`
    
    // 既に取得済み、または取得中の場合はスキップ（関数形式で最新の値を参照）
    setBirdDescriptions(prev => {
      const existingDesc = prev.get(birdKey)
      if (existingDesc && (existingDesc.description || existingDesc.descriptionJa || existingDesc.loading)) {
        return prev // 変更なし
      }

      // 説明を取得中としてマーク
      const newMap = new Map(prev)
      newMap.set(birdKey, { description: null, descriptionJa: null, loading: true })
      
      // APIから説明を取得
      const fetchDescription = async () => {
        try {
          const query = selectedBirdData.species || selectedBirdData.name || selectedBirdData.nameJa
          const res = await fetch(`/api/bird-description?q=${encodeURIComponent(query)}&speciesCode=${selectedBirdData.id}`)
          const data = await res.json()
          
          setBirdDescriptions(prevDesc => {
            const newDescMap = new Map(prevDesc)
            newDescMap.set(birdKey, {
              description: data.description || null,
              descriptionJa: data.descriptionJa || null,
              loading: false
            })
            return newDescMap
          })
        } catch (error) {
          console.error('Failed to fetch bird description:', error)
          setBirdDescriptions(prevDesc => {
            const newDescMap = new Map(prevDesc)
            newDescMap.set(birdKey, { description: null, descriptionJa: null, loading: false })
            return newDescMap
          })
        }
      }

      fetchDescription()
      return newMap
    })
  }, [selectedBird, catalog, caughtBirds])

  return (
    <div className="min-h-[100svh] bg-background pb-[calc(env(safe-area-inset-bottom)+5rem)]">
      <header className="bg-primary text-primary-foreground p-4 shadow-md">
        <div className="max-w-md mx-auto">
          <h1 className="text-xl font-bold mb-1">鳥図鑑</h1>
          <p className="text-xs opacity-90">
            {isLoadingBirds 
              ? "位置情報を取得中..." 
              : regionName 
                ? `${regionName} 付近の観測種 (eBird)` 
                : "位置情報を取得できませんでした"}
          </p>
          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            <div className="bg-primary-foreground/10 rounded-lg p-2">
              <p className="text-2xl font-bold">{mounted ? uniqueCaught : '-'}</p>
              <p className="text-xs opacity-90">種類</p>
            </div>
            <div className="bg-primary-foreground/10 rounded-lg p-2">
              <p className="text-2xl font-bold">{mounted ? totalCaught : '-'}</p>
              <p className="text-xs opacity-90">総捕獲数</p>
            </div>
            <div className="bg-primary-foreground/10 rounded-lg p-2">
              <p className="text-2xl font-bold">{mounted ? completionRate : '-'}%</p>
              <p className="text-xs opacity-90">完成度</p>
            </div>
          </div>
          
          {/* レベルとXP表示 - コンパクト版 */}
          <div className="bg-primary-foreground/10 rounded-lg p-2 mb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">Lv.{mounted ? levelState.level : '-'}</span>
              </div>
              <div className="flex-1 mx-2 bg-primary-foreground/20 rounded-full h-1.5">
                <div
                  className="bg-yellow-400 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: mounted ? `${xpProgress.percentage}%` : '0%' }}
                />
              </div>
              <span className="text-xs opacity-75">
                {mounted ? `${xpProgress.current}/${xpProgress.required}` : '-/-'}
              </span>
            </div>
          </div>
          
          {/* バッジセクション - コンパクト版 */}
          {earnedBadges.length > 0 && (
            <div className="flex items-center gap-1.5 mb-2">
              <Award className="w-3.5 h-3.5 opacity-75" />
              <div className="flex flex-wrap gap-1.5">
                {earnedBadges.map((badge) => (
                  <div
                    key={badge.name}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold"
                    style={{
                      backgroundColor: badge.bgColor,
                      color: badge.color,
                      border: `1px solid ${badge.color}`,
                    }}
                  >
                    <span>{badge.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* 次のバッジまでの進捗 - コンパクト版 */}
          {nextBadgeProgress.nextBadge && (
            <div className="text-xs opacity-75">
              次のバッジまで: {nextBadgeProgress.remaining}種類 (
              <span style={{ color: nextBadgeProgress.nextBadge.color }}>
                {nextBadgeProgress.nextBadge.name}
              </span>)
            </div>
          )}
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 pb-24">
        {isLoadingBirds ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">位置情報から鳥のリストを取得中...</p>
            </div>
          </div>
        ) : catalog.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground mb-4">位置情報を取得できませんでした</p>
            <p className="text-sm text-muted-foreground">位置情報の許可を確認してください</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {catalog.map((bird) => {
            // speciesでマッチするpokedexStoreのエントリを探す（IDが異なる場合でも）
            const matchingPokedexEntry = pokedexStore.getAllEntries().find(entry => {
              if (!entry.species || !bird.species) return false
              const entrySpecies = entry.species.toLowerCase().trim()
              const birdSpecies = bird.species.toLowerCase().trim()
              return entrySpecies === birdSpecies || 
                     entrySpecies.includes(birdSpecies) ||
                     birdSpecies.includes(entrySpecies)
            })
            
            // speciesでマッチする捕獲済みの鳥を探す（IDが異なる場合でも）
            const matchingCaughtBird = caughtBirds.find(cb => {
              const entry = pokedexStore.getEntry(cb.birdId)
              if (entry && bird.species) {
                const entrySpecies = entry.species?.toLowerCase().trim() || ''
                const birdSpecies = bird.species.toLowerCase().trim()
                return entrySpecies === birdSpecies || 
                       entrySpecies.includes(birdSpecies) ||
                       birdSpecies.includes(entrySpecies)
              }
              return false
            })
            
            // 既存のカタログエントリ（bird.id）を優先して使用
            // matchingPokedexEntryが見つかった場合、その情報（画像など）をマージ
            const effectiveBirdId = bird.id // 常にカタログのIDを使用
            
            // カウント: bird.idでのカウント + matchingPokedexEntryやmatchingCaughtBirdが存在する場合
            let count = getCaughtCount(effectiveBirdId)
            if (matchingPokedexEntry && matchingPokedexEntry.birdId !== effectiveBirdId) {
              // matchingPokedexEntryのIDでもカウント（speciesマッチの場合）
              count += getCaughtCount(matchingPokedexEntry.birdId)
            }
            if (matchingCaughtBird && matchingCaughtBird.birdId !== effectiveBirdId && matchingCaughtBird.birdId !== matchingPokedexEntry?.birdId) {
              count += getCaughtCount(matchingCaughtBird.birdId)
            }
            
            const firstCaught = getFirstCaught(effectiveBirdId) || 
                               (matchingPokedexEntry ? new Date(matchingPokedexEntry.capturedAt) : null) ||
                               (matchingCaughtBird ? new Date(matchingCaughtBird.caughtAt) : null)
            const isCaught = count > 0 || !!matchingPokedexEntry || !!matchingCaughtBird
            
            // pokedexStoreからエントリを取得して画像URLを取得
            // matchingPokedexEntryを優先（speciesマッチで見つかったもの）
            const pokedexEntry = matchingPokedexEntry || pokedexStore.getEntry(effectiveBirdId)
            const imageUrl = pokedexEntry?.meta?.imageUrl || bird.imageUrl

            const birdKey = `${bird.id}-${bird.species || bird.name}`
            const descriptionData = birdDescriptions.get(birdKey)

            return (
              <Card
                key={bird.id}
                className={`p-4 cursor-pointer transition-all hover:shadow-lg ${
                  selectedBird === bird.id ? "ring-2 ring-primary" : ""
                } ${!isCaught ? "opacity-50" : ""}`}
                onClick={() => setSelectedBird(selectedBird === bird.id ? null : bird.id)}
              >
                <div className="relative mb-3">
                  {imageUrl && imageUrl !== "/placeholder.jpg" ? (
                    <img
                      src={imageUrl}
                      alt={pokedexEntry?.meta?.nameJa || bird.nameJa}
                      className={`w-full h-32 object-cover rounded-lg ${!isCaught ? "filter brightness-0" : ""}`}
                      onError={(e) => {
                        // 画像読み込み失敗時はLazyBirdImageにフォールバック
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        const fallback = target.nextElementSibling as HTMLElement
                        if (fallback) fallback.style.display = 'block'
                      }}
                    />
                  ) : null}
                  <LazyBirdImage
                    sciOrCommonName={bird.species || bird.name}
                    alt={pokedexEntry?.meta?.nameJa || bird.nameJa}
                    className={`w-full h-32 object-cover rounded-lg ${!isCaught ? "filter brightness-0" : ""} ${imageUrl && imageUrl !== "/placeholder.jpg" ? "hidden" : ""}`}
                  />
                  <div
                    className="absolute top-2 right-2 w-6 h-6 rounded-full border-2 border-white shadow-md"
                    style={{ backgroundColor: RARITY_COLORS[pokedexEntry?.meta?.rarity || bird.rarity] }}
                  />
                  {count > 1 && (
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full font-semibold">
                      ×{count}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="font-semibold text-sm truncate">
                    {pokedexEntry?.meta?.nameJa || bird.nameJa}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {pokedexEntry?.meta?.name || bird.name}
                  </p>
                  <Badge
                    variant="secondary"
                    className="text-xs"
                    style={{
                      backgroundColor: isCaught ? RARITY_COLORS[pokedexEntry?.meta?.rarity || bird.rarity] : "#9ca3af",
                      color: "white",
                    }}
                  >
                    {isCaught ? RARITY_LABELS[pokedexEntry?.meta?.rarity || bird.rarity] : "未発見"}
                  </Badge>
                </div>

                {selectedBird === bird.id && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2 text-xs">
                    {/* 捕獲済みの場合のみ説明を表示 */}
                    {isCaught ? (
                      <>
                        {/* 説明セクション */}
                        <div>
                          <h4 className="font-semibold text-foreground mb-1">説明</h4>
                          {descriptionData?.loading ? (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                              <span>説明を読み込み中...</span>
                            </div>
                          ) : (
                            <p className="text-muted-foreground leading-relaxed">
                              {descriptionData?.descriptionJa || 
                               descriptionData?.description || 
                               pokedexEntry?.meta?.description || 
                               bird.description || 
                               `${pokedexEntry?.meta?.nameJa || bird.nameJa}は${pokedexEntry?.meta?.name || bird.name}という名前の鳥です。`}
                            </p>
                          )}
                        </div>
                        
                        {/* 生息地 */}
                        {(pokedexEntry?.meta?.habitat || bird.habitat) && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="w-3 h-3" />
                            <span>生息地: {pokedexEntry?.meta?.habitat || bird.habitat}</span>
                          </div>
                        )}
                        
                        {/* 捕獲情報 */}
                        {firstCaught && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            <span>初捕獲: {firstCaught.toLocaleDateString("ja-JP")}</span>
                          </div>
                        )}
                        {pokedexEntry?.location && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="w-3 h-3" />
                            <span>位置: {pokedexEntry.location.lat.toFixed(4)}, {pokedexEntry.location.lng.toFixed(4)}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      /* 未捕獲の場合のメッセージ */
                      <p className="text-muted-foreground italic">
                        この鳥はまだ捕獲されていません。マップで探してみましょう！
                      </p>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
          </div>
        )}

        {!isLoadingBirds && catalog.length > 0 && uniqueCaught > 0 && uniqueCaught === catalog.length && (
          <Card className="mt-6 p-6 bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
            <div className="text-center">
              <Trophy className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-amber-900 mb-2">図鑑コンプリート!</h3>
              <p className="text-sm text-amber-700">すべての鳥を捕獲しました。おめでとうございます!</p>
            </div>
          </Card>
        )}

            {!isLoadingBirds && catalog.length > 0 && uniqueCaught === 0 && (
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
