"use client"

import { geoPath, type GeoPermissibleObjects } from "d3-geo"
import Link from "next/link"
import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react"
import { feature } from "topojson-client"
import type { Feature, FeatureCollection, Geometry, Polygon } from "geojson"
import type { GeometryCollection, Topology } from "topojson-specification"

import { Download } from "lucide-react"

import { ColorChooser } from "@/components/color-chooser"
import { Button } from "@/components/ui/button"
import { UsCountyElectionMap } from "@/components/us-county-election-map"
import type { UsCountyRow } from "@/components/us-county-map"
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
import { COLORS } from "@/lib/demographics"
import {
  ELECTION_MARGIN_CAP,
  election2024Intensity,
  ENFORCEMENT_TIER_LABELS,
  enforcementIntensity,
  formatElection2024,
  maxStateAntiImmig,
  maxStateNative,
  maxStateThirtyMarriedHomeowner,
  maxStateWealthShareUnder30,
  minStateAntiImmig,
  minStateNative,
  minStateThirtyMarriedHomeowner,
  minStateWealthShareUnder30,
  rangeIntensity,
  stateNavByAbbr,
  stateMapByAbbr,
  stateMapData,
  type StateMapMetrics,
} from "@/lib/states"

type MapMetric =
  | "election2024"
  | "antiImmig"
  | "enforcement"
  | "native"
  | "thirtyMarriedHomeowner"
  | "wealthShareUnder30"

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

const ABBR_TO_FIPS: Record<string, string> = Object.fromEntries(
  Object.entries(FIPS_TO_ABBR).map(([fips, abbr]) => [abbr, fips])
)

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

const NO_DATA_FILL = "var(--border)"
const NO_DATA_HOVER_FILL = "color-mix(in oklch, var(--foreground) 10%, var(--border))"

type MetricConfig = {
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
  /** Position in the color scale, 0 (palest) to 1 (deepest); null when the state has no figure */
  intensity: (d: StateMapMetrics) => number | null
  value: (d: StateMapMetrics) => string
}

