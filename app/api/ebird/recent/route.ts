import { NextResponse } from "next/server"

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get("lat") || "35.681236"; // 東京駅
    const lng = searchParams.get("lng") || "139.767125";
    const dist = searchParams.get("dist") ?? "10";
    const back = searchParams.get("back") ?? "7";

    const apiKey = process.env.EBIRD_API_KEY;
    if (!apiKey) {
      console.error("eBird API key not found in environment variables");
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const ebirdUrl = `https://api.ebird.org/v2/data/obs/geo/recent?lat=${lat}&lng=${lng}&dist=${dist}&back=${back}`;
    console.log("Fetching eBird data from:", ebirdUrl);

    const res = await fetch(ebirdUrl, {
      headers: {
        "X-eBirdApiToken": apiKey,
        "User-Agent": "bird-map-app (contact@example.com)"
      },
      next: { revalidate: 300 }
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("eBird API error:", res.status, errorText);
      return new Response(JSON.stringify([]), { status: 500 });
    }

    const data = await res.json();
    console.log(`Successfully fetched ${data.length} bird observations`);
    return new Response(JSON.stringify(data), { status: 200 });
  } catch (error) {
    console.error("API fetch error:", error);
    return new Response(JSON.stringify([]), { status: 500 });
  }
}


