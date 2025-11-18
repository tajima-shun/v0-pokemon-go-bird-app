import { NextResponse } from "next/server"

// Wikipedia APIを使って鳥の詳細な説明を取得
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")
  const speciesCode = searchParams.get("speciesCode")
  
  if (!q) {
    return NextResponse.json({ error: "q (query) required" }, { status: 400 })
  }

  try {
    // Wikipedia APIで検索
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=1`
    const searchRes = await fetch(searchUrl)
    
    if (!searchRes.ok) {
      throw new Error("Wikipedia search failed")
    }
    
    const searchData = await searchRes.json()
    const pageId = searchData?.query?.search?.[0]?.pageid
    
    if (!pageId) {
      return NextResponse.json({ 
        description: null,
        error: "No Wikipedia page found"
      })
    }

    // ページの詳細情報を取得（extractで説明文を取得）
    const detailUrl = `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageId}&prop=extracts|langlinks&lllang=ja&format=json&exintro=true&explaintext=true&exchars=500`
    const detailRes = await fetch(detailUrl)
    
    if (!detailRes.ok) {
      throw new Error("Wikipedia detail fetch failed")
    }
    
    const detailData = await detailRes.json()
    const page = detailData?.query?.pages?.[pageId]
    
    if (!page) {
      return NextResponse.json({ 
        description: null,
        error: "Page not found"
      })
    }

    // 説明文を取得（英語版）
    let description = page.extract || null
    
    // 日本語版の説明も取得を試みる
    let descriptionJa: string | null = null
    if (page.langlinks && page.langlinks.length > 0) {
      const jaLink = page.langlinks.find((link: any) => link.lang === 'ja')
      if (jaLink) {
        try {
          const jaPageId = await fetch(
            `https://ja.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(jaLink.title)}&format=json`
          ).then(r => r.json())
          
          const jaPageIdValue = Object.keys(jaPageId?.query?.pages || {})[0]
          if (jaPageIdValue && jaPageIdValue !== '-1') {
            const jaDetail = await fetch(
              `https://ja.wikipedia.org/w/api.php?action=query&pageids=${jaPageIdValue}&prop=extracts&format=json&exintro=true&explaintext=true&exchars=500`
            ).then(r => r.json())
            
            const jaPage = jaDetail?.query?.pages?.[jaPageIdValue]
            descriptionJa = jaPage?.extract || null
          }
        } catch (e) {
          console.error("Failed to fetch Japanese description:", e)
        }
      }
    }

    // 説明文を整形（最初の段落を取得、長すぎる場合は切り詰め）
    const formatDescription = (text: string | null): string | null => {
      if (!text) return null
      
      // 最初の段落を取得
      const firstParagraph = text.split('\n\n')[0]
      
      // 500文字を超える場合は切り詰め
      if (firstParagraph.length > 500) {
        return firstParagraph.substring(0, 497) + '...'
      }
      
      return firstParagraph
    }

    return NextResponse.json({
      description: formatDescription(description),
      descriptionJa: formatDescription(descriptionJa),
      wikipediaUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
    })
  } catch (error) {
    console.error("Error fetching bird description:", error)
    return NextResponse.json({ 
      description: null,
      descriptionJa: null,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

