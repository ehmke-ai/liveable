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
  ANTI_IMMIG_COLOR,
  divergingGradient,
  divergingShade,
  divergingStops,
  downloadMapPng,
  PRO_IMMIG_COLOR,
} from "@/components/us-county-map-export"

/** [trump %, harris %, total votes], from scripts/build-county-election-2024.py */
type CountyResult = [number, number, number]
type CountyResults = Record<string, CountyResult>

const RESULTS_URL = "/data/county-election-2024.json"

/** Margins at or beyond this many points take the deepest shade */
const MARGIN_CAP = 60

const SUBTITLE =
  "Popular-vote margin between Donald Trump and Kamala Harris; deeper means a wider win."
const SOURCE = "Source: county results compiled from state and county election offices (tonmcg)"

/** Trump-minus-Harris margin in points: positive is a Trump win */
function marginOf([trump, harris]: CountyResult): number {
  return trump - harris
}

function fillFor(result: CountyResult | undefined, harrisColor: string, trumpColor: string) {
  if (!result) return "var(--border)"
  const t = Math.min(1, Math.max(0, (marginOf(result) / MARGIN_CAP + 1) / 2))
  return divergingShade(harrisColor, trumpColor, t)
}

export function UsCountyElectionMap({
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
  const [results, setResults] = useState<CountyResults | null>(null)
  const [hoveredFips, setHoveredFips] = useState<string | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [harrisColor, setHarrisColor] = useState(PRO_IMMIG_COLOR)
  const [trumpColor, setTrumpColor] = useState(ANTI_IMMIG_COLOR)
  const [exporting, setExporting] = useState(false)

  const labelByFips = useMemo(() => Object.fromEntries(rows), [rows])

  useEffect(() => {
    let cancelled = false
    fetch(RESULTS_URL)
      .then((r) => r.json() as Promise<CountyResults>)
      .then((countyResults) => {
        if (!cancelled) setResults(countyResults)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const { width, height, counties: countyOutlines, ctRegions, regionLabels, stateBorders } = geometry
  const loading = geometry.loading

  // Connecticut reports 2024 results by planning region, so draw those in place of its old counties
  const outlines = useMemo(
    () => (ctRegions.length ? withCtRegions(countyOutlines, ctRegions) : countyOutlines),
    [countyOutlines, ctRegions]
  )

  const shapes = useMemo(
    () =>
      outlines.map((o) => ({ ...o, fill: fillFor(results?.[o.fips], harrisColor, trumpColor) })),
    [outlines, results, harrisColor, trumpColor]
  )

  const pathByFips = useMemo(
    () => Object.fromEntries(outlines.map((o) => [o.fips, o.d])),
    [outlines]
  )

  // One listener for the whole map: read the county off the path under the cursor
  function handleMouseMove(e: MouseEvent<SVGSVGElement>) {
    const target = e.target as Element
    const fips = target.getAttribute("data-fips")
    if (!fips || !results?.[fips]) {
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

  const hovered = hoveredFips ? results?.[hoveredFips] : undefined
  const title = `2024 presidential election by county${state ? ` in ${state.state}` : ""}`
  const low = `Harris +${MARGIN_CAP}`
  const high = `Trump +${MARGIN_CAP}`

  async function handleDownload() {
    setExporting(true)
    try {
      await downloadMapPng({
        title,
        subtitle: SUBTITLE,
        legend: [
          { name: "2024 margin", stops: divergingStops(harrisColor, trumpColor), low, high },
        ],
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
      {/* Title, map, legend, and source sit together so a screenshot of this block stands alone */}
      <figure className="space-y-3 bg-background">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-balance text-foreground sm:text-lg">
              {title}
            </h3>
            <p className="text-xs text-muted-foreground">{SUBTITLE}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleDownload}
            disabled={loading || !results || exporting}
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
              className="pointer-events-none absolute z-10 min-w-[11rem] rounded-none border border-border bg-popover px-3 py-2 text-sm shadow-md"
              style={{
                left: `min(${pointer.x}%, calc(100% - 12rem))`,
                top: `max(${pointer.y - 2}%, 0.5rem)`,
                transform: "translateY(-100%)",
              }}
            >
              <div className="font-medium text-foreground">
                {hoveredFips.startsWith("02")
                  ? "Alaska (statewide)"
                  : `${labelByFips[hoveredFips] ?? regionLabels[hoveredFips]}${state ? "" : `, ${states[hoveredFips.slice(0, 2)]}`}`}
              </div>
              <ul className="mt-1.5 space-y-0.5 tabular-nums">
                {(
                  [
                    ["Trump", hovered[0], trumpColor],
                    ["Harris", hovered[1], harrisColor],
                  ] as const
                ).map(([name, value, color]) => (
                  <li key={name} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <i
                        className="inline-block size-2 rounded-full"
                        style={{ background: color }}
                        aria-hidden
                      />
                      {name}
                    </span>
                    <span className="font-medium text-foreground">{value.toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
              <div className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                {marginOf(hovered) >= 0 ? "Trump" : "Harris"} +
                {Math.abs(marginOf(hovered)).toFixed(1)} · {hovered[2].toLocaleString()} votes
              </div>
            </div>
          )}
        </div>

        <figcaption className="flex flex-wrap items-end gap-x-6 gap-y-3 text-xs">
          <div className="w-48 space-y-1">
            <div className="font-medium text-foreground">2024 margin</div>
            <div
              className="h-2.5 border border-border"
              style={{ background: divergingGradient(harrisColor, trumpColor) }}
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
          <span className="ml-auto text-muted-foreground">{SOURCE}</span>
        </figcaption>
      </figure>

      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["Harris color", harrisColor, setHarrisColor],
            ["Trump color", trumpColor, setTrumpColor],
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
        Share of all votes cast for president in each county in the 2024 general election;
        third-party votes make up the remainder. Margins of {MARGIN_CAP} points or more take the
        deepest shade. Connecticut is shown by its nine planning regions and DC&apos;s wards are
        combined. Alaska reports results by state house district rather than borough, so the
        whole state is shaded by its statewide result.
      </p>
    </div>
  )
}
