"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Trophy, Sparkles } from "lucide-react"

interface LevelUpModalProps {
  newLevel: number
  onClose: () => void
}

export function LevelUpModal({ newLevel, onClose }: LevelUpModalProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // アニメーションのために少し遅延
    setTimeout(() => setShow(true), 100)
    
    // 3秒後に自動的に閉じる
    const timer = setTimeout(() => {
      setShow(false)
      setTimeout(onClose, 300) // アニメーション終了を待つ
    }, 3000)

    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 transition-opacity duration-300 ${
        show ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      <Card
        className={`relative mx-4 w-full max-w-sm bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 border-2 border-yellow-400 shadow-2xl transition-all duration-300 ${
          show ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 text-center">
          {/* 装飾的なスパークル */}
          <div className="absolute top-4 right-4">
            <Sparkles className="w-6 h-6 text-yellow-500 animate-pulse" />
          </div>
          <div className="absolute top-4 left-4">
            <Sparkles className="w-6 h-6 text-amber-500 animate-pulse" style={{ animationDelay: "0.5s" }} />
          </div>

          {/* トロフィーアイコン */}
          <div className="mb-4 flex justify-center">
            <div className="relative">
              <Trophy className="w-20 h-20 text-yellow-500 animate-bounce" />
              <div className="absolute inset-0 bg-yellow-400/30 rounded-full blur-xl animate-pulse" />
            </div>
          </div>

          {/* レベルアップテキスト */}
          <h2 className="text-3xl font-bold text-amber-900 mb-2">
            レベルアップ！
          </h2>
          <div className="text-6xl font-extrabold text-yellow-600 mb-4">
            Lv.{newLevel}
          </div>
          <p className="text-sm text-amber-700">
            おめでとうございます！
            <br />
            新しいレベルに到達しました
          </p>

          {/* 閉じるボタン */}
          <button
            onClick={onClose}
            className="mt-6 px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-lg transition-colors"
          >
            閉じる
          </button>
        </div>
      </Card>
    </div>
  )
}

