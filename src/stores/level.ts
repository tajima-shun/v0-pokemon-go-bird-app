// XPとレベルを管理するストア

interface LevelState {
  xp: number
  level: number
  totalXp: number // 累計XP（レベルアップ後も保持）
}

const STORAGE_KEY = 'user_level_state'

// レベル計算: レベルNに到達するのに必要なXP = 100 * N * (N + 1) / 2
// 例: レベル1 = 100XP, レベル2 = 300XP (100+200), レベル3 = 600XP (100+200+300)
const getXpForLevel = (level: number): number => {
  return (100 * level * (level + 1)) / 2
}

// XPからレベルを計算
const calculateLevel = (totalXp: number): number => {
  let level = 1
  while (getXpForLevel(level + 1) <= totalXp) {
    level++
  }
  return level
}

// 現在のレベルでのXP進捗を計算
const getXpProgress = (totalXp: number, level: number): { current: number; required: number } => {
  const xpForCurrentLevel = getXpForLevel(level)
  const xpForNextLevel = getXpForLevel(level + 1)
  return {
    current: totalXp - xpForCurrentLevel,
    required: xpForNextLevel - xpForCurrentLevel,
  }
}

const loadFromStorage = (): LevelState => {
  if (typeof window === 'undefined') {
    return { xp: 0, level: 1, totalXp: 0 }
  }

  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (data) {
      const parsed = JSON.parse(data) as LevelState
      // レベルを再計算（データの整合性を保つため）
      const level = calculateLevel(parsed.totalXp)
      return {
        xp: parsed.xp,
        level,
        totalXp: parsed.totalXp,
      }
    }
  } catch (error) {
    console.error('Failed to load level from storage', error)
  }

  return { xp: 0, level: 1, totalXp: 0 }
}

const saveToStorage = (state: LevelState): void => {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.error('Failed to save level to storage', error)
  }
}

class LevelStore {
  private state: LevelState
  private listeners: Set<() => void> = new Set()

  constructor() {
    this.state = loadFromStorage()
  }

  // XPを追加（捕獲時に呼び出す）
  addXp(amount: number, rarity?: 'common' | 'uncommon' | 'rare' | 'legendary'): { leveledUp: boolean; newLevel: number } {
    // レアリティに応じてXPを調整
    const rarityMultiplier = {
      common: 1.0,
      uncommon: 1.5,
      rare: 2.0,
      legendary: 3.0,
    }
    const multiplier = rarity ? rarityMultiplier[rarity] : 1.0
    const xpGained = Math.floor(amount * multiplier)

    const oldLevel = this.state.level
    this.state.totalXp += xpGained
    this.state.xp += xpGained
    this.state.level = calculateLevel(this.state.totalXp)

    saveToStorage(this.state)
    this.notifyListeners()

    const leveledUp = this.state.level > oldLevel
    return {
      leveledUp,
      newLevel: this.state.level,
    }
  }

  // 現在の状態を取得
  getState(): LevelState {
    return { ...this.state }
  }

  // XP進捗を取得
  getXpProgress(): { current: number; required: number; percentage: number } {
    const progress = getXpProgress(this.state.totalXp, this.state.level)
    const percentage = progress.required > 0 
      ? Math.round((progress.current / progress.required) * 100) 
      : 100
    return {
      ...progress,
      percentage,
    }
  }

  // リスナーを追加（状態変更時に通知）
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener())
  }

  // リセット（デバッグ用）
  reset(): void {
    this.state = { xp: 0, level: 1, totalXp: 0 }
    saveToStorage(this.state)
    this.notifyListeners()
  }
}

export const levelStore = new LevelStore()

