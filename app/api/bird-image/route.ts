import { NextResponse } from "next/server"

// Multi-source image resolver: eBird media -> Wikipedia -> Flickr
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")
  const speciesCode = searchParams.get("speciesCode")
  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 })

  try {
    // 1) Try eBird media API first (if speciesCode provided)
    if (speciesCode) {
      try {
        const ebirdRes = await fetch(
          `https://api.ebird.org/v2/ref/taxonomy/forms/${speciesCode}`,
          {
            headers: {
              "X-eBirdApiToken": process.env.EBIRD_API_KEY ?? "",
            },
          }
        )
        if (ebirdRes.ok) {
          const ebirdData = await ebirdRes.json()
          // eBird doesn't directly provide images, but we can use the species info
        }
      } catch (e) {
        // eBird media fetch failed, continue to other sources
      }
    }

    // 2) Try Wikipedia API
    try {
      const search = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=1`
      )
      const sjson = await search.json()
      const pageId = sjson?.query?.search?.[0]?.pageid
      if (pageId) {
        const detail = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageId}&prop=pageimages&format=json&pithumbsize=400`
        )
        const djson = await detail.json()
        const page = djson?.query?.pages?.[pageId]
        const thumb = page?.thumbnail?.source
        if (thumb) {
          return NextResponse.json({ imageUrl: thumb })
        }
      }
    } catch (e) {
      // Wikipedia fetch failed, continue to other sources
    }

    // 3) Try Flickr API as fallback (if API key available)
    if (process.env.FLICKR_API_KEY) {
      try {
        const flickrRes = await fetch(
          `https://api.flickr.com/services/rest/?method=flickr.photos.search&api_key=${process.env.FLICKR_API_KEY}&text=${encodeURIComponent(q + " bird")}&per_page=1&format=json&nojsoncallback=1&sort=relevance&content_type=1&media=photos`
        )
        if (flickrRes.ok) {
          const flickrData = await flickrRes.json()
          if (flickrData.photos?.photo?.[0]) {
            const photo = flickrData.photos.photo[0]
            const imageUrl = `https://farm${photo.farm}.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}_z.jpg`
            return NextResponse.json({ imageUrl })
          }
        }
      } catch (e) {
        // Flickr fetch failed, continue
      }
    }

    return NextResponse.json({ imageUrl: null })
  } catch (e) {
    return NextResponse.json({ imageUrl: null })
  }
}


