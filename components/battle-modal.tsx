"use client"

import { useState, useEffect } from "react"
import { X, Sword, Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { pokedexStore } from "@/src/stores/pokedex"
import type { PokedexEntry } from "@/src/types/ar"
import type { DynamicBird } from "@/lib/ebird"
import { LazyBirdImage } from "@/components/lazy-bird-image"

interface BattleModalProps {
  targetBird: {
    id: string
    name: string
    nameJa: string
    species: string
    imageUrl: string
    rarity: "common" | "uncommon" | "rare" | "legendary"
  }
  onVictory: () => void
  onCancel: () => void
}

interface BattleBird {
  id: string
  name: string
  nameJa: string
  species: string
  imageUrl: string
  rarity: "common" | "uncommon" | "rare" | "legendary"
  maxHp: number
  currentHp: number
  attack: number
}

const RARITY_STATS = {
  common: { maxHp: 100, attack: 20 },
  uncommon: { maxHp: 120, attack: 25 },
  rare: { maxHp: 150, attack: 30 },
  legendary: { maxHp: 200, attack: 40 },
}

export function BattleModal({ targetBird, onVictory, onCancel }: BattleModalProps) {
  const [availableBirds, setAvailableBirds] = useState<BattleBird[]>([])
  const [selectedBird, setSelectedBird] = useState<BattleBird | null>(null)
  const [enemyBird, setEnemyBird] = useState<BattleBird | null>(null)
  const [battleStarted, setBattleStarted] = useState(false)
  const [turn, setTurn] = useState<"player" | "enemy">("player")
  const [battleLog, setBattleLog] = useState<string[]>([])

  useEffect(() => {
    // 図鑑から捕獲済みの鳥を取得
    const entries = pokedexStore.getAllEntries()
    const birds: BattleBird[] = entries.map((entry) => {
      const rarity = (entry.meta?.rarity as "common" | "uncommon" | "rare" | "legendary") || "common"
      const stats = RARITY_STATS[rarity]
      return {
        id: entry.birdId,
        name: entry.meta?.name || "Unknown",
        nameJa: entry.meta?.nameJa || "不明",
        species: entry.species,
        imageUrl: entry.meta?.imageUrl || "/placeholder.jpg",
        rarity,
        maxHp: stats.maxHp,
        currentHp: stats.maxHp,
        attack: stats.attack,
      }
    })

    setAvailableBirds(birds)

    // 敵の鳥を初期化
    const enemyStats = RARITY_STATS[targetBird.rarity]
    setEnemyBird({
      id: targetBird.id,
      name: targetBird.name,
      nameJa: targetBird.nameJa,
      species: targetBird.species,
      imageUrl: targetBird.imageUrl || "/placeholder.jpg",
      rarity: targetBird.rarity,
      maxHp: enemyStats.maxHp,
      currentHp: enemyStats.maxHp,
      attack: enemyStats.attack,
    })
  }, [targetBird])

  const startBattle = () => {
    if (!selectedBird) return
    setBattleStarted(true)
    setTurn("player")
    setBattleLog([`バトル開始！${selectedBird.nameJa} vs ${enemyBird?.nameJa}`])
  }

  const attackEnemy = () => {
    if (!selectedBird || !enemyBird || turn !== "player") return

    const damage = selectedBird.attack + Math.floor(Math.random() * 10) - 5 // 攻撃力±5のランダム
    const newEnemyHp = Math.max(0, enemyBird.currentHp - damage)
    
    setEnemyBird({ ...enemyBird, currentHp: newEnemyHp })
    setBattleLog([...battleLog, `${selectedBird.nameJa}の攻撃！${damage}ダメージ！`])

    if (newEnemyHp <= 0) {
      setTimeout(() => {
        setBattleLog([...battleLog, `${selectedBird.nameJa}の攻撃！${damage}ダメージ！`, "勝利！"])
        setTimeout(() => {
          onVictory()
        }, 1000)
      }, 500)
      return
    }

    // 敵のターン
    setTimeout(() => {
      const enemyDamage = enemyBird.attack + Math.floor(Math.random() * 10) - 5
      const newPlayerHp = Math.max(0, selectedBird.currentHp - enemyDamage)
      
      setSelectedBird({ ...selectedBird, currentHp: newPlayerHp })
      setBattleLog([...battleLog, `${selectedBird.nameJa}の攻撃！${damage}ダメージ！`, `${enemyBird.nameJa}の攻撃！${enemyDamage}ダメージ！`])

      if (newPlayerHp <= 0) {
        setTimeout(() => {
          setBattleLog([...battleLog, `${selectedBird.nameJa}の攻撃！${damage}ダメージ！`, `${enemyBird.nameJa}の攻撃！${enemyDamage}ダメージ！`, "敗北..."])
        }, 500)
      } else {
        setTurn("player")
      }
    }, 1000)
  }

  if (availableBirds.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white p-6">
          <h2 className="text-xl font-bold mb-4">バトル準備</h2>
          <p className="text-muted-foreground mb-4">
            図鑑に登録されている鳥がいません。まずは鳥を捕獲して図鑑に登録してください。
          </p>
          <Button onClick={onCancel} className="w-full">
            閉じる
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white p-6 relative max-h-[90vh] overflow-y-auto">
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="absolute top-2 right-2"
        >
          <X className="w-5 h-5" />
        </Button>

        {!battleStarted ? (
          <>
            <h2 className="text-xl font-bold mb-4">バトル準備</h2>
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground">捕獲対象</h3>
              <Card className="p-4 bg-red-50 border-red-200">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
                    <LazyBirdImage
                      sciOrCommonName={targetBird.species || targetBird.name}
                      alt={targetBird.nameJa}
                      className="w-16 h-16 object-cover"
                      placeholderSrc={targetBird.imageUrl || "/placeholder.jpg"}
                    />
                  </div>
                  <div>
                    <p className="font-bold">{targetBird.nameJa}</p>
                    <p className="text-sm text-muted-foreground">{targetBird.name}</p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground">使用する鳥を選択</h3>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {availableBirds.map((bird) => (
                  <Card
                    key={bird.id}
                    className={`p-3 cursor-pointer transition-all ${
                      selectedBird?.id === bird.id
                        ? "ring-2 ring-primary bg-primary/10"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => setSelectedBird(bird)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                        <LazyBirdImage
                          sciOrCommonName={bird.species || bird.name}
                          alt={bird.nameJa}
                          className="w-12 h-12 object-cover"
                          placeholderSrc={bird.imageUrl || "/placeholder.jpg"}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{bird.nameJa}</p>
                        <p className="text-xs text-muted-foreground">HP: {bird.maxHp} / 攻撃: {bird.attack}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            <Button
              onClick={startBattle}
              disabled={!selectedBird}
              className="w-full"
              size="lg"
            >
              バトル開始
            </Button>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold mb-4">バトル中</h2>

            {/* 敵の鳥 */}
            <Card className="p-4 bg-red-50 border-red-200 mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
                    {enemyBird && (
                      <LazyBirdImage
                        sciOrCommonName={enemyBird.species || enemyBird.name}
                        alt={enemyBird.nameJa}
                        className="w-16 h-16 object-cover"
                        placeholderSrc={enemyBird.imageUrl || "/placeholder.jpg"}
                      />
                    )}
                  </div>
                  <div>
                    <p className="font-bold">{enemyBird?.nameJa}</p>
                    <p className="text-sm text-muted-foreground">{enemyBird?.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-red-600">
                    <Heart className="w-4 h-4" />
                    <span className="font-bold">{enemyBird?.currentHp} / {enemyBird?.maxHp}</span>
                  </div>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-red-500 h-2 rounded-full transition-all"
                  style={{ width: `${((enemyBird?.currentHp || 0) / (enemyBird?.maxHp || 1)) * 100}%` }}
                />
              </div>
            </Card>

            {/* 自分の鳥 */}
            <Card className="p-4 bg-blue-50 border-blue-200 mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
                    {selectedBird && (
                      <LazyBirdImage
                        sciOrCommonName={selectedBird.species || selectedBird.name}
                        alt={selectedBird.nameJa}
                        className="w-16 h-16 object-cover"
                        placeholderSrc={selectedBird.imageUrl || "/placeholder.jpg"}
                      />
                    )}
                  </div>
                  <div>
                    <p className="font-bold">{selectedBird?.nameJa}</p>
                    <p className="text-sm text-muted-foreground">{selectedBird?.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-blue-600">
                    <Heart className="w-4 h-4" />
                    <span className="font-bold">{selectedBird?.currentHp} / {selectedBird?.maxHp}</span>
                  </div>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${((selectedBird?.currentHp || 0) / (selectedBird?.maxHp || 1)) * 100}%` }}
                />
              </div>
            </Card>

            {/* バトルログ */}
            <Card className="p-3 bg-gray-50 mb-4 max-h-32 overflow-y-auto">
              <div className="space-y-1">
                {battleLog.map((log, index) => (
                  <p key={index} className="text-sm">{log}</p>
                ))}
              </div>
            </Card>

            {/* 攻撃ボタン */}
            {turn === "player" && selectedBird && selectedBird.currentHp > 0 && enemyBird && enemyBird.currentHp > 0 && (
              <Button
                onClick={attackEnemy}
                className="w-full"
                size="lg"
                disabled={turn !== "player"}
              >
                <Sword className="w-4 h-4 mr-2" />
                攻撃
              </Button>
            )}

            {selectedBird && selectedBird.currentHp <= 0 && (
              <Card className="p-4 bg-red-50 border-red-200">
                <p className="text-center font-bold text-red-600">敗北...</p>
                <Button onClick={onCancel} className="w-full mt-4">
                  閉じる
                </Button>
              </Card>
            )}
          </>
        )}
      </Card>
    </div>
  )
}

