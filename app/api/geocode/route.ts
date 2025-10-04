import { NextResponse } from "next/server"

// Reverse geocoding via OpenStreetMap Nominatim
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get("lat")
  const lng = searchParams.get("lng")
  if (!lat || !lng) return NextResponse.json({ error: "lat,lng required" }, { status: 400 })

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`
    const res = await fetch(url, {
      headers: { "User-Agent": "pokemonGoBirdApp/1.0" },
      next: { revalidate: 86400 }, // 1 day cache
    })
    if (!res.ok) return NextResponse.json({ error: "geocode error" }, { status: 502 })
    const data = await res.json()
    const address = data?.address ?? {}
    return NextResponse.json({
      state: address.state || address.region || address.province || null,
      city: address.city || address.town || address.village || null,
      raw: address,
    })
  } catch {
    return NextResponse.json({ error: "unexpected" }, { status: 500 })
  }
}


