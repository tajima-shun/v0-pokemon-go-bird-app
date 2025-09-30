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

export const BIRDS: Bird[] = [
  {
    id: "1",
    name: "Sparrow",
    nameJa: "スズメ",
    species: "Passer montanus",
    rarity: "common",
    imageUrl: "/sparrow-bird.jpg",
    description: "日本で最も一般的な小鳥の一つ。都市部でもよく見られます。",
    habitat: "都市、農地",
  },
  {
    id: "2",
    name: "Japanese White-eye",
    nameJa: "メジロ",
    species: "Zosterops japonicus",
    rarity: "common",
    imageUrl: "/japanese-white-eye-bird-green.jpg",
    description: "目の周りの白い輪が特徴的な小鳥。甘い声でさえずります。",
    habitat: "森林、庭園",
  },
  {
    id: "3",
    name: "Japanese Tit",
    nameJa: "シジュウカラ",
    species: "Parus minor",
    rarity: "uncommon",
    imageUrl: "/japanese-tit-bird-black-white.jpg",
    description: "黒い頭と白い頬が特徴。活発に動き回ります。",
    habitat: "森林、公園",
  },
  {
    id: "4",
    name: "Bull-headed Shrike",
    nameJa: "モズ",
    species: "Lanius bucephalus",
    rarity: "uncommon",
    imageUrl: "/bull-headed-shrike-bird.jpg",
    description: "小型の猛禽類のような習性を持つ鳥。獲物を木の枝に刺す習性があります。",
    habitat: "農地、草原",
  },
  {
    id: "5",
    name: "Japanese Paradise Flycatcher",
    nameJa: "サンコウチョウ",
    species: "Terpsiphone atrocaudata",
    rarity: "rare",
    imageUrl: "/japanese-paradise-flycatcher-long-tail.jpg",
    description: "長い尾羽が美しい夏鳥。「月日星ホイホイホイ」と鳴きます。",
    habitat: "深い森林",
  },
  {
    id: "6",
    name: "Japanese Crested Ibis",
    nameJa: "トキ",
    species: "Nipponia nippon",
    rarity: "legendary",
    imageUrl: "/japanese-crested-ibis-pink-bird.jpg",
    description: "日本の特別天然記念物。美しいピンク色の羽を持つ希少な鳥。",
    habitat: "湿地、水田",
  },
  {
    id: "7",
    name: "Japanese Green Woodpecker",
    nameJa: "アオゲラ",
    species: "Picus awokera",
    rarity: "rare",
    imageUrl: "/japanese-green-woodpecker.jpg",
    description: "日本固有種のキツツキ。緑色の美しい羽を持ちます。",
    habitat: "森林",
  },
  {
    id: "8",
    name: "Azure-winged Magpie",
    nameJa: "オナガ",
    species: "Cyanopica cyanus",
    rarity: "uncommon",
    imageUrl: "/azure-winged-magpie-blue-bird.jpg",
    description: "青い翼と長い尾が特徴。群れで行動します。",
    habitat: "森林、住宅地",
  },
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
