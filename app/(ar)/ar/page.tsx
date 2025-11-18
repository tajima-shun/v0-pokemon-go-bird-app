// app/(ar)/ar/page.tsx
'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { arBridge } from '../../../src/utils/arBridge'
import type { ArToApp, AppToAr, BirdSpawn } from '../../../src/types/ar'
import { pokedexStore } from '../../../src/stores/pokedex'
import { levelStore } from '../../../src/stores/level'
import { BattleModal } from '@/components/battle-modal'
import { BattleLoading } from '@/components/battle-loading'
import { mapObsToBird, type DynamicBird } from '../../../lib/ebird'

// /ar ページは常に動的扱いにする（静的プリレンダリングしない）
// Next.js 14では、dynamic = 'force-dynamic' で静的生成を完全に無効化
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const generateSessionId = (): string => {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function ARPageContent() {
  // ★ mounted フラグで「クライアントでのマウント完了」を判定
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // サーバーもクライアント初回も、まずは同じプレースホルダを返す
  // ビルド時の静的生成を防ぐため、常にプレースホルダを返す
  if (typeof window === 'undefined' || !mounted) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <p>Loading AR experience...</p>
      </div>
    )
  }

  console.log('📱 AR page: component rendering')

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isReady, setIsReady] = useState(false)
  const [sessionId] = useState(() => generateSessionId())
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [battleTarget, setBattleTarget] = useState<{
    id: string
    name: string
    nameJa: string
    species: string
    imageUrl: string
    rarity: 'common' | 'uncommon' | 'rare' | 'legendary'
  } | null>(null)
  const [isBattleLoading, setIsBattleLoading] = useState(false)
  const pendingCaptures = useRef<
    Map<string, { birdId: string; species: string; lat: number; lng: number }>
  >(new Map())

  console.log('📱 AR page: component state', {
    isReady,
    hasUserLocation: !!userLocation,
    sessionId,
  })

  // 位置情報取得（クライアントでのみ動く）
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      () => {
        // 失敗時はデフォルト（東京）
        setUserLocation({ lat: 35.6762, lng: 139.6503 })
      }
    )
  }, [])

  // postMessage リスナー
  useEffect(() => {
    console.log('📱 AR page: setting up message listener', { userLocation })

    const handleMessage = (event: MessageEvent) => {
      console.log('📱 AR page: received message event', {
        origin: event.origin,
        data: event.data,
        source: event.source,
        isFromIframe: event.source !== window,
      })

      const handled = arBridge.receiveFromAr(event, (message: ArToApp) => {
        console.log('📱 AR page: handling message', message.type)
        switch (message.type) {
          case 'AR_READY':
            console.log('📱 AR page: AR_READY received, setting isReady and initializing')
            setIsReady(true)
            initializeAR()
            break

          case 'AR_BIRD_SPAWNED':
            console.log('Bird spawned:', message.payload)
            break

          case 'AR_BIRD_RECOGNIZED':
            console.log('Bird recognized:', message.payload)
            break

          case 'AR_BIRD_CAPTURED':
            console.log('AR_BIRD_CAPTURED received, calling handleBirdCaptured')
            handleBirdCaptured(message.payload)
            break

          case 'AR_CAPTURE_RESULT':
            handleCaptureResult(message.payload)
            break
        }
      })

      if (!handled) {
        console.warn('⚠️ AR page: message not handled', {
          origin: event.origin,
          dataType: typeof event.data,
          hasType: (event as any).data?.type,
          expectedOrigin: process.env.NEXT_PUBLIC_8THWALL_ORIGIN || '*',
        })
      }
    }

    window.addEventListener('message', handleMessage)
    console.log('📱 AR page: message listener added')

    return () => {
      window.removeEventListener('message', handleMessage)
      console.log('📱 AR page: message listener removed')
    }
  }, []) // userLocation は依存から外す

  const initializeAR = async () => {
    if (!iframeRef.current || !userLocation) return

    const allowedSpecies = ['sparrow', 'eagle', 'owl', 'crow', 'robin']

    const initMessage: AppToAr = {
      type: 'APP_INIT',
      payload: {
        sessionId,
        allowedSpecies,
      },
    }

    arBridge.sendToAr(iframeRef.current, initMessage)

    try {
      const response = await fetch(
        `/api/birds/nearby?lat=${userLocation.lat}&lng=${userLocation.lng}`
      )
      if (!response.ok) throw new Error('Failed to fetch nearby birds')

      const data = await response.json()
      const birdListMessage: AppToAr = {
        type: 'APP_BIRD_LIST',
        payload: { birds: data.birds as BirdSpawn[] },
      }

      arBridge.sendToAr(iframeRef.current, birdListMessage)
    } catch (err) {
      console.error('Failed to load nearby birds:', err)
      setError('鳥のリストを取得できませんでした')
    }
  }

  const handleBirdCaptured = async (payload: {
    birdId: string
    species: string
    capturedAt: number
  }) => {
    console.log('handleBirdCaptured called with:', payload)

    const pokedexEntries = pokedexStore.getAllEntries()
    const needsBattle = pokedexEntries.length > 0

    if (needsBattle) {
      setIsBattleLoading(true)
    }

    let availableBirds: DynamicBird[] = []

    // eBird APIから位置情報ベースで鳥を取得
    if (userLocation) {
      try {
        const res = await fetch(
          `/api/ebird/recent?lat=${userLocation.lat}&lng=${userLocation.lng}&dist=50&back=30`
        )
        if (res.ok) {
          const arr = await res.json()
          const base = arr.map(mapObsToBird)

          if (needsBattle && base.length > 0) {
            // バトル用に 1件だけ詳細画像を取りに行く
            const firstBird = base[0]
            try {
              const imgRes = await fetch(
                `/api/bird-image?q=${encodeURIComponent(
                  firstBird.species || firstBird.name
                )}&speciesCode=${firstBird.id}`
              )
              const imgData = await imgRes.json()
              availableBirds = [
                {
                  ...firstBird,
                  imageUrl: imgData.imageUrl || '/placeholder.jpg',
                  nameJa: imgData.nameJa || firstBird.nameJa || firstBird.name,
                  name: imgData.name || firstBird.name,
                },
              ]
            } catch {
              availableBirds = [{ ...firstBird, imageUrl: '/placeholder.jpg' }]
            }

            // 残りは placeholder
            availableBirds = [
              ...availableBirds,
              ...base.slice(1, 30).map((b) => ({ ...b, imageUrl: '/placeholder.jpg' })),
            ]

            // バックグラウンドで画像を取得
            Promise.all(
              base.slice(1, 30).map(async (b) => {
                try {
                  const imgRes = await fetch(
                    `/api/bird-image?q=${encodeURIComponent(
                      b.species || b.name
                    )}&speciesCode=${b.id}`
                  )
                  const imgData = await imgRes.json()
                  return {
                    ...b,
                    imageUrl: imgData.imageUrl || '/placeholder.jpg',
                    nameJa: imgData.nameJa || b.nameJa || b.name,
                    name: imgData.name || b.name,
                  }
                } catch {
                  return { ...b, imageUrl: '/placeholder.jpg' }
                }
              })
            ).then((images) => {
              console.log('Background images loaded:', images.length)
            })
          } else {
            // バトル不要のときは普通に全部画像付きで取る
            availableBirds = await Promise.all(
              base.slice(0, 30).map(async (b) => {
                try {
                  const imgRes = await fetch(
                    `/api/bird-image?q=${encodeURIComponent(
                      b.species || b.name
                    )}&speciesCode=${b.id}`
                  )
                  const imgData = await imgRes.json()
                  return {
                    ...b,
                    imageUrl: imgData.imageUrl || '/placeholder.jpg',
                    nameJa: imgData.nameJa || b.nameJa || b.name,
                    name: imgData.name || b.name,
                  }
                } catch {
                  return { ...b, imageUrl: '/placeholder.jpg' }
                }
              })
            )
          }
        }
      } catch (error) {
        console.error('Failed to fetch birds from location:', error)
      }
    }

    // 位置情報から取得できなかった場合、図鑑の登録から選択
    if (availableBirds.length === 0) {
      const entries = pokedexStore.getAllEntries()
      if (entries.length > 0) {
        availableBirds = entries.map((entry) => ({
          id: entry.birdId,
          name: entry.meta?.name || 'Unknown',
          nameJa: entry.meta?.nameJa || '不明',
          species: entry.species,
          rarity:
            (entry.meta?.rarity as 'common' | 'uncommon' | 'rare' | 'legendary') ||
            'common',
          imageUrl: entry.meta?.imageUrl || '/placeholder.jpg',
          description: entry.meta?.description || '',
          habitat: entry.meta?.habitat || '',
        }))
      }
    }

    if (availableBirds.length === 0) {
      console.warn('AR page: No birds available from API or pokedex')
      setIsBattleLoading(false)
      return
    }

    let randomBird = availableBirds[Math.floor(Math.random() * availableBirds.length)]
    console.log('Selected random bird:', randomBird)

    if (randomBird.imageUrl === '/placeholder.jpg' && randomBird.species) {
      try {
        const imgRes = await fetch(
          `/api/bird-image?q=${encodeURIComponent(
            randomBird.species || randomBird.name
          )}&speciesCode=${randomBird.id}`
        )
        const imgData = await imgRes.json()
        randomBird = {
          ...randomBird,
          imageUrl: imgData.imageUrl || '/placeholder.jpg',
          nameJa: imgData.nameJa || randomBird.nameJa || randomBird.name,
          name: imgData.name || randomBird.name,
        }
        console.log('Image fetched for selected bird:', randomBird)
      } catch (error) {
        console.error('Failed to fetch image for selected bird:', error)
      }
    }

    // 図鑑が空ならバトルせずに直接登録
    if (pokedexEntries.length === 0) {
      console.log('AR page: Pokedex is empty, capturing directly without battle')

      if (!userLocation) {
        console.warn('User location not available')
        setError('位置情報が取得できません')
        return
      }

      const captureId = `capture-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`
      console.log('Generated captureId:', captureId)

      try {
        const requestBody = {
          captureId,
          birdId: randomBird.id,
          species: randomBird.species,
          lat: userLocation.lat,
          lng: userLocation.lng,
        }
        console.log('Sending capture request:', requestBody)

        const res = await fetch('/api/pokedex/capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })

        if (!res.ok) {
          const errorText = await res.text()
          throw new Error(`Capture API failed: ${res.status} - ${errorText}`)
        }

        const apiEntry = await res.json()
        console.log('API response:', apiEntry)

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

        console.log('Adding entry to pokedex:', entry)
        const added = pokedexStore.addEntry(entry, captureId)
        if (added) {
          console.log('✅ 鳥を図鑑に登録しました:', entry)

          const { leveledUp, newLevel } = levelStore.addXp(50, randomBird.rarity)
          if (leveledUp) {
            console.log(`🎉 レベルアップ！ レベル ${newLevel} に到達しました！`)
            setError(
              `${randomBird.nameJa || randomBird.name}を獲得しました！🎉 レベル ${newLevel} に到達しました！`
            )
          } else {
            setError(`${randomBird.nameJa || randomBird.name}を獲得しました！`)
          }
          setTimeout(() => {
            setError(null)
          }, 3000)
        } else {
          console.warn('⚠️ 図鑑への登録がスキップされました（重複の可能性）')
        }
      } catch (err) {
        console.error('❌ 捕獲処理に失敗しました:', err)
        setError(
          `捕獲処理に失敗しました: ${
            err instanceof Error ? err.message : String(err)
          }`
        )
      }
      return
    }

    // 図鑑あり → バトルへ
    setBattleTarget({
      id: randomBird.id,
      name: randomBird.name,
      nameJa: randomBird.nameJa,
      species: randomBird.species,
      imageUrl: randomBird.imageUrl,
      rarity: randomBird.rarity,
    })
    setIsBattleLoading(false)
  }

  // バトル勝利時
  const handleBattleVictory = async () => {
    if (!battleTarget) return

    if (!userLocation) {
      console.warn('User location not available')
      setError('位置情報が取得できません')
      setBattleTarget(null)
      return
    }

    const captureId = `capture-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`
    console.log('Generated captureId:', captureId)

    try {
      const requestBody = {
        captureId,
        birdId: battleTarget.id,
        species: battleTarget.species,
        lat: userLocation.lat,
        lng: userLocation.lng,
      }
      console.log('Sending capture request:', requestBody)

      const res = await fetch('/api/pokedex/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Capture API failed: ${res.status} - ${errorText}`)
      }

      const apiEntry = await res.json()
      console.log('API response:', apiEntry)

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

      console.log('Adding entry to pokedex:', entry)
      const added = pokedexStore.addEntry(entry, captureId)
      if (added) {
        console.log('✅ 鳥を図鑑に登録しました:', entry)

        const { leveledUp, newLevel } = levelStore.addXp(
          50,
          battleTarget.rarity
        )
        if (leveledUp) {
          console.log(`🎉 レベルアップ！ レベル ${newLevel} に到達しました！`)
          setError(`🎉 レベル ${newLevel} に到達しました！`)
          setTimeout(() => {
            setError(null)
          }, 3000)
        } else {
          setError(null)
        }
      } else {
        console.warn('⚠️ 図鑑への登録がスキップされました（重複の可能性）')
      }

      setBattleTarget(null)
    } catch (err) {
      console.error('❌ 捕獲処理に失敗しました:', err)
      setError(
        `捕獲処理に失敗しました: ${
          err instanceof Error ? err.message : String(err)
        }`
      )
      setBattleTarget(null)
    }
  }

  const handleCaptureResult = async (result: {
    captureId: string
    ok: boolean
    pokedexEntry?: any
    error?: string
  }) => {
    const pending = pendingCaptures.current.get(result.captureId)
    if (!pending) {
      console.warn(`Unknown captureId: ${result.captureId}`)
      return
    }

    if (result.ok && result.pokedexEntry) {
      const added = pokedexStore.addEntry(result.pokedexEntry, result.captureId)
      if (added) {
        console.log('Bird added to pokedex:', result.pokedexEntry)

        const rarity = result.pokedexEntry.meta
          ?.rarity as 'common' | 'uncommon' | 'rare' | 'legendary' | undefined
        const { leveledUp, newLevel } = levelStore.addXp(50, rarity)
        if (leveledUp) {
          console.log(`🎉 レベルアップ！ レベル ${newLevel} に到達しました！`)
          setError(`🎉 レベル ${newLevel} に到達しました！`)
          setTimeout(() => {
            setError(null)
          }, 3000)
        }
      }
    } else {
      setError(result.error || '捕獲に失敗しました')
    }

    pendingCaptures.current.delete(result.captureId)
  }

  const handleCaptureRequest = async (birdId: string, species: string) => {
    if (!userLocation || !iframeRef.current) return

    const captureId = `capture-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`

    pendingCaptures.current.set(captureId, {
      birdId,
      species,
      lat: userLocation.lat,
      lng: userLocation.lng,
    })

    const captureMessage: AppToAr = {
      type: 'APP_CAPTURE_REQUEST',
      payload: { captureId, birdId },
    }

    arBridge.sendToAr(iframeRef.current, captureMessage)

    try {
      const res = await fetch('/api/pokedex/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captureId,
          birdId,
          species,
          lat: userLocation.lat,
          lng: userLocation.lng,
        }),
      })

      if (!res.ok) throw new Error(`Capture API failed: ${res.status}`)
      const entry = await res.json()

      const resultMessage: AppToAr = {
        type: 'APP_CAPTURE_RESULT',
        payload: {
          captureId,
          ok: true,
          pokedexEntry: entry,
        },
      }

      if (iframeRef.current) {
        arBridge.sendToAr(iframeRef.current, resultMessage)
      }
    } catch (err) {
      console.error('Capture request failed:', err)
      setError('捕獲処理に失敗しました')

      const errorResult: AppToAr = {
        type: 'APP_CAPTURE_RESULT',
        payload: {
          captureId,
          ok: false,
          error: 'API request failed',
        },
      }

      if (iframeRef.current) {
        arBridge.sendToAr(iframeRef.current, errorResult)
      }

      pendingCaptures.current.delete(captureId)
    }
  }

  const handleSetModel = (species: string) => {
    if (!iframeRef.current) return

    const setModelMessage: AppToAr = {
      type: 'APP_SET_MODEL',
      payload: { species },
    }

    arBridge.sendToAr(iframeRef.current, setModelMessage)
  }

  const embedUrl =
    process.env.NEXT_PUBLIC_8THWALL_EMBED_URL || 'https://tajin.8thwall.app/answer/'

  // iframe のロード状況監視
  useEffect(() => {
    console.log('📱 AR page: iframe ref changed', {
      hasRef: !!iframeRef.current,
      src: embedUrl,
      iframeSrc: iframeRef.current?.src,
    })

    if (iframeRef.current) {
      iframeRef.current.onload = () => {
        console.log('📱 AR page: iframe loaded')
      }
      iframeRef.current.onerror = (error) => {
        console.error('📱 AR page: iframe load error', error)
      }
    }
  }, [embedUrl])

  return (
    <div className="w-full h-screen relative">
      <iframe
        ref={iframeRef}
        src={embedUrl}
        allowFullScreen
        allow="camera; microphone; geolocation; accelerometer; magnetometer; gyroscope; autoplay; clipboard-read; clipboard-write; fullscreen"
        className="w-full h-screen border-none"
        style={{ width: '100%', height: '100vh' }}
      />

      {error && (
        <div
          className={`absolute top-4 left-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
            error.includes('獲得') || error.includes('登録')
              ? 'bg-emerald-500 text-white'
              : 'bg-red-500 text-white'
          }`}
        >
          <p>{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm underline"
          >
            閉じる
          </button>
        </div>
      )}

      {/* AR初期化中オーバーレイ */}
      {!isReady && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
            <p>AR初期化中...</p>
          </div>
        </div>
      )}

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
    </div>
  )
}

export default function ARPage() {
  return (
    <Suspense fallback={
      <div className="w-full h-screen flex items-center justify-center">
        <p>Loading AR experience...</p>
      </div>
    }>
      <ARPageContent />
    </Suspense>
  )
}
