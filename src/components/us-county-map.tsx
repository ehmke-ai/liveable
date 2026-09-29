"use client"

import { geoPath, type GeoPermissibleObjects } from "d3-geo"
import { memo, useEffect, useMemo, useState, type MouseEvent } from "react"
import { HexColorInput, HexColorPicker } from "react-colorful"
import { feature, mesh } from "topojson-client"
import type { Feature, FeatureCollection, Geometry, MultiLineString } from "geojson"
import type { GeometryCollection, Topology } from "topojson-specification"

import { POPULATION_COLORS } from "@/components/population-stack-chart"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { YearSlider } from "@/components/year-slider"
import {
  COUNTY_HISTORY_URL,
  CT_FIPS,
  foldedBreakdown,
  GROUPS,
  groupShare,
  type CountyHistory,
  type CountyValues,
  type GroupKey,
} from "@/lib/county-history"

type CountyFeature = Feature<Geometry, { name: string }> & { id?: string | number }
type UsTopology = Topology<{ counties: GeometryCollection; states: GeometryCollection }>
type CtRegionsTopology = Topology<{ regions: GeometryCollection }>

/** [fips, display label] — the figures themselves come from county-history.json */
export type UsCountyRow = [string, string]

// Same viewBox as UsMap's state map (both use us-atlas's pre-projected albers coordinates)
// so the two views draw the country at the same size
const WIDTH = 960
const HEIGHT = 600

/** `id` is a stable React key, since sides can be removed from the middle */
type Side = { id: number; groups: GroupKey[]; color: string }

// Red, blue, the secondaries, brown, white, and black, as their HTML named-color hex codes. Lowercase to
// match what the custom picker emits, so a preset stays highlighted.
const SWATCHES = [
  "#ff0000", // red
  "#a52a2a", // brown
  "#0000ff", // blue
  "#ffa500", // orange
  "#008000", // green
  "#800080", // purple
  "#ffffff", // white
  "#000000", // black
]

const DEFAULT_SIDES: Side[] = [
  { id: 0, groups: ["european"], color: "#0000ff" },
  { id: 1, groups: ["hispanic", "african", "indian", "eastAsian", "arab", "other"], color: "#ff0000" },
]

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
function fillFor(
  leader: Leader | undefined,
  maxLead: number,
  sides: Side[]
) {
  if (!leader) return "var(--border)"
  const t = maxLead > 0 ? Math.min(1, leader.lead / maxLead) : 0
  return `color-mix(in oklch, ${sides[leader.index].color} ${Math.round(15 + t * 85)}%, var(--muted))`
}

function sideLabel(side: Side): string {
  return side.groups.map((g) => GROUPS.find((x) => x.key === g)?.label).join(" + ")
}

type CountyOutline = { fips: string; d: string }
type CountyShape = CountyOutline & { fill: string }

function outlinesOf(features: CountyFeature[], path: ReturnType<typeof geoPath>): CountyOutline[] {
  return features.flatMap((f) => {
    const d = path(f as GeoPermissibleObjects)
    return d ? [{ fips: String(f.id), d }] : []
  })
}

// Memoized so hovering (which re-renders the parent) never touches the 3,000+ county paths
const CountyPaths = memo(function CountyPaths({ shapes }: { shapes: CountyShape[] }) {
  return shapes.map(({ fips, d, fill }) => (
    <path
      key={fips}
      d={d}
      data-fips={fips}
      fill={fill}
      stroke="var(--background)"
      strokeWidth={0.25}
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    />
  ))
})

