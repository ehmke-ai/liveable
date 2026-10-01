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
import { YearSlider } from "@/components/year-slider"

/** % of population in each tradition, in CATEGORIES order (less Unclaimed), from scripts/build-county-religion.py */
type CountyShares = number[]
/** Census year -> FIPS -> shares */
type CountyReligion = Record<string, Record<string, CountyShares>>

const DATA_URL = "/data/county-religion.json"

/** The leading tradition's share of population at the palest and deepest shades */
const SHARE_FLOOR = 10
const SHARE_CAP = 60

/** In the order of the data file's arrays, then Unclaimed, which is whatever share they leave */
const CATEGORIES = [
  { key: "evangelical", label: "Evangelical Protestant", color: "#1565c0" },
  { key: "mainline", label: "Mainline Protestant", color: "#29b6f6" },
  { key: "blackProtestant", label: "Black Protestant", color: "#1a237e" },
  { key: "catholic", label: "Catholic", color: "#c62828" },
  { key: "orthodox", label: "Orthodox", color: "#8d6e63" },
  { key: "lds", label: "Latter-day Saints", color: "#ef6c00" },
  { key: "jewish", label: "Jewish", color: "#7b1fa2" },
  { key: "muslim", label: "Muslim", color: "#00897b" },
  { key: "other", label: "Other religions", color: "#9e9d24" },
  { key: "unclaimed", label: "Unclaimed", color: "#424242" },
] as const

const UNCLAIMED = CATEGORIES.length - 1

/** Source line under the map, so a screenshot carries its citation */
const YEAR_SOURCES: Record<string, string> = {
  1990: "Churches and Church Membership in the United States 1990 (Glenmary Research Center)",
  2000: "Religious Congregations and Membership Study 2000 (ASARB)",
  2010: "2010 U.S. Religion Census (ASARB)",
  2020: "2020 U.S. Religion Census (ASARB)",
}

/** Each tradition's share, then the unclaimed rest (none when adherents exceed residents) */
function withUnclaimed(shares: CountyShares): number[] {
  const total = shares.reduce((t, v) => t + v, 0)
  return [...shares, Math.max(0, 100 - total)]
}

/** The largest category, counting Unclaimed only while it is shown */
function leaderOf(shares: CountyShares, showUnclaimed: boolean): { index: number; value: number } {
  const values = withUnclaimed(shares)
  const last = showUnclaimed ? UNCLAIMED : UNCLAIMED - 1
  let index = 0
  for (let i = 1; i <= last; i++) if (values[i] > values[index]) index = i
  return { index, value: values[index] }
}

function fillFor(shares: CountyShares | undefined, colors: string[], showUnclaimed: boolean) {
  if (!shares) return "var(--border)"
  const { index, value } = leaderOf(shares, showUnclaimed)
  const t = Math.min(1, Math.max(0, (value - SHARE_FLOOR) / (SHARE_CAP - SHARE_FLOOR)))
  return shade(colors[index], Math.round(SHADE_RANGE[0] + t * (SHADE_RANGE[1] - SHADE_RANGE[0])))
}

