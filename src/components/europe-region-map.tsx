"use client"

import { geoCentroid, geoConicConformal, geoPath, type GeoPermissibleObjects } from "d3-geo"
import { memo, useEffect, useMemo, useState, type MouseEvent } from "react"
import { Download } from "lucide-react"
import { feature, mesh } from "topojson-client"
import type { Feature, FeatureCollection, Geometry } from "geojson"
import type { GeometryCollection, Topology } from "topojson-specification"

import { ColorChooser } from "@/components/color-chooser"
import { FRAME, HEIGHT, PAD, WIDTH } from "@/components/europe-map"
import { Button } from "@/components/ui/button"
import {
  downloadMapPng,
  shade,
  SHADE_RANGE,
  shadeGradient,
  shadeStops,
} from "@/components/us-county-map-export"
import { blend, blendStops, NEW_SIDE_COLORS } from "@/components/us-county-map"

const GEO_URL = "/geo/europe-nuts3-20m.json"

type GroupKey = string
type Group = { key: GroupKey; label: string; color: string }

type DatasetKey = "origin" | "religion"

type Dataset = {
  url: string
  /** In the order of each region's shares in the dataset's JSON */
  groups: Group[]
  /** Groups that can "lead" a region in the largest-group view */
  leaders: GroupKey[]
  /** Selections with a shorter name than their groups joined together */
  named: { keys: GroupKey[]; title: string }[]
  defaultSides: Side[]
  source: string
  shareButton: string
  largestButton: string
  largestTitle: string
  /** Appended to share-view titles, e.g. the census year */
  titleSuffix: string
  largestSubtitle: string
  shareSubtitle: string
}

const ORIGIN_GROUPS: Group[] = [
  { key: "native", label: "Born in country", color: "#2a78d6" },
  { key: "eu", label: "Other EU", color: "#3fa9d4" },
  { key: "europe", label: "Rest of Europe", color: "#4a3aa7" },
  { key: "turkey", label: "Turkey", color: "#d32f2f" },
  { key: "mena", label: "Middle East & N. Africa", color: "#008300" },
  { key: "africa", label: "Sub-Saharan Africa", color: "#1baf7a" },
  { key: "southAsia", label: "South Asia", color: "#eda100" },
  { key: "eastAsia", label: "East & SE Asia", color: "#e87ba4" },
  { key: "latin", label: "Latin America", color: "#eb6834" },
  { key: "other", label: "Other / unknown", color: "#8a8a8a" },
]

const FOREIGN: GroupKey[] = ORIGIN_GROUPS.map((g) => g.key).filter((k) => k !== "native")

const RELIGION_GROUPS: Group[] = [
  { key: "catholic", label: "Catholic", color: "#2a78d6" },
  { key: "protestant", label: "Protestant", color: "#d32f2f" },
  { key: "orthodox", label: "Orthodox", color: "#4a3aa7" },
  { key: "otherChristian", label: "Other Christian", color: "#e87ba4" },
  { key: "muslim", label: "Muslim", color: "#008300" },
  { key: "jewish", label: "Jewish", color: "#3fa9d4" },
  { key: "other", label: "Other religion", color: "#eda100" },
  { key: "none", label: "No religion", color: "#eb6834" },
  // Czechia only: believers who belong to no church
  { key: "believer", label: "Believer, no church", color: "#1baf7a" },
  { key: "nonMember", label: "Not a church member", color: "#b3a58f" },
  { key: "notStated", label: "Not stated", color: "#8a8a8a" },
]

const CHRISTIAN: GroupKey[] = ["catholic", "protestant", "orthodox", "otherChristian"]

