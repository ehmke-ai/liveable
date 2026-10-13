"use client"

import { useEffect, useMemo, useState, type MouseEvent } from "react"
import { Download } from "lucide-react"

import { ColorChooser } from "@/components/color-chooser"
import {
  countyLinkHandlers,
  CountyPaths,
  useCountyGeometry,
  type CountyMapState,
} from "@/components/county-map-geometry"
import { Button } from "@/components/ui/button"
import type { UsCountyRow } from "@/components/us-county-map"
import {
  downloadMapPng,
  shade,
  SHADE_RANGE,
  shadeGradient,
  shadeStops,
} from "@/components/us-county-map-export"
import { rangeIntensity } from "@/lib/states"
import { formatCount } from "@/lib/work-visas"

/** [H-1B positions, H-2A workers, H-2B workers, resident population] */
type CountyVisa = [number, number, number, number | null]
type CountyVisas = Record<string, CountyVisa>

type Program = "h1b" | "h2a" | "h2b"
type Scale = "positions" | "rate"

const DATA_URL = "/data/county-visas.json"

const PROGRAMS: Record<
  Program,
  { index: 0 | 1 | 2; label: string; name: string; noun: string; color: string }
> = {
  h1b: { index: 0, label: "H-1B", name: "H-1B positions", noun: "positions", color: "#1d4ed8" },
  h2a: { index: 1, label: "H-2A", name: "H-2A workers", noun: "workers", color: "#15803d" },
  h2b: { index: 2, label: "H-2B", name: "H-2B workers", noun: "workers", color: "#b45309" },
}

const SOURCE =
  "Source: DOL OFLC case disclosure, FY 2025 (worksite). Population: Census Bureau, July 1, 2024 (Connecticut counties, July 1, 2021)."

function formatRate(value: number): string {
  return value >= 100 ? value.toFixed(0) : value.toFixed(1)
}

function per100k(count: number, population: number): number {
  return (count / population) * 100_000
}

/** Log scale from 1 to the national maximum, so a few huge counties do not wash out the rest. */
function intensity(value: number, max: number): number {
  if (value <= 0 || max <= 1) return 0
  return rangeIntensity(Math.log10(value), 0, Math.log10(max))
}

function fillFor(value: number | null, max: number, color: string) {
  if (value == null) return "var(--border)"
  const t = intensity(value, max)
  const pct = Math.round(SHADE_RANGE[0] + t * (SHADE_RANGE[1] - SHADE_RANGE[0]))
  return shade(color, pct)
}

