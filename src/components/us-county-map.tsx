"use client"

import { useEffect, useMemo, useState, type MouseEvent } from "react"
import { Download } from "lucide-react"

import { ColorChooser } from "@/components/color-chooser"
import {
  countyLinkHandlers,
  CountyPaths,
  useCountyGeometry,
  withCtRegions,
  type CountyMapState,
} from "@/components/county-map-geometry"
import { POPULATION_COLORS } from "@/components/population-stack-chart"
import { Button } from "@/components/ui/button"
import {
  downloadMapPng,
  shade,
  shadeGradient,
  shadeStops,
} from "@/components/us-county-map-export"
import { YearSlider } from "@/components/year-slider"
import {
  COUNTY_HISTORY_URL,
  foldedBreakdown,
  GROUPS,
  groupShare,
  type CountyHistory,
  type CountyValues,
  type GroupKey,
} from "@/lib/county-history"

/** [fips, display label] — the figures themselves come from county-history.json */
export type UsCountyRow = [string, string]

/** `id` is a stable React key, since sides can be removed from the middle */
type Side = { id: number; groups: GroupKey[]; color: string }

const DEFAULT_SIDES: Side[] = [
  { id: 0, groups: ["european"], color: "#F1C7A8" },
  { id: 1, groups: ["hispanic", "african", "indian", "eastAsian", "arab", "nativeAmerican", "other"], color: "#593001" },
]

// Starting colors for newly added sides; each can then be changed with the custom picker
export const NEW_SIDE_COLORS =["#ff0000", "#a52a2a", "#0000ff", "#ffa500", "#008000", "#800080", "#000000"]

// Groups are exclusive and every side needs one, so there can be at most one side per group
const MAX_SIDES = GROUPS.length

type Leader = { index: number; lead: number }

/**
 * The side with the largest combined share in a county, and its lead over the runner-up.
 * With two sides this is just "whichever is larger, and by how much".
 *
 * 1990 has no Indian, East Asian, or Arab figures; those residents are counted inside Other
 * and European that year. A group without a figure adds nothing to its side, and the county
 * is no data only when some side has nothing but such groups (e.g. Indian vs. European).
 */
function leaderOf(values: CountyValues, sides: Side[]): Leader | undefined {
  const shares = sides.map((side) => side.groups.map((g) => groupShare(values, g)))
  if (shares.some((side) => side.every((v) => v == null))) return undefined
  const sums = shares.map((side) => side.reduce<number>((t, v) => t + (v ?? 0), 0))
  let index = 0
  for (let i = 1; i < sums.length; i++) if (sums[i] > sums[index]) index = i
  const runnerUp = Math.max(...sums.filter((_, i) => i !== index))
  return { index, lead: sums[index] - runnerUp }
}

// Each county takes the color of its leading side, deeper the wider its lead. Scaled to the
// widest lead in any county in any year, so a shade means the same margin across the slider.
// Two sides share one scale, like immigration sentiment, but blend straight from the first
// side's color into the second's with no neutral middle.
function fillFor(
  leader: Leader | undefined,
  maxLead: number,
  sides: Side[]
) {
  if (!leader) return "var(--border)"
  const t = maxLead > 0 ? Math.min(1, leader.lead / maxLead) : 0
  if (sides.length === 2) {
    const signed = leader.index === 0 ? -t : t
    return blend(sides[0].color, sides[1].color, 0.5 + signed / 2)
  }
  return shade(sides[leader.index].color, Math.round(15 + t * 85))
}

/** `t` of the way from `from` (0) to `to` (1) */
export function blend(from: string, to: string, t: number) {
  return `color-mix(in oklch, ${from}, ${to} ${Math.round(t * 100)}%)`
}

export function blendStops(from: string, to: string) {
  return [0, 0.25, 0.5, 0.75, 1].map((t) => blend(from, to, t))
}

function sideLabel(side: Side): string {
  return side.groups.map((g) => GROUPS.find((x) => x.key === g)?.label).join(" + ")
}

