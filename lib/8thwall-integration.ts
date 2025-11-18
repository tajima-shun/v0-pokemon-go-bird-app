// 8thwall統合用の通信プロトコルとユーティリティ

export interface BirdCaptureData {
  id: string
  name: string
  nameJa?: string
  species?: string
  rarity: "common" | "uncommon" | "rare" | "legendary"
  imageUrl?: string
  description?: string
  habitat?: string
  confidence?: number // AI認識の信頼度 (0-1)
}

export interface LocationData {
  lat: number
  lng: number
  accuracy?: number
}

export interface MessageFrom8thwall {
  type: "birdCaptured" | "locationUpdate" | "error" | "ready"
  birdData?: BirdCaptureData
  location?: LocationData
  error?: string
}

export interface MessageTo8thwall {
  type: "captureConfirmed" | "captureCancelled" | "requestLocation" | "syncData"
  birdId?: string
  userLocation?: LocationData
  caughtBirds?: string[] // 既に捕獲した鳥のIDリスト
}

// 鳥の種類認識ロジック
export class BirdRecognitionService {
  private static instance: BirdRecognitionService
  private birdDatabase: Map<string, BirdCaptureData> = new Map()

  static getInstance(): BirdRecognitionService {
    if (!BirdRecognitionService.instance) {
      BirdRecognitionService.instance = new BirdRecognitionService()
    }
    return BirdRecognitionService.instance
  }

  constructor() {
    this.initializeBirdDatabase()
  }

  private initializeBirdDatabase() {
    // 基本的な鳥のデータベースを初期化
    const commonBirds: BirdCaptureData[] = [
      {
        id: "sparrow",
        name: "Sparrow",
        nameJa: "スズメ",
        species: "Passer montanus",
        rarity: "common",
        description: "一般的な小鳥で、都市部でもよく見られます。",
        habitat: "都市、農地、公園",
        confidence: 0.9
      },
      {
        id: "crow",
        name: "Crow",
        nameJa: "カラス",
        species: "Corvus corone",
        rarity: "common",
        description: "知能が高く、都市部でよく見られる鳥です。",
        habitat: "都市、森林、農地",
        confidence: 0.9
      },
      {
        id: "pigeon",
        name: "Pigeon",
        nameJa: "ハト",
        species: "Columba livia",
        rarity: "common",
        description: "都市部で最も一般的な鳥の一つです。",
        habitat: "都市、公園、広場",
        confidence: 0.9
      }
    ]

    commonBirds.forEach(bird => {
      this.birdDatabase.set(bird.id, bird)
    })
  }

  // 8thwallから送られてきた生のデータを処理して標準化
  processRawBirdData(rawData: any): BirdCaptureData {
    // 生データから鳥の情報を抽出・標準化
    const processedData: BirdCaptureData = {
      id: rawData.id || rawData.speciesCode || `ar-${Date.now()}`,
      name: rawData.name || rawData.comName || rawData.speciesName || "Unknown Bird",
      nameJa: rawData.nameJa || rawData.japaneseName || this.translateToJapanese(rawData.name || rawData.comName),
      species: rawData.species || rawData.sciName || rawData.scientificName || "",
      rarity: this.determineRarity(rawData),
      imageUrl: rawData.imageUrl || rawData.image || "/placeholder.jpg",
      description: rawData.description || this.generateDescription(rawData),
      habitat: rawData.habitat || this.inferHabitat(rawData),
      confidence: rawData.confidence || rawData.recognitionScore || 0.8
    }

    return processedData
  }