export function UsCountyVisaMap({
  counties: rows,
  states,
  state,
  onOpenCounty,
}: {
  counties: UsCountyRow[]
  /** State FIPS -> USPS abbreviation, for the tooltip heading */
  states: Record<string, string>
  /** Draw only this state's counties */
  state?: CountyMapState
  /** Opens a county's page; with it, the counties in `counties` are clickable links */
  onOpenCounty?: (fips: string) => void
}) {
  const geometry = useCountyGeometry(state)
  const [visas, setVisas] = useState<CountyVisas | null>(null)
  const [program, setProgram] = useState<Program>("h1b")
  const [scale, setScale] = useState<Scale>("positions")
  const [color, setColor] = useState(PROGRAMS.h1b.color)
  const [hoveredFips, setHoveredFips] = useState<string | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [exporting, setExporting] = useState(false)
  const config = PROGRAMS[program]

  const labelByFips = useMemo(() => Object.fromEntries(rows), [rows])

  useEffect(() => {
    let cancelled = false
    fetch(DATA_URL)
      .then((r) => r.json() as Promise<CountyVisas>)
      .then((data) => {
        if (!cancelled) setVisas(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const { width, height, counties: countyOutlines, regionLabels, stateBorders } = geometry
  const loading = geometry.loading

  const max = useMemo(() => {
    if (!visas) return 1
    let peak = 1
    for (const row of Object.values(visas)) {
      const count = row[config.index]
      const population = row[3]
      const value =
        scale === "rate" ? (population ? per100k(count, population) : 0) : count
      if (value > peak) peak = value
    }
    return peak
  }, [visas, config.index, scale])

  const shapes = useMemo(
    () =>
      countyOutlines.map((outline) => {
        const row = visas?.[outline.fips]
        if (!row) return { ...outline, fill: fillFor(null, max, color) }
        const count = row[config.index]
        const value = scale === "positions" ? count : row[3] ? per100k(count, row[3]) : null
        return { ...outline, fill: fillFor(value, max, color) }
      }),
    [countyOutlines, visas, max, color, config.index, scale]
  )

  const pathByFips = useMemo(
    () => Object.fromEntries(countyOutlines.map((outline) => [outline.fips, outline.d])),
    [countyOutlines]
  )

  function handleMouseMove(e: MouseEvent<SVGSVGElement>) {
    const fips = (e.target as Element).getAttribute("data-fips")
    if (!fips || !visas?.[fips]) {
      setHoveredFips(null)
      setPointer(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setHoveredFips(fips)
    setPointer({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    })
  }

  const hovered = hoveredFips ? visas?.[hoveredFips] : undefined
  const place = state ? ` in ${state.state}` : ""
  const title = `${config.name} by county${place}`
  const subtitle =
    scale === "rate"
      ? `${config.name} per 100,000 residents. The color follows the log of the rate, from none to the highest county in the country.`
      : `Certified ${config.noun} in FY 2025, at the county of the first worksite. The color follows the log of the count, so counties across the range stay visible.`
  const low = "0"
  const high = scale === "rate" ? `${formatRate(max)} per 100,000` : formatCount(Math.round(max))

  async function handleDownload() {
    setExporting(true)
    try {
      await downloadMapPng({
        title,
        subtitle,
        legend: [{ name: scale === "rate" ? `${config.name} per 100,000` : config.name, stops: shadeStops(color), low, high }],
        noData: true,
        source: SOURCE,
        mapWidth: width,
        mapHeight: height,
        shapes,
        stateBorders,
        fileName: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`,
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(PROGRAMS) as Program[]).map((key) => (
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
        <div className="inline-flex gap-1" role="group" aria-label="Map scale">
          {(
            [
              ["positions", "Positions"],
              ["rate", "Per 100,000"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              size="xs"
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
              {title}
            </h3>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleDownload}
            disabled={loading || !visas || exporting}
          >
            <Download aria-hidden />
            {exporting ? "Saving…" : "PNG"}
          </Button>
        </div>

        <div className="relative">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-muted-foreground">
              Loading map…
            </div>
          )}
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className={`h-auto w-full touch-pan-y ${state ? "max-h-[75svh]" : ""}`}
            role={onOpenCounty ? "group" : "img"}
            aria-label={`Map: ${title}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => {
              setHoveredFips(null)
              setPointer(null)
            }}
            {...countyLinkHandlers(onOpenCounty)}
          >
            <CountyPaths shapes={shapes} links={onOpenCounty ? labelByFips : undefined} />
            {stateBorders && (
              <path
                d={stateBorders}
                fill="none"
                stroke="var(--background)"
                strokeWidth={1}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            )}
            {hoveredFips && pathByFips[hoveredFips] && (
              <path
                d={pathByFips[hoveredFips]}
                fill="none"
                stroke="color-mix(in oklch, var(--foreground) 55%, var(--background))"
                strokeWidth={1.25}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            )}
          </svg>

          {hoveredFips && hovered && pointer && (
            <div
              className="pointer-events-none absolute z-10 min-w-[14rem] rounded-none border border-border bg-popover px-3 py-2 text-sm shadow-md"
              style={{
                left: `min(${pointer.x}%, calc(100% - 15rem))`,
                top: `max(${pointer.y - 2}%, 0.5rem)`,
                transform: "translateY(-100%)",
              }}
            >
              <div className="font-medium text-foreground">
                {labelByFips[hoveredFips] ?? regionLabels[hoveredFips] ?? (hoveredFips === "11001" ? "District of Columbia" : hoveredFips)}
                {state ? "" : `, ${states[hoveredFips.slice(0, 2)] ?? ""}`}
              </div>
              <ul className="mt-1.5 space-y-0.5 tabular-nums">
                {(Object.keys(PROGRAMS) as Program[]).map((key) => {
                  const item = PROGRAMS[key]
                  const count = hovered[item.index]
                  const population = hovered[3]
                  const rate = population ? per100k(count, population) : null
                  return (
                    <li key={key} className="flex items-center justify-between gap-3">
                      <span className={key === program ? "text-foreground" : "text-muted-foreground"}>
                        {item.name}
                      </span>
                      <span className="font-medium text-foreground">
                        {formatCount(count)}
                        {scale === "rate" && rate != null ? ` · ${formatRate(rate)}` : ""}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>

        <figcaption className="flex flex-wrap items-end gap-x-6 gap-y-3 text-xs">
          <div className="w-48 space-y-1">
            <div className="font-medium text-foreground">
              {scale === "rate" ? `${config.name} per 100,000` : config.name}
            </div>
            <div
              className="h-2.5 border border-border"
              style={{ background: shadeGradient(color) }}
            />
            <div className="flex justify-between gap-2 tabular-nums text-muted-foreground">
              <span>{low}</span>
              <span className="text-right">{high}</span>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <i
              className="inline-block size-3 rounded-[3px] border border-border"
              style={{ background: "var(--border)" }}
              aria-hidden
            />
            No data
          </span>
          <span className="ml-auto text-muted-foreground">{SOURCE}</span>
        </figcaption>
      </figure>

      <div className="space-y-3 rounded-lg border border-border bg-card/40 px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <i
            className="inline-block size-3 shrink-0 rounded-[3px] border border-border"
            style={{ background: color }}
            aria-hidden
          />
          <span className="font-medium text-foreground">Color</span>
        </div>
        <ColorChooser color={color} onChange={setColor} label="Color" />
      </div>

      <p className="text-xs text-muted-foreground">
        Fiscal year 2025, from the Labor Department’s case files. H-1B counts positions on
        certified Labor Condition Applications. H-2A and H-2B count workers DOL certified,
        including partial certifications. An application that lists several worksites is counted
        in the first county. A certified slot is permission for an employer to petition. It is
        not a visa stamp and not a person admitted. Hover a county for all three counts. Where
        the filing left the county blank, the worksite ZIP is assigned to the county it overlaps
        most.
      </p>
    </div>
  )
}