const METRICS: Record<MapMetric, MetricConfig> = {
  election2024: {
    title: "2024 presidential election by state",
    subtitle:
      "Statewide popular-vote margin between Donald Trump and Kamala Harris; deeper means a wider win.",
    name: "2024 margin",
    low: `Harris +${ELECTION_MARGIN_CAP}`,
    high: `Trump +${ELECTION_MARGIN_CAP}`,
    source: "Source: certified 2024 general election results (state election offices)",
    defaultColor: ANTI_IMMIG_COLOR,
    defaultLowColor: PRO_IMMIG_COLOR,
    colorLabels: ["Harris color", "Trump color"],
    intensity: election2024Intensity,
    value: formatElection2024,
  },
  antiImmig: {
    title: "Immigration sentiment by state",
    subtitle:
      "Share saying newcomers from other countries threaten traditional American customs and values; the scale runs from the most pro-immigration states to the most anti.",
    name: "Immigration sentiment",
    low: `Pro (${minStateAntiImmig}%)`,
    high: `Anti (${maxStateAntiImmig}%)`,
    source: "Source: PRRI 2015 American Values Atlas (DC not surveyed)",
    defaultColor: ANTI_IMMIG_COLOR,
    defaultLowColor: PRO_IMMIG_COLOR,
    intensity: (d) =>
      d.antiImmig == null ? null : rangeIntensity(d.antiImmig, minStateAntiImmig, maxStateAntiImmig),
    value: (d) => (d.antiImmig == null ? "no data" : `${d.antiImmig}% opposed`),
  },
  enforcement: {
    title: "Immigration enforcement laws by state",
    subtitle:
      "State laws on ICE detainers, 287(g), information sharing, anti-sanctuary mandates, and state immigration crimes; the scale runs from the most protective states to the most enforcement.",
    name: "ICE cooperation",
    low: "Sanctuary protections",
    high: "Heavy ICE cooperation",
    source: "Source: ILRC State Map on Immigration Enforcement, July 2026",
    defaultColor: ANTI_IMMIG_COLOR,
    defaultLowColor: PRO_IMMIG_COLOR,
    intensity: (d) => enforcementIntensity(d.enforcementScore),
    value: enforcementLabel,
  },
  thirtyMarriedHomeowner: {
    title: "Fishback benchmark by state",
    subtitle:
      "Share of 30-year-olds who are married with spouse present and own their home; the scale runs from the lowest states to the highest.",
    name: "30, married & homeowner",
    low: `${minStateThirtyMarriedHomeowner}%`,
    high: `${maxStateThirtyMarriedHomeowner}%`,
    source: "Source: U.S. Census Bureau, ACS 2024 1-year estimates",
    defaultColor: "#004278",
    defaultLowColor: "#E76224",
    colorLabels: ["Low color", "High color"],
    intensity: (d) =>
      rangeIntensity(
        d.thirtyMarriedHomeowner,
        minStateThirtyMarriedHomeowner,
        maxStateThirtyMarriedHomeowner
      ),
    value: (d) => `${d.thirtyMarriedHomeowner}%`,
  },
  wealthShareUnder30: {
    title: "Wealth share held by residents 30 and under, by state",
    subtitle:
      "Estimated share of total household net wealth; the scale runs from the lowest states to the highest.",
    name: "Wealth share, 30 & under",
    low: `${minStateWealthShareUnder30}%`,
    high: `${maxStateWealthShareUnder30}%`,
    source:
      "Sources: Fishback benchmark (ACS 2024); Federal Reserve Distributional Financial Accounts",
    defaultColor: "#004278",
    defaultLowColor: "#E76224",
    colorLabels: ["Low color", "High color"],
    intensity: (d) =>
      rangeIntensity(d.wealthShareUnder30, minStateWealthShareUnder30, maxStateWealthShareUnder30),
    value: (d) => `${d.wealthShareUnder30}%`,
  },
  native: {
    title: "Native / European share by state",
    subtitle: "Non-Hispanic White minus Arab ancestry, as a share of population; deeper means higher.",
    name: "Native / European",
    low: `${minStateNative}%`,
    high: `${maxStateNative}%`,
    source: "Source: U.S. Census Bureau (Vintage 2025 estimates, ACS 2024)",
    defaultColor: "#000000",
    intensity: (d) => rangeIntensity(d.native, minStateNative, maxStateNative),
    value: (d) => `${d.native}%`,
  },
}

const DEFAULT_COLORS = Object.fromEntries(
  Object.entries(METRICS).map(([metric, config]) => [metric, config.defaultColor])
) as Record<MapMetric, string>

/** Metrics drawn on the same pro/anti-immigration scale, which share their chosen colors */
const IMMIGRATION_METRICS: MapMetric[] = ["antiImmig", "enforcement"]

/** Sets `next` for `metric`, and for every metric sharing its colors */
function withColor<T extends Partial<Record<MapMetric, string>>>(
  prev: T,
  metric: MapMetric,
  next: string
): T {
  const linked = IMMIGRATION_METRICS.includes(metric) ? IMMIGRATION_METRICS : [metric]
  return { ...prev, ...Object.fromEntries(linked.map((m) => [m, next])) }
}

const DEFAULT_LOW_COLORS = Object.fromEntries(
  Object.entries(METRICS).flatMap(([metric, config]) =>
    config.defaultLowColor ? [[metric, config.defaultLowColor]] : []
  )
) as Partial<Record<MapMetric, string>>

// Scaled like the county map: 15% of the chosen color at the low end, full color at the high.
// Diverging metrics (given a `lowColor`) run from full low color through neutral to full chosen color.
function fillFor(
  data: StateMapMetrics | undefined,
  metric: MapMetric,
  color: string,
  lowColor: string | undefined,
  hovered = false,
  selected = false
) {
  const t = data ? METRICS[metric].intensity(data) : null
  if (t == null) return hovered ? NO_DATA_HOVER_FILL : NO_DATA_FILL
  const boost = selected ? 15 : hovered ? 8 : 0
  if (lowColor) return divergingShade(lowColor, color, t, boost)
  const pct = Math.round(SHADE_RANGE[0] + t * (SHADE_RANGE[1] - SHADE_RANGE[0]))
  return shade(color, Math.min(100, pct + boost))
}

