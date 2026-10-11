"use client"

import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react"
import { Download } from "lucide-react"

import { ColorChooser } from "@/components/color-chooser"
import {
  countyLinkHandlers,
  CountyPaths,
  useCountyGeometry,
  withCtRegions,
  type CountyMapState,
} from "@/components/county-map-geometry"
import { Button } from "@/components/ui/button"
import type { UsCountyRow } from "@/components/us-county-map"
import {
  divergingGradient,
  divergingShade,
  divergingStops,
  downloadMapPng,
} from "@/components/us-county-map-export"
import {
  COUNTY_COST_SOURCE,
  COUNTY_COST_URL,
  formatDollarsShort,
  formatRatio,
  formatRent,
  priceToIncome,
  rentToIncome,
  type CountyCost,
} from "@/lib/cost-of-living"

type CountyCosts = Record<string, CountyCost>

export type CostMetric = "priceToIncome" | "rentToIncome" | "homeValue" | "rent" | "income"

/** Affordable / low end of the scale */
export const COST_LOW_COLOR = "#1a8a5a"
/** Expensive / high end of the scale */
export const COST_HIGH_COLOR = "#c2410c"

type MetricConfig = {
  label: string
  /** Legend heading and tooltip row name */
  name: string
  subtitle: string
  value: (c: CountyCost) => number | null
  format: (v: number) => string
  /** Values at or beyond these take the palest / deepest shade */
  range: [number, number]
  /** Scale on log values, for dollar figures spanning an order of magnitude */
  log?: boolean
}

const METRICS: Record<CostMetric, MetricConfig> = {
  priceToIncome: {
    label: "Home price ÷ income",
    name: "Home price to income",
    subtitle:
      "Median home value as a multiple of median household income; deeper orange means homes are harder to afford.",
    value: ([income, home]) => priceToIncome(home, income),
    format: formatRatio,
    range: [2, 8],
  },
  rentToIncome: {
    label: "Rent ÷ income",
    name: "Rent to income",
    subtitle:
      "A year of median gross rent as a share of median household income; deeper orange means rent takes more of a typical paycheck.",
    value: ([income, , rent]) => rentToIncome(rent, income),
    format: (v) => `${v.toFixed(1)}%`,
    range: [12, 36],
  },
  homeValue: {
    label: "Home value",
    name: "Median home value",
    subtitle: "Median value of owner-occupied homes.",
    value: ([, home]) => home,
    format: formatDollarsShort,
    range: [75_000, 750_000],
    log: true,
  },
  rent: {
    label: "Rent",
    name: "Median gross rent",
    subtitle: "Median monthly gross rent (contract rent plus utilities).",
    value: ([, , rent]) => rent,
    format: formatRent,
    range: [600, 2400],
    log: true,
  },
  income: {
    label: "Household income",
    name: "Median household income",
    subtitle: "Median household income in 2024 dollars.",
    value: ([income]) => income,
    format: formatDollarsShort,
    range: [35_000, 140_000],
    log: true,
  },
}

const METRIC_KEYS = Object.keys(METRICS) as CostMetric[]

function intensity(config: MetricConfig, value: number): number {
  const f = config.log ? Math.log : (v: number) => v
  const [lo, hi] = config.range
  return Math.min(1, Math.max(0, (f(value) - f(lo)) / (f(hi) - f(lo))))
}

function fillFor(
  cost: CountyCost | undefined,
  config: MetricConfig,
  lowColor: string,
  highColor: string
) {
  const value = cost ? config.value(cost) : null
  if (value == null) return "var(--border)"
  return divergingShade(lowColor, highColor, intensity(config, value))
}

