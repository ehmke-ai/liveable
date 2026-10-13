"use client"

import { geoPath, type GeoPermissibleObjects } from "d3-geo"
import Link from "next/link"
import { useEffect, useMemo, useState, type MouseEvent } from "react"
import { feature } from "topojson-client"
import type { Feature, FeatureCollection, Geometry, Polygon } from "geojson"
import type { GeometryCollection, Topology } from "topojson-specification"
import { Download } from "lucide-react"

import { ColorChooser } from "@/components/color-chooser"
import { Button } from "@/components/ui/button"
import {
  downloadMapPng,
  shade,
  shadeGradient,
  shadeStops,
  SHADE_RANGE,
} from "@/components/us-county-map-export"
import {
  workVisaByAbbr,
  workVisaStates,
  workVisaTotal,
  type WorkVisaProgram,
  type WorkVisaState,
} from "@/data/work-visa-states"
import { formatCount, formatShare } from "@/lib/work-visas"
import { rangeIntensity, stateNavByAbbr } from "@/lib/states"

type Scale = "positions" | "rate"

type StateFeature = Feature<Geometry, { name: string }> & { id?: string | number }

const WIDTH = 960
const HEIGHT = 600

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

const SIDEBAR_ABBRS = ["VT", "NH", "MA", "RI", "CT", "NJ", "DE", "MD", "DC"]
const UNLABELED_ABBRS = new Set([...SIDEBAR_ABBRS, "HI"])

const PROGRAMS: Record<
  WorkVisaProgram,
  { label: string; title: string; name: string; color: string; noun: string }
> = {
  h1b: {
    label: "H-1B",
    title: "H-1B positions by state",
    name: "H-1B positions",
    color: "#1d4ed8",
    noun: "positions",
  },
  h2a: {
    label: "H-2A",
    title: "H-2A farm jobs by state",
    name: "H-2A workers",
    color: "#15803d",
    noun: "workers",
  },
  h2b: {
    label: "H-2B",
    title: "H-2B seasonal jobs by state",
    name: "H-2B workers",
    color: "#b45309",
    noun: "workers",
  },
}

const SOURCE =
  "Source: DOL OFLC case disclosure, FY 2025 (primary worksite). Population: Census Bureau, July 1, 2024."

function isoKey(id: string | number | undefined) {
  if (id == null) return ""
  return String(id).padStart(2, "0")
}

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
  const c = path.centroid({
    type: "Feature",
    properties: {},
    geometry: largest,
  } as GeoPermissibleObjects)
  return Number.isFinite(c[0]) && Number.isFinite(c[1]) ? c : null
}

function per100k(row: WorkVisaState, program: WorkVisaProgram): number {
  return (row[program] / row.population) * 100_000
}

function formatRate(value: number): string {
  return value >= 100 ? value.toFixed(0) : value.toFixed(1)
}

function measure(row: WorkVisaState, program: WorkVisaProgram, scale: Scale): number {
  return scale === "rate" ? per100k(row, program) : row[program]
}

/** Count view is log-scaled so a few thousand positions still read against California. */
function intensity(
  row: WorkVisaState,
  program: WorkVisaProgram,
  scale: Scale,
  min: number,
  max: number
): number {
  const value = measure(row, program, scale)
  if (scale === "positions") {
    const floor = Math.max(min, 1)
    if (value <= 0) return 0
    return rangeIntensity(Math.log10(value), Math.log10(floor), Math.log10(max))
  }
  return rangeIntensity(value, min, max)
}

function fillFor(t: number, color: string, hovered = false, selected = false) {
  const boost = selected ? 15 : hovered ? 8 : 0
  const pct = Math.round(SHADE_RANGE[0] + t * (SHADE_RANGE[1] - SHADE_RANGE[0]))
  return shade(color, Math.min(100, pct + boost))
}