export function UsCountyMap({
  counties: rows,
  states,
  years,
}: {
  counties: UsCountyRow[]
  /** State FIPS -> USPS abbreviation, for the tooltip heading */
  states: Record<string, string>
  /** Slider years, oldest first; each must be a key of county-history.json */
  years: number[]
}) {
  const latestYear = years[years.length - 1]
  const [features, setFeatures] = useState<CountyFeature[]>([])
  const [ctRegions, setCtRegions] = useState<CountyFeature[]>([])
  const [stateBorders, setStateBorders] = useState<MultiLineString | null>(null)
  const [history, setHistory] = useState<CountyHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(latestYear)
  const [hoveredFips, setHoveredFips] = useState<string | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [sides, setSides] = useState<Side[]>(DEFAULT_SIDES)

  const labelByFips = useMemo(() => Object.fromEntries(rows), [rows])

  const yearValues = useMemo(() => history?.[year] ?? {}, [history, year])

  const maxLead = useMemo(() => {
    let max = 0
    for (const values of Object.values(history ?? {})) {
      for (const v of Object.values(values)) max = Math.max(max, leaderOf(v, sides)?.lead ?? 0)
    }
    return max
  }, [history, sides])

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
  // the side holding the most, and the first preset color no side is using yet.
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
      const color = SWATCHES.find((c) => !used.has(c)) ?? SWATCHES[0]
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
    Promise.all([
      fetch("/geo/us-counties-albers-10m.json").then((r) => r.json() as Promise<UsTopology>),
      fetch(COUNTY_HISTORY_URL)
        .then((r) => r.json() as Promise<CountyHistory>)
        .catch(() => null),
      fetch("/geo/ct-planning-regions-albers.json")
        .then((r) => r.json() as Promise<CtRegionsTopology>)
        .catch(() => null),
    ])
      .then(([topology, countyHistory, ctTopology]) => {
        if (cancelled) return
        const collection = feature(
          topology,
          topology.objects.counties
        ) as FeatureCollection<Geometry, { name: string }>
        setFeatures(collection.features as CountyFeature[])
        setStateBorders(mesh(topology, topology.objects.states, (a, b) => a !== b))
        setHistory(countyHistory)
        if (ctTopology) {
          const regions = feature(
            ctTopology,
            ctTopology.objects.regions
          ) as FeatureCollection<Geometry, { name: string }>
          setCtRegions(regions.features as CountyFeature[])
        }
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

  const path = useMemo(() => geoPath(), [])

  // Path strings are computed once; changing the year only recomputes fills
  const countyOutlines = useMemo(() => outlinesOf(features, path), [features, path])
  const ctRegionOutlines = useMemo(() => outlinesOf(ctRegions, path), [ctRegions, path])

  // Connecticut replaced its counties with planning regions in 2022. For years whose data is
  // keyed by region (2025), draw the regions in place of CT's old counties.
  const useCtRegions = ctRegionOutlines.some((o) => yearValues[o.fips])
  const outlines = useMemo(
    () =>
      useCtRegions
        ? [...countyOutlines.filter((o) => !o.fips.startsWith(CT_FIPS)), ...ctRegionOutlines]
        : countyOutlines,
    [useCtRegions, countyOutlines, ctRegionOutlines]
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

  // Planning regions aren't in the server-rendered county list; their names come with the shapes
  const regionLabels = useMemo(
    () => Object.fromEntries(ctRegions.map((f) => [String(f.id), f.properties.name])),
    [ctRegions]
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

  return (
    <div className="space-y-5">
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
          aria-label={`Map of United States counties comparing ${sides.map(sideLabel).join(" vs. ")} in ${year}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => {
            setHoveredFips(null)
            setPointer(null)
          }}
        >
          <CountyPaths shapes={shapes} />
          {stateBorders && (
            <path
              d={path(stateBorders) ?? undefined}
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
              {labelByFips[hoveredFips] ?? regionLabels[hoveredFips]}, {states[hoveredFips.slice(0, 2)]}
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

      <YearSlider years={years} year={year} onChange={setYear} disabled={!history} />

      <div className="grid gap-3 sm:grid-cols-2">
        {sides.map((side, sideIndex) => {
          const isCustom = !SWATCHES.includes(side.color)
          return (
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

              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`Side ${sideIndex + 1} color`}>
                {SWATCHES.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Use ${color}`}
                    aria-pressed={side.color === color}
                    onClick={() => setSideColor(sideIndex, color)}
                    className={`size-5 rounded-full border border-border ${side.color === color ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : ""}`}
                    style={{ background: color }}
                  />
                ))}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      title="Custom color"
                      aria-label="Custom color"
                      className={`size-5 rounded-full border border-border ${isCustom ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : ""}`}
                      style={{
                        background: isCustom
                          ? side.color
                          : "conic-gradient(#e23d3d, #c9a227, #2db88a, #0e9fb3, #3d7ee2, #8b5cf6, #e87ba4, #e23d3d)",
                      }}
                    />
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto">
                    <HexColorPicker
                      color={side.color}
                      onChange={(color) => setSideColor(sideIndex, color)}
                    />
                    <HexColorInput
                      color={side.color}
                      onChange={(color) => setSideColor(sideIndex, color)}
                      prefixed
                      aria-label="Hex color code"
                      className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 font-mono text-sm uppercase outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )
        })}

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

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <i
            className="inline-block size-3 rounded-[3px] border border-border"
            style={{ background: "var(--border)" }}
            aria-hidden
          />
          No data for that year
        </span>
        <span>Each county takes the color of its largest side; paler means a closer race.</span>
      </div>
    </div>
  )
}
