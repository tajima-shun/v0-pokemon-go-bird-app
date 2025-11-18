import type { PokedexEntry } from '../types/ar'

interface PokedexState {
  entries: Map<string, PokedexEntry>
  captureIds: Set<string>
}

const STORAGE_KEY = 'pokedex_entries'
const CAPTURE_IDS_KEY = 'pokedex_capture_ids'

const loadFromStorage = (): PokedexState => {
  if (typeof window === 'undefined') {
    return { entries: new Map(), captureIds: new Set() }
  }

  try {
    const entriesData = localStorage.getItem(STORAGE_KEY)
    const captureIdsData = localStorage.getItem(CAPTURE_IDS_KEY)

    const entries = new Map<string, PokedexEntry>()
    if (entriesData) {
      const parsed = JSON.parse(entriesData) as PokedexEntry[]
      parsed.forEach((entry) => {
        entries.set(entry.birdId, entry)
      })
    }

    const captureIds = new Set<string>()
    if (captureIdsData) {
      const parsed = JSON.parse(captureIdsData) as string[]
      parsed.forEach((id) => captureIds.add(id))
    }

    return { entries, captureIds }
  } catch (error) {
    console.error('Failed to load pokedex from storage', error)
    return { entries: new Map(), captureIds: new Set() }
  }
}

const saveToStorage = (state: PokedexState): void => {
  if (typeof window === 'undefined') return

  try {
    const entriesArray = Array.from(state.entries.values())
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entriesArray))
    localStorage.setItem(CAPTURE_IDS_KEY, JSON.stringify(Array.from(state.captureIds)))
  } catch (error) {
    console.error('Failed to save pokedex to storage', error)
  }
}

class PokedexStore {
  private state: PokedexState

  constructor() {
    this.state = loadFromStorage()
  }

  addEntry(entry: PokedexEntry, captureId: string): boolean {
    if (this.state.captureIds.has(captureId)) {
      console.warn(`Pokedex: duplicate captureId ${captureId}, ignoring`)
      return false
    }

    if (this.state.entries.has(entry.birdId)) {
      const existing = this.state.entries.get(entry.birdId)!
      if (existing.capturedAt > entry.capturedAt) {
        return false
      }
    }

    this.state.entries.set(entry.birdId, entry)
    this.state.captureIds.add(captureId)
    saveToStorage(this.state)
    return true
  }

  getEntry(birdId: string): PokedexEntry | undefined {
    return this.state.entries.get(birdId)
  }

  getAllEntries(): PokedexEntry[] {
    return Array.from(this.state.entries.values())
  }

  hasEntry(birdId: string): boolean {
    return this.state.entries.has(birdId)
  }

  hasCaptureId(captureId: string): boolean {
    return this.state.captureIds.has(captureId)
  }

  getEntryCount(): number {
    return this.state.entries.size
  }
}

export const pokedexStore = new PokedexStore()