export function WorkVisaMap() {
  const [features, setFeatures] = useState<StateFeature[]>([])
  const [program, setProgram] = useState<WorkVisaProgram>("h1b")
  const [scale, setScale] = useState<Scale>("positions")
  const [color, setColor] = useState(PROGRAMS.h1b.color)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const config = PROGRAMS[program]
  const total = workVisaTotal(program)
  const values = workVisaStates.map((row) => measure(row, program, scale))
  const min = Math.min(...values)
  const max = Math.max(...values)

  function updatePointer(e: MouseEvent<SVGPathElement | HTMLButtonElement>) {
    const svg =
      e.currentTarget instanceof SVGPathElement
        ? e.currentTarget.ownerSVGElement
        : e.currentTarget.closest("figure")?.querySelector("svg")
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

  const path = useMemo(() => geoPath(null), [])

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

  const hovered = hoveredId ? workVisaByAbbr[FIPS_TO_ABBR[hoveredId]] : undefined
  const selected = selectedId ? workVisaByAbbr[FIPS_TO_ABBR[selectedId]] : undefined
  const detail = selected ?? hovered

  function valueLabel(row: WorkVisaState): string {
    const count = row[program]
    if (scale === "rate") {
      return `${formatRate(per100k(row, program))} per 100,000`
    }
    return formatCount(count)
  }

  function legendCaption(value: number): string {
    return scale === "rate" ? formatRate(value) : formatCount(value)
  }

  const subtitle =
    scale === "rate"
      ? `${config.name} per 100,000 residents. The color runs in a straight line from the lowest state to the highest.`
      : `${config.name} certified in FY 2025. The color follows the log of the count, so states across the range stay visible.`

  async function handleDownload() {
    setExporting(true)
    try {
      await downloadMapPng({
        title: config.title,
        subtitle,
        legend: [
          {
            name: scale === "rate" ? `${config.name} per 100,000` : config.name,
            stops: shadeStops(color),
            low: legendCaption(min),
            high: legendCaption(max),
          },
        ],
        noData: false,
        source: SOURCE,
        mapWidth: WIDTH,
        mapHeight: HEIGHT,
        shapes: features.flatMap((f) => {
          const d = path(f as GeoPermissibleObjects)
          const row = workVisaByAbbr[FIPS_TO_ABBR[isoKey(f.id)]]
          return d
            ? [{ d, fill: fillFor(row ? intensity(row, program, scale, min, max) : 0, color) }]
            : []
        }),
        shapeStroke: 1,
        labels: labels.map(({ abbr, x, y }) => ({ x, y, text: abbr })),
        fileName: `${config.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`,
      })
    } finally {
      setExporting(false)
    }
  }

  const ranked = [...workVisaStates].sort((a, b) => b[program] - a[program])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(PROGRAMS) as WorkVisaProgram[]).map((key) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={program === key ? "default" : "secondary"}
            aria-pressed={program === key}
            onClick={() => {
              setProgram(key)
              setColor(PROGRAMS[key].color)
            }}
          >
            {PROGRAMS[key].label}
          </Button>
        ))}
        <div className="ml-auto inline-flex gap-1" role="group" aria-label="Map scale">
          {(
            [
              ["positions", "Positions"],
              ["rate", "Per 100,000"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={scale === key ? "default" : "secondary"}
              aria-pressed={scale === key}
              onClick={() => setScale(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <figure className="space-y-3 bg-background">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-balance text-foreground sm:text-lg">
              {config.title}
            </h3>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
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
                const row = workVisaByAbbr[FIPS_TO_ABBR[id]]
                const isHovered = hoveredId === id
                const isSelected = selectedId === id
                const d = path(f as GeoPermissibleObjects)
                if (!d || !row) return null
                return (
                  <path
                    key={id}
                    d={d}
                    fill={fillFor(intensity(row, program, scale, min, max), color, isHovered, isSelected)}
                    stroke={
                      isSelected
                        ? "var(--foreground)"
                        : isHovered
                          ? "color-mix(in oklch, var(--foreground) 55%, var(--background))"
                          : "var(--background)"
                    }
                    strokeWidth={isSelected ? 1.75 : isHovered ? 1.5 : 1}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    className="cursor-pointer transition-[fill,stroke-width] duration-150"
                    onMouseEnter={(e) => {
                      setHoveredId(id)
                      updatePointer(e)
                    }}
                    onMouseMove={updatePointer}
                    onMouseLeave={() => {
                      setHoveredId(null)
                      setPointer(null)
                    }}
                    onClick={() => setSelectedId((prev) => (prev === id ? null : id))}
                  >
                    <title>
                      {row.name}: {valueLabel(row)}
                    </title>
                  </path>
                )
              })}
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

            {hovered && pointer && (
              <div
                className="pointer-events-none absolute z-10 rounded-md border border-border bg-popover px-3 py-2 text-sm shadow-md"
                style={{
                  left: `min(${pointer.x}%, calc(100% - 12rem))`,
                  top: `max(${pointer.y - 2}%, 0.5rem)`,
                  transform: "translateY(-100%)",
                }}
              >
                <div className="font-medium text-foreground">{hovered.name}</div>
                <div className="tabular-nums text-muted-foreground">
                  {config.name}{" "}
                  <span className="font-medium text-foreground">{valueLabel(hovered)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-lg border border-border sm:w-32">
            {SIDEBAR_ABBRS.map((abbr) => {
              const id = ABBR_TO_FIPS[abbr]
              const row = workVisaByAbbr[abbr]
              const isHovered = hoveredId === id
              const isSelected = selectedId === id
              return (
                <button
                  key={abbr}
                  type="button"
                  title={`${row.name}: ${valueLabel(row)}`}
                  className="block w-full cursor-pointer border-b border-border/60 px-3 py-1.5 text-left text-xs font-bold uppercase tracking-wide text-foreground transition-colors last:border-b-0"
                  style={{
                    background: fillFor(
                      intensity(row, program, scale, min, max),
                      color,
                      isHovered,
                      isSelected
                    ),
                  }}
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
            <div className="font-medium text-foreground">
              {scale === "rate" ? "Per 100,000 residents" : config.name}
            </div>
            <div className="h-2.5 border border-border" style={{ background: shadeGradient(color) }} />
            <div className="flex justify-between gap-2 tabular-nums text-muted-foreground">
              <span>{legendCaption(min)}</span>
              <span className="text-right">{legendCaption(max)}</span>
            </div>
          </div>
          <span className="ml-auto max-w-md text-muted-foreground">{SOURCE}</span>
        </figcaption>
      </figure>

      <div className="grid gap-4 lg:grid-cols-[1fr_16rem] lg:items-start">
        <div className="rounded-lg border border-border bg-card/40 px-4 py-3 text-sm">
          {detail ? (
            <StateDetail
              row={detail}
              program={program}
              color={color}
              total={total}
              onClear={selected ? () => setSelectedId(null) : undefined}
            />
          ) : (
            <p className="text-muted-foreground">
              Hover or select a state. The {config.label} total across the 50 states and D.C. is{" "}
              {formatCount(total)} {config.noun}.
            </p>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card/40 px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">Map color</span>
            <ColorChooser color={color} onChange={setColor} label="Map color" />
          </div>
        </div>
      </div>

      <div className="max-h-80 overflow-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left font-medium">State</th>
              <th className="px-3 py-2 text-right font-medium">{config.name}</th>
              <th className="px-3 py-2 text-right font-medium">Per 100,000</th>
              <th className="px-3 py-2 text-right font-medium">Share</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((row) => {
              const id = ABBR_TO_FIPS[row.abbr]
              const active = selectedId === id
              return (
                <tr
                  key={row.abbr}
                  className={`cursor-pointer border-b border-border/60 last:border-b-0 ${active ? "bg-muted/60" : "hover:bg-muted/40"}`}
                  onClick={() => setSelectedId(id)}
                >
                  <td className="px-3 py-1.5 font-medium">{row.name}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatCount(row[program])}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                    {formatRate(per100k(row, program))}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                    {formatShare(row[program], total)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StateDetail({
  row,
  program,
  color,
  total,
  onClear,
}: {
  row: WorkVisaState
  program: WorkVisaProgram
  color: string
  total: number
  onClear?: () => void
}) {
  const nav = stateNavByAbbr[row.abbr]
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">
          {nav ? (
            <Link href={`/united-states/${nav.slug}`} className="hover:underline">
              {row.name}
            </Link>
          ) : (
            row.name
          )}
        </h3>
        {onClear && (
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={onClear}
          >
            Clear selection
          </button>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 tabular-nums sm:grid-cols-3">
        {(Object.keys(PROGRAMS) as WorkVisaProgram[]).map((key) => (
          <div key={key}>
            <dt className={key === program ? "text-foreground" : "text-muted-foreground"}>
              {PROGRAMS[key].name}
            </dt>
            <dd className="font-medium" style={{ color: key === program ? color : undefined }}>
              {formatCount(row[key])}
              <span className="ml-2 font-normal text-muted-foreground">
                {formatRate(per100k(row, key))} / 100k
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        {formatShare(row[program], total)} of {PROGRAMS[program].label} {PROGRAMS[program].noun}{" "}
        certified in the states and D.C.
      </p>
    </div>
  )
}