function metricLabel(data: StateMapMetrics, metric: MapMetric): string {
  return METRICS[metric].value(data)
}

function enforcementLabel(data: StateMapMetrics): string {
  return `${ENFORCEMENT_TIER_LABELS[data.enforcementTier]} (${data.enforcementScore.toFixed(1)})`
}

function strokeFor(selected: boolean, hovered: boolean): string {
  if (selected) return "var(--foreground)"
  if (hovered) return "color-mix(in oklch, var(--foreground) 55%, var(--background))"
  return "var(--background)"
}

/** The map tabs: the state metrics, plus views that only exist at county level */
type MapView = MapMetric | "election2024County"

type ElectionLevel = "county" | "state"

/**
 * `countyMap` replaces the state map while Demographics is selected (the county-level
 * UsCountyMap), and the county-level UsCountyElectionMap while 2024 election is shown by county. Both stay mounted when hidden so
 * they keep their state.
 */
export function UsMap({
  countyMap,
  electionCounties,
}: {
  countyMap: ReactNode
  /** County labels and state abbreviations for the county-level 2024 election map */
  electionCounties: { counties: UsCountyRow[]; states: Record<string, string> }
}) {
  const [features, setFeatures] = useState<StateFeature[]>([])
  const [view, setView] = useState<MapView>("native")
  // Which level the 2024 election tab shows; remembered when switching away and back
  const [electionLevel, setElectionLevel] = useState<ElectionLevel>("county")
  // County-only views hide the state map, so any state metric will do behind them
  const metric: MapMetric = view === "election2024County" ? "native" : view
  const electionActive = view === "election2024" || view === "election2024County"
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

  // Draw selected/hovered states last so their strokes sit on top
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

  const hovered = hoveredId ? stateMapByAbbr[FIPS_TO_ABBR[hoveredId]] : undefined
  const selected = selectedId ? stateMapByAbbr[FIPS_TO_ABBR[selectedId]] : undefined
  const detail = selected ?? hovered
  const detailPage = detail ? stateNavByAbbr[detail.abbr] : undefined
  const showCounties = view === "native"
  const showElection = view === "election2024County"
  const showStates = !showCounties && !showElection

  const labels = useMemo(
    () =>
      features.flatMap((f) => {
        const abbr = FIPS_TO_ABBR[isoKey(f.id)]
        if (!abbr || UNLABELED_ABBRS.has(abbr)) return []
        const centroid = labelCentroid(path, f)
        return centroid ? [{ abbr, x: centroid[0], y: centroid[1] }] : []
      }),
    [features, path]
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
        noData: metric === "antiImmig",
        source: config.source,
        mapWidth: WIDTH,
        mapHeight: HEIGHT,
        shapes: features.flatMap((f) => {
          const d = path(f as GeoPermissibleObjects)
          const abbr = FIPS_TO_ABBR[isoKey(f.id)]
          const data = abbr ? stateMapByAbbr[abbr] : undefined
          return d ? [{ d, fill: fillFor(data, metric, color, lowColor) }] : []
        }),
        shapeStroke: 1,
        labels: labels.map(({ abbr, x, y }) => ({ x, y, text: abbr })),
        fileName: `${config.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`,
      })
    } finally {
      setExporting(false)
    }
  }

  // Sits beside the legend on both 2024 election maps
  const electionLevelToggle = (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">Show by</span>
      <div className="inline-flex gap-1" role="group" aria-label="2024 election level">
        {(["county", "state"] as const).map((level) => (
          <Button
            key={level}
            type="button"
            size="xs"
            variant={electionLevel === level ? "default" : "secondary"}
            aria-pressed={electionLevel === level}
            onClick={() => {
              setElectionLevel(level)
              setView(level === "county" ? "election2024County" : "election2024")
            }}
          >
            {level === "county" ? "County" : "State"}
          </Button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={view === "native" ? "default" : "secondary"}
          onClick={() => setView("native")}
        >
          Demographics
        </Button>
        <Button
          type="button"
          size="sm"
          variant={electionActive ? "default" : "secondary"}
          onClick={() => setView(electionLevel === "county" ? "election2024County" : "election2024")}
        >
          2024 election
        </Button>
        <Button
          type="button"
          size="sm"
          variant={view === "antiImmig" ? "default" : "secondary"}
          onClick={() => setView("antiImmig")}
        >
          Immigration sentiment
        </Button>
        <Button
          type="button"
          size="sm"
          variant={view === "enforcement" ? "default" : "secondary"}
          onClick={() => setView("enforcement")}
        >
          Enforcement laws &amp; ICE
        </Button>
        <Button
          type="button"
          size="sm"
          variant={view === "thirtyMarriedHomeowner" ? "default" : "secondary"}
          onClick={() => setView("thirtyMarriedHomeowner")}
        >
          Fishback benchmark
        </Button>
        <Button
          type="button"
          size="sm"
          variant={view === "wealthShareUnder30" ? "default" : "secondary"}
          onClick={() => setView("wealthShareUnder30")}
        >
          Wealth share (30 &amp; under)
        </Button>
      </div>

      <div className={showCounties ? undefined : "hidden"}>
        {/* Same columns as the state view, with an empty stand-in for the small-state list so
            the map renders at the same size in every view */}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
          {countyMap}
          <div className="hidden sm:block sm:w-32" aria-hidden />
        </div>
      </div>

      <div className={showElection ? undefined : "hidden"}>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
          <UsCountyElectionMap {...electionCounties} legendExtra={electionLevelToggle} />
          <div className="hidden sm:block sm:w-32" aria-hidden />
        </div>
      </div>

      {/* Title, map, legend, and source sit together so a screenshot of this block stands alone */}
      <figure className={`space-y-3 bg-background ${showStates ? "" : "hidden"}`}>
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
              className="h-auto w-full touch-pan-y"
              role="img"
              aria-label={`Map: ${config.title}`}
            >
              {orderedFeatures.map((f) => {
                const id = isoKey(f.id)
                const abbr = FIPS_TO_ABBR[id]
                const data = abbr ? stateMapByAbbr[abbr] : undefined
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
                        ? `${data.state}: ${metricLabel(data, metric)}`
                        : `${f.properties.name}: no data`}
                    </title>
                  </path>
                )
              })}

              {/* Labels in a separate pass so hovered/selected states drawn later don't cover them */}
              {labels.map(({ abbr, x, y }) => (
                <text
                  key={abbr}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  paintOrder="stroke"
                  stroke="var(--background)"
                  strokeWidth={3}
                  strokeLinejoin="round"
                  className="pointer-events-none select-none font-bold uppercase tracking-wide"
                  style={{ fontSize: 13, fill: "var(--foreground)" }}
                >
                  {abbr}
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
                    <div className="font-medium text-foreground">{hovered.state}</div>
                    <div className="tabular-nums text-muted-foreground">
                      {config.name}{" "}
                      <span className="font-medium text-foreground">{metricLabel(hovered, metric)}</span>
                    </div>
                  </>
                ) : (
                  <div className="font-medium text-foreground">No data</div>
                )}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-lg border border-border sm:w-32">
            {SIDEBAR_ABBRS.map((abbr) => {
              const id = ABBR_TO_FIPS[abbr]
              const data = stateMapByAbbr[abbr]
              const isHovered = hoveredId === id
              const isSelected = selectedId === id
              return (
                <button
                  key={abbr}
                  type="button"
                  title={data ? `${data.state}: ${metricLabel(data, metric)}` : abbr}
                  className="block w-full cursor-pointer border-b border-border/60 px-3 py-1.5 text-left text-xs font-bold uppercase tracking-wide text-foreground transition-colors last:border-b-0"
                  style={{ background: fillFor(data, metric, color, lowColor, isHovered, isSelected) }}
                  onMouseEnter={() => setHoveredId(id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => setSelectedId((prev) => (prev === id ? null : id))}
                >
                  <span
                    className="rounded-[3px] px-1"
                    style={{ background: "color-mix(in oklch, var(--background) 70%, transparent)" }}
                  >
                    {abbr}
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
          {metric === "antiImmig" && <LegendSwatch color={NO_DATA_FILL} label="No data" />}
          {metric === "election2024" && electionLevelToggle}
          <span className="ml-auto text-muted-foreground">{config.source}</span>
        </figcaption>
      </figure>

      <div
        className={`grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start ${showStates ? "" : "hidden"}`}
      >
        <div className="rounded-lg border border-border bg-card/40 px-4 py-3 text-sm">
          {detail ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-base font-semibold text-foreground">
                  {detailPage ? (
                    <Link href={`/united-states/${detailPage.slug}`} className="hover:underline">
                      {detail.state}
                    </Link>
                  ) : (
                    detail.state
                  )}
                </h3>
                <div className="flex items-center gap-3">
                  {detailPage && (
                    <Link
                      href={`/united-states/${detailPage.slug}`}
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      Full profile →
                    </Link>
                  )}
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
                <Stat
                  label="2024 presidential vote"
                  value={formatElection2024(detail)}
                  color={detail.trump2024 >= detail.harris2024 ? ANTI_IMMIG_COLOR : PRO_IMMIG_COLOR}
                />
                <Stat
                  label="Anti-immigration sentiment"
                  value={detail.antiImmig == null ? "—" : `${detail.antiImmig}%`}
                  color={COLORS.anti}
                />
                <Stat
                  label="Enforcement laws & ICE"
                  value={enforcementLabel(detail)}
                  color={COLORS.enforcement}
                />
                <Stat label="Native / European" value={`${detail.native}%`} color={COLORS.native} />
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
              Hover or select one of {stateMapData.length} states (including DC) to inspect its
              figures.
            </p>
          )}
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-card/40 px-4 py-3 text-sm">
          {lowColor && (
            <MapColorControl
              label={lowColorLabel}
              color={lowColor}
              onChange={(next) => setLowColors((prev) => withColor(prev, metric, next))}
            />
          )}
          <MapColorControl
            label={lowColor ? highColorLabel : "Map color"}
            color={color}
            onChange={(next) => setColors((prev) => withColor(prev, metric, next))}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Anti-immigration sentiment: share saying newcomers from other countries threaten
        traditional American customs and values (PRRI 2015 American Values Atlas; DC not
        surveyed). Enforcement laws &amp; ICE: state legislation on ICE detainers, 287(g),
        information sharing, anti-sanctuary mandates, and state immigration crimes, averaged
        on ILRC&apos;s 1–5 scale (1 = most enforcement, 5 = most protective; ILRC State Map on
        Immigration Enforcement, July 2026).
        Demographics: county shares of the same groups as the state ethnic chart — European
        (non-Hispanic White minus Arab ancestry), Hispanic, African (non-Hispanic Black), Indian,
        East Asian, Arab, Native American (non-Hispanic American Indian and Alaska Native), and
        Other (Census county estimates for 1990; decennial census and
        ancestry tables for 2000 and 2010; ACS 2016–2020 for 2020; Census Vintage 2025
        estimates with ACS 2020–2024 Asian-group and ancestry shares for 2025). The 1990 county data has no
        Indian, East Asian, or Arab figures (they are counted in Other and European that year),
        so a side made only of those groups shows no data for 1990. In 2025 Connecticut is
        shown by its nine planning regions, which replaced its counties in 2022 and are how the
        Census now reports it. Each
        county takes the color of whichever chosen side is largest, deeper the wider its lead
        over the next side. 30, married &amp; homeowner: among 30-year-olds, share who are married with
        spouse present and own their home, estimated from ACS 2024 1-year cross-tabulations by
        age, marital status, and tenure. Wealth share (30 &amp; under): estimated share of total
        household net wealth held by residents aged 30 and under, derived from the Fishback
        benchmark and Federal Reserve Distributional Financial Accounts under-35 wealth shares.
        2024 election (by state): statewide popular-vote shares for Donald Trump and Kamala
        Harris in the 2024 presidential general election (certified results; third-party votes
        make up the remainder). Margins of {ELECTION_MARGIN_CAP} points or more take the deepest
        shade. Maine and Nebraska split electoral votes by district; the map shows the statewide
        vote. State-level colors are scaled to the range across states.
      </p>
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
