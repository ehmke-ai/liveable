"use client"

import { geoPath, type GeoPermissibleObjects } from "d3-geo"
import Link from "next/link"
import { useEffect, useMemo, useState, type MouseEvent } from "react"
import { feature } from "topojson-client"
import type { Feature, FeatureCollection, Geometry, Polygon } from "geojson"
import type { GeometryCollection, Topology } from "topojson-specification"

import { Button } from "@/components/ui/button"
import { COLORS } from "@/lib/demographics"
import {
  ENFORCEMENT_TIER_LABELS,
  enforcementIntensity,
  maxStateAntiImmig,
  maxStateNative,
  maxStateThirtyMarriedHomeowner,
  maxStateWealthShareUnder30,
  minStateAntiImmig,
  minStateNative,
  minStateThirtyMarriedHomeowner,
  minStateWealthShareUnder30,
  rangeIntensity,
  stateByAbbr,
  stateMapByAbbr,
  stateMapData,
  type StateMapMetrics,
} from "@/lib/states"

type MapMetric =
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

function fillFor(
  data: StateMapMetrics | undefined,
  metric: MapMetric,
  hovered: boolean,
  selected: boolean
) {
  if (!data || (metric === "antiImmig" && data.antiImmig == null)) {
    return hovered ? NO_DATA_HOVER_FILL : NO_DATA_FILL
  }

  if (metric === "antiImmig") {
    const t = rangeIntensity(data.antiImmig ?? 0, minStateAntiImmig, maxStateAntiImmig)
    const alpha = 0.3 + t * 0.7
    if (selected) return `rgba(217, 120, 45, ${Math.min(1, alpha + 0.15)})`
    if (hovered) return `rgba(240, 178, 122, ${Math.min(1, alpha + 0.1)})`
    return `rgba(217, 120, 45, ${alpha})`
  }

  if (metric === "enforcement") {
    const t = enforcementIntensity(data.enforcementScore)
    const alpha = 0.3 + t * 0.7
    if (selected) return `rgba(194, 65, 91, ${Math.min(1, alpha + 0.15)})`
    if (hovered) return `rgba(226, 130, 150, ${Math.min(1, alpha + 0.1)})`
    return `rgba(194, 65, 91, ${alpha})`
  }

  if (metric === "thirtyMarriedHomeowner") {
    const t = rangeIntensity(
      data.thirtyMarriedHomeowner,
      minStateThirtyMarriedHomeowner,
      maxStateThirtyMarriedHomeowner
    )
    const alpha = 0.3 + t * 0.7
    if (selected) return `rgba(139, 92, 246, ${Math.min(1, alpha + 0.15)})`
    if (hovered) return `rgba(180, 150, 250, ${Math.min(1, alpha + 0.1)})`
    return `rgba(139, 92, 246, ${alpha})`
  }

  if (metric === "wealthShareUnder30") {
    const t = rangeIntensity(
      data.wealthShareUnder30,
      minStateWealthShareUnder30,
      maxStateWealthShareUnder30
    )
    const alpha = 0.3 + t * 0.7
    if (selected) return `rgba(34, 197, 94, ${Math.min(1, alpha + 0.15)})`
    if (hovered) return `rgba(140, 230, 170, ${Math.min(1, alpha + 0.1)})`
    return `rgba(34, 197, 94, ${alpha})`
  }

  const t = rangeIntensity(data.native, minStateNative, maxStateNative)
  const pct = Math.round(15 + t * 85)
  if (selected) {
    return `color-mix(in oklch, var(--foreground) ${Math.min(100, pct + 15)}%, var(--muted))`
  }
  if (hovered) {
    return `color-mix(in oklch, var(--foreground) ${Math.min(100, pct + 8)}%, var(--muted))`
  }
  return `color-mix(in oklch, var(--foreground) ${pct}%, var(--muted))`
}

