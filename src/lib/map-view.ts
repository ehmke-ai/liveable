/** Query values for the United States map tabs. The default view omits `view`. */

export type MapLevel = "county" | "state"

export type NationalMapView =
  | "visas"
  | "costCounty"
  | "costOfLiving"
  | "native"
  | "election2024County"
  | "election2024"
  | "religion"
  | "antiImmig"
  | "enforcement"
  | "thirtyMarriedHomeowner"
  | "wealthShareUnder30"

export type StateMapView = "visas" | "demographics" | "election2024" | "religion" | "cost"

type MapQuery = { view: string | null; level: "state" | null }

const SLUGS: Record<string, string> = {
  visas: "visas",
  cost: "cost",
  "cost-of-living": "cost",
  demographics: "demographics",
  native: "demographics",
  election: "election",
  election2024: "election",
  "election-2024": "election",
  religion: "religion",
  sentiment: "sentiment",
  antiimmig: "sentiment",
  "anti-immig": "sentiment",
  enforcement: "enforcement",
  fishback: "fishback",
  "thirty-married-homeowner": "fishback",
  wealth: "wealth",
  "wealth-share": "wealth",
}

export function queryValue(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined
}

export function mapLevel(value: string | undefined): MapLevel {
  return value === "state" ? "state" : "county"
}

function slug(value: string | undefined): string | null {
  if (!value) return null
  return SLUGS[value.toLowerCase()] ?? null
}

export function nationalMapView(view: string | undefined, level: string | undefined): NationalMapView {
  const state = mapLevel(level) === "state"
  switch (slug(view)) {
    case "cost":
      return state ? "costOfLiving" : "costCounty"
    case "demographics":
      return "native"
    case "election":
      return state ? "election2024" : "election2024County"
    case "religion":
      return "religion"
    case "sentiment":
      return "antiImmig"
    case "enforcement":
      return "enforcement"
    case "fishback":
      return "thirtyMarriedHomeowner"
    case "wealth":
      return "wealthShareUnder30"
    default:
      return "visas"
  }
}

export function stateMapView(view: string | undefined): StateMapView {
  switch (slug(view)) {
    case "demographics":
      return "demographics"
    case "election":
      return "election2024"
    case "religion":
      return "religion"
    case "cost":
      return "cost"
    default:
      return "visas"
  }
}

function nationalQuery(view: NationalMapView): MapQuery {
  switch (view) {
    case "costCounty":
      return { view: "cost", level: null }
    case "costOfLiving":
      return { view: "cost", level: "state" }
    case "native":
      return { view: "demographics", level: null }
    case "election2024County":
      return { view: "election", level: null }
    case "election2024":
      return { view: "election", level: "state" }
    case "religion":
      return { view: "religion", level: null }
    case "antiImmig":
      return { view: "sentiment", level: null }
    case "enforcement":
      return { view: "enforcement", level: null }
    case "thirtyMarriedHomeowner":
      return { view: "fishback", level: null }
    case "wealthShareUnder30":
      return { view: "wealth", level: null }
    default:
      return { view: null, level: null }
  }
}

function stateQuery(view: StateMapView): MapQuery {
  switch (view) {
    case "demographics":
      return { view: "demographics", level: null }
    case "election2024":
      return { view: "election", level: null }
    case "religion":
      return { view: "religion", level: null }
    case "cost":
      return { view: "cost", level: null }
    default:
      return { view: null, level: null }
  }
}

export function nationalMapHref(view: NationalMapView): string {
  return mapHref("/", nationalQuery(view))
}

export function stateMapHref(pathname: string, view: StateMapView): string {
  return mapHref(pathname, stateQuery(view))
}

function mapHref(pathname: string, query: MapQuery): string {
  const params = new URLSearchParams()
  if (query.view) params.set("view", query.view)
  if (query.level) params.set("level", query.level)
  const search = params.toString()
  return search ? `${pathname}?${search}` : pathname
}
