export type ArToApp =
  | { type: 'AR_READY'; payload: { version: string } }
  | { type: 'AR_BIRD_SPAWNED'; payload: BirdSpawn }
  | { type: 'AR_BIRD_RECOGNIZED'; payload: BirdRecognized }
  | { type: 'AR_CAPTURE_RESULT'; payload: { captureId: string; ok: boolean; pokedexEntry?: PokedexEntry; error?: string } }
  | { type: 'AR_BIRD_CAPTURED'; payload: { birdId: string; species: string; capturedAt: number } }

export type AppToAr =
  | { type: 'APP_INIT'; payload: { sessionId: string; allowedSpecies: string[] } }
  | { type: 'APP_BIRD_LIST'; payload: { birds: BirdSpawn[] } }
  | { type: 'APP_CAPTURE_REQUEST'; payload: { captureId: string; birdId: string } }
  | { type: 'APP_SET_MODEL'; payload: { species: string } }
  | { type: 'APP_CAPTURE_RESULT'; payload: { captureId: string; ok: boolean; pokedexEntry?: PokedexEntry; error?: string } }

export type BirdSpawn = {
  birdId: string
  species: string
  lat: number
  lng: number
  spawnedAt: number
  modelKey: string
}

export type BirdRecognized = {
  birdId: string
  confidence: number
  recognizedAt: number
}

export type PokedexEntry = {
  birdId: string
  species: string
  capturedAt: number
  location: { lat: number; lng: number }
  meta?: Record<string, any>
}

