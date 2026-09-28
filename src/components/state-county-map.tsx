"use client"

import { geoAlbers, geoPath, type GeoPermissibleObjects } from "d3-geo"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from "react"
import { feature } from "topojson-client"
import type { Feature, FeatureCollection, Geometry } from "geojson"
import type { GeometryCollection, Topology } from "topojson-specification"

import { POPULATION_COLORS } from "@/components/population-stack-chart"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  countyGeoUrl,
  countySlug,
  foldedCountyBreakdown,
  rangeIntensity,
  type CountyDemographics,
  type StateDemographics,
} from "@/lib/states"

type CountyFeature = Feature<Geometry, { name: string }> & { id?: string | number }

const WIDTH = 720
const HEIGHT = 720
const PAD = 16

function fillFor(
  data: CountyDemographics | undefined,
  min: number,
  max: number,
  hovered: boolean
) {
  if (!data) {
    return hovered
      ? "color-mix(in oklch, var(--foreground) 10%, var(--border))"
      : "var(--border)"
  }

  const t = rangeIntensity(data.nonHispanicWhitePct, min, max)
  const pct = Math.round(15 + t * 85)
  if (hovered) {
    return `color-mix(in oklch, var(--foreground) ${Math.min(100, pct + 8)}%, var(--muted))`
  }
  return `color-mix(in oklch, var(--foreground) ${pct}%, var(--muted))`
}

function strokeFor(hovered: boolean): string {
  if (hovered) return "color-mix(in oklch, var(--foreground) 55%, var(--background))"
  return "var(--background)"
}

