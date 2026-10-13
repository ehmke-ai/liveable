import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { NativeShareTrendChart } from "@/components/native-share-trend-chart"
import { PlaceSearch } from "@/components/place-search"
import { PoliticalLeanTrendChart } from "@/components/political-lean-trend-chart"
import { PageHeader, RankingTable, Swatch } from "@/components/topic-page"
import { UsCountyMap } from "@/components/us-county-map"
import { UsMap } from "@/components/us-map"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { formatRatio } from "@/lib/cost-of-living"
import { COUNTY_HISTORY_YEARS } from "@/lib/county-history"
import {
  COLORS,
  demographicsData,
  getCountryBySlug,
  getCountryRankings,
} from "@/lib/demographics"
import { queryValue } from "@/lib/map-view"
import { usCountyMapData } from "@/lib/state-data"
import {
  election2024Margin,
  ENFORCEMENT_TIER_LABELS,
  maxStateEnforcementScore,
  maxStateNative,
  maxStateThirtyMarriedHomeowner,
  minStateEnforcementScore,
  rangeIntensity,
  stateMapData,
  stateNavByAbbr,
  statePriceToIncome,
  type StateMapMetrics,
} from "@/lib/states"

export const metadata: Metadata = {
  title: { absolute: "basedmetrics.com — America by the numbers" },
}

const LEADERBOARD_SIZE = 5

function stateHref(s: StateMapMetrics): string {
  return `/united-states/${stateNavByAbbr[s.abbr].slug}`
}

function top(
  compare: (a: StateMapMetrics, b: StateMapMetrics) => number
): StateMapMetrics[] {
  return [...stateMapData].sort(compare).slice(0, LEADERBOARD_SIZE)
}

const maxTrumpMargin = Math.max(...stateMapData.map(election2024Margin))
const maxPriceToIncome = Math.max(...stateMapData.map(statePriceToIncome))

const leaderboards = [
  {
    title: "Highest non-Hispanic White share",
    valueLabel: "Share",
    color: COLORS.native,
    rows: top((a, b) => b.native - a.native).map((s) => ({
      country: s.state,
      href: stateHref(s),
      value: `${s.native}%`,
      intensity: s.native / maxStateNative,
    })),
  },
  {
    title: "Most ICE cooperation",
    valueLabel: "Tier",
    color: COLORS.enforcement,
    rows: top((a, b) => a.enforcementScore - b.enforcementScore).map((s) => ({
      country: s.state,
      href: stateHref(s),
      value: ENFORCEMENT_TIER_LABELS[s.enforcementTier],
      intensity:
        1 - rangeIntensity(s.enforcementScore, minStateEnforcementScore, maxStateEnforcementScore),
    })),
  },
  {
    title: "Largest Trump margin, 2024",
    valueLabel: "Margin",
    color: COLORS.rightWing,
    rows: top((a, b) => election2024Margin(b) - election2024Margin(a)).map((s) => ({
      country: s.state,
      href: stateHref(s),
      value: `R+${election2024Margin(s).toFixed(1)}`,
      intensity: election2024Margin(s) / maxTrumpMargin,
    })),
  },
  {
    title: "Most married homeowners at 30",
    valueLabel: "Share",
    color: COLORS.thirtyMarriedHomeowner,
    rows: top((a, b) => b.thirtyMarriedHomeowner - a.thirtyMarriedHomeowner).map((s) => ({
      country: s.state,
      href: stateHref(s),
      value: `${s.thirtyMarriedHomeowner}%`,
      intensity: s.thirtyMarriedHomeowner / maxStateThirtyMarriedHomeowner,
    })),
  },
  {
    title: "Most affordable homes",
    valueLabel: "Price ÷ income",
    color: COLORS.costOfLiving,
    rows: top((a, b) => statePriceToIncome(a) - statePriceToIncome(b)).map((s) => ({
      country: s.state,
      href: stateHref(s),
      value: formatRatio(statePriceToIncome(s)),
      intensity: statePriceToIncome(s) / maxPriceToIncome,
    })),
  },
  {
    title: "Least affordable homes",
    valueLabel: "Price ÷ income",
    color: COLORS.costOfLiving,
    rows: top((a, b) => statePriceToIncome(b) - statePriceToIncome(a)).map((s) => ({
      country: s.state,
      href: stateHref(s),
      value: formatRatio(statePriceToIncome(s)),
      intensity: statePriceToIncome(s) / maxPriceToIncome,
    })),
  },
]

