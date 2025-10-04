export interface RoadStyle {
  outline: {
    width: number
    color: string
  }
  fill: {
    width: number
    color: string
  }
  centerline?: {
    width: number
    color: string
    dashArray: number[]
  }
}

export const roadStyles: Record<string, RoadStyle> = {
  motorway: {
    outline: { width: 14, color: "#1f2937" },
    fill: { width: 12, color: "#fbbf24" },
    centerline: { width: 2, color: "#ffffff", dashArray: [10, 5] },
  },
  trunk: {
    outline: { width: 12, color: "#374151" },
    fill: { width: 10, color: "#f59e0b" },
    centerline: { width: 2, color: "#ffffff", dashArray: [10, 5] },
  },
  primary: {
    outline: { width: 10, color: "#4b5563" },
    fill: { width: 8, color: "#d97706" },
    centerline: { width: 1, color: "#ffffff", dashArray: [8, 4] },
  },
  secondary: {
    outline: { width: 8, color: "#6b7280" },
    fill: { width: 6, color: "#92400e" },
  },
  tertiary: {
    outline: { width: 6, color: "#9ca3af" },
    fill: { width: 4, color: "#a16207" },
  },
  residential: {
    outline: { width: 5, color: "#d1d5db" },
    fill: { width: 3, color: "#e5e7eb" },
  },
  service: {
    outline: { width: 4, color: "#e5e7eb" },
    fill: { width: 2, color: "#f3f4f6" },
  },
  unclassified: {
    outline: { width: 5, color: "#d1d5db" },
    fill: { width: 3, color: "#e5e7eb" },
  },
}

export function getRoadStyle(highway: string): RoadStyle {
  return roadStyles[highway] || roadStyles.residential
}
