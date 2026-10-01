import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { EuropeRegionMap } from "@/components/europe-region-map"
import { NativeShareTrendChart } from "@/components/native-share-trend-chart"
import { PoliticalLeanTrendChart } from "@/components/political-lean-trend-chart"
import { UsCountyMap, type UsCountyRow } from "@/components/us-county-map"
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
import {
  COLORS,
  demographicsData,
  formatMarketCap,
  formatMedianAge,
  getCountryBySlug,
  getCountryRankings,
  slugify,
} from "@/lib/demographics"
import { COUNTY_HISTORY_YEARS } from "@/lib/county-history"
import { getCounties, statesData } from "@/lib/state-data"
import { countyLabel } from "@/lib/states"

// County labels and state abbreviations (keyed by state FIPS) for the Demographics map's
// tooltip; the figures themselves load client-side from county-history.json
function usCountyMapData(): { counties: UsCountyRow[]; states: Record<string, string> } {
  const counties: UsCountyRow[] = []
  const states: Record<string, string> = {}
  for (const state of statesData) {
    const stateCounties = getCounties(state)
    if (!stateCounties.length) continue
    states[stateCounties[0].fips.slice(0, 2)] = state.abbr
    for (const c of stateCounties) counties.push([c.fips, countyLabel(c)])
  }
  return { counties, states }
}

export function generateStaticParams() {
  return demographicsData.map((d) => ({ slug: slugify(d.country) }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const country = getCountryBySlug(slug)
  if (!country) return { title: "Country not found" }
  return {
    title: `${country.country} — Demographics`,
    description: `Demographic breakdown, rankings, and historical trends for ${country.country}.`,
  }
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 text-[17px] font-semibold tabular-nums" style={{ color }}>
        {value}
      </dd>
    </div>
  )
}

export default async function CountryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const country = getCountryBySlug(slug)
  if (!country) notFound()

  const rankings = getCountryRankings(country.country)
  const isUnitedStates = country.country === "United States"
  const countyMapData = isUnitedStates ? usCountyMapData() : null

  const snapshotCard = (
    <Card className="border-border bg-card shadow-none">
      <CardHeader className="pb-2">
        <CardTitle>Snapshot</CardTitle>
        <CardDescription>Current approximate figures</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Stat label="Native / european" value={`${country.native}%`} color={COLORS.native} />
          <Stat label="Catholic" value={`${country.catholic}%`} color={COLORS.catholic} />
          <Stat label="Protestant" value={`${country.protestant}%`} color={COLORS.protestant} />
          <Stat label="Orthodox" value={`${country.orthodox}%`} color={COLORS.orthodox} />
          <Stat
            label="Anti-immigration"
            value={`${country.antiImmig}%`}
            color={COLORS.anti}
          />
          <Stat
            label="Market cap"
            value={formatMarketCap(country.marketCap)}
            color={COLORS.marketCap}
          />
          <Stat
            label="Native median age"
            value={`${formatMedianAge(country.medianAge)} yrs`}
            color={COLORS.medianAge}
          />
        </dl>
      </CardContent>
    </Card>
  )

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6">
      <h1 className="sr-only">{country.country}</h1>

      {!isUnitedStates && (
        <>
          {snapshotCard}

          <header className="mt-12 mb-7">
            <h2 className="section-title">Origin and religion by region</h2>
            <p className="section-sub">
              Where residents of each of {country.country}&apos;s regions were born, from the 2021
              census, and their religion where it&apos;s recorded regionally. Hover a region for its
              full breakdown and top countries of birth.
            </p>
          </header>
          <EuropeRegionMap country={country.country} />
        </>
      )}

      {countyMapData && (
        <>

          <UsMap
            countyMap={<UsCountyMap {...countyMapData} years={COUNTY_HISTORY_YEARS} />}
            electionCounties={countyMapData}
          />

          <header className="mt-12 mb-7">
            <h2 className="section-title">Snapshot</h2>
          </header>

          {snapshotCard}
        </>
      )}

      <header className="mt-12 mb-7">
        <h2 className="section-title">Rankings</h2>
        <p className="section-sub">
          Where {country.country} lands among all {demographicsData.length} countries in the
          data set.
        </p>
      </header>

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

      <header className="mt-12 mb-7">
        <h2 className="section-title">Native / european share over time</h2>
        <p className="section-sub">
          Approximate native / european population share from 1960 to 2025.
        </p>
      </header>

      <Card className="border-border bg-card shadow-none">
        <CardContent>
          <NativeShareTrendChart country={country.country} hideSelector />
          <Separator className="my-4" />
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <i
              className="inline-block size-3.5 rounded-[3px]"
              style={{ background: COLORS.native }}
              aria-hidden
            />
            Native / european population share
          </span>
        </CardContent>
      </Card>

      <header className="mt-12 mb-7">
        <h2 className="section-title">Political leanings over time</h2>
        <p className="section-sub">
          {isUnitedStates
            ? "Presidential popular vote, Democratic vs. Republican, 1960 to 2024."
            : "Parliamentary vote share in four left–right bands from 1960 to 2025."}
        </p>
      </header>

      <Card className="border-border bg-card shadow-none">
        <CardContent>
          <PoliticalLeanTrendChart country={country.country} hideSelector hideWings={isUnitedStates} />
          <Separator className="my-4" />
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {!isUnitedStates && (
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <i
                  className="inline-block size-3.5 rounded-[3px]"
                  style={{ background: COLORS.leftWing }}
                  aria-hidden
                />
                Left wing
              </span>
            )}
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <i
                className="inline-block size-3.5 rounded-[3px]"
                style={{ background: COLORS.leftOfCenter }}
                aria-hidden
              />
              Left of center
            </span>
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <i
                className="inline-block size-3.5 rounded-[3px]"
                style={{ background: COLORS.rightOfCenter }}
                aria-hidden
              />
              Right of center
            </span>
            {!isUnitedStates && (
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <i
                  className="inline-block size-3.5 rounded-[3px]"
                  style={{ background: COLORS.rightWing }}
                  aria-hidden
                />
                Right wing
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
