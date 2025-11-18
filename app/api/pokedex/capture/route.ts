import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const captureRequestSchema = z.object({
  captureId: z.string(),
  birdId: z.string(),
  species: z.string(),
  lat: z.number(),
  lng: z.number(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = captureRequestSchema.parse(body)

    const entry = {
      birdId: validated.birdId,
      species: validated.species,
      capturedAt: Date.now(),
      location: {
        lat: validated.lat,
        lng: validated.lng,
      },
      meta: {
        captureId: validated.captureId,
      },
    }

    return NextResponse.json(entry, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Capture API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