function metricLabel(data: StateMapMetrics, metric: MapMetric): string {
  if (metric === "antiImmig") return data.antiImmig == null ? "no data" : `${data.antiImmig}%`
  if (metric === "enforcement") return enforcementLabel(data)
  if (metric === "thirtyMarriedHomeowner") return `${data.thirtyMarriedHomeowner}%`
  if (metric === "wealthShareUnder30") return `${data.wealthShareUnder30}%`
  return `${data.native}%`
}

function enforcementLabel(data: StateMapMetrics): string {
  return `${ENFORCEMENT_TIER_LABELS[data.enforcementTier]} (${data.enforcementScore.toFixed(1)})`
}

function strokeFor(metric: MapMetric, selected: boolean, hovered: boolean): string {
  if (selected) {
    if (metric === "antiImmig") return "#f0b27a"
    if (metric === "enforcement") return "#e8899c"
    if (metric === "thirtyMarriedHomeowner") return "#c4b5fd"
    if (metric === "wealthShareUnder30") return "#86efac"
    return "var(--foreground)"
  }
  if (hovered) return "color-mix(in oklch, var(--foreground) 55%, var(--background))"
  return "var(--background)"
}

export function UsMap() {
  const [features, setFeatures] = useState<StateFeature[]>([])
  const [metric, setMetric] = useState<MapMetric>("native")
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
  const detailPage = detail ? stateByAbbr[detail.abbr] : undefined

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={metric === "native" ? "default" : "secondary"}
          onClick={() => setMetric("native")}
        >
          Native / European
        </Button>
        <Button
          type="button"
          size="sm"
          variant={metric === "antiImmig" ? "default" : "secondary"}
          onClick={() => setMetric("antiImmig")}
        >
          Anti-immigration sentiment
        </Button>
        <Button
          type="button"
          size="sm"
          variant={metric === "enforcement" ? "default" : "secondary"}
          onClick={() => setMetric("enforcement")}
        >
          Enforcement laws &amp; ICE
        </Button>
        <Button
          type="button"
          size="sm"
          variant={metric === "thirtyMarriedHomeowner" ? "default" : "secondary"}
          onClick={() => setMetric("thirtyMarriedHomeowner")}
        >
          Fishback benchmark
        </Button>
        <Button
          type="button"
          size="sm"
          variant={metric === "wealthShareUnder30" ? "default" : "secondary"}
          onClick={() => setMetric("wealthShareUnder30")}
        >
          Wealth share (30 &amp; under)
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
            aria-label="Interactive map of the United States showing demographic metrics"
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
                  fill={fillFor(data, metric, isHovered, isSelected)}
                  stroke={strokeFor(metric, isSelected, isHovered)}
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
            {features.map((f) => {
              const abbr = FIPS_TO_ABBR[isoKey(f.id)]
              if (!abbr || UNLABELED_ABBRS.has(abbr)) return null
              const centroid = labelCentroid(path, f)
              if (!centroid) return null
              return (
                <text
                  key={abbr}
                  x={centroid[0]}
                  y={centroid[1]}
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
                  <div className="font-medium text-foreground">{hovered.state}</div>
                  <div className="tabular-nums text-muted-foreground">
                    {metric === "antiImmig" ? (
                      hovered.antiImmig == null ? (
                        "No survey data"
                      ) : (
                        <>
                          Opposition{" "}
                          <span style={{ color: COLORS.anti }}>{hovered.antiImmig}%</span>
                        </>
                      )
                    ) : metric === "enforcement" ? (
                      <>
                        <span style={{ color: COLORS.enforcement }}>
                          {ENFORCEMENT_TIER_LABELS[hovered.enforcementTier]}
                        </span>{" "}
                        · ILRC {hovered.enforcementScore.toFixed(1)}
                      </>
                    ) : metric === "thirtyMarriedHomeowner" ? (
                      <>
                        30, married &amp; homeowner{" "}
                        <span style={{ color: COLORS.thirtyMarriedHomeowner }}>
                          {hovered.thirtyMarriedHomeowner}%
                        </span>
                      </>
                    ) : metric === "wealthShareUnder30" ? (
                      <>
                        Wealth share, 30 &amp; under{" "}
                        <span style={{ color: COLORS.wealthShareUnder30 }}>
                          {hovered.wealthShareUnder30}%
                        </span>
                      </>
                    ) : (
                      <>
                        Native / European{" "}
                        <span style={{ color: COLORS.native }}>{hovered.native}%</span>
                      </>
                    )}
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
                style={{ background: fillFor(data, metric, isHovered, isSelected) }}
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

      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="rounded-lg border border-border bg-card/40 px-4 py-3 text-sm">
          {detail ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-base font-semibold text-foreground">
                  {detailPage ? (
                    <Link href={`/state/${detailPage.slug}`} className="hover:underline">
                      {detail.state}
                    </Link>
                  ) : (
                    detail.state
                  )}
                </h3>
                <div className="flex items-center gap-3">
                  {detailPage && (
                    <Link
                      href={`/state/${detailPage.slug}`}
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

        <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:min-w-[10rem]">
          <span className="font-medium text-foreground">Legend</span>
          {metric === "antiImmig" ? (
            <>
              <LegendSwatch color="rgba(217,120,45,0.3)" label={`Lower opposition (${minStateAntiImmig}%)`} />
              <LegendSwatch color="rgba(217,120,45,1)" label={`Higher opposition (${maxStateAntiImmig}%)`} />
            </>
          ) : metric === "enforcement" ? (
            <>
              <LegendSwatch color="rgba(194,65,91,0.3)" label="Sanctuary protections" />
              <LegendSwatch color="rgba(194,65,91,1)" label="Heavy ICE cooperation" />
            </>
          ) : metric === "thirtyMarriedHomeowner" ? (
            <>
              <LegendSwatch
                color="rgba(139,92,246,0.3)"
                label={`Lower share (${minStateThirtyMarriedHomeowner}%)`}
              />
              <LegendSwatch
                color="rgba(139,92,246,1)"
                label={`Higher share (${maxStateThirtyMarriedHomeowner}%)`}
              />
            </>
          ) : metric === "wealthShareUnder30" ? (
            <>
              <LegendSwatch
                color="rgba(34,197,94,0.3)"
                label={`Lower share (${minStateWealthShareUnder30}%)`}
              />
              <LegendSwatch
                color="rgba(34,197,94,1)"
                label={`Higher share (${maxStateWealthShareUnder30}%)`}
              />
            </>
          ) : (
            <>
              <LegendSwatch
                color="color-mix(in oklch, var(--foreground) 15%, var(--muted))"
                label={`Lower native share (${minStateNative}%)`}
              />
              <LegendSwatch color="var(--foreground)" label={`Higher native share (${maxStateNative}%)`} />
            </>
          )}
          {metric === "antiImmig" && <LegendSwatch color={NO_DATA_FILL} label="No data" />}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Anti-immigration sentiment: share saying newcomers from other countries threaten
        traditional American customs and values (PRRI 2015 American Values Atlas; DC not
        surveyed). Enforcement laws &amp; ICE: state legislation on ICE detainers, 287(g),
        information sharing, anti-sanctuary mandates, and state immigration crimes, averaged
        on ILRC&apos;s 1–5 scale (1 = most enforcement, 5 = most protective; ILRC State Map on
        Immigration Enforcement, July 2026).
        Native / European: non-Hispanic White minus Arab ancestry (Census Vintage 2025, ACS
        2024). 30, married &amp; homeowner: among 30-year-olds, share who are married with
        spouse present and own their home, estimated from ACS 2024 1-year cross-tabulations by
        age, marital status, and tenure. Wealth share (30 &amp; under): estimated share of total
        household net wealth held by residents aged 30 and under, derived from the Fishback
        benchmark and Federal Reserve Distributional Financial Accounts under-35 wealth shares.
        Colors are scaled to the range across states.
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