export function UsCountyCostMap({
  counties: rows,
  states,
  legendExtra,
  state,
  onOpenCounty,
}: {
  counties: UsCountyRow[]
  /** State FIPS -> USPS abbreviation, for the tooltip heading */
  states: Record<string, string>
  /** Drawn beside the legend (UsMap's county/state toggle) */
  legendExtra?: ReactNode
  /** Draw only this state's counties */
  state?: CountyMapState
  /** Opens a county's page; with it, the counties in `counties` are clickable links */
  onOpenCounty?: (fips: string) => void
}) {
  const geometry = useCountyGeometry(state)
  const [costs, setCosts] = useState<CountyCosts | null>(null)
  const [metric, setMetric] = useState<CostMetric>("priceToIncome")
  const [hoveredFips, setHoveredFips] = useState<string | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [lowColor, setLowColor] = useState(COST_LOW_COLOR)
  const [highColor, setHighColor] = useState(COST_HIGH_COLOR)
  const [exporting, setExporting] = useState(false)
  const config = METRICS[metric]

  const labelByFips = useMemo(() => Object.fromEntries(rows), [rows])

  useEffect(() => {
    let cancelled = false
    fetch(COUNTY_COST_URL)
      .then((r) => r.json() as Promise<CountyCosts>)
      .then((data) => {
        if (!cancelled) setCosts(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const { width, height, counties: countyOutlines, ctRegions, regionLabels, stateBorders } = geometry
  const loading = geometry.loading

  // The 2024 ACS reports Connecticut by planning region, so draw those in place of its old counties
  const outlines = useMemo(
    () => (ctRegions.length ? withCtRegions(countyOutlines, ctRegions) : countyOutlines),
    [countyOutlines, ctRegions]
  )

  const shapes = useMemo(
    () =>
      outlines.map((o) => ({ ...o, fill: fillFor(costs?.[o.fips], config, lowColor, highColor) })),
    [outlines, costs, config, lowColor, highColor]
  )

  const pathByFips = useMemo(
    () => Object.fromEntries(outlines.map((o) => [o.fips, o.d])),
    [outlines]
  )

  // One listener for the whole map: read the county off the path under the cursor
  function handleMouseMove(e: MouseEvent<SVGSVGElement>) {
    const target = e.target as Element
    const fips = target.getAttribute("data-fips")
    if (!fips || !costs?.[fips]) {
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

  const hovered = hoveredFips ? costs?.[hoveredFips] : undefined
  const title = `${config.name} by county${state ? ` in ${state.state}` : ""}`
  const low = `${config.format(config.range[0])} or less`
  const high = `${config.format(config.range[1])} or more`

  async function handleDownload() {
    setExporting(true)
    try {
      await downloadMapPng({
        title,
        subtitle: config.subtitle,
        legend: [{ name: config.name, stops: divergingStops(lowColor, highColor), low, high }],
        noData: true,
        source: COUNTY_COST_SOURCE,
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
      <div className="inline-flex flex-wrap gap-1" role="group" aria-label="Cost-of-living measure">
        {METRIC_KEYS.map((key) => (
          <Button
            key={key}
            type="button"
            size="xs"
            variant={metric === key ? "default" : "secondary"}
            aria-pressed={metric === key}
            onClick={() => setMetric(key)}
          >
            {METRICS[key].label}
          </Button>
        ))}
      </div>

      {/* Title, map, legend, and source sit together so a screenshot of this block stands alone */}
      <figure className="space-y-3 bg-background">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-balance text-foreground sm:text-lg">
              {title}
            </h3>
            <p className="text-xs text-muted-foreground">{config.subtitle}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleDownload}
            disabled={loading || !costs || exporting}
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
              className="pointer-events-none absolute z-10 min-w-[13rem] rounded-none border border-border bg-popover px-3 py-2 text-sm shadow-md"
              style={{
                left: `min(${pointer.x}%, calc(100% - 14rem))`,
                top: `max(${pointer.y - 2}%, 0.5rem)`,
                transform: "translateY(-100%)",
              }}
            >
              <div className="font-medium text-foreground">
                {labelByFips[hoveredFips] ?? regionLabels[hoveredFips]}
                {state ? "" : `, ${states[hoveredFips.slice(0, 2)]}`}
              </div>
              <ul className="mt-1.5 space-y-0.5 tabular-nums">
                {METRIC_KEYS.map((key) => {
                  const value = METRICS[key].value(hovered)
                  return (
                    <li key={key} className="flex items-center justify-between gap-3">
                      <span
                        className={key === metric ? "text-foreground" : "text-muted-foreground"}
                      >
                        {METRICS[key].name}
                      </span>
                      <span className="font-medium text-foreground">
                        {value == null ? "—" : METRICS[key].format(value)}
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
            <div className="font-medium text-foreground">{config.name}</div>
            <div
              className="h-2.5 border border-border"
              style={{ background: divergingGradient(lowColor, highColor) }}
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
          {legendExtra}
          <span className="ml-auto text-muted-foreground">{COUNTY_COST_SOURCE}</span>
        </figcaption>
      </figure>

      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["Low color", lowColor, setLowColor],
            ["High color", highColor, setHighColor],
          ] as const
        ).map(([label, color, setColor]) => (
          <div
            key={label}
            className="space-y-3 rounded-lg border border-border bg-card/40 px-4 py-3 text-sm"
          >
            <div className="flex items-center gap-2">
              <i
                className="inline-block size-3 shrink-0 rounded-[3px] border border-border"
                style={{ background: color }}
                aria-hidden
              />
              <span className="font-medium text-foreground">{label}</span>
            </div>
            <ColorChooser color={color} onChange={setColor} label={label} />
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        American Community Survey 2020–2024 5-year medians, the only ACS figures published for
        every county. Home price to income divides median owner-occupied home value by median
        household income; rent to income is twelve months of median gross rent over the same
        income. Connecticut is shown by its nine planning regions. Valdez-Cordova, Alaska, split
        in 2019 and its medians can&apos;t be recombined, so it shows no data, as do a few
        counties where the Census suppresses a figure.
      </p>
    </div>
  )
}
