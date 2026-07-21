"use client"

import {
  geoConicConformal,
  geoPath,
  type GeoPermissibleObjects,
} from "d3-geo"
import { useEffect, useMemo, useState, type MouseEvent } from "react"
import { feature } from "topojson-client"
import type { Feature, FeatureCollection, Geometry } from "geojson"
import type { GeometryCollection, Topology } from "topojson-specification"

import { Button } from "@/components/ui/button"
import {
  COLORS,
  demographicsByIso,
  formatMarketCap,
  mapDemographicsData,
  marketCapIntensity,
  maxAntiImmig,
  maxMapMarketCap,
  type CountryDemographics,
} from "@/lib/demographics"

type MapMetric = "antiImmig" | "native" | "marketCap"

type CountryFeature = Feature<Geometry, { name: string }> & { id?: string | number }
type Ring = number[][]
type PolygonCoords = Ring[]

const WIDTH = 960
const HEIGHT = 640
const PAD = 24

/** ISO 3166-1 numeric for Russia */
const RUSSIA_ISO = "643"
/** Conventional Europe–Asia divide at the Urals */
const EUROPE_RUSSIA_MAX_LON = 60
const EUROPE_RUSSIA_MIN_LON = 19

function isoKey(id: string | number | undefined) {
  if (id == null) return ""
  return String(Number(id))
}

function closeRing(ring: Ring): Ring {
  if (!ring.length) return ring
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) return [...ring, first]
  return ring
}

function intersectAtLon(a: number[], b: number[], lon: number): number[] {
  const t = (lon - a[0]) / (b[0] - a[0] || 1e-12)
  return [lon, a[1] + t * (b[1] - a[1])]
}

function ringLonBounds(ring: Ring) {
  let minLon = Infinity
  let maxLon = -Infinity
  for (const p of ring) {
    minLon = Math.min(minLon, p[0])
    maxLon = Math.max(maxLon, p[0])
  }
  return { minLon, maxLon }
}

/** Planar clip against lon <= maxLon (safe for non-antimeridian rings). */
function clipRingMaxLon(ring: Ring, maxLon: number): Ring {
  const open = ring.length > 1 ? ring.slice(0, -1) : ring
  if (!open.length) return []
  const out: Ring = []
  for (let i = 0; i < open.length; i++) {
    const a = open[i]
    const b = open[(i + 1) % open.length]
    const aIn = a[0] <= maxLon
    const bIn = b[0] <= maxLon
    if (aIn && bIn) out.push(b)
    else if (aIn && !bIn) out.push(intersectAtLon(a, b, maxLon))
    else if (!aIn && bIn) {
      out.push(intersectAtLon(a, b, maxLon))
      out.push(b)
    }
  }
  return closeRing(out)
}

/**
 * Antimeridian-spanning rings cannot be longitude-clipped with Sutherland–Hodgman
 * (that yields world-covering garbage). Extract contiguous European lon runs instead.
 *
 * Russia's outline wraps the vertex index across Europe, so the first/last runs must
 * be merged — otherwise closing each run alone draws a diagonal shard over the Caspian.
 */
function europeanRunsFromRing(ring: Ring, minLon: number, maxLon: number): Ring[] {
  const open = ring.length > 1 ? ring.slice(0, -1) : ring
  if (!open.length) return []

  const inEurope = (p: number[]) => p[0] >= minLon && p[0] <= maxLon

  type Run = { start: number; end: number; pts: Ring }
  const runs: Run[] = []
  let current: Run | null = null

  for (let i = 0; i < open.length; i++) {
    const p = open[i]
    if (inEurope(p)) {
      if (!current) current = { start: i, end: i, pts: [] }
      current.pts.push(p)
      current.end = i
    } else if (current) {
      runs.push(current)
      current = null
    }
  }
  if (current) runs.push(current)

  // Merge wrap-around: ring ends mid-Europe and continues at index 0
  if (
    runs.length >= 2 &&
    inEurope(open[0]) &&
    inEurope(open[open.length - 1])
  ) {
    const first = runs[0]
    const last = runs[runs.length - 1]
    runs[0] = {
      start: last.start,
      end: first.end,
      pts: [...last.pts, ...first.pts],
    }
    runs.pop()
  }

  return runs
    .filter((run) => run.pts.length >= 8)
    .map((run) => {
      const pts = [...run.pts]
      const prev = open[(run.start - 1 + open.length) % open.length]
      const next = open[(run.end + 1) % open.length]

      if (prev[0] > maxLon) {
        pts.unshift(intersectAtLon(prev, pts[0], maxLon))
      }
      if (next[0] > maxLon) {
        pts.push(intersectAtLon(pts[pts.length - 1], next, maxLon))
      }

      return closeRing(pts)
    })
    .filter((r) => r.length >= 4)
}

