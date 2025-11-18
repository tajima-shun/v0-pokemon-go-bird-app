import { NextRequest, NextResponse } from 'next/server'
import type { BirdSpawn } from '../../../../src/types/ar'

// このAPIルートは常に動的として扱う
export const dynamic = 'force-dynamic'

const getDummyBirds = (lat: number, lng: number): BirdSpawn[] => {
  const species = ['sparrow', 'eagle', 'owl', 'crow', 'robin']
  const birds: BirdSpawn[] = []

  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI * 2 * i) / 5
    const distance = 0.001 + Math.random() * 0.002
    const birdLat = lat + distance * Math.cos(angle)
    const birdLng = lng + distance * Math.sin(angle)

    birds.push({
      birdId: `bird-${Date.now()}-${i}`,
      species: species[i % species.length],
      lat: birdLat,
      lng: birdLng,
      spawnedAt: Date.now(),
      modelKey: species[i % species.length],
    })
  }

  return birds
}

export async function GET(request: NextRequest) {
  // ★ Dynamic な値の取得は try の外でやる
  const searchParams = request.nextUrl.searchParams
  const lat = parseFloat(searchParams.get('lat') || '35.6762')
  const lng = parseFloat(searchParams.get('lng') || '139.6503')

  try {
    const birds = getDummyBirds(lat, lng)

    return NextResponse.json({ birds }, { status: 200 })
  } catch (error) {
    console.error('Nearby birds API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', birds: [] },
      { status: 500 }
    )
  }
}
