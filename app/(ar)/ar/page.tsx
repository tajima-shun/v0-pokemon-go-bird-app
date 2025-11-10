'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { arBridge } from '../../../src/utils/arBridge'
import type { ArToApp, AppToAr, BirdSpawn } from '../../../src/types/ar'
import { pokedexStore } from '../../../src/stores/pokedex'
import { BIRDS } from '../../../lib/birds'

const generateSessionId = (): string => {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export default function ARPage() {
  console.log('📱 AR page: component rendering')
  
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isReady, setIsReady] = useState(false)
  const [sessionId] = useState(() => generateSessionId())
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pendingCaptures = useRef<Map<string, { birdId: string; species: string; lat: number; lng: number }>>(new Map())
  const searchParams = useSearchParams()
  
  console.log('📱 AR page: component state', { isReady, hasUserLocation: !!userLocation, sessionId })

  useEffect(() => {
    if (typeof window === 'undefined') return

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      () => {
        setUserLocation({ lat: 35.6762, lng: 139.6503 })
      }
    )
  }, [])

  useEffect(() => {
    console.log('📱 AR page: setting up message listener', { userLocation })
    
    const handleMessage = (event: MessageEvent) => {
      console.log('📱 AR page: received message event', {
        origin: event.origin,
        data: event.data,
        source: event.source,
        isFromIframe: event.source !== window
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
          hasType: event.data?.type,
          expectedOrigin: process.env.NEXT_PUBLIC_8THWALL_ORIGIN || '*'
        })
      }
    }

    window.addEventListener('message', handleMessage)
    console.log('📱 AR page: message listener added')

    return () => {
      window.removeEventListener('message', handleMessage)
      console.log('📱 AR page: message listener removed')
    }
  }, []) // userLocationを依存配列から削除（メッセージリスナーは常に必要）

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
    
    if (!userLocation) {
      console.warn('User location not available')
      setError('位置情報が取得できません')
      return
    }

    const captureId = `capture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    console.log('Generated captureId:', captureId)

    const coalTit = BIRDS.find((b) => b.species === 'Periparus ater' || b.name === 'Coal Tit' || b.nameJa === 'コガラ') || BIRDS.find((b) => b.id === 'fallback-3') || BIRDS[2]
    console.log('Found coal tit:', coalTit)

    try {
      const requestBody = {
        captureId,
        birdId: coalTit.id,
        species: coalTit.species,
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
          name: coalTit.name,
          nameJa: coalTit.nameJa,
          rarity: coalTit.rarity,
          imageUrl: coalTit.imageUrl,
          description: coalTit.description,
          habitat: coalTit.habitat,
        },
      }

      console.log('Adding entry to pokedex:', entry)
      const added = pokedexStore.addEntry(entry, captureId)
      if (added) {
        console.log('✅ コガラを図鑑に登録しました:', entry)
        setError(null)
      } else {
        console.warn('⚠️ 図鑑への登録がスキップされました（重複の可能性）')
      }
    } catch (err) {
      console.error('❌ 捕獲処理に失敗しました:', err)
      setError(`捕獲処理に失敗しました: ${err instanceof Error ? err.message : String(err)}`)
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
      }
    } else {
      setError(result.error || '捕獲に失敗しました')
    }

    pendingCaptures.current.delete(result.captureId)
  }

  const handleCaptureRequest = async (birdId: string, species: string) => {
    if (!userLocation || !iframeRef.current) return

    const captureId = `capture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

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
    process.env.NEXT_PUBLIC_8THWALL_EMBED_URL ||
    'https://tajin.8thwall.app/answer/'

  useEffect(() => {
    console.log('📱 AR page: iframe ref changed', {
      hasRef: !!iframeRef.current,
      src: embedUrl,
      iframeSrc: iframeRef.current?.src
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
        <div className="absolute top-4 left-4 right-4 z-50 bg-red-500 text-white p-4 rounded-lg shadow-lg">
          <p>{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm underline"
          >
            閉じる
          </button>
        </div>
      )}

      {!isReady && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p>AR初期化中...</p>
          </div>
        </div>
      )}
    </div>
  )
}