function isAntimeridianRing(ring: Ring) {
  const { minLon, maxLon } = ringLonBounds(ring)
  return minLon < -90 || maxLon > 150
}

/** Keep only the European side of Russia (west of the Urals). */
function clipEuropeanRussia(f: CountryFeature): CountryFeature {
  if (isoKey(f.id) !== RUSSIA_ISO || !f.geometry) return f

  const polygons: PolygonCoords[] =
    f.geometry.type === "Polygon"
      ? [f.geometry.coordinates as PolygonCoords]
      : f.geometry.type === "MultiPolygon"
        ? (f.geometry.coordinates as PolygonCoords[])
        : []

  const clipped: PolygonCoords[] = []

  for (const polygon of polygons) {
    const exterior = polygon[0]
    if (!exterior?.length) continue
    const { minLon, maxLon } = ringLonBounds(exterior)

    if (minLon > EUROPE_RUSSIA_MAX_LON) continue

    if (isAntimeridianRing(exterior)) {
      for (const run of europeanRunsFromRing(
        exterior,
        EUROPE_RUSSIA_MIN_LON,
        EUROPE_RUSSIA_MAX_LON
      )) {
        clipped.push([run])
      }
      continue
    }

    if (maxLon <= EUROPE_RUSSIA_MAX_LON) {
      clipped.push(polygon)
      continue
    }

    const rings = polygon
      .map((ring) => clipRingMaxLon(ring, EUROPE_RUSSIA_MAX_LON))
      .filter((ring) => ring.length >= 4)
    if (rings.length) clipped.push(rings)
  }

  if (!clipped.length) return f

  return {
    ...f,
    geometry: { type: "MultiPolygon", coordinates: clipped },
  }
}

function fillFor(
  data: CountryDemographics | undefined,
  metric: MapMetric,
  hovered: boolean,
  selected: boolean
) {
  if (!data) return hovered ? "#2a2a2a" : "#141414"

  if (metric === "antiImmig") {
    const t = data.antiImmig / maxAntiImmig
    const alpha = 0.35 + t * 0.65
    if (selected) return `rgba(217, 120, 45, ${Math.min(1, alpha + 0.15)})`
    if (hovered) return `rgba(240, 178, 122, ${Math.min(1, alpha + 0.1)})`
    return `rgba(217, 120, 45, ${alpha})`
  }

  if (metric === "marketCap") {
    const t = marketCapIntensity(data.marketCap, maxMapMarketCap)
    const alpha = 0.3 + t * 0.7
    if (selected) return `rgba(45, 184, 138, ${Math.min(1, alpha + 0.15)})`
    if (hovered) return `rgba(110, 220, 180, ${Math.min(1, alpha + 0.1)})`
    return `rgba(45, 184, 138, ${alpha})`
  }

  const t = data.native / 100
  const v = Math.round(40 + t * 215)
  if (selected) return `rgb(${Math.min(255, v + 25)},${Math.min(255, v + 25)},${Math.min(255, v + 25)})`
  if (hovered) return `rgb(${Math.min(255, v + 15)},${Math.min(255, v + 15)},${Math.min(255, v + 15)})`
  return `rgb(${v},${v},${v})`
}

function metricLabel(data: CountryDemographics, metric: MapMetric): string {
  if (metric === "antiImmig") return `${data.antiImmig}%`
  if (metric === "marketCap") return formatMarketCap(data.marketCap)
  return `${data.native}%`
}

