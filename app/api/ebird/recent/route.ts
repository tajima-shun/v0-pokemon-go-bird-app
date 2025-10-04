import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get("lat")
  const lng = searchParams.get("lng")
  const dist = searchParams.get("dist") ?? "10"
  const back = searchParams.get("back") ?? "7"

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat,lng required" }, { status: 400 })
  }

  try {
    const apiKey = process.env.EBIRD_API_KEY
    const res = await fetch(
      `https://api.ebird.org/v2/data/obs/geo/recent?lat=${lat}&lng=${lng}&dist=${dist}&back=${back}`,
      {
        headers: {
          "X-eBirdApiToken": apiKey ?? "",
        },
        // Cache for 1 hour on the server
        next: { revalidate: 3600 },
      },
    )

    if (!res.ok) {
      return NextResponse.json({ error: "eBird error" }, { status: 502 })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: "unexpected" }, { status: 500 })
  }
}