const DATASETS: Record<DatasetKey, Dataset> = {
  origin: {
    url: "/data/europe-region-origin.json",
    groups: ORIGIN_GROUPS,
    // Other mixes North America, Oceania, Central Asia, and unknown birthplaces, so it never "leads"
    leaders: FOREIGN.filter((k) => k !== "other"),
    named: [{ keys: FOREIGN, title: "Foreign-born" }],
    // One side starts as a plain share map of everyone born abroad; adding sides compares them
    defaultSides: [{ id: 0, groups: FOREIGN, color: "#593001" }],
    source: "Source: Eurostat, Census 2021 (cens_21cob_r3). Boundaries © EuroGeographics",
    shareButton: "Share by origin",
    largestButton: "Largest foreign-born group",
    largestTitle: "Largest foreign-born group by region, 2021",
    titleSuffix: ", 2021",
    largestSubtitle:
      "Each region takes the color of its largest group born abroad; deeper means a larger share of residents.",
    shareSubtitle: "Share of each NUTS 3 region's residents born in the selected places; deeper means higher.",
  },
  religion: {
    url: "/data/europe-region-religion.json",
    groups: RELIGION_GROUPS,
    // Church registers can't say what non-members believe, and "not stated" says nothing at all
    leaders: RELIGION_GROUPS.map((g) => g.key).filter((k) => k !== "nonMember" && k !== "notStated"),
    named: [{ keys: CHRISTIAN, title: "Christian" }],
    defaultSides: [{ id: 0, groups: ["catholic"], color: "#2a78d6" }],
    source:
      "Source: national censuses 2021–22 and church registers (hover a region for its source). Boundaries © EuroGeographics",
    shareButton: "Share by religion",
    largestButton: "Largest religious group",
    largestTitle: "Largest religious group by region",
    // Countries report from different years (2021 censuses to recent church registers)
    titleSuffix: "",
    largestSubtitle:
      "Each region takes the color of its largest religion (or no religion); deeper means a larger share of residents. Gray countries collect no regional religion data.",
    shareSubtitle:
      "Share of each NUTS 3 region's residents in the selected groups; deeper means higher. Gray countries collect no regional religion data.",
  },
}

type Region = {
  /** Name */
  n: string
  /** Population */
  p: number
  /** % of population per group, in the dataset's group order */
  s: number[]
  /** Most common foreign countries of birth: [code, % of population] (origin only) */
  top?: [string, number][]
}

type RegionData = {
  groups: GroupKey[]
  countries: Record<string, string>
  /** Names of countries of birth in "top" (origin only) */
  origins?: Record<string, string>
  /** Per reporting country, where its figures come from (religion only) */
  sources?: Record<string, string>
  regions: Record<string, Region>
}

type Mode = "share" | "largest"

/** `id` is a stable React key, since sides can be removed from the middle */
type Side = { id: number; groups: GroupKey[]; color: string }

type RegionFeature = Feature<Geometry, { name: string }> & { id?: string | number }
type NutsTopology = Topology<{ regions: GeometryCollection; countries: GeometryCollection }>

type Outline = { id: string; d: string }
type Shape = Outline & { fill: string }

const NO_DATA_FILL = "var(--border)"
/** Neighbors around a single country, fainter than its regions without data */
const NEIGHBOR_FILL = "color-mix(in oklch, var(--border) 45%, var(--background))"

/** Whether a region sits in mainland Europe's frame, leaving out the Canaries, Azores, French overseas departments, ... */
function inFrame(f: RegionFeature) {
  const [lon, lat] = geoCentroid(f as GeoPermissibleObjects)
  return lon >= -11 && lon <= 32 && lat >= 34 && lat <= 72
}

type Geometry2D = {
  regions: Outline[]
  context: Outline[]
  borders: string
  width: number
  height: number
}

/** Europe-wide, every region in the frame */
function europeGeometry(topology: NutsTopology, origin: RegionData): Geometry2D {
  const path = geoPath(
    geoConicConformal()
      .parallels([43, 62])
      .rotate([-10, 0])
      .fitExtent(
        [
          [PAD, PAD],
          [WIDTH - PAD, HEIGHT - PAD],
        ],
        FRAME
      )
  )
  const countries = toFeatures(topology, "countries").filter((f) => !origin.countries[String(f.id)])
  return {
    regions: outlinesOf(toFeatures(topology, "regions"), path),
    context: outlinesOf(countries, path),
    // Lines between countries, over the region outlines
    borders:
      path(
        mesh(
          topology,
          topology.objects.regions,
          (a, b) => String(a.id).slice(0, 2) !== String(b.id).slice(0, 2)
        )
      ) ?? "",
    width: WIDTH,
    height: HEIGHT,
  }
}

