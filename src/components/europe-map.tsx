"use client"

import {
  geoConicConformal,
  geoPath,
  type GeoPermissibleObjects,
} from "d3-geo"
import Link from "next/link"
import { useEffect, useMemo, useState, type MouseEvent } from "react"
import { feature } from "topojson-client"
import type { Feature, FeatureCollection, Geometry, Polygon } from "geojson"
import type { GeometryCollection, Topology } from "topojson-specification"

import { Download } from "lucide-react"

import { ColorChooser } from "@/components/color-chooser"
import { Button } from "@/components/ui/button"
import {
  ANTI_IMMIG_COLOR,
  divergingGradient,
  divergingShade,
  divergingStops,
  downloadMapPng,
  PRO_IMMIG_COLOR,
  shade,
  SHADE_RANGE,
  shadeGradient,
  shadeStops,
} from "@/components/us-county-map-export"
import {
  COLORS,
  demographicsByIso,
  formatMedianAge,
  mapDemographicsData,
  maxMapMedianAge,
  maxMapThirtyMarriedHomeowner,
  maxMapWealthShareUnder30,
  medianAgeYouthIntensity,
  minMapMedianAge,
  minMapThirtyMarriedHomeowner,
  minMapWealthShareUnder30,
  rangeIntensity,
  slugify,
  type CountryDemographics,
} from "@/lib/demographics"

type MapMetric = "foreignBorn" | "antiImmig" | "medianAge" | "thirtyMarriedHomeowner" | "wealthShareUnder30"

type CountryFeature = Feature<Geometry, { name: string }> & { id?: string | number }
type Ring = number[][]
type PolygonCoords = Ring[]

export const WIDTH = 960
export const HEIGHT = 720
export const PAD = 16

/**
 * The map is fitted to the data countries (Ireland to Poland, Sicily to the North Cape) rather
 * than every country in the topology — fitting to all of Europe out to the Urals, Iceland, and
 * Svalbard left the data countries small. Neighbors spill past the frame as context.
 */
export const FRAME: GeoPermissibleObjects = {
  type: "MultiPoint",
  coordinates: [
    ...Array.from({ length: 43 }, (_, i) => [-11 + i, 36]),
    ...Array.from({ length: 43 }, (_, i) => [-11 + i, 71.5]),
    ...Array.from({ length: 72 }, (_, i) => [-11, 36 + i / 2]),
    ...Array.from({ length: 72 }, (_, i) => [31, 36 + i / 2]),
  ],
}

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