// Short name for the title: a side holding every group but one reads as "Non-" that group
function sideTitle(side: Side, sides: Side[]): string {
  const rest = GROUPS.filter((g) => !side.groups.includes(g.key))
  const allAssigned = sides.flatMap((s) => s.groups).length === GROUPS.length
  if (side.groups.length > 2 && rest.length === 1 && allAssigned) return `Non-${rest[0].label}`
  return sideLabel(side)
}

/** Source line under the map, so a screenshot carries its citation */
const YEAR_SOURCES: Record<number, string> = {
  1990: "1990 county population estimates",
  2000: "2000 Census",
  2010: "2010 Census",
  2020: "ACS 2016–2020",
  2025: "Vintage 2025 estimates, ACS 2020–2024",
}

export function UsCountyMap({
  counties: rows,
  states,
  years,
  state,
  onOpenCounty,
}: {
  counties: UsCountyRow[]
  /** State FIPS -> USPS abbreviation, for the tooltip heading */
  states: Record<string, string>
  /** Slider years, oldest first; each must be a key of county-history.json */
  years: number[]
  /** Draw only this state's counties, with the shading scaled to them */
  state?: CountyMapState
  /** Opens a county's page; with it, the counties in `counties` are clickable links */
  onOpenCounty?: (fips: string) => void
}) {
  const latestYear = years[years.length - 1]
  const geometry = useCountyGeometry(state)
  const [history, setHistory] = useState<CountyHistory | null>(null)
  const [year, setYear] = useState(latestYear)
  const [hoveredFips, setHoveredFips] = useState<string | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [sides, setSides] = useState<Side[]>(DEFAULT_SIDES)
  const [exporting, setExporting] = useState(false)

  const labelByFips = useMemo(() => Object.fromEntries(rows), [rows])
  const stateFips = state ? rows[0]?.[0].slice(0, 2) : undefined

  const yearValues = useMemo(() => history?.[year] ?? {}, [history, year])

  // On a state map, only that state's counties set the scale
  const maxLead = useMemo(() => {
    let max = 0
    for (const values of Object.values(history ?? {})) {
      for (const [fips, v] of Object.entries(values)) {
        if (stateFips && !fips.startsWith(stateFips)) continue
        max = Math.max(max, leaderOf(v, sides)?.lead ?? 0)
      }
    }
    return max
  }, [history, sides, stateFips])

  // Clicking a group puts it on that side (taking it off whichever side had it), or takes it
  // off if it's already there. No side may be left empty.
  function toggleGroup(sideIndex: number, key: GroupKey) {
    setSides((prev) => {
      const own = prev[sideIndex]
      const holder = prev.find((side) => side.groups.includes(key))
      if (holder === own) {
        if (own.groups.length === 1) return prev
        return prev.map((side) =>
          side === own ? { ...side, groups: side.groups.filter((g) => g !== key) } : side
        )
      }
      if (holder && holder.groups.length === 1) return prev
      return prev.map((side) => {
        if (side === own) {
          const groups = GROUPS.map((g) => g.key).filter((g) => g === key || own.groups.includes(g))
          return { ...side, groups }
        }
        if (side === holder) return { ...side, groups: side.groups.filter((g) => g !== key) }
        return side
      })
    })
  }

  function setSideColor(sideIndex: number, color: string) {
    setSides((prev) => prev.map((side, i) => (i === sideIndex ? { ...side, color } : side)))
  }

  // A new side starts with an unassigned group if there is one, otherwise the last group of
  // the side holding the most, and the first starting color no side is using yet.
  function addSide() {
    setSides((prev) => {
      if (prev.length >= MAX_SIDES) return prev
      const assigned = new Set(prev.flatMap((side) => side.groups))
      let key = GROUPS.map((g) => g.key).find((g) => !assigned.has(g))
      let next = prev
      if (!key) {
        const donor = prev.reduce((a, b) => (b.groups.length > a.groups.length ? b : a))
        if (donor.groups.length < 2) return prev
        key = donor.groups[donor.groups.length - 1]
        next = prev.map((side) =>
          side === donor ? { ...side, groups: side.groups.slice(0, -1) } : side
        )
      }
      const used = new Set(prev.map((side) => side.color))
      const color = NEW_SIDE_COLORS.find((c) => !used.has(c)) ?? NEW_SIDE_COLORS[0]
      const id = Math.max(...prev.map((side) => side.id)) + 1
      return [...next, { id, groups: [key], color }]
    })
  }

  // A removed side's groups become unassigned rather than moving to another side
  function removeSide(sideIndex: number) {
    setSides((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== sideIndex) : prev))
  }

  useEffect(() => {
    let cancelled = false
    fetch(COUNTY_HISTORY_URL)
      .then((r) => r.json() as Promise<CountyHistory>)
      .then((countyHistory) => {
        if (!cancelled) setHistory(countyHistory)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const { width, height, counties: countyOutlines, ctRegions, regionLabels, stateBorders } = geometry
  const loading = geometry.loading

  // Connecticut replaced its counties with planning regions in 2022. For years whose data is
  // keyed by region (2025), draw the regions in place of CT's old counties.
  const useCtRegions = ctRegions.some((o) => yearValues[o.fips])
  const outlines = useMemo(
    () => (useCtRegions ? withCtRegions(countyOutlines, ctRegions) : countyOutlines),
    [useCtRegions, countyOutlines, ctRegions]
  )

  const shapes = useMemo(
    () =>
      outlines.map((o) => {
        const values = yearValues[o.fips]
        return { ...o, fill: fillFor(values && leaderOf(values, sides), maxLead, sides) }
      }),
    [outlines, yearValues, sides, maxLead]
  )

  const pathByFips = useMemo(
    () => Object.fromEntries(outlines.map((o) => [o.fips, o.d])),
    [outlines]
  )

  // One listener for the whole map: read the county off the path under the cursor
  function handleMouseMove(e: MouseEvent<SVGSVGElement>) {
    const target = e.target as Element
    const fips = target.getAttribute("data-fips")
    if (!fips || !yearValues[fips]) {
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

  const hoveredValues = hoveredFips ? yearValues[hoveredFips] : undefined
  // Mirrors addSide: there must be a group free, or a side with one to spare
  const canAddSide =
    sides.length < MAX_SIDES &&
    (sides.flatMap((side) => side.groups).length < GROUPS.length ||
      sides.some((side) => side.groups.length > 1))

  const place = state ? ` in ${state.state}` : ""
  const title = `${sides.map((side) => sideTitle(side, sides)).join(" vs. ")} by county${place}, ${year}`
  const leadLabel = `+${Math.round(maxLead)} pts`
  // Two sides blend into each other on one bar; more each get their own
  const diverging = sides.length === 2
  const subtitle = `Each county is colored by its ${sides.length > 2 ? "largest" : "larger"} side, as a share of population; deeper means a wider lead.`
  const source = `Source: U.S. Census Bureau${YEAR_SOURCES[year] ? ` (${YEAR_SOURCES[year]})` : ""}`

  async function handleDownload() {
    setExporting(true)
    try {
      await downloadMapPng({
        title,
        subtitle,
        legend: diverging
          ? [
              {
                name: "Lead",
                stops: blendStops(sides[0].color, sides[1].color),
                low: `${sideTitle(sides[0], sides)} ${leadLabel}`,
                high: `${sideTitle(sides[1], sides)} ${leadLabel}`,
              },
            ]
          : sides.map((side) => {
              const name = sideTitle(side, sides)
              return {
                name: `Most ${name}`,
                groups: name !== sideLabel(side) ? sideLabel(side) : undefined,
                stops: shadeStops(side.color),
                low: "Close",
                high: leadLabel,
              }
            }),
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
            disabled={loading || !history || exporting}
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

          {hoveredFips && hoveredValues && pointer && (
            <div
              className="pointer-events-none absolute z-10 min-w-[11rem] rounded-none border border-border bg-popover px-3 py-2 text-sm shadow-md"
              style={{
                left: `min(${pointer.x}%, calc(100% - 12rem))`,
                top: `max(${pointer.y - 2}%, 0.5rem)`,
                transform: "translateY(-100%)",
              }}
            >
              <div className="font-medium text-foreground">
                {labelByFips[hoveredFips] ?? regionLabels[hoveredFips]}
                {!state && `, ${states[hoveredFips.slice(0, 2)]}`}
              </div>
              <ul className="mt-1.5 space-y-0.5 tabular-nums">
                {foldedBreakdown(hoveredValues).map(
                  ({ key, label, value }) => (
                    <li key={key} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <i
                          className="inline-block size-2 rounded-full"
                          style={{
                            background: POPULATION_COLORS[key]?.light ?? "var(--muted-foreground)",
                          }}
                          aria-hidden
                        />
                        {label}
                      </span>
                      <span className="font-medium text-foreground">{value}%</span>
                    </li>
                  )
                )}
              </ul>
            </div>
          )}
        </div>

        <figcaption className="flex flex-wrap items-end gap-x-6 gap-y-3 text-xs">
          {diverging ? (
            <div className="w-64 space-y-1">
              <div className="font-medium text-foreground">Lead</div>
              <div
                className="h-2.5 border border-border"
                style={{ background: `linear-gradient(in oklch to right, ${sides[0].color}, ${sides[1].color})` }}
              />
              <div className="flex justify-between gap-2 tabular-nums text-muted-foreground">
                <span>{sideTitle(sides[0], sides)} {leadLabel}</span>
                <span className="text-right">{sideTitle(sides[1], sides)} {leadLabel}</span>
              </div>
            </div>
          ) : (
            sides.map((side) => {
              const name = sideTitle(side, sides)
              return (
                <div key={side.id} className="w-40 space-y-1">
                  <div className="font-medium text-foreground">Most {name}</div>
                  {name !== sideLabel(side) && (
                    <div className="text-muted-foreground">{sideLabel(side)}</div>
                  )}
                  <div
                    className="h-2.5 border border-border"
                    style={{
                      background: shadeGradient(side.color),
                    }}
                  />
                  <div className="flex justify-between tabular-nums text-muted-foreground">
                    <span>Close</span>
                    <span>{leadLabel}</span>
                  </div>
                </div>
              )
            })
          )}
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <i
              className="inline-block size-3 rounded-[3px] border border-border"
              style={{ background: "var(--border)" }}
              aria-hidden
            />
            No data
          </span>
          <span className="ml-auto text-muted-foreground">
            {source}
          </span>
        </figcaption>
      </figure>

      <YearSlider years={years} year={year} onChange={setYear} disabled={!history} />

      <div className="grid gap-3 sm:grid-cols-2">
        {sides.map((side, sideIndex) => (
          <div
            key={side.id}
            className="space-y-3 rounded-lg border border-border bg-card/40 px-4 py-3 text-sm"
          >
            <div className="flex items-center gap-2">
              <i
                className="inline-block size-3 shrink-0 rounded-[3px] border border-border"
                style={{ background: side.color }}
                aria-hidden
              />
              <span className="font-medium text-foreground">
                {sides.length > 2 ? "Most" : "More"} {sideLabel(side)}
              </span>
              {sides.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeSide(sideIndex)}
                  aria-label={`Remove side ${sideIndex + 1}`}
                  className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Side ${sideIndex + 1} groups`}>
              {GROUPS.map(({ key, label }) => {
                const active = side.groups.includes(key)
                const holder = sides.find((s) => s.groups.includes(key))
                // Can't take a side's only group, whether this side's or another's
                const locked = holder ? holder.groups.length === 1 : false
                return (
                  <Button
                    key={key}
                    type="button"
                    size="xs"
                    variant={active ? "default" : "secondary"}
                    aria-pressed={active}
                    disabled={locked}
                    title={locked ? "Each side needs at least one group" : undefined}
                    onClick={() => toggleGroup(sideIndex, key)}
                  >
                    {label}
                  </Button>
                )
              })}
            </div>

            <ColorChooser
              color={side.color}
              onChange={(color) => setSideColor(sideIndex, color)}
              label={`Side ${sideIndex + 1} color`}
            />
          </div>
        ))}

        {canAddSide && (
          <button
            type="button"
            onClick={addSide}
            className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
          >
            + Add side
          </button>
        )}
      </div>
    </div>
  )
}
