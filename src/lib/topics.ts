import {
  BarChart3,
  Church,
  Hourglass,
  Map as MapIcon,
  ShieldAlert,
  Users,
  type LucideIcon,
} from "lucide-react"

export type Topic = {
  slug: string
  label: string
  description: string
  icon: LucideIcon
}

// The home page shows this topic instead of it having its own page.
export const HOME_TOPIC = "religion"

// Each topic is a page at /topics/<slug> (except HOME_TOPIC); order here is the order in
// the sidebar.
export const topics: Topic[] = [
  {
    slug: "religion",
    label: "Native & Christian share",
    description: "Native / European share next to Catholic, Protestant, and Orthodox affiliation.",
    icon: Church,
  },
  {
    slug: "map",
    label: "The Europe Map",
    description: "Interactive choropleth — switch metrics and click a country for details.",
    icon: MapIcon,
  },
  {
    slug: "native-share",
    label: "Native share",
    description:
      "Countries ranked by approximate native / European population share, and how it has changed since 1960.",
    icon: Users,
  },
  {
    slug: "anti-immigration",
    label: "Anti-immigration",
    description: "Opposition to immigration from poorer countries outside Europe.",
    icon: ShieldAlert,
  },
  {
    slug: "market-cap",
    label: "Market capitalization",
    description: "Listed domestic equity market size, a proxy for financial-market scale.",
    icon: BarChart3,
  },
  {
    slug: "median-age",
    label: "Median age",
    description: "Countries ranked by median age of the native / European population.",
    icon: Hourglass,
  },
]

export function topicHref(slug: string): string {
  return slug === HOME_TOPIC ? "/" : `/topics/${slug}`
}

export function topicMetadata(slug: string): { title: string; description: string } {
  const topic = topics.find((t) => t.slug === slug)
  if (!topic) throw new Error(`Unknown topic: ${slug}`)
  return { title: `${topic.label} — Demographics`, description: topic.description }
}
