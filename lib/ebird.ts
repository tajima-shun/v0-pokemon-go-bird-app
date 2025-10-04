export interface EbirdObs {
  speciesCode: string
  comName: string
  sciName: string
}

export interface DynamicBird {
  id: string
  name: string
  nameJa: string
  species: string
  rarity: "common" | "uncommon" | "rare" | "legendary"
  imageUrl: string
  description: string
  habitat: string
}

export function mapObsToBird(obs: EbirdObs): DynamicBird {
  const rarity = inferRarityFromSpeciesCode(obs.speciesCode)
  return {
    id: obs.speciesCode,
    name: obs.comName,
    nameJa: obs.comName,
    species: obs.sciName,
    rarity,
    imageUrl: "/placeholder.jpg",
    description: "",
    habitat: "",
  }
}

export function inferRarityFromSpeciesCode(code: string): DynamicBird["rarity"] {
  if (code.length <= 5) return "common"
  if (code.length <= 7) return "uncommon"
  if (code.length <= 9) return "rare"
  return "legendary"
}


