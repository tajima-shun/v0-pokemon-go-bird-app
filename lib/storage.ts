import type { BirdSpawn } from "./birds"

export interface CaughtBird {
  birdId: string
  caughtAt: number
  location: {
    lat: number
    lng: number
  }
}

export interface UserMovement {
  totalDistance: number // in meters
  lastPosition: { lat: number; lng: number } | null
  lastUpdateTime: number
}

export const storage = {
  getCaughtBirds(): CaughtBird[] {
    if (typeof window === "undefined") return []
    const data = localStorage.getItem("caughtBirds")
    return data ? JSON.parse(data) : []
  },

  addCaughtBird(bird: CaughtBird): void {
    const birds = this.getCaughtBirds()
    birds.push(bird)
    localStorage.setItem("caughtBirds", JSON.stringify(birds))
  },

  getBirdSpawns(): BirdSpawn[] {
    if (typeof window === "undefined") return []
    const data = localStorage.getItem("birdSpawns")
    return data ? JSON.parse(data) : []
  },

  setBirdSpawns(spawns: BirdSpawn[]): void {
    localStorage.setItem("birdSpawns", JSON.stringify(spawns))
  },

  getUserLocation(): { lat: number; lng: number } | null {
    if (typeof window === "undefined") return null
    const data = localStorage.getItem("userLocation")
    return data ? JSON.parse(data) : null
  },

  setUserLocation(location: { lat: number; lng: number }): void {
    localStorage.setItem("userLocation", JSON.stringify(location))
  },

  getUserMovement(): UserMovement {
    if (typeof window === "undefined") return { totalDistance: 0, lastPosition: null, lastUpdateTime: Date.now() }
    const data = localStorage.getItem("userMovement")
    return data ? JSON.parse(data) : { totalDistance: 0, lastPosition: null, lastUpdateTime: Date.now() }
  },

  setUserMovement(movement: UserMovement): void {
    localStorage.setItem("userMovement", JSON.stringify(movement))
  },

  resetDistanceCounter(): void {
    const movement = this.getUserMovement()
    movement.totalDistance = 0
    this.setUserMovement(movement)
  },
}