/** One country's mainland regions, fitted to the map's width, with its neighbors as context */
function countryGeometry(topology: NutsTopology, code: string): Geometry2D {
  const own = toFeatures(topology, "regions").filter(
    (f) => String(f.id).startsWith(code) && inFrame(f)
  )
  const fitTo: FeatureCollection = { type: "FeatureCollection", features: own }
  const [lon, lat] = geoCentroid(fitTo)
  const projection = geoConicConformal()
    .parallels([lat - 4, lat + 4])
    .rotate([-lon, 0])
    .fitWidth(WIDTH - 2 * PAD, fitTo)
  // Tall countries (Italy, Norway) get a taller map, within reason
  const [[, y0], [, y1]] = geoPath(projection).bounds(fitTo)
  const height = Math.round(Math.min(Math.max(y1 - y0 + 2 * PAD, 420), 1100))
  projection.fitExtent(
    [
      [PAD, PAD],
      [WIDTH - PAD, height - PAD],
    ],
    fitTo
  )
  const path = geoPath(projection)
  const neighbors = toFeatures(topology, "countries").filter((f) => String(f.id) !== code)
  return {
    regions: outlinesOf(own, path),
    context: outlinesOf(neighbors, path),
    borders: path(mesh(topology, topology.objects.countries, (a, b) => a !== b)) ?? "",
    width: WIDTH,
    height,
  }
}

function share(ds: Dataset, region: Region, key: GroupKey) {
  return region.s[ds.groups.findIndex((g) => g.key === key)] ?? 0
}

function combined(ds: Dataset, region: Region, keys: GroupKey[]) {
  return keys.reduce((t, k) => t + share(ds, region, k), 0)
}

type Leader = { index: number; lead: number }

/**
 * The side with the largest combined share in a region, and its lead over the runner-up.
 * A lone side "leads" by its whole share, so one side is a plain share map.
 */
function sideLeader(ds: Dataset, region: Region, sides: Side[]): Leader {
  const sums = sides.map((side) => combined(ds, region, side.groups))
  let index = 0
  for (let i = 1; i < sums.length; i++) if (sums[i] > sums[index]) index = i
  const runnerUp = sums.length > 1 ? Math.max(...sums.filter((_, i) => i !== index)) : 0
  return { index, lead: sums[index] - runnerUp }
}

// Like the US map: two sides blend straight from the first side's color into the second's,
// more each shade their own color, deeper the wider the lead
function sideFill(leader: Leader, maxLead: number, sides: Side[]) {
  const t = maxLead > 0 ? Math.min(1, leader.lead / maxLead) : 0
  if (sides.length === 2) {
    const signed = leader.index === 0 ? -t : t
    return blend(sides[0].color, sides[1].color, 0.5 + signed / 2)
  }
  return intensityShade(sides[leader.index].color, t)
}

function sideLabel(ds: Dataset, side: Side) {
  return side.groups.map((k) => groupOf(ds, k).label).join(" + ")
}

/** The largest leading group in a region (e.g. foreign-born origin, or religion), and its share */
function leaderOf(ds: Dataset, region: Region): { key: GroupKey; value: number } {
  let best = { key: ds.leaders[0], value: -1 }
  for (const key of ds.leaders) {
    const value = share(ds, region, key)
    if (value > best.value) best = { key, value }
  }
  return best
}

function groupOf(ds: Dataset, key: GroupKey) {
  return ds.groups.find((g) => g.key === key)!
}

