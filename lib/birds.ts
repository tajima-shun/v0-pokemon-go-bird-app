export interface Bird {
  id: string
  name: string
  nameJa: string
  species: string
  rarity: "common" | "uncommon" | "rare" | "legendary"
  imageUrl: string
  description: string
  habitat: string
}

// Fallback birds for when eBird fails
export const BIRDS: Bird[] = [
  {
    id: "fallback-1",
    name: "Sparrow",
    nameJa: "スズメ",
    species: "Passer montanus",
    rarity: "common",
    imageUrl: "/placeholder.jpg",
    description: "一般的な小鳥",
    habitat: "都市、農地",
  },
  {
    id: "fallback-2", 
    name: "Crow",
    nameJa: "カラス",
    species: "Corvus corone",
    rarity: "common",
    imageUrl: "/placeholder.jpg",
    description: "都市部でよく見られる鳥",
    habitat: "都市、森林",
  }
]

export interface BirdSpawn {
  id: string
  birdId: string
  lat: number
  lng: number
  expiresAt: number
}

export const RARITY_COLORS = {
  common: "#10b981",
  uncommon: "#3b82f6",
  rare: "#a855f7",
  legendary: "#f59e0b",
}

export const RARITY_LABELS = {
  common: "コモン",
  uncommon: "アンコモン",
  rare: "レア",
  legendary: "レジェンダリー",
}