  // 英語名から日本語名への翻訳（簡易版）
  private translateToJapanese(englishName: string): string {
    const translations: Record<string, string> = {
      "sparrow": "スズメ",
      "crow": "カラス",
      "pigeon": "ハト",
      "robin": "コマドリ",
      "eagle": "ワシ",
      "hawk": "タカ",
      "owl": "フクロウ",
      "duck": "カモ",
      "swan": "ハクチョウ",
      "heron": "サギ",
      "kingfisher": "カワセミ",
      "woodpecker": "キツツキ",
      "magpie": "カササギ",
      "jay": "カケス",
      "tit": "シジュウカラ",
      "finch": "アトリ",
      "warbler": "ウグイス",
      "thrush": "ツグミ",
      "starling": "ムクドリ",
      "swallow": "ツバメ"
    }

    const lowerName = englishName.toLowerCase()
    return translations[lowerName] || englishName
  }

  // レアリティの決定
  private determineRarity(rawData: any): "common" | "uncommon" | "rare" | "legendary" {
    // 既存のレアリティ情報がある場合はそれを使用
    if (rawData.rarity && ["common", "uncommon", "rare", "legendary"].includes(rawData.rarity)) {
      return rawData.rarity
    }

    // 信頼度に基づいてレアリティを決定
    const confidence = rawData.confidence || rawData.recognitionScore || 0.8
    
    if (confidence >= 0.9) return "common"
    if (confidence >= 0.7) return "uncommon"
    if (confidence >= 0.5) return "rare"
    return "legendary"
  }

  // 説明文の生成
  private generateDescription(rawData: any): string {
    const name = rawData.name || rawData.comName || "この鳥"
    const rarity = this.determineRarity(rawData)
    
    const descriptions = {
      common: `${name}は一般的な鳥で、多くの場所で見ることができます。`,
      uncommon: `${name}は比較的珍しい鳥で、特定の環境で見ることができます。`,
      rare: `${name}は珍しい鳥で、特別な条件でしか見ることができません。`,
      legendary: `${name}は非常に珍しい伝説的な鳥です！`
    }

    return descriptions[rarity] || `${name}についての詳細な情報はまだありません。`
  }

  // 生息地の推測
  private inferHabitat(rawData: any): string {
    const name = (rawData.name || rawData.comName || "").toLowerCase()
    
    if (name.includes("sparrow") || name.includes("pigeon") || name.includes("crow")) {
      return "都市、公園、農地"
    }
    if (name.includes("eagle") || name.includes("hawk")) {
      return "山岳、森林、草原"
    }
    if (name.includes("duck") || name.includes("swan") || name.includes("heron")) {
      return "湖、川、湿地"
    }
    if (name.includes("woodpecker") || name.includes("owl")) {
      return "森林、樹木"
    }
    
    return "様々な環境"
  }

  // 既知の鳥かどうかをチェック
  isKnownBird(birdId: string): boolean {
    return this.birdDatabase.has(birdId)
  }

  // 鳥のデータを取得
  getBirdData(birdId: string): BirdCaptureData | undefined {
    return this.birdDatabase.get(birdId)
  }

  // 新しい鳥をデータベースに追加
  addBirdData(bird: BirdCaptureData): void {
    this.birdDatabase.set(bird.id, bird)
  }
}

// 通信ヘルパー関数
export class CommunicationHelper {
  static sendMessageTo8thwall(iframe: HTMLIFrameElement, message: MessageTo8thwall): void {
    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage(message, "https://tajin.8thwall.app")
    }
  }

  static handleMessageFrom8thwall(
    event: MessageEvent,
    onBirdCaptured: (birdData: BirdCaptureData, location: LocationData) => void,
    onLocationUpdate: (location: LocationData) => void,
    onError: (error: string) => void
  ): void {
    // セキュリティチェック
    if (event.origin !== "https://tajin.8thwall.app") {
      return
    }

    const data = event.data as MessageFrom8thwall

    switch (data.type) {
      case "birdCaptured":
        if (data.birdData && data.location) {
          onBirdCaptured(data.birdData, data.location)
        }
        break
      case "locationUpdate":
        if (data.location) {
          onLocationUpdate(data.location)
        }
        break
      case "error":
        if (data.error) {
          onError(data.error)
        }
        break
      case "ready":
        console.log("8thwall is ready")
        break
    }
  }
}