// A named selection (e.g. every foreign group) reads by its name; every group but one, "All but" it
function selectionTitle(ds: Dataset, keys: GroupKey[]) {
  const named = ds.named.find(
    (n) => n.keys.length === keys.length && n.keys.every((k) => keys.includes(k))
  )
  if (named) return named.title
  if (keys.length === ds.groups.length - 1) {
    const missing = ds.groups.find((g) => !keys.includes(g.key))!
    return `All but ${missing.label}`
  }
  return keys.map((k) => groupOf(ds, k).label).join(" + ")
}

function intensityShade(color: string, t: number) {
  return shade(color, Math.round(SHADE_RANGE[0] + t * (SHADE_RANGE[1] - SHADE_RANGE[0])))
}

function formatPct(value: number) {
  return `${value.toFixed(1)}%`
}

function toFeatures(topology: NutsTopology, object: "regions" | "countries") {
  return (feature(topology, topology.objects[object]) as FeatureCollection<Geometry, { name: string }>)
    .features as RegionFeature[]
}

function outlinesOf(features: RegionFeature[], path: ReturnType<typeof geoPath>): Outline[] {
  return features.flatMap((f) => {
    const d = path(f as GeoPermissibleObjects)
    return d ? [{ id: String(f.id), d }] : []
  })
}

// Memoized so hovering (which re-renders the parent) never touches the 1,200 region paths
const RegionPaths = memo(function RegionPaths({ shapes }: { shapes: Shape[] }) {
  return shapes.map(({ id, d, fill }) => (
    <path
      key={id}
      d={d}
      data-id={id}
      fill={fill}
      stroke="var(--background)"
      strokeWidth={0.35}
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    />
  ))
})

/**
 * Europe's NUTS 3 regions (Kreise, départements, provinces, ...) colored by country of birth,
 * Europe's closest counterpart to the US county ethnicity map, or by religion where countries
 * record it regionally.
 */
