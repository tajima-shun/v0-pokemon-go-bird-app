export interface RoadFeature {
  type: "Feature"
  geometry: {
    type: "LineString"
    coordinates: [number, number][]
  }
  properties: {
    highway: string
    name?: string
  }
}

export interface RoadData {
  type: "FeatureCollection"
  features: RoadFeature[]
}

export async function fetchRoadsFromOverpass(lat: number, lng: number, radiusMeters = 500): Promise<RoadData | null> {
  const radiusDegrees = radiusMeters / 111000
  const bbox = {
    south: lat - radiusDegrees,
    west: lng - radiusDegrees,
    north: lat + radiusDegrees,
    east: lng + radiusDegrees,
  }

  const query = `
    [out:json][timeout:25];
    (
      way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|service|unclassified)$"]
        (${bbox.south},${bbox.west},${bbox.north},${bbox.east});
    );
    out geom;
  `

  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
    })

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`)
    }

    const data = await response.json()

    const features: RoadFeature[] = data.elements
      .filter((el: any) => el.type === "way" && el.geometry)
      .map((way: any) => ({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: way.geometry.map((node: any) => [node.lon, node.lat]),
        },
        properties: {
          highway: way.tags?.highway || "unknown",
          name: way.tags?.name,
        },
      }))

    return {
      type: "FeatureCollection",
      features,
    }
  } catch (error) {
    console.error("Error fetching roads from Overpass:", error)
    return null
  }
}
