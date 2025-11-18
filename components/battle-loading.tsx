"use client"

import { Sword } from "lucide-react"
import { Card } from "@/components/ui/card"

export function BattleLoading() {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
      <Card className="w-full max-w-sm bg-white p-8">
        <div className="flex flex-col items-center justify-center">
          <div className="relative mb-6">
            <Sword className="w-16 h-16 text-primary animate-pulse" />
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
          </div>
          <h2 className="text-xl font-bold mb-2">バトル準備中...</h2>
          <p className="text-sm text-muted-foreground text-center">
            鳥の情報を読み込んでいます
          </p>
          <div className="mt-6 w-full bg-gray-200 rounded-full h-2">
            <div className="bg-primary h-2 rounded-full animate-pulse" style={{ width: "60%" }} />
          </div>
        </div>
      </Card>
    </div>
  )
}