function SectionHeader({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children?: React.ReactNode
}) {
  return (
    <header id={id} className="mt-12 mb-7 scroll-mt-16">
      <h2 className="section-title">{title}</h2>
      {children && <p className="section-sub">{children}</p>}
    </header>
  )
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[]; level?: string | string[] }>
}) {
  const query = await searchParams
  const us = getCountryBySlug("united-states")
  if (!us) throw new Error("Missing United States data")

  const countyMapData = usCountyMapData()
  const rankings = getCountryRankings(us.country)

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6">
      <PageHeader
        title="America by the numbers"
        description="Who lives where, what they believe, how they vote, what it costs to live there, and whether young Americans can still marry and buy a home — for every state and county."
      >
        <PlaceSearch className="mt-5 max-w-md" />
      </PageHeader>

      <UsMap
        countyMap={<UsCountyMap {...countyMapData} years={COUNTY_HISTORY_YEARS} />}
        electionCounties={countyMapData}
        viewQuery={queryValue(query.view)}
        levelQuery={queryValue(query.level)}
      />

      <SectionHeader id="leaderboards" title="Leaderboards">
        The top {LEADERBOARD_SIZE} states on each measure.{" "}
        <Link href="/states" className="underline-offset-2 hover:underline">
          Compare all states →
        </Link>
      </SectionHeader>
      <div className="grid gap-x-4 gap-y-7 md:grid-cols-2">
        {leaderboards.map((board) => (
          <section key={board.title} className="min-w-0">
            <h3 className="eyebrow mb-2">{board.title}</h3>
            <RankingTable
              className=""
              rows={board.rows}
              nameLabel="State"
              valueLabel={board.valueLabel}
              intensityLabel="Relative"
              color={board.color}
              badgeClassName="bg-foreground/15 text-foreground hover:bg-foreground/15"
            />
          </section>
        ))}
      </div>

      <SectionHeader id="trends" title="Trends">
        Non-Hispanic White share of the population and the presidential popular vote since 1960.
      </SectionHeader>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border bg-card shadow-none">
          <CardHeader className="pb-2">
            <CardTitle>Non-Hispanic White share</CardTitle>
            <CardDescription>Census, 1960 to 2025</CardDescription>
          </CardHeader>
          <CardContent>
            <NativeShareTrendChart country={us.country} hideSelector />
            <Separator className="my-4" />
            <Swatch color={COLORS.native} label="Non-Hispanic White share" />
          </CardContent>
        </Card>
        <Card className="border-border bg-card shadow-none">
          <CardHeader className="pb-2">
            <CardTitle>Presidential popular vote</CardTitle>
            <CardDescription>Democratic vs. Republican, 1960 to 2024</CardDescription>
          </CardHeader>
          <CardContent>
            <PoliticalLeanTrendChart country={us.country} hideSelector hideWings />
            <Separator className="my-4" />
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <Swatch color={COLORS.leftOfCenter} label="Democratic" />
              <Swatch color={COLORS.rightOfCenter} label="Republican" />
            </div>
          </CardContent>
        </Card>
      </div>

      <SectionHeader id="compare" title="How the US compares">
        Where the United States lands among all {demographicsData.length} countries in the data
        set.
      </SectionHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        {rankings.map((r) => (
          <Card key={r.label} className="border-border bg-card shadow-none">
            <CardContent className="flex items-center justify-between gap-4 pt-6">
              <div>
                <div className="eyebrow">{r.label}</div>
                <div className="tabular-nums font-medium" style={{ color: r.color }}>
                  {r.value}
                </div>
              </div>
              <Badge
                variant="secondary"
                className="min-w-10 justify-center rounded-full bg-foreground/15 text-foreground hover:bg-foreground/15"
              >
                {r.rank} / {r.total}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
      <Link href="/europe" className="group mt-4 block">
        <Card className="border-border bg-card shadow-none transition-colors group-hover:bg-muted/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Compare with Europe
              <ArrowRight className="size-4 text-muted-foreground" />
            </CardTitle>
            <CardDescription>
              Native share, Christian affiliation, and anti-immigration sentiment across{" "}
              {demographicsData.length - 1} European countries, down to the regional level.
            </CardDescription>
          </CardHeader>
        </Card>
      </Link>

      <footer className="fine-print mt-6 max-w-3xl">
        <strong className="font-semibold text-foreground">Notes:</strong> Non-Hispanic White uses
        Census Bureau estimates (2023 nationally; Vintage 2025 less Arab ancestry by state).
        Christian affiliation is from the Pew Religious Landscape Study 2023–24. Immigration
        enforcement tiers are from the ILRC State Map on Immigration Enforcement. Married
        homeowner at 30 is estimated from ACS 2024 1-year tables. Home affordability is median home
        value over median household income (ACS 2020–2024 5-year). Election results are certified
        2024 popular vote. Values are rounded.
      </footer>
    </main>
  )
}
