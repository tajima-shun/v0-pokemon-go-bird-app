"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Award, Sparkles } from "lucide-react"

interface BadgeType {
  name: string
  threshold: number
  color: string
  bgColor: string
}

interface BadgeNotificationProps {
  badge: BadgeType
  onClose: () => void
}

export function BadgeNotification({ badge, onClose }: BadgeNotificationProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    setTimeout(() => setShow(true), 100) // アニメーションのために少し遅延
    const timer = setTimeout(() => {
      setShow(false)
      setTimeout(onClose, 300) // アニメーション終了を待つ
    }, 3000) // 3秒後に自動的に閉じる
    return () => clearTimeout(timer)
  }, [onClose, badge])

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 transition-opacity duration-300 ${
        show ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      <Card
        className={`relative mx-4 w-full max-w-sm bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-2 shadow-2xl transition-all duration-300 ${
          show ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        style={{ borderColor: badge.color }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 text-center">
          {/* 装飾的なスパークル */}
          <div className="absolute top-4 right-4">
            <Sparkles className="w-6 h-6 animate-pulse" style={{ color: badge.color }} />
          </div>
          <div className="absolute top-4 left-4">
            <Sparkles className="w-6 h-6 animate-pulse" style={{ color: badge.color, animationDelay: "0.5s" }} />
          </div>

          {/* バッジアイコン */}
          <div className="mb-4 flex justify-center">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center shadow-lg animate-bounce"
              style={{ backgroundColor: badge.bgColor, border: `3px solid ${badge.color}` }}
            >
              <Award className="w-12 h-12" style={{ color: badge.color }} />
            </div>
          </div>

          {/* バッジ獲得テキスト */}
          <h2 className="text-2xl font-bold text-indigo-900 mb-2">
            バッジ獲得！
          </h2>
          <div
            className="text-4xl font-extrabold mb-4"
            style={{ color: badge.color }}
          >
            {badge.name}バッジ
          </div>
          <p className="text-sm text-indigo-700">
            {badge.threshold}種類の鳥を捕獲しました！
          </p>

          {/* 閉じるボタン */}
          <button
            onClick={onClose}
            className="mt-6 px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-lg transition-colors"
          >
            閉じる
          </button>
        </div>
      </Card>
    </div>
  )
}



