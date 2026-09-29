"use client"

import { geoCentroid, geoConicEqualArea, geoPath, type GeoPermissibleObjects } from "d3-geo"
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
import { YearSlider } from "@/components/year-slider"
import {
  COUNTY_HISTORY_URL,
  CT_FIPS,
  foldedBreakdown,
  type CountyHistory,
  type CountyValues,
} from "@/lib/county-history"
import {
  countyGeoUrl,
  countyLabel,
  countySlug,
  rangeIntensity,
  type CountyDemographics,
  type StateDemographics,
} from "@/lib/states"

type CountyFeature = Feature<Geometry, { name: string }> & { id?: string | number }
type CountiesTopology = Topology<{ counties: GeometryCollection }>

// Connecticut's planning regions, unprojected like the state county files, drawn in place of
// its old counties for years whose data is keyed by region (2025)
const CT_REGIONS_URL = "/geo/ct-planning-regions-10m.json"

const WIDTH = 720
const HEIGHT = 720
const PAD = 16

function fillFor(
  values: CountyValues | undefined,
  min: number,
  max: number,
  hovered: boolean
) {
  if (!values) {
    return hovered
      ? "color-mix(in oklch, var(--foreground) 10%, var(--border))"
      : "var(--border)"
  }

  const t = rangeIntensity(values[0], min, max)
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

export function StateCountyMap({
  state,
  counties: data,
  years,
}: {
  state: StateDemographics
  counties: CountyDemographics[]
  /** Slider years, oldest first; each must be a key of county-history.json */
  years: number[]
}) {
  const router = useRouter()

  const [features, setFeatures] = useState<CountyFeature[]>([])
  const [ctRegions, setCtRegions] = useState<CountyFeature[]>([])
  const [history, setHistory] = useState<CountyHistory | null>(null)
  const [year, setYear] = useState(years[years.length - 1])
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
    () => sortedCounties.map((c) => ({ value: c.fips, label: countyLabel(c) })),
    [sortedCounties]
  )
  const countyGroups = useMemo(() => groupByLetter(sortedCounties), [sortedCounties])
  const stateFips = data[0]?.fips.slice(0, 2)
  const yearValues = useMemo(() => history?.[year] ?? {}, [history, year])

  // European share range over this state's counties in every year, so a shade means the same
  // share anywhere on the slider
  const [min, max] = useMemo(() => {
    const shares = Object.values(history ?? {}).flatMap((values) =>
      Object.entries(values).flatMap(([fips, v]) => (fips.startsWith(stateFips) ? [v[0]] : []))
    )
    return shares.length ? [Math.min(...shares), Math.max(...shares)] : [0, 100]
  }, [history, stateFips])

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
    const toFeatures = (topology: CountiesTopology) =>
      (feature(topology, topology.objects.counties) as FeatureCollection<Geometry, { name: string }>)
        .features as CountyFeature[]
    Promise.all([
      fetch(countyGeoUrl(state)).then((r) => r.json() as Promise<CountiesTopology>),
      fetch(COUNTY_HISTORY_URL)
        .then((r) => r.json() as Promise<CountyHistory>)
        .catch(() => null),
      stateFips === CT_FIPS
        ? fetch(CT_REGIONS_URL)
            .then((r) => r.json() as Promise<CountiesTopology>)
            .catch(() => null)
        : null,
    ])
      .then(([topology, countyHistory, ctTopology]) => {
        if (cancelled) return
        setFeatures(toFeatures(topology))
        setHistory(countyHistory)
        if (ctTopology) setCtRegions(toFeatures(ctTopology))
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
  }, [state, stateFips])

  const collection = useMemo(
    () => ({ type: "FeatureCollection" as const, features }),
    [features]
  )

  const projection = useMemo(() => {
    const proj = geoConicEqualArea()
    if (!features.length) return proj.scale(2500).translate([WIDTH / 2, HEIGHT / 2])
    // Center the cone on the state so it sits upright instead of sheared like on a US-wide map
    const [lon, lat] = geoCentroid(collection)
    return proj
      .rotate([-lon, 0])
      .parallels([lat - 5, lat + 5])
      .fitExtent(
        [
          [PAD, PAD],
          [WIDTH - PAD, HEIGHT - PAD],
        ],
        collection
      )
  }, [collection, features.length])

  const path = useMemo(() => geoPath(projection), [projection])

  const viewBox = useMemo(() => {
    if (!features.length) return `0 0 ${WIDTH} ${HEIGHT}`
    const [[x0, y0], [x1, y1]] = path.bounds(collection)
    return `${x0 - PAD} ${y0 - PAD} ${x1 - x0 + 2 * PAD} ${y1 - y0 + 2 * PAD}`
  }, [collection, features.length, path])

  // The projection stays fitted to the counties, so swapping in Connecticut's regions (which
  // cover the same ground) doesn't shift the map
  const useCtRegions = ctRegions.some((f) => yearValues[String(f.id)])
  const shownFeatures = useCtRegions ? ctRegions : features

  const orderedFeatures = useMemo(() => {
    if (!hoveredFips) return shownFeatures
    return [...shownFeatures].sort((a, b) => {
      const aBoost = String(a.id) === hoveredFips ? 1 : 0
      const bBoost = String(b.id) === hoveredFips ? 1 : 0
      return aBoost - bBoost
    })
  }, [shownFeatures, hoveredFips])

  const hoveredFeature = hoveredFips
    ? shownFeatures.find((f) => String(f.id) === hoveredFips)
    : undefined
  const hoveredCounty = hoveredFips ? byFips[hoveredFips] : undefined
  const hoveredValues = hoveredFips ? yearValues[hoveredFips] : undefined

  return (
    <div className="space-y-3">
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-muted-foreground">
            Loading map…
          </div>
        )}
        <svg
          viewBox={viewBox}
          className="h-auto w-full touch-pan-y"
          role="img"
          aria-label={`Interactive map of ${state.state} counties showing European population share in ${year}`}
        >
          {orderedFeatures.map((f) => {
            const fips = String(f.id)
            const county = byFips[fips]
            const values = yearValues[fips]
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
                fill={fillFor(values, min, max, isHovered)}
                stroke={strokeFor(isHovered)}
                strokeWidth={isHovered ? 1.25 : 0.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                tabIndex={county ? 0 : undefined}
                role={county ? "link" : undefined}
                aria-label={county ? countyLabel(county) : undefined}
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
                  {`${county ? countyLabel(county) : f.properties.name}: ${
                    values ? `${values[0]}% European` : "no data"
                  } in ${year}`}
                </title>
              </path>
            )
          })}
        </svg>

        {hoveredFips && pointer && (hoveredCounty || hoveredFeature) && (
          <div
            className="pointer-events-none absolute z-10 min-w-[11rem] rounded-none border border-border bg-popover px-3 py-2 text-sm shadow-md"
            style={{
              left: `min(${pointer.x}%, calc(100% - 12rem))`,
              top: `max(${pointer.y - 2}%, 0.5rem)`,
              transform: "translateY(-100%)",
            }}
          >
            <div className="font-medium text-foreground">
              {hoveredCounty ? countyLabel(hoveredCounty) : hoveredFeature?.properties.name}
            </div>
            {!hoveredValues && (
              <div className="mt-1 text-muted-foreground">No data for {year}</div>
            )}
            <ul className="mt-1.5 space-y-0.5 tabular-nums">
              {(hoveredValues ? foldedBreakdown(hoveredValues) : []).map(({ key, label, value }) => (
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

      <YearSlider years={years} year={year} onChange={setYear} disabled={!history} />

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <i
            className="inline-block size-3 rounded-[3px] border border-border"
            style={{ background: "var(--border)" }}
            aria-hidden
          />
          No data for that year
        </span>
        <span>Darker means a larger European share.</span>
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
