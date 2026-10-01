"use client"

import { geoCentroid, geoConicEqualArea, geoPath, type GeoPermissibleObjects } from "d3-geo"
import { memo, useEffect, useState, type KeyboardEvent, type MouseEvent } from "react"
import { feature, mesh } from "topojson-client"
import type { Feature, FeatureCollection, Geometry } from "geojson"
import type { GeometryCollection, Topology } from "topojson-specification"

import { CT_FIPS } from "@/lib/county-history"
import { countyGeoUrl } from "@/lib/states"

type CountyFeature = Feature<Geometry, { name: string }> & { id?: string | number }
type UsTopology = Topology<{ counties: GeometryCollection; states: GeometryCollection }>
type FeaturesTopology = Topology<Record<string, GeometryCollection>>

/** A state to draw on its own, instead of the whole country */
export type CountyMapState = { state: string; abbr: string }

export type CountyOutline = { fips: string; d: string }
export type CountyShape = CountyOutline & { fill: string }

export type CountyGeometry = {
  /** Map size; paths are drawn in 0..width, 0..height */
  width: number
  height: number
  counties: CountyOutline[]
  /** Connecticut's planning regions, for data keyed by region instead of its old counties */
  ctRegions: CountyOutline[]
  /** Planning regions aren't in the server-rendered county lists; their names come with the shapes */
  regionLabels: Record<string, string>
  /** Lines between states on the US map */
  stateBorders?: string
  loading: boolean
}

// us-atlas's pre-projected albers coordinates, shared with UsMap's state map so every US view
// draws the country at the same size
const US_WIDTH = 960
const US_HEIGHT = 600

// A state is fitted into this box, then the box is cropped to the state's shape
const STATE_SIZE = 720
const STATE_PAD = 16

function toFeatures(topology: FeaturesTopology, object: string) {
  return (feature(topology, topology.objects[object]) as FeatureCollection<Geometry, { name: string }>)
    .features as CountyFeature[]
}

function outlinesOf(features: CountyFeature[], path: ReturnType<typeof geoPath>): CountyOutline[] {
  return features.flatMap((f) => {
    const d = path(f as GeoPermissibleObjects)
    return d ? [{ fips: String(f.id), d }] : []
  })
}

function labelsOf(features: CountyFeature[]) {
  return Object.fromEntries(features.map((f) => [String(f.id), f.properties.name]))
}

async function loadUs(): Promise<Omit<CountyGeometry, "loading">> {
  const [topology, ctTopology] = await Promise.all([
    fetch("/geo/us-counties-albers-10m.json").then((r) => r.json() as Promise<UsTopology>),
    fetch("/geo/ct-planning-regions-albers.json")
      .then((r) => r.json() as Promise<FeaturesTopology>)
      .catch(() => null),
  ])
  const path = geoPath()
  const regions = ctTopology ? toFeatures(ctTopology, "regions") : []
  return {
    width: US_WIDTH,
    height: US_HEIGHT,
    counties: outlinesOf(toFeatures(topology as FeaturesTopology, "counties"), path),
    ctRegions: outlinesOf(regions, path),
    regionLabels: labelsOf(regions),
    stateBorders: path(mesh(topology, topology.objects.states, (a, b) => a !== b)) ?? undefined,
  }
}

async function loadState(abbr: string): Promise<Omit<CountyGeometry, "loading">> {
  const [topology, ctTopology] = await Promise.all([
    fetch(countyGeoUrl({ abbr })).then((r) => r.json() as Promise<FeaturesTopology>),
    abbr === "CT"
      ? fetch("/geo/ct-planning-regions-10m.json")
          .then((r) => r.json() as Promise<FeaturesTopology>)
          .catch(() => null)
      : null,
  ])
  const features = toFeatures(topology, "counties")
  const regions = ctTopology ? toFeatures(ctTopology, "counties") : []
  const collection: FeatureCollection = { type: "FeatureCollection", features }

  // Center the cone on the state so it sits upright instead of sheared like on a US-wide map,
  // then shift it so the state's bounds start at the padding
  const [lon, lat] = geoCentroid(collection)
  const projection = geoConicEqualArea()
    .rotate([-lon, 0])
    .parallels([lat - 5, lat + 5])
    .fitExtent(
      [
        [0, 0],
        [STATE_SIZE, STATE_SIZE],
      ],
      collection
    )
  const [[x0, y0], [x1, y1]] = geoPath(projection).bounds(collection)
  const [tx, ty] = projection.translate()
  projection.translate([tx - x0 + STATE_PAD, ty - y0 + STATE_PAD])
  const path = geoPath(projection)

  // The projection stays fitted to the counties, so swapping in Connecticut's regions (which
  // cover the same ground) doesn't shift the map
  return {
    width: x1 - x0 + 2 * STATE_PAD,
    height: y1 - y0 + 2 * STATE_PAD,
    counties: outlinesOf(features, path),
    ctRegions: outlinesOf(regions, path),
    regionLabels: labelsOf(regions),
  }
}

const EMPTY: Omit<CountyGeometry, "loading"> = {
  width: US_WIDTH,
  height: US_HEIGHT,
  counties: [],
  ctRegions: [],
  regionLabels: {},
}

/** County outlines for the whole US, or for one state when `state` is given */
export function useCountyGeometry(state?: CountyMapState): CountyGeometry {
  const [geometry, setGeometry] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const abbr = state?.abbr

  useEffect(() => {
    let cancelled = false
    ;(abbr ? loadState(abbr) : loadUs())
      .then((g) => {
        if (!cancelled) setGeometry(g)
      })
      .catch(() => {
        if (!cancelled) setGeometry(EMPTY)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [abbr])

  return { ...geometry, loading }
}

/** `outlines` with Connecticut's old counties swapped for its planning regions */
export function withCtRegions(counties: CountyOutline[], ctRegions: CountyOutline[]) {
  return [...counties.filter((o) => !o.fips.startsWith(CT_FIPS)), ...ctRegions]
}

// Memoized so hovering (which re-renders the parent) never touches the 3,000+ county paths.
// With `links`, each county named in it is focusable and announced as a link to its page.
export const CountyPaths = memo(function CountyPaths({
  shapes,
  links,
}: {
  shapes: CountyShape[]
  links?: Record<string, string>
}) {
  return shapes.map(({ fips, d, fill }) => {
    const link = links?.[fips]
    return (
      <path
        key={fips}
        d={d}
        data-fips={fips}
        fill={fill}
        stroke="var(--background)"
        strokeWidth={links ? 0.5 : 0.25}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        tabIndex={link ? 0 : undefined}
        role={link ? "link" : undefined}
        aria-label={link}
        className={
          link
            ? "cursor-pointer transition-[fill] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            : undefined
        }
      />
    )
  })
})

/**
 * Click and Enter/Space handlers for a county map's svg, opening the county under the event.
 * Delegated from the svg so the memoized paths need no handlers of their own.
 */
export function countyLinkHandlers(open: ((fips: string) => void) | undefined) {
  if (!open) return {}
  const fipsOf = (e: { target: EventTarget }) => (e.target as Element).getAttribute("data-fips")
  return {
    onClick: (e: MouseEvent<SVGSVGElement>) => {
      const fips = fipsOf(e)
      if (fips) open(fips)
    },
    onKeyDown: (e: KeyboardEvent<SVGSVGElement>) => {
      const fips = fipsOf(e)
      if (fips && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault()
        open(fips)
      }
    },
  }
}
