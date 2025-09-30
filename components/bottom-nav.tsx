"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Map, BookOpen } from "lucide-react"

export function BottomNav() {
  const pathname = usePathname()

  const links = [
    { href: "/", icon: Map, label: "マップ" },
    { href: "/pokedex", icon: BookOpen, label: "図鑑" },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto">
        {links.map((link) => {
          const Icon = link.icon
          const isActive = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs font-medium">{link.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