function strokeFor(metric: MapMetric, selected: boolean, hovered: boolean): string {
  if (selected) {
    if (metric === "antiImmig") return "#f0b27a"
    if (metric === "marketCap") return "#7eecc0"
    return "#ffffff"
  }
  if (hovered) return "#9aa6ba"
  return "#2a2a2a"
}

export function EuropeMap() {
  const [features, setFeatures] = useState<CountryFeature[]>([])
  const [metric, setMetric] = useState<MapMetric>("antiImmig")
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
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
    fetch("/geo/europe-50m.topo.json")
      .then((r) => r.json())
      .then((topology: Topology<{ countries: GeometryCollection }>) => {
        if (cancelled) return
        const countries = feature(
          topology,
          topology.objects.countries
        ) as FeatureCollection<Geometry, { name: string }>
        setFeatures(
          (countries.features as CountryFeature[]).map(clipEuropeanRussia)
        )
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

  const collection = useMemo(
    () => ({ type: "FeatureCollection" as const, features }),
    [features]
  )

  const projection = useMemo(() => {
    // Lambert conformal conic — standard for accurate European shapes/areas
    const proj = geoConicConformal()
      .parallels([43, 62])
      .rotate([-10, 0])

    if (!features.length) {
      return proj.scale(800).translate([WIDTH / 2, HEIGHT / 2])
    }

    return proj.fitExtent(
      [
        [PAD, PAD],
        [WIDTH - PAD, HEIGHT - PAD],
      ],
      collection
    )
  }, [collection, features.length])

  const path = useMemo(() => geoPath(projection), [projection])

  // Draw selected/hovered countries last so their strokes sit on top
  const orderedFeatures = useMemo(() => {
    if (!hoveredId && !selectedId) return features
    return [...features].sort((a, b) => {
      const aId = isoKey(a.id)
      const bId = isoKey(b.id)
      const aBoost = (aId === selectedId ? 2 : 0) + (aId === hoveredId ? 1 : 0)
      const bBoost = (bId === selectedId ? 2 : 0) + (bId === hoveredId ? 1 : 0)
      return aBoost - bBoost
    })
  }, [features, hoveredId, selectedId])

  const hovered = hoveredId ? demographicsByIso[hoveredId] : undefined
  const hoveredName =
    hoveredId != null
      ? features.find((f) => isoKey(f.id) === hoveredId)?.properties.name
      : undefined
  const selected = selectedId ? demographicsByIso[selectedId] : undefined
  const detail = selected ?? hovered

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={metric === "antiImmig" ? "default" : "secondary"}
            onClick={() => setMetric("antiImmig")}
          >
            Anti-immigration
          </Button>
          <Button
            type="button"
            size="sm"
            variant={metric === "native" ? "default" : "secondary"}
            onClick={() => setMetric("native")}
          >
            Native / white
          </Button>
          <Button
            type="button"
            size="sm"
            variant={metric === "marketCap" ? "default" : "secondary"}
            onClick={() => setMetric("marketCap")}
          >
            Market cap
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Hover for preview · click a highlighted country for details
        </p>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-border bg-[#050505]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-muted-foreground">
            Loading map…
          </div>
        )}
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full touch-pan-y"
          role="img"
          aria-label="Interactive map of Europe showing demographic metrics"
        >
          <rect width={WIDTH} height={HEIGHT} fill="#050505" />
          {orderedFeatures.map((f) => {
            const id = isoKey(f.id)
            const data = demographicsByIso[id]
            const isHovered = hoveredId === id
            const isSelected = selectedId === id
            const d = path(f as GeoPermissibleObjects)
            if (!d) return null

            return (
              <path
                key={id || f.properties.name}
                d={d}
                fill={fillFor(data, metric, isHovered, isSelected)}
                stroke={strokeFor(metric, isSelected, isHovered)}
                strokeWidth={isSelected ? 1.75 : isHovered ? 1.25 : 0.55}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className={
                  data
                    ? "cursor-pointer transition-[fill,stroke-width] duration-150"
                    : "cursor-default"
                }
                onMouseEnter={(e) => {
                  setHoveredId(id)
                  updatePointer(e)
                }}
                onMouseMove={updatePointer}
                onMouseLeave={() => {
                  setHoveredId(null)
                  setPointer(null)
                }}
                onClick={() => {
                  if (!data) return
                  setSelectedId((prev) => (prev === id ? null : id))
                }}
              >
                <title>
                  {data
                    ? `${data.country}: ${metricLabel(data, metric)}`
                    : `${f.properties.name}: cooked`}
                </title>
              </path>
            )
          })}
        </svg>

        {hoveredId && pointer && (
          <div
            className="pointer-events-none absolute z-10 rounded-md border border-border bg-popover px-3 py-2 text-sm shadow-md"
            style={{
              left: `min(${pointer.x}%, calc(100% - 10rem))`,
              top: `max(${pointer.y - 2}%, 0.5rem)`,
              transform: "translateY(-100%)",
            }}
          >
            {hovered ? (
              <>
                <div className="font-medium text-foreground">{hovered.country}</div>
                <div className="tabular-nums text-muted-foreground">
                  {metric === "antiImmig" ? (
                    <>
                      Opposition{" "}
                      <span style={{ color: COLORS.anti }}>{hovered.antiImmig}%</span>
                    </>
                  ) : metric === "marketCap" ? (
                    <>
                      Market cap{" "}
                      <span style={{ color: COLORS.marketCap }}>
                        {formatMarketCap(hovered.marketCap)}
                      </span>
                    </>
                  ) : (
                    <>
                      Native / white{" "}
                      <span style={{ color: COLORS.native }}>{hovered.native}%</span>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="font-medium text-foreground">
                {hoveredName ?? "Unknown"}: cooked
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="rounded-lg border border-border bg-card/40 px-4 py-3 text-sm">
          {detail ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-base font-semibold text-foreground">{detail.country}</h3>
                {selected && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => setSelectedId(null)}
                  >
                    Clear selection
                  </button>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 tabular-nums sm:grid-cols-4">
                <Stat label="Native / white" value={`${detail.native}%`} color={COLORS.native} />
                <Stat label="Catholic" value={`${detail.catholic}%`} color={COLORS.catholic} />
                <Stat label="Protestant" value={`${detail.protestant}%`} color={COLORS.protestant} />
                <Stat label="Orthodox" value={`${detail.orthodox}%`} color={COLORS.orthodox} />
                <Stat
                  label="Anti-immigration"
                  value={`${detail.antiImmig}%`}
                  color={COLORS.anti}
                />
                <Stat
                  label="Market cap"
                  value={formatMarketCap(detail.marketCap)}
                  color={COLORS.marketCap}
                />
              </dl>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Select one of {mapDemographicsData.length} countries in the data pool to inspect
              demographics. Unhighlighted European countries are shown for geographic context
              only.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:min-w-[10rem]">
          <span className="font-medium text-foreground">Legend</span>
          {metric === "antiImmig" ? (
            <>
              <LegendSwatch color="rgba(217,120,45,0.35)" label="Lower opposition" />
              <LegendSwatch color="rgba(217,120,45,1)" label="Higher opposition" />
            </>
          ) : metric === "marketCap" ? (
            <>
              <LegendSwatch color="rgba(45,184,138,0.3)" label="Smaller market" />
              <LegendSwatch color="rgba(45,184,138,1)" label="Larger market" />
            </>
          ) : (
            <>
              <LegendSwatch color="rgb(80,80,80)" label="Lower native share" />
              <LegendSwatch color="rgb(255,255,255)" label="Higher native share" />
            </>
          )}
          <LegendSwatch color="#141414" label="No data" />
        </div>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  color,
  className,
}: {
  label: string
  value: string
  color: string
  className?: string
}) {
  return (
    <div className={className}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium" style={{ color }}>
        {value}
      </dd>
    </div>
  )
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <i
        className="inline-block size-3 rounded-[3px] border border-border"
        style={{ background: color }}
        aria-hidden
      />
      {label}
    </span>
  )
}
