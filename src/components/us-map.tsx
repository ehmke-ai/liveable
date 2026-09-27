"use client"

import { geoPath, type GeoPermissibleObjects } from "d3-geo"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState, type MouseEvent } from "react"
import { feature } from "topojson-client"
import type { Feature, FeatureCollection, Geometry, Polygon } from "geojson"
import type { GeometryCollection, Topology } from "topojson-specification"

import { stateByAbbr } from "@/lib/states"

type StateFeature = Feature<Geometry, { name: string }> & { id?: string | number }

const WIDTH = 960
const HEIGHT = 600

/** FIPS state code -> USPS abbreviation */
const FIPS_TO_ABBR: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
  "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI",
  "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
  "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
  "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
  "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
  "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
  "54": "WV", "55": "WI", "56": "WY",
}

/** States too small to hold an inline label — listed in a sidebar instead, top to bottom like Kalshi's. */
const SIDEBAR_ABBRS = ["VT", "NH", "MA", "RI", "CT", "NJ", "DE", "MD", "DC"]
/** States that get neither an inline label nor a sidebar row (too small / disjoint to letter). */
const UNLABELED_ABBRS = new Set([...SIDEBAR_ABBRS, "HI"])

function isoKey(id: string | number | undefined) {
  if (id == null) return ""
  return String(id).padStart(2, "0")
}

/** For multipart states (e.g. Michigan's two peninsulas), label the largest piece rather than the area-weighted centroid of all of them. */
function labelCentroid(
  path: ReturnType<typeof geoPath>,
  f: StateFeature
): [number, number] | null {
  if (f.geometry.type !== "MultiPolygon") {
    const c = path.centroid(f as GeoPermissibleObjects)
    return Number.isFinite(c[0]) && Number.isFinite(c[1]) ? c : null
  }

  let largest: Polygon | null = null
  let largestArea = -Infinity
  for (const coordinates of f.geometry.coordinates) {
    const candidate: Feature<Polygon> = {
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates },
    }
    const area = Math.abs(path.area(candidate as GeoPermissibleObjects))
    if (area > largestArea) {
      largestArea = area
      largest = candidate.geometry
    }
  }
  if (!largest) return null
  const c = path.centroid({ type: "Feature", properties: {}, geometry: largest } as GeoPermissibleObjects)
  return Number.isFinite(c[0]) && Number.isFinite(c[1]) ? c : null
}

export function UsMap() {
  const router = useRouter()
  const [features, setFeatures] = useState<StateFeature[]>([])
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [loading, setLoading] = useState(true)

  function updatePointer(e: MouseEvent<SVGPathElement>) {
    const svg = e.currentTarget.ownerSVGElement
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    setPointer({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    })
  }

  useEffect(() => {
    let cancelled = false
    fetch("/geo/us-states-albers-10m.json")
      .then((r) => r.json())
      .then((topology: Topology<{ states: GeometryCollection }>) => {
        if (cancelled) return
        const states = feature(
          topology,
          topology.objects.states
        ) as FeatureCollection<Geometry, { name: string }>
        setFeatures(states.features as StateFeature[])
      })
      .catch(() => {
        if (!cancelled) setFeatures([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Coordinates are pre-projected (Albers USA), so no projection is applied here.
  const path = useMemo(() => geoPath(null), [])

  const hoveredName = hoveredId
    ? features.find((f) => isoKey(f.id) === hoveredId)?.properties.name
    : undefined
  const hoveredAbbr = hoveredId ? FIPS_TO_ABBR[hoveredId] : undefined

  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-muted-foreground">
            Loading map…
          </div>
        )}
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full touch-pan-y"
          role="img"
          aria-label="Interactive map of the United States"
        >
          {features.map((f) => {
            const id = isoKey(f.id)
            const abbr = FIPS_TO_ABBR[id]
            const isHovered = hoveredId === id
            const statePage = abbr ? stateByAbbr[abbr] : undefined
            const d = path(f as GeoPermissibleObjects)
            if (!d) return null

            const showLabel = abbr && !UNLABELED_ABBRS.has(abbr)
            const centroid = showLabel ? labelCentroid(path, f) : null

            return (
              <g key={id || f.properties.name}>
                <path
                  d={d}
                  fill={
                    isHovered
                      ? "color-mix(in oklch, var(--foreground) 22%, var(--muted))"
                      : "color-mix(in oklch, var(--foreground) 10%, var(--muted))"
                  }
                  stroke="var(--background)"
                  strokeWidth={isHovered ? 1.5 : 1}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  className={`${statePage ? "cursor-pointer" : "cursor-default"} transition-[fill,stroke-width] duration-150`}
                  onClick={statePage ? () => router.push(`/state/${statePage.slug}`) : undefined}
                  onMouseEnter={(e) => {
                    setHoveredId(id)
                    updatePointer(e)
                  }}
                  onMouseMove={updatePointer}
                  onMouseLeave={() => {
                    setHoveredId(null)
                    setPointer(null)
                  }}
                >
                  <title>{f.properties.name}</title>
                </path>
                {centroid && (
                  <text
                    x={centroid[0]}
                    y={centroid[1]}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="pointer-events-none select-none font-bold uppercase tracking-wide"
                    style={{ fontSize: 13, fill: "var(--foreground)" }}
                  >
                    {abbr}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {hoveredId && pointer && hoveredName && (
          <div
            className="pointer-events-none absolute z-10 rounded-md border border-border bg-popover px-3 py-2 text-sm shadow-md"
            style={{
              left: `min(${pointer.x}%, calc(100% - 10rem))`,
              top: `max(${pointer.y - 2}%, 0.5rem)`,
              transform: "translateY(-100%)",
            }}
          >
            <div className="font-medium text-foreground">{hoveredName}</div>
            {hoveredAbbr && stateByAbbr[hoveredAbbr] && (
              <div className="text-xs text-muted-foreground">Click for details</div>
            )}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border sm:w-32">
        {SIDEBAR_ABBRS.map((abbr) => {
          const id = Object.entries(FIPS_TO_ABBR).find(([, a]) => a === abbr)?.[0]
          const isHovered = !!id && hoveredId === id
          return (
            <div
              key={abbr}
              className="cursor-default border-b border-border/60 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-foreground transition-colors last:border-b-0"
              style={{
                background: isHovered
                  ? "color-mix(in oklch, var(--foreground) 22%, var(--muted))"
                  : "color-mix(in oklch, var(--foreground) 10%, var(--muted))",
              }}
              onMouseEnter={() => id && setHoveredId(id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {abbr}
            </div>
          )
        })}
      </div>

      {hoveredAbbr && (
        <p className="col-span-full text-xs text-muted-foreground sm:hidden">
          {hoveredName}
        </p>
      )}
    </div>
  )
}
