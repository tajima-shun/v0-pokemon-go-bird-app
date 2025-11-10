import { z } from 'zod'

export const birdSpawnSchema = z.object({
  birdId: z.string(),
  species: z.string(),
  lat: z.number(),
  lng: z.number(),
  spawnedAt: z.number(),
  modelKey: z.string(),
})

export const birdRecognizedSchema = z.object({
  birdId: z.string(),
  confidence: z.number().min(0).max(1),
  recognizedAt: z.number(),
})

export const pokedexEntrySchema = z.object({
  birdId: z.string(),
  species: z.string(),
  capturedAt: z.number(),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  meta: z.record(z.any()).optional(),
})

export const arReadySchema = z.object({
  type: z.literal('AR_READY'),
  payload: z.object({
    version: z.string(),
  }),
})

export const arBirdSpawnedSchema = z.object({
  type: z.literal('AR_BIRD_SPAWNED'),
  payload: birdSpawnSchema,
})

export const arBirdRecognizedSchema = z.object({
  type: z.literal('AR_BIRD_RECOGNIZED'),
  payload: birdRecognizedSchema,
})

export const arCaptureResultSchema = z.object({
  type: z.literal('AR_CAPTURE_RESULT'),
  payload: z.object({
    captureId: z.string(),
    ok: z.boolean(),
    pokedexEntry: pokedexEntrySchema.optional(),
    error: z.string().optional(),
  }),
})

export const arBirdCapturedSchema = z.object({
  type: z.literal('AR_BIRD_CAPTURED'),
  payload: z.object({
    birdId: z.string(),
    species: z.string(),
    capturedAt: z.number(),
  }),
})

export const appInitSchema = z.object({
  type: z.literal('APP_INIT'),
  payload: z.object({
    sessionId: z.string(),
    allowedSpecies: z.array(z.string()),
  }),
})

export const appBirdListSchema = z.object({
  type: z.literal('APP_BIRD_LIST'),
  payload: z.object({
    birds: z.array(birdSpawnSchema),
  }),
})

export const appCaptureRequestSchema = z.object({
  type: z.literal('APP_CAPTURE_REQUEST'),
  payload: z.object({
    captureId: z.string(),
    birdId: z.string(),
  }),
})

export const appSetModelSchema = z.object({
  type: z.literal('APP_SET_MODEL'),
  payload: z.object({
    species: z.string(),
  }),
})

export const appCaptureResultSchema = z.object({
  type: z.literal('APP_CAPTURE_RESULT'),
  payload: z.object({
    captureId: z.string(),
    ok: z.boolean(),
    pokedexEntry: pokedexEntrySchema.optional(),
    error: z.string().optional(),
  }),
})

export const arToAppSchema = z.discriminatedUnion('type', [
  arReadySchema,
  arBirdSpawnedSchema,
  arBirdRecognizedSchema,
  arCaptureResultSchema,
  arBirdCapturedSchema,
])

export const appToArSchema = z.discriminatedUnion('type', [
  appInitSchema,
  appBirdListSchema,
  appCaptureRequestSchema,
  appSetModelSchema,
  appCaptureResultSchema,
])