/** For multipart countries (e.g. Norway's islands), label the largest piece rather than the area-weighted centroid of all of them. */
function labelCentroid(
  path: ReturnType<typeof geoPath>,
  f: CountryFeature
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

/** Countries too small/cramped to reliably click or label on the map — listed in a sidebar, with their figure, instead, like the US map's small states. */
const SIDEBAR_COUNTRIES = ["Switzerland", "Austria", "Netherlands", "Denmark", "Ireland"]
const SIDEBAR_IDS = new Set(
  SIDEBAR_COUNTRIES.flatMap((name) => {
    const data = mapDemographicsData.find((d) => d.country === name)
    return data ? [isoKey(data.isoNumeric)] : []
  })
)

// Scale ends across the countries on the map (the shared min/max exports include the United States)
const minMapForeignBorn = Math.min(...mapDemographicsData.map((d) => d.foreignBorn))
const maxMapForeignBorn = Math.max(...mapDemographicsData.map((d) => d.foreignBorn))
const minMapAntiImmig = Math.min(...mapDemographicsData.map((d) => d.antiImmig))
const maxMapAntiImmig = Math.max(...mapDemographicsData.map((d) => d.antiImmig))

const NO_DATA_FILL = "var(--border)"
const NO_DATA_HOVER_FILL = "color-mix(in oklch, var(--foreground) 10%, var(--border))"

type MetricConfig = {
  /** Tab label */
  tab: string
  title: string
  subtitle: string
  /** Legend heading, and the figure's name in the tooltip */
  name: string
  low: string
  high: string
  source: string
  defaultColor: string
  /** When set, the scale diverges: this default low-end color, neutral mid-range, the chosen color at the high end */
  defaultLowColor?: string
  /** Color-picker labels for the low and high ends of a diverging scale */
  colorLabels?: [string, string]
  /** Position in the color scale, 0 (palest) to 1 (deepest) */
  intensity: (d: CountryDemographics) => number
  value: (d: CountryDemographics) => string
  /** Short figure printed on the country */
  label: (d: CountryDemographics) => string
}

const METRICS: Record<MapMetric, MetricConfig> = {
  foreignBorn: {
    tab: "Foreign-born",
    title: "Foreign-born share by country",
    subtitle: "Share of the population born in another country; deeper means higher.",
    name: "Foreign-born",
    low: `${minMapForeignBorn}%`,
    high: `${maxMapForeignBorn}%`,
    source: "Source: Eurostat, population by country of birth, 1 January 2025",
    defaultColor: "#593001",
    intensity: (d) => rangeIntensity(d.foreignBorn, minMapForeignBorn, maxMapForeignBorn),
    value: (d) => `${d.foreignBorn}%`,
    label: (d) => `${d.foreignBorn}%`,
  },
  antiImmig: {
    tab: "Immigration sentiment",
    title: "Immigration sentiment by country",
    subtitle:
      "Share who would allow few or no immigrants from poorer countries outside Europe; the scale runs from the most pro-immigration countries to the most anti.",
    name: "Immigration sentiment",
    low: `Pro (${minMapAntiImmig}%)`,
    high: `Anti (${maxMapAntiImmig}%)`,
    source: "Source: European Social Survey 2023 (Round 9/10 for Denmark)",
    defaultColor: ANTI_IMMIG_COLOR,
    defaultLowColor: PRO_IMMIG_COLOR,
    intensity: (d) => rangeIntensity(d.antiImmig, minMapAntiImmig, maxMapAntiImmig),
    value: (d) => `${d.antiImmig}% opposed`,
    label: (d) => `${d.antiImmig}%`,
  },
  medianAge: {
    tab: "Native median age",
    title: "Native median age by country",
    subtitle:
      "Median age of the native-born population; the scale runs from the oldest countries to the youngest.",
    name: "Native median age",
    low: `Older (${formatMedianAge(maxMapMedianAge)} yrs)`,
    high: `Younger (${formatMedianAge(minMapMedianAge)} yrs)`,
    source: "Source: Eurostat, population born in reporting country, 1 January 2025",
    defaultColor: "#004278",
    defaultLowColor: "#E76224",
    colorLabels: ["Older color", "Younger color"],
    intensity: (d) => medianAgeYouthIntensity(d.medianAge, minMapMedianAge, maxMapMedianAge),
    value: (d) => `${formatMedianAge(d.medianAge)} yrs`,
    label: (d) => formatMedianAge(d.medianAge),
  },
  thirtyMarriedHomeowner: {
    tab: "Fishback benchmark",
    title: "Fishback benchmark by country",
    subtitle:
      "Share of 30-year-olds who are married and own their home; the scale runs from the lowest countries to the highest.",
    name: "30, married & homeowner",
    low: `${minMapThirtyMarriedHomeowner}%`,
    high: `${maxMapThirtyMarriedHomeowner}%`,
    source: "Source: Eurostat EU-SILC household composition and tenure by age",
    defaultColor: "#004278",
    defaultLowColor: "#E76224",
    colorLabels: ["Low color", "High color"],
    intensity: (d) =>
      rangeIntensity(
        d.thirtyMarriedHomeowner,
        minMapThirtyMarriedHomeowner,
        maxMapThirtyMarriedHomeowner
      ),
    value: (d) => `${d.thirtyMarriedHomeowner}%`,
    label: (d) => `${d.thirtyMarriedHomeowner}%`,
  },
  wealthShareUnder30: {
    tab: "Wealth share (30 & under)",
    title: "Wealth share held by people 30 and under, by country",
    subtitle:
      "Estimated share of total household net wealth; the scale runs from the lowest countries to the highest.",
    name: "Wealth share, 30 & under",
    low: `${minMapWealthShareUnder30}%`,
    high: `${maxMapWealthShareUnder30}%`,
    source: "Source: ECB Household Finance and Consumption Survey (interpolated from under-35)",
    defaultColor: "#004278",
    defaultLowColor: "#E76224",
    colorLabels: ["Low color", "High color"],
    intensity: (d) =>
      rangeIntensity(d.wealthShareUnder30, minMapWealthShareUnder30, maxMapWealthShareUnder30),
    value: (d) => `${d.wealthShareUnder30}%`,
    label: (d) => `${d.wealthShareUnder30}%`,
  },
}

const METRIC_ORDER: MapMetric[] = [
  "foreignBorn",
  "antiImmig",
  "medianAge",
  "thirtyMarriedHomeowner",
  "wealthShareUnder30",
]

const DEFAULT_COLORS = Object.fromEntries(
  Object.entries(METRICS).map(([metric, config]) => [metric, config.defaultColor])
) as Record<MapMetric, string>

const DEFAULT_LOW_COLORS = Object.fromEntries(
  Object.entries(METRICS).flatMap(([metric, config]) =>
    config.defaultLowColor ? [[metric, config.defaultLowColor]] : []
  )
) as Partial<Record<MapMetric, string>>

// Scaled like the US map: 15% of the chosen color at the low end, full color at the high.
// Diverging metrics (given a `lowColor`) run from full low color through neutral to full chosen color.
function fillFor(
  data: CountryDemographics | undefined,
  metric: MapMetric,
  color: string,
  lowColor: string | undefined,
  hovered = false,
  selected = false
) {
  if (!data) return hovered ? NO_DATA_HOVER_FILL : NO_DATA_FILL
  const t = METRICS[metric].intensity(data)
  const boost = selected ? 15 : hovered ? 8 : 0
  if (lowColor) return divergingShade(lowColor, color, t, boost)
  const pct = Math.round(SHADE_RANGE[0] + t * (SHADE_RANGE[1] - SHADE_RANGE[0]))
  return shade(color, Math.min(100, pct + boost))
}

function strokeFor(selected: boolean, hovered: boolean): string {
  if (selected) return "var(--foreground)"
  if (hovered) return "color-mix(in oklch, var(--foreground) 55%, var(--background))"
  return "var(--background)"
}

export function EuropeMap() {
  const [features, setFeatures] = useState<CountryFeature[]>([])
  const [metric, setMetric] = useState<MapMetric>("foreignBorn")
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [colors, setColors] = useState<Record<MapMetric, string>>(DEFAULT_COLORS)
  const [lowColors, setLowColors] = useState(DEFAULT_LOW_COLORS)
  const [exporting, setExporting] = useState(false)
  const color = colors[metric]
  const config = METRICS[metric]
  const lowColor = lowColors[metric]
  const [lowColorLabel, highColorLabel] = config.colorLabels ?? ["Pro color", "Anti color"]

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

  // Lambert conformal conic — standard for accurate European shapes/areas
  const path = useMemo(
    () =>
      geoPath(
        geoConicConformal()
          .parallels([43, 62])
          .rotate([-10, 0])
          .fitExtent(
            [
              [PAD, PAD],
              [WIDTH - PAD, HEIGHT - PAD],
            ],
            FRAME
          )
      ),
    []
  )

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

  const labels = useMemo(
    () =>
      features.flatMap((f) => {
        const id = isoKey(f.id)
        const data = demographicsByIso[id]
        if (!data || SIDEBAR_IDS.has(id)) return []
        const centroid = labelCentroid(path, f)
        return centroid ? [{ id, text: config.label(data), x: centroid[0], y: centroid[1] }] : []
      }),
    [features, path, config]
  )

  async function handleDownload() {
    setExporting(true)
    try {
      await downloadMapPng({
        title: config.title,
        subtitle: config.subtitle,
        legend: [
          {
            name: config.name,
            stops: lowColor ? divergingStops(lowColor, color) : shadeStops(color),
            low: config.low,
            high: config.high,
          },
        ],
        source: config.source,
        mapWidth: WIDTH,
        mapHeight: HEIGHT,
        shapes: features.flatMap((f) => {
          const d = path(f as GeoPermissibleObjects)
          return d
            ? [{ d, fill: fillFor(demographicsByIso[isoKey(f.id)], metric, color, lowColor) }]
            : []
        }),
        shapeStroke: 1,
        labels: labels.map(({ text, x, y }) => ({ x, y, text })),
        fileName: `${config.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`,
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {METRIC_ORDER.map((m) => (
          <Button
            key={m}
            type="button"
            size="sm"
            variant={metric === m ? "default" : "secondary"}
            onClick={() => setMetric(m)}
          >
            {METRICS[m].tab}
          </Button>
        ))}
      </div>

      {/* Title, map, legend, and source sit together so a screenshot of this block stands alone */}
      <figure className="space-y-3 bg-background">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-balance text-foreground sm:text-lg">
              {config.title}
            </h3>
            <p className="text-xs text-muted-foreground">{config.subtitle}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleDownload}
            disabled={loading || exporting}
          >
            <Download aria-hidden />
            {exporting ? "Saving…" : "PNG"}
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
          <div className="relative">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-muted-foreground">
                Loading map…
              </div>
            )}
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="h-auto max-h-[75svh] w-full touch-pan-y overflow-hidden"
              role="img"
              aria-label={`Map: ${config.title}`}
            >
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
                    fill={fillFor(data, metric, color, lowColor, isHovered, isSelected)}
                    stroke={strokeFor(isSelected, isHovered)}
                    strokeWidth={isSelected ? 1.75 : isHovered ? 1.5 : 1}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    className={`${data ? "cursor-pointer" : "cursor-default"} transition-[fill,stroke-width] duration-150`}
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
                        ? `${data.country}: ${config.value(data)}`
                        : `${f.properties.name}: no data`}
                    </title>
                  </path>
                )
              })}

              {/* Labels in a separate pass so hovered/selected countries drawn later don't cover them */}
              {labels.map(({ id, text, x, y }) => (
                <text
                  key={id}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  paintOrder="stroke"
                  stroke="var(--background)"
                  strokeWidth={3}
                  strokeLinejoin="round"
                  className="pointer-events-none select-none font-bold tabular-nums"
                  style={{ fontSize: 13, fill: "var(--foreground)" }}
                >
                  {text}
                </text>
              ))}
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
                      {config.name}{" "}
                      <span className="font-medium text-foreground">{config.value(hovered)}</span>
                    </div>
                  </>
                ) : (
                  <div className="font-medium text-foreground">
                    {hoveredName ?? "Unknown"}: no data
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-lg border border-border sm:w-44">
            {SIDEBAR_COUNTRIES.map((name) => {
              const data = mapDemographicsData.find((d) => d.country === name)
              if (!data) return null
              const id = isoKey(data.isoNumeric)
              const isHovered = hoveredId === id
              const isSelected = selectedId === id
              return (
                <button
                  key={name}
                  type="button"
                  title={`${data.country}: ${config.value(data)}`}
                  className="flex w-full cursor-pointer items-center justify-between gap-2 border-b border-border/60 px-3 py-1.5 text-left text-xs font-bold tracking-wide text-foreground transition-colors last:border-b-0"
                  style={{ background: fillFor(data, metric, color, lowColor, isHovered, isSelected) }}
                  onMouseEnter={() => setHoveredId(id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => setSelectedId((prev) => (prev === id ? null : id))}
                >
                  <span
                    className="rounded-[3px] px-1"
                    style={{ background: "color-mix(in oklch, var(--background) 70%, transparent)" }}
                  >
                    {name}
                  </span>
                  <span
                    className="rounded-[3px] px-1 tabular-nums"
                    style={{ background: "color-mix(in oklch, var(--background) 70%, transparent)" }}
                  >
                    {config.label(data)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <figcaption className="flex flex-wrap items-end gap-x-6 gap-y-3 text-xs">
          <div className="w-48 space-y-1">
            <div className="font-medium text-foreground">{config.name}</div>
            <div
              className="h-2.5 border border-border"
              style={{
                background: lowColor
                  ? divergingGradient(lowColor, color)
                  : shadeGradient(color),
              }}
            />
            <div className="flex justify-between gap-2 tabular-nums text-muted-foreground">
              <span>{config.low}</span>
              <span className="text-right">{config.high}</span>
            </div>
          </div>
          <LegendSwatch color={NO_DATA_FILL} label="No data" />
          <span className="ml-auto text-muted-foreground">{config.source}</span>
        </figcaption>
      </figure>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="rounded-lg border border-border bg-card/40 px-4 py-3 text-sm">
          {detail ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-base font-semibold text-foreground">
                  <Link href={`/${slugify(detail.country)}`} className="hover:underline">
                    {detail.country}
                  </Link>
                </h3>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/${slugify(detail.country)}`}
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    Full profile →
                  </Link>
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
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 tabular-nums sm:grid-cols-4">
                <Stat label="Foreign-born" value={`${detail.foreignBorn}%`} color={COLORS.native} />
                <Stat label="Catholic" value={`${detail.catholic}%`} color={COLORS.catholic} />
                <Stat label="Protestant" value={`${detail.protestant}%`} color={COLORS.protestant} />
                <Stat label="Orthodox" value={`${detail.orthodox}%`} color={COLORS.orthodox} />
                <Stat
                  label="Anti-immigration sentiment"
                  value={`${detail.antiImmig}%`}
                  color={COLORS.anti}
                />
                <Stat
                  label="Native median age"
                  value={`${formatMedianAge(detail.medianAge)} yrs`}
                  color={COLORS.medianAge}
                />
                <Stat
                  label="30, married & homeowner"
                  value={`${detail.thirtyMarriedHomeowner}%`}
                  color={COLORS.thirtyMarriedHomeowner}
                />
                <Stat
                  label="Wealth share, 30 & under"
                  value={`${detail.wealthShareUnder30}%`}
                  color={COLORS.wealthShareUnder30}
                />
              </dl>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Hover or select one of {mapDemographicsData.length} countries to inspect its
              figures. Unshaded European countries are shown for geographic context only.
            </p>
          )}
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-card/40 px-4 py-3 text-sm">
          {lowColor && (
            <MapColorControl
              label={lowColorLabel}
              color={lowColor}
              onChange={(next) => setLowColors((prev) => ({ ...prev, [metric]: next }))}
            />
          )}
          <MapColorControl
            label={lowColor ? highColorLabel : "Map color"}
            color={color}
            onChange={(next) => setColors((prev) => ({ ...prev, [metric]: next }))}
          />
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium" style={{ color }}>
        {value}
      </dd>
    </div>
  )
}

function MapColorControl({
  label,
  color,
  onChange,
}: {
  label: string
  color: string
  onChange: (color: string) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <i
          className="inline-block size-3 shrink-0 rounded-[3px] border border-border"
          style={{ background: color }}
          aria-hidden
        />
        <span className="font-medium text-foreground">{label}</span>
      </div>
      <ColorChooser color={color} onChange={onChange} label={label} />
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