function groupByLetter(counties: CountyDemographics[]) {
  const groups = new Map<string, CountyDemographics[]>()
  for (const county of counties) {
    const letter = county.name[0]?.toUpperCase() ?? "#"
    const group = groups.get(letter)
    if (group) group.push(county)
    else groups.set(letter, [county])
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
}

export function StateCountyMap({ state }: { state: StateDemographics }) {
  const router = useRouter()
  const data = useMemo(() => state.countyDemographics ?? [], [state.countyDemographics])

  const [features, setFeatures] = useState<CountyFeature[]>([])
  const [hoveredFips, setHoveredFips] = useState<string | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [loading, setLoading] = useState(true)

  const byFips = useMemo(
    () => Object.fromEntries(data.map((c) => [c.fips, c])),
    [data]
  )
  const sortedCounties = useMemo(
    () => [...data].sort((a, b) => a.name.localeCompare(b.name)),
    [data]
  )
  const countyOptions = useMemo(
    () => sortedCounties.map((c) => ({ value: c.fips, label: `${c.name} County` })),
    [sortedCounties]
  )
  const countyGroups = useMemo(() => groupByLetter(sortedCounties), [sortedCounties])
  const min = useMemo(() => Math.min(...data.map((c) => c.nonHispanicWhitePct)), [data])
  const max = useMemo(() => Math.max(...data.map((c) => c.nonHispanicWhitePct)), [data])

  function goToCounty(county: CountyDemographics) {
    router.push(`/united-states/${state.slug}/${countySlug(county.name)}`)
  }

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
    setLoading(true)
    fetch(countyGeoUrl(state))
      .then((r) => r.json())
      .then((topology: Topology<{ counties: GeometryCollection }>) => {
        if (cancelled) return
        const counties = feature(
          topology,
          topology.objects.counties
        ) as FeatureCollection<Geometry, { name: string }>
        setFeatures(counties.features as CountyFeature[])
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
  }, [state])

  const collection = useMemo(
    () => ({ type: "FeatureCollection" as const, features }),
    [features]
  )

  const projection = useMemo(() => {
    const proj = geoAlbers()
    if (!features.length) return proj.scale(2500).translate([WIDTH / 2, HEIGHT / 2])
    return proj.fitExtent(
      [
        [PAD, PAD],
        [WIDTH - PAD, HEIGHT - PAD],
      ],
      collection
    )
  }, [collection, features.length])

  const path = useMemo(() => geoPath(projection), [projection])

  const orderedFeatures = useMemo(() => {
    if (!hoveredFips) return features
    return [...features].sort((a, b) => {
      const aBoost = String(a.id) === hoveredFips ? 1 : 0
      const bBoost = String(b.id) === hoveredFips ? 1 : 0
      return aBoost - bBoost
    })
  }, [features, hoveredFips])

  const hovered = hoveredFips ? byFips[hoveredFips] : undefined

  return (
    <div className="space-y-3">
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
          aria-label={`Interactive map of ${state.state} counties showing non-Hispanic White population share`}
        >
          {orderedFeatures.map((f) => {
            const fips = String(f.id)
            const county = byFips[fips]
            const isHovered = hoveredFips === fips
            const d = path(f as GeoPermissibleObjects)
            if (!d) return null

            function handleKeyDown(e: KeyboardEvent<SVGPathElement>) {
              if (!county) return
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                goToCounty(county)
              }
            }

            return (
              <path
                key={fips || f.properties.name}
                d={d}
                fill={fillFor(county, min, max, isHovered)}
                stroke={strokeFor(isHovered)}
                strokeWidth={isHovered ? 1.25 : 0.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                tabIndex={county ? 0 : undefined}
                role={county ? "link" : undefined}
                aria-label={county ? `${county.name} County` : undefined}
                className={`${county ? "cursor-pointer" : "cursor-default"} transition-[fill,stroke-width] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`}
                onMouseEnter={(e) => {
                  setHoveredFips(fips)
                  updatePointer(e)
                }}
                onMouseMove={updatePointer}
                onMouseLeave={() => {
                  setHoveredFips(null)
                  setPointer(null)
                }}
                onFocus={() => setHoveredFips(fips)}
                onBlur={() => setHoveredFips((prev) => (prev === fips ? null : prev))}
                onClick={() => {
                  if (!county) return
                  goToCounty(county)
                }}
                onKeyDown={handleKeyDown}
              >
                <title>
                  {county
                    ? `${county.name}: ${county.nonHispanicWhitePct}% non-Hispanic White`
                    : `${f.properties.name}: no data`}
                </title>
              </path>
            )
          })}
        </svg>

        {hoveredFips && pointer && hovered && (
          <div
            className="pointer-events-none absolute z-10 min-w-[11rem] rounded-none border border-border bg-popover px-3 py-2 text-sm shadow-md"
            style={{
              left: `min(${pointer.x}%, calc(100% - 12rem))`,
              top: `max(${pointer.y - 2}%, 0.5rem)`,
              transform: "translateY(-100%)",
            }}
          >
            <div className="font-medium text-foreground">{hovered.name} County</div>
            <ul className="mt-1.5 space-y-0.5 tabular-nums">
              {foldedCountyBreakdown(state, hovered).map(({ key, label, value }) => (
                <li key={key} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <i
                      className="inline-block size-2 rounded-full"
                      style={{ background: POPULATION_COLORS[key]?.light ?? "var(--muted-foreground)" }}
                      aria-hidden
                    />
                    {label}
                  </span>
                  <span className="font-medium text-foreground">{value}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Combobox
        items={countyOptions}
        value={null}
        onValueChange={(value) => {
          const county = value ? byFips[value] : undefined
          if (county) goToCounty(county)
        }}
      >
        <ComboboxInput placeholder="Search for a county…" className="w-full rounded-none sm:w-72" />
        <ComboboxContent>
          <ComboboxEmpty>No county found.</ComboboxEmpty>
          <ComboboxList>
            {(option: { value: string; label: string }) => (
              <ComboboxItem key={option.value} value={option.value}>
                {option.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      <div className="rounded-lg border border-border bg-card/40 px-4 py-3">

        <div className="columns-2 gap-x-6 sm:columns-3 lg:columns-4">
          {countyGroups.map(([letter, counties]) => (
            <div key={letter} className="mb-3 break-inside-avoid">
              <div className="text-xs font-semibold text-muted-foreground">{letter}</div>
              <ul>
                {counties.map((county) => (
                  <li key={county.fips}>
                    <Link
                      href={`/united-states/${state.slug}/${countySlug(county.name)}`}
                      className="block py-0.5 text-sm text-foreground hover:underline"
                    >
                      {county.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
