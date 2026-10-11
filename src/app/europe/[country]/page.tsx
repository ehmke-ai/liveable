import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { EuropeRegionMap } from "@/components/europe-region-map"
import { NativeShareTrendChart } from "@/components/native-share-trend-chart"
import { PoliticalLeanTrendChart } from "@/components/political-lean-trend-chart"
import { PageHeader, Stat, Swatch } from "@/components/topic-page"
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

export function generateStaticParams() {
  return demographicsData
    .filter((d) => d.country !== "United States")
    .map((d) => ({ country: slugify(d.country) }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ country: string }>
}): Promise<Metadata> {
  const { country: slug } = await params
  const country = getCountryBySlug(slug)
  if (!country || country.country === "United States") return { title: "Country not found" }
  return {
    title: country.country,
    description: `Demographic breakdown, rankings, and historical trends for ${country.country}.`,
  }
}

export default async function CountryPage({
  params,
}: {
  params: Promise<{ country: string }>
}) {
  const { country: slug } = await params
  const country = getCountryBySlug(slug)
  if (!country || country.country === "United States") notFound()

  const rankings = getCountryRankings(country.country)

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="Europe"
        title={country.country}
        description={`Demographic breakdown, rankings, and historical trends for ${country.country}.`}
      />

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

      <header className="mt-12 mb-7">
        <h2 className="section-title">Origin and religion by region</h2>
        <p className="section-sub">
          Where residents of each of {country.country}&apos;s regions were born, from the 2021
          census, and their religion where it&apos;s recorded regionally. Hover a region for its
          full breakdown and top countries of birth.
        </p>
      </header>
      <EuropeRegionMap country={country.country} />

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
          <Swatch color={COLORS.native} label="Native / european population share" />
        </CardContent>
      </Card>

      <header className="mt-12 mb-7">
        <h2 className="section-title">Political leanings over time</h2>
        <p className="section-sub">
          Parliamentary vote share in four left–right bands from 1960 to 2025.
        </p>
      </header>

      <Card className="border-border bg-card shadow-none">
        <CardContent>
          <PoliticalLeanTrendChart country={country.country} hideSelector />
          <Separator className="my-4" />
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Swatch color={COLORS.leftWing} label="Left wing" />
            <Swatch color={COLORS.leftOfCenter} label="Left of center" />
            <Swatch color={COLORS.rightOfCenter} label="Right of center" />
            <Swatch color={COLORS.rightWing} label="Right wing" />
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