export function EuropeRegionMap({ country }: { country?: string } = {}) {
  const [datasetKey, setDatasetKey] = useState<DatasetKey>("origin")
  // Each dataset is fetched the first time it's picked
  const [loaded, setLoaded] = useState<Partial<Record<DatasetKey, RegionData>>>({})
  const [geometry, setGeometry] = useState<Geometry2D | null>(null)
  // The NUTS code of `country`, once the data says which countries it covers
  const [code, setCode] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const [mode, setMode] = useState<Mode>("share")
  const [sides, setSides] = useState<Side[]>(DATASETS.origin.defaultSides)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [exporting, setExporting] = useState(false)

  const ds = DATASETS[datasetKey]
  const data = loaded[datasetKey]
  // Groups are exclusive and every side needs one, so there can be at most one side per group
  const maxSides = ds.groups.length

  function pickDataset(key: DatasetKey) {
    if (key === datasetKey) return
    setDatasetKey(key)
    setSides(DATASETS[key].defaultSides)
    setHoveredId(null)
    setPointer(null)
  }

  useEffect(() => {
    if (loaded[datasetKey] || datasetKey === "origin" || country) return
    let cancelled = false
    fetch(DATASETS[datasetKey].url)
      .then((r) => r.json() as Promise<RegionData>)
      .then((d) => {
        if (!cancelled) setLoaded((prev) => ({ ...prev, [datasetKey]: d }))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [datasetKey, loaded, country])

  // Origin data comes with the shapes, since it also says which countries the map covers.
  // A single country also fetches religion up front, to know whether it records religion at all.
  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch(DATASETS.origin.url).then((r) => r.json() as Promise<RegionData>),
      fetch(GEO_URL).then((r) => r.json() as Promise<NutsTopology>),
      country
        ? fetch(DATASETS.religion.url).then((r) => r.json() as Promise<RegionData>)
        : undefined,
    ])
      .then(([origin, topology, religion]) => {
        if (cancelled) return
        setLoaded((prev) => ({ ...prev, origin, ...(religion && { religion }) }))
        if (!country) {
          setGeometry(europeGeometry(topology, origin))
          return
        }
        const match = Object.entries(origin.countries).find(([, name]) => name === country)
        if (!match) {
          setMissing(true)
          return
        }
        setCode(match[0])
        setGeometry(countryGeometry(topology, match[0]))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [country])

  // A single country's map covers only its drawn regions, so colors scale to them alone
  const allRegions = data?.regions
  const regions = useMemo(() => {
    if (!country || !allRegions || !geometry) return allRegions
    return Object.fromEntries(
      geometry.regions.flatMap((o) => (allRegions[o.id] ? [[o.id, allRegions[o.id]]] : []))
    )
  }, [country, allRegions, geometry])

  // Scaled to the region with the widest lead (or, for one side, the highest share)
  const maxShare = useMemo(() => {
    let max = 0
    for (const region of Object.values(regions ?? {})) {
      max = Math.max(
        max,
        mode === "share" ? sideLeader(ds, region, sides).lead : leaderOf(ds, region).value
      )
    }
    return max
  }, [ds, regions, mode, sides])

  const shapes = useMemo(() => {
    if (!geometry || !regions) return []
    const contextFill = country ? NEIGHBOR_FILL : NO_DATA_FILL
    const fills: Shape[] = geometry.context.map((o) => ({ ...o, fill: contextFill }))
    for (const o of geometry.regions) {
      const region = regions[o.id]
      let fill = NO_DATA_FILL
      if (region && maxShare > 0) {
        if (mode === "share") {
          fill = sideFill(sideLeader(ds, region, sides), maxShare, sides)
        } else {
          const leader = leaderOf(ds, region)
          fill = intensityShade(groupOf(ds, leader.key).color, leader.value / maxShare)
        }
      }
      fills.push({ ...o, fill })
    }
    return fills
  }, [ds, geometry, regions, mode, sides, maxShare, country])

  const pathById = useMemo(
    () => Object.fromEntries((geometry?.regions ?? []).map((o) => [o.id, o.d])),
    [geometry]
  )

  // Groups that lead somewhere, for the "largest group" legend
  const leaders = useMemo(() => {
    const keys = new Set(Object.values(regions ?? {}).map((r) => leaderOf(ds, r).key))
    return ds.leaders.filter((k) => keys.has(k))
  }, [ds, regions])

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
          const groups = ds.groups.map((g) => g.key).filter((g) => g === key || own.groups.includes(g))
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
  // the side holding the most, and the first starting color no side is using yet
  function addSide() {
    setSides((prev) => {
      if (prev.length >= maxSides) return prev
      const assigned = new Set(prev.flatMap((side) => side.groups))
      let key = ds.groups.map((g) => g.key).find((g) => !assigned.has(g))
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
    setSides((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== sideIndex) : prev))
  }

  // Mirrors addSide: there must be a group free, or a side with one to spare
  const canAddSide =
    sides.length < maxSides &&
    (sides.flatMap((side) => side.groups).length < ds.groups.length ||
      sides.some((side) => side.groups.length > 1))

  // One listener for the whole map: read the region off the path under the cursor
  function handleMouseMove(e: MouseEvent<SVGSVGElement>) {
    const id = (e.target as Element).getAttribute("data-id")
    if (!id || !regions?.[id]) {
      setHoveredId(null)
      setPointer(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setHoveredId(id)
    setPointer({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    })
  }

  const hovered = hoveredId ? regions?.[hoveredId] : undefined
  const loading = !geometry || !data
  const maxLabel = formatPct(maxShare)
  const single = sides.length === 1
  // Two sides blend into each other on one bar; more each get their own
  const diverging = sides.length === 2
  const leadLabel = `+${Math.round(maxShare)} pts`

  const europeTitle =
    mode === "largest"
      ? ds.largestTitle
      : single
        ? `${selectionTitle(ds, sides[0].groups)} share of population by region${ds.titleSuffix}`
        : `${sides.map((side) => selectionTitle(ds, side.groups)).join(" vs. ")} by region${ds.titleSuffix}`
  const title = country ? europeTitle.replace(" by region", ` by region in ${country}`) : europeTitle
  // A single country only offers religion if it records it regionally
  const hasReligion = !country || (code != null && !!loaded.religion?.countries[code])
  const subtitle =
    mode === "largest"
      ? ds.largestSubtitle
      : single
        ? ds.shareSubtitle
        : `Each region is colored by its ${diverging ? "larger" : "largest"} side, as a share of residents; deeper means a wider lead.`

  const shareLegend =
    single
      ? [{ name: selectionTitle(ds, sides[0].groups), stops: shadeStops(sides[0].color), low: "0%", high: maxLabel }]
      : diverging
        ? [
            {
              name: "Lead",
              stops: blendStops(sides[0].color, sides[1].color),
              low: `${selectionTitle(ds, sides[0].groups)} ${leadLabel}`,
              high: `${selectionTitle(ds, sides[1].groups)} ${leadLabel}`,
            },
          ]
        : sides.map((side) => ({
            name: `Most ${selectionTitle(ds, side.groups)}`,
            groups:
              selectionTitle(ds, side.groups) !== sideLabel(ds, side) ? sideLabel(ds, side) : undefined,
            stops: shadeStops(side.color),
            low: "Close",
            high: leadLabel,
          }))

  async function handleDownload() {
    setExporting(true)
    try {
      await downloadMapPng({
        title,
        subtitle,
        legend:
          mode === "share"
            ? shareLegend
            : leaders.map((key) => ({
                name: groupOf(ds, key).label,
                stops: shadeStops(groupOf(ds, key).color),
                low: "0%",
                high: maxLabel,
              })),
        source: ds.source,
        mapWidth: geometry?.width ?? WIDTH,
        mapHeight: geometry?.height ?? HEIGHT,
        shapes,
        stateBorders: geometry?.borders,
        fileName: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`,
      })
    } finally {
      setExporting(false)
    }
  }

  if (missing) return null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {hasReligion && (
          <>
            <div className="flex gap-1" role="group" aria-label="Category">
              {(["origin", "religion"] as const).map((key) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={datasetKey === key ? "default" : "outline"}
                  aria-pressed={datasetKey === key}
                  onClick={() => pickDataset(key)}
                >
                  {key === "origin" ? "Origin" : "Religion"}
                </Button>
              ))}
            </div>
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          </>
        )}
        <Button
          type="button"
          size="sm"
          variant={mode === "share" ? "default" : "secondary"}
          onClick={() => setMode("share")}
        >
          {ds.shareButton}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "largest" ? "default" : "secondary"}
          onClick={() => setMode("largest")}
        >
          {ds.largestButton}
        </Button>
      </div>

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
            disabled={loading || exporting}
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
            viewBox={`0 0 ${geometry?.width ?? WIDTH} ${geometry?.height ?? HEIGHT}`}
            className="h-auto max-h-[75svh] w-full touch-pan-y overflow-hidden"
            role="img"
            aria-label={`Map: ${title}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => {
              setHoveredId(null)
              setPointer(null)
            }}
          >
            <RegionPaths shapes={shapes} />
            {geometry?.borders && (
              <path
                d={geometry.borders}
                fill="none"
                stroke="var(--background)"
                strokeWidth={1.25}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            )}
            {hoveredId && pathById[hoveredId] && (
              <path
                d={pathById[hoveredId]}
                fill="none"
                stroke="color-mix(in oklch, var(--foreground) 55%, var(--background))"
                strokeWidth={1.25}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            )}
          </svg>

          {hoveredId && hovered && pointer && data && (
            <div
              className="pointer-events-none absolute z-10 min-w-[13rem] rounded-none border border-border bg-popover px-3 py-2 text-sm shadow-md"
              style={{
                left: `min(${pointer.x}%, calc(100% - 14rem))`,
                top: `max(${pointer.y - 2}%, 0.5rem)`,
                transform: "translateY(-100%)",
              }}
            >
              <div className="font-medium text-foreground">
                {hovered.n}, {data.countries[hoveredId.slice(0, 2)]}
              </div>
              <div className="text-xs tabular-nums text-muted-foreground">
                Population {hovered.p.toLocaleString("en-US")}
              </div>
              <ul className="mt-1.5 space-y-0.5 tabular-nums">
                {ds.groups.map((g) => ({ ...g, value: share(ds, hovered, g.key) }))
                  .filter((g) => g.value >= 0.1)
                  .sort((a, b) => b.value - a.value)
                  .map(({ key, label, color: dot, value }) => (
                    <li key={key} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <i className="inline-block size-2 rounded-full" style={{ background: dot }} aria-hidden />
                        {label}
                      </span>
                      <span className="font-medium text-foreground">{formatPct(value)}</span>
                    </li>
                  ))}
              </ul>
              {data.sources?.[hoveredId.slice(0, 2)] && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {data.sources[hoveredId.slice(0, 2)]}
                </div>
              )}
              {hovered.top && hovered.top.length > 0 && (
                <>
                  <div className="mt-2 text-xs font-medium text-foreground">Top countries of birth</div>
                  <ul className="mt-0.5 space-y-0.5 text-xs tabular-nums">
                    {hovered.top.map(([code, value]) => (
                      <li key={code} className="flex justify-between gap-3">
                        <span className="text-muted-foreground">{data.origins?.[code] ?? code}</span>
                        <span className="text-foreground">{formatPct(value)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        <figcaption className="flex flex-wrap items-end gap-x-6 gap-y-3 text-xs">
          {mode === "share" ? (
            diverging ? (
              <div className="w-64 space-y-1">
                <div className="font-medium text-foreground">Lead</div>
                <div
                  className="h-2.5 border border-border"
                  style={{ background: `linear-gradient(in oklch to right, ${sides[0].color}, ${sides[1].color})` }}
                />
                <div className="flex justify-between gap-2 tabular-nums text-muted-foreground">
                  <span>{selectionTitle(ds, sides[0].groups)} {leadLabel}</span>
                  <span className="text-right">{selectionTitle(ds, sides[1].groups)} {leadLabel}</span>
                </div>
              </div>
            ) : (
              sides.map((side) => {
                const name = selectionTitle(ds, side.groups)
                return (
                  <div key={side.id} className={`${single ? "w-48" : "w-40"} space-y-1`}>
                    <div className="font-medium text-foreground">{single ? name : `Most ${name}`}</div>
                    {!single && name !== sideLabel(ds, side) && (
                      <div className="text-muted-foreground">{sideLabel(ds, side)}</div>
                    )}
                    <div className="h-2.5 border border-border" style={{ background: shadeGradient(side.color) }} />
                    <div className="flex justify-between tabular-nums text-muted-foreground">
                      <span>{single ? "0%" : "Close"}</span>
                      <span>{single ? maxLabel : leadLabel}</span>
                    </div>
                  </div>
                )
              })
            )
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {leaders.map((key) => (
                <LegendSwatch key={key} color={groupOf(ds, key).color} label={groupOf(ds, key).label} />
              ))}
            </div>
          )}
          <LegendSwatch color={NO_DATA_FILL} label="No data" />
          <span className="ml-auto text-muted-foreground">{ds.source}</span>
        </figcaption>
      </figure>

      {mode === "share" && (
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
                  {!single && `${sides.length > 2 ? "Most" : "More"} `}
                  {sideLabel(ds, side)}
                </span>
                {sides.length > 1 && (
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
                {ds.groups.map(({ key, label }) => {
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
      )}
    </div>
  )
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-muted-foreground">
      <i
        className="inline-block size-3 rounded-[3px] border border-border"
        style={{ background: color }}
        aria-hidden
      />
      {label}
    </span>
  )
}