export function UsCountyReligionMap({
  counties: rows,
  states,
  state,
  onOpenCounty,
}: {
  counties: UsCountyRow[]
  /** State FIPS -> USPS abbreviation, for the tooltip heading */
  states: Record<string, string>
  /** Draw only this state's counties, with the legend limited to traditions leading there */
  state?: CountyMapState
  /** Opens a county's page; with it, the counties in `counties` are clickable links */
  onOpenCounty?: (fips: string) => void
}) {
  const geometry = useCountyGeometry(state)
  const [religion, setReligion] = useState<CountyReligion | null>(null)
  const [hoveredFips, setHoveredFips] = useState<string | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [colors, setColors] = useState<string[]>(() => CATEGORIES.map((c) => c.color))
  const [showUnclaimed, setShowUnclaimed] = useState(false)
  const [year, setYear] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)

  const labelByFips = useMemo(() => Object.fromEntries(rows), [rows])

  const years = useMemo(() => Object.keys(religion ?? {}).map(Number).sort((a, b) => a - b), [religion])
  // Start on the latest year once the data arrives
  const shownYear = year ?? years[years.length - 1] ?? 2020
  const yearShares = useMemo(() => religion?.[shownYear] ?? {}, [religion, shownYear])

  useEffect(() => {
    let cancelled = false
    fetch(DATA_URL)
      .then((r) => r.json() as Promise<CountyReligion>)
      .then((countyReligion) => {
        if (!cancelled) setReligion(countyReligion)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Every study reports Connecticut by its old counties, which the county outlines draw
  const { width, height, counties: outlines, stateBorders, loading } = geometry

  const shapes = useMemo(
    () =>
      outlines.map((o) => ({ ...o, fill: fillFor(yearShares[o.fips], colors, showUnclaimed) })),
    [outlines, yearShares, colors, showUnclaimed]
  )

  const pathByFips = useMemo(
    () => Object.fromEntries(outlines.map((o) => [o.fips, o.d])),
    [outlines]
  )

  // Only categories that lead somewhere on the map this year get a legend entry
  const leading = useMemo(() => {
    const seen = new Set<number>()
    for (const { fips } of outlines) {
      const shares = yearShares[fips]
      if (shares) seen.add(leaderOf(shares, showUnclaimed).index)
    }
    return CATEGORIES.flatMap((_, i) => (seen.has(i) ? [i] : []))
  }, [outlines, yearShares, showUnclaimed])

  // One listener for the whole map: read the county off the path under the cursor
  function handleMouseMove(e: MouseEvent<SVGSVGElement>) {
    const target = e.target as Element
    const fips = target.getAttribute("data-fips")
    if (!fips || !yearShares[fips]) {
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

  const hovered = hoveredFips ? yearShares[hoveredFips] : undefined
  const hoveredRows = hovered
    ? withUnclaimed(hovered)
        .map((value, i) => ({ ...CATEGORIES[i], color: colors[i], value }))
        .filter((c) => c.value > 0 && (showUnclaimed || c.key !== "unclaimed"))
        .sort((a, b) => b.value - a.value)
    : []
  const overCounted = hovered ? hovered.reduce((t, v) => t + v, 0) > 100 : false
  const low = `${SHARE_FLOOR}%`
  const high = `${SHARE_CAP}%+`

  const place = state ? ` in ${state.state}` : ""
  const title = `Largest religious ${showUnclaimed ? "group" : "tradition"} by county${place}, ${shownYear}`
  const subtitle = showUnclaimed
    ? "Each county is colored by its largest tradition, or Unclaimed where more residents belong to no congregation; deeper means a larger share of residents."
    : "Each county is colored by the tradition with the most adherents; deeper means a larger share of residents."
  const source = `Source: ${YEAR_SOURCES[shownYear] ?? "U.S. Religion Census (ASARB)"}`

  async function handleDownload() {
    setExporting(true)
    try {
      await downloadMapPng({
        title,
        subtitle,
        legend: leading.map((i) => ({
          name: `Most ${CATEGORIES[i].label}`,
          stops: shadeStops(colors[i]),
          low,
          high,
        })),
        source,
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
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleDownload}
            disabled={loading || !religion || exporting}
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
                {labelByFips[hoveredFips]}
                {!state && `, ${states[hoveredFips.slice(0, 2)]}`}
              </div>
              <ul className="mt-1.5 space-y-0.5 tabular-nums">
                {hoveredRows.map(({ key, label, color, value }) => (
                  <li key={key} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <i
                        className="inline-block size-2 rounded-full"
                        style={{ background: color }}
                        aria-hidden
                      />
                      {label}
                    </span>
                    <span className="font-medium text-foreground">{value.toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
              {overCounted && (
                <div className="mt-1.5 max-w-[14rem] text-xs text-muted-foreground">
                  Adherents exceed residents (congregations draw from outside the county)
                </div>
              )}
            </div>
          )}
        </div>

        <figcaption className="flex flex-wrap items-end gap-x-6 gap-y-3 text-xs">
          {leading.map((i) => (
            <div key={CATEGORIES[i].key} className="w-40 space-y-1">
              <div className="font-medium text-foreground">Most {CATEGORIES[i].label}</div>
              <div
                className="h-2.5 border border-border"
                style={{ background: shadeGradient(colors[i]) }}
              />
              <div className="flex justify-between tabular-nums text-muted-foreground">
                <span>{low}</span>
                <span>{high}</span>
              </div>
            </div>
          ))}
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <i
              className="inline-block size-3 rounded-[3px] border border-border"
              style={{ background: "var(--border)" }}
              aria-hidden
            />
            No data
          </span>
          <span className="ml-auto text-muted-foreground">{source}</span>
        </figcaption>
      </figure>

      <YearSlider
        years={years.length ? years : [shownYear]}
        year={shownYear}
        onChange={setYear}
        disabled={!religion}
      />

      <div className="rounded-lg border border-border bg-card/40 px-4 py-3 text-sm">
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-3">
          {CATEGORIES.map(({ key, label }, i) => {
            const hidden = key === "unclaimed" && !showUnclaimed
            return (
              <div key={key} className="flex items-center gap-2">
                <ColorChooser
                  color={colors[i]}
                  onChange={(next) =>
                    setColors((prev) => prev.map((c, j) => (j === i ? next : c)))
                  }
                  label={`${label} color`}
                />
                <span className={hidden ? "text-muted-foreground line-through" : "text-foreground"}>
                  {label}
                </span>
                {key === "unclaimed" && (
                  <button
                    type="button"
                    onClick={() => setShowUnclaimed((prev) => !prev)}
                    aria-pressed={showUnclaimed}
                    className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    {showUnclaimed ? "Remove" : "Add back"}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Adherents of each tradition as a share of the county&apos;s population, from the
        decennial church membership studies (1990: Glenmary Research Center; 2000–2020: ASARB,
        the U.S. Religion Census), each covering a few hundred religious bodies. Denominations are
        grouped into traditions following the ASARB and Pew families; non-denominational churches count as
        Evangelical Protestant, and Jehovah&apos;s Witnesses, Unitarian Universalists, Hindus,
        Buddhists, Baha&apos;is, and other faiths as Other religions. Unclaimed residents are those
        not counted as adherents of any participating group — not the same as atheist or
        agnostic, as it includes believers who belong to no congregation and members of groups
        that didn&apos;t take part. Each county is colored by its largest tradition; add Unclaimed back to color it Unclaimed where more residents belong to no congregation. Adherents are counted where their
        congregation meets, so a county whose churches draw from its neighbors can exceed 100%.
        Coverage changes between studies, so compare years with care: historically Black
        denominations are absent from 2000 and incomplete in other years (1990 has a single Black
        Baptists estimate), so Black Protestant figures are undercounts; Muslims are first
        estimated in 2000. Leading shares of {SHARE_CAP}% or more take the deepest shade. The 1990
        study folds Virginia&apos;s independent cities into their counties, Alaska boroughs created
        after a study show no data for it, and Loving County, TX and Alpine County, CA
        reported no congregations in some years.
      </p>
    </div>
  )
}
