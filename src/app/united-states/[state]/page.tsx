import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"

import { PopulationStackChart } from "@/components/population-stack-chart"
import { PoliticalLeanTrendChart } from "@/components/political-lean-trend-chart"
import { StateCountyMap } from "@/components/state-county-map"
import { PageHeader, Stat, Swatch } from "@/components/topic-page"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  COST_SOURCES,
  costComparisonRows,
  formatDollars,
  formatRpp,
  stateCost,
  usCost,
} from "@/lib/cost-of-living"
import { COUNTY_HISTORY_YEARS } from "@/lib/county-history"
import { queryValue } from "@/lib/map-view"
import { COLORS, formatMedianAge, getCountryBySlug } from "@/lib/demographics"
import {
  POPULATION_GROUP_LABELS,
  POPULATION_LABEL_THRESHOLD,
  type PopulationGroup,
  latestPopulation,
  stackPopulationHistory,
  stateNav,
  stateNavByAbbr,
} from "@/lib/states"
import { STATE_NEIGHBORS } from "@/lib/state-neighbors"
import { getCounties, getStateBySlug, statesData } from "@/lib/state-data"

const COUNTY_NOUN: Record<string, string> = {
  AK: "boroughs and census areas",
  LA: "parishes",
}

export function generateStaticParams() {
  return statesData.map((s) => ({ state: s.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string }>
}): Promise<Metadata> {
  const { state: slug } = await params
  const state = getStateBySlug(slug)
  if (!state) return { title: "State not found" }
  return {
    title: state.state,
    description: `Demographic breakdown and historical trends for ${state.state}.`,
  }
}

export default async function StatePage({
  params,
  searchParams,
}: {
  params: Promise<{ state: string }>
  searchParams: Promise<{ view?: string | string[] }>
}) {
  const { state: slug } = await params
  const query = await searchParams
  const state = getStateBySlug(slug)
  if (!state) notFound()

  const us = getCountryBySlug("united-states")
  const counties = getCounties(state)
  const neighbors = (STATE_NEIGHBORS[state.abbr] ?? [])
    .map((abbr) => stateNavByAbbr[abbr])
    .filter(Boolean)
    .sort((a, b) => a.state.localeCompare(b.state))
  const index = stateNav.findIndex((s) => s.slug === state.slug)
  const prev = stateNav[(index - 1 + stateNav.length) % stateNav.length]
  const next = stateNav[(index + 1) % stateNav.length]
  const population = latestPopulation(state)
  const stacked = stackPopulationHistory(state.populationHistory)
  const groups = Object.keys(POPULATION_GROUP_LABELS) as PopulationGroup[]
  const nonHispanicWhite = Math.round((population.european + (population.arab ?? 0)) * 10) / 10

  // Snapshot card: same fold-below-threshold-into-Other logic as the ethnic group chart,
  // but at 2% instead of POPULATION_LABEL_THRESHOLD (3%).
  const SNAPSHOT_GROUP_THRESHOLD = 2
  const snapshotGroups = groups
    .filter((g) => (population[g] ?? 0) >= SNAPSHOT_GROUP_THRESHOLD)
    .sort((a, b) => (population[b] ?? 0) - (population[a] ?? 0))
  const foldedSnapshotGroups = groups.filter((g) => !snapshotGroups.includes(g))
  const snapshotOther =
    Math.round(
      (population.other + foldedSnapshotGroups.reduce((sum, g) => sum + (population[g] ?? 0), 0)) *
        10
    ) / 10

  const cost = stateCost[state.abbr]
  const costRows = costComparisonRows([cost, usCost])

  const comparison = us
    ? [
        { label: "Non-Hispanic White", state: `${nonHispanicWhite}%`, us: `${us.native}%`, color: COLORS.native },
        { label: "Catholic", state: `${state.catholic}%`, us: `${us.catholic}%`, color: COLORS.catholic },
        { label: "Protestant", state: `${state.protestant}%`, us: `${us.protestant}%`, color: COLORS.protestant },
        { label: "Orthodox", state: `${state.orthodox}%`, us: `${us.orthodox}%`, color: COLORS.orthodox },
        {
          label: "Non-Hispanic White median age",
          state: `${formatMedianAge(state.medianAge)} yrs`,
          us: `${formatMedianAge(us.medianAge)} yrs`,
          color: COLORS.medianAge,
        },
      ]
    : []

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="United States"
        title={state.state}
        description={`${state.population.toFixed(1)} million residents`}
      />

      <Card className="border-border bg-card shadow-none">
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            {snapshotGroups.map((g) => (
              <Stat
                key={g}
                label={POPULATION_GROUP_LABELS[g]}
                value={`${population[g] ?? "—"}%`}
                color={g === "european" ? COLORS.native : undefined}
              />
            ))}
            {snapshotOther >= SNAPSHOT_GROUP_THRESHOLD && (
              <Stat label="Other" value={`${snapshotOther}%`} />
            )}
            <Stat label="Foreign-born" value={`${state.foreignBorn}%`} />
            <Stat label="Catholic" value={`${state.catholic}%`} color={COLORS.catholic} />
            <Stat label="Protestant" value={`${state.protestant}%`} color={COLORS.protestant} />
            <Stat label="Orthodox" value={`${state.orthodox}%`} color={COLORS.orthodox} />
            <Stat
              label="Non-Hispanic White median age"
              value={`${formatMedianAge(state.medianAge)} yrs`}
              color={COLORS.medianAge}
            />
            <Stat label="Median age (all)" value={`${formatMedianAge(state.medianAgeAll)} yrs`} />
            <Stat
              label="Fishback benchmark"
              value={`${state.thirtyMarriedHomeowner}%`}
              color={COLORS.thirtyMarriedHomeowner}
            />
            <Stat label="Price level (US = 100)" value={formatRpp(cost.rpp)} color={COLORS.costOfLiving} />
            <Stat
              label="Median home value"
              value={formatDollars(cost.medianHomeValue)}
              color={COLORS.costOfLiving}
            />
          </dl>
        </CardContent>
      </Card>

      {counties.length > 0 && (
        <>
          <header className="mt-12 mb-7">
            <h2 className="section-title">Counties</h2>
            <p className="section-sub">
              Demographics, the 2024 election, religion, cost of living, and certified work visas across all {counties.length}{" "}
              {state.state} {COUNTY_NOUN[state.abbr] ?? "counties"}. Switch views above the map,
              hover a county to preview its figures, click to open its page — or browse the full
              list below.
            </p>
          </header>

          <Card className="border-border bg-card shadow-none">
            <CardContent>
              <StateCountyMap
                key={state.slug}
                state={state}
                counties={counties}
                years={COUNTY_HISTORY_YEARS}
                viewQuery={queryValue(query.view)}
              />
            </CardContent>
          </Card>
        </>
      )}

      {us && (
        <>
          <header className="mt-12 mb-7">
            <h2 className="section-title">
              Compared with the United States
            </h2>
            <p className="section-sub">
              {state.state} next to the national figures used elsewhere on this site.
            </p>
          </header>

          <Card className="border-border bg-card shadow-none">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Metric</TableHead>
                    <TableHead className="text-right">{state.state}</TableHead>
                    <TableHead className="text-right">United States</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparison.map((row) => (
                    <TableRow key={row.label}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell
                        className="text-right font-medium tabular-nums"
                        style={{ color: row.color }}
                      >
                        {row.state}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {row.us}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <header className="mt-12 mb-7">
        <h2 className="section-title">Cost of living</h2>
        <p className="section-sub">
          Prices, incomes, and housing costs in {state.state} next to the national figures.
        </p>
      </header>

      <Card className="border-border bg-card shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Metric</TableHead>
                <TableHead className="text-right">{state.state}</TableHead>
                <TableHead className="text-right">United States</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costRows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell
                    className="text-right font-medium tabular-nums"
                    style={{ color: COLORS.costOfLiving }}
                  >
                    {row.values[0]}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.values[1]}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <header className="mt-12 mb-7">
        <h2 className="section-title">Population by ethnic group</h2>
        <p className="section-sub">
          Share of the population from {state.populationHistory[0].year} to{" "}
          {state.populationHistory[state.populationHistory.length - 1].year}, from the Census
          Bureau. Groups under{" "}
          {POPULATION_LABEL_THRESHOLD}% today are combined into Other on the chart; the table
          lists every group.
        </p>
      </header>

      <Card className="border-border bg-card shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="sr-only">Population by ethnic group chart</CardTitle>
          <CardDescription className="sr-only">
            Stacked area chart of population share by ethnic group over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PopulationStackChart series={stacked.series} data={stacked.data} />
        </CardContent>
      </Card>

      <Card className="mt-7 border-border bg-card shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Year</TableHead>
                {groups.map((g) => (
                  <TableHead key={g} className="text-right">
                    {POPULATION_GROUP_LABELS[g]}
                  </TableHead>
                ))}
                <TableHead className="text-right">Other</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.populationHistory.map((row) => (
                <TableRow key={row.year}>
                  <TableCell className="font-medium tabular-nums">{row.year}</TableCell>
                  {groups.map((g) => (
                    <TableCell key={g} className="text-right tabular-nums">
                      {row[g] == null ? "—" : `${row[g]}%`}
                    </TableCell>
                  ))}
                  <TableCell className="text-right tabular-nums">{row.other}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <header className="mt-12 mb-7">
        <h2 className="section-title">Political leanings over time</h2>
        <p className="section-sub">
          Presidential popular vote in {state.state}, Democratic vs. Republican, 1960 to 2024.
        </p>
      </header>

      <Card className="border-border bg-card shadow-none">
        <CardContent>
          <PoliticalLeanTrendChart data={state.politicalLeanHistory} hideSelector hideWings />
          <Separator className="my-4" />
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Swatch color={COLORS.leftOfCenter} label="Democratic (left of center)" />
            <Swatch color={COLORS.rightOfCenter} label="Republican (right of center)" />
          </div>
        </CardContent>
      </Card>

      <footer className="fine-print mt-12 border-t border-border pt-6">
        <h2 className="section-title mb-3">Sources</h2>
        <ul className="grid gap-3">
          {[...state.sources, ...COST_SOURCES].map((source) => (
            <li key={source.url}>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground hover:underline"
              >
                {source.label}
              </a>
              <span className="block">{source.detail}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-3xl">
          <strong className="font-semibold text-foreground">Notes:</strong> Figures are
          rounded. Groups are built from Census Bureau race, Hispanic-origin, Asian-group, and
          ancestry tables. Hispanic is of any race; every other group is non-Hispanic. European
          is non-Hispanic White minus people reporting Arab ancestry (the Census counts Arab
          Americans as White; ancestry is asked separately, so this subtraction is approximate).
          African is Black or African American. Indian is Asian Indian, Pakistani, and
          Bangladeshi; East Asian follows the Census East Asian grouping (Chinese, Taiwanese,
          Japanese, Korean, Mongolian, Okinawan, Hmong). Both count people reporting a single
          Asian group. Native American is American Indian and Alaska Native. Other covers
          Southeast Asian (mainly Vietnamese and Filipino), other South and Central Asian, Pacific
          Islander, and multiracial residents. From
          2000 the broad groups use the Census population estimates, which assign &ldquo;some
          other race&rdquo; responses to a specific race. Before 2000 the Census published
          Hispanic origin only against non-Hispanic White, so African and Native American include
          Hispanic Black and Hispanic American Indian residents, and Arab, Indian, and East Asian cannot be separated (shown as &mdash; and
          included in Other). The census did not tabulate Hispanic origin at all in 1960;
          Hispanic residents were classified as White, so a 1960 figure overstates non-Hispanic
          White relative to 1970 onward, when Hispanic origin was asked of a 15% sample. The 2025
          group splits use the 2024
          American Community Survey, the latest available. Decade points on the political
          chart use the nearest presidential election (1968, 1988, 2008, 2024); third-party
          candidates, such as George Wallace in 1968, are omitted, so the lines need not sum to
          100%. State GDP is shown in place of market capitalization, which is not published at
          the state level. Price levels are BEA Regional Price Parities for 2024; incomes, home
          values, and rents are ACS 2020–2024 5-year medians, so they trail current prices.
          {state.notes?.map((note) => ` ${note}.`)}
        </p>
      </footer>

      <nav aria-label="Other states" className="mt-12 space-y-4 border-t pt-6">
        {neighbors.length > 0 && (
          <div>
            <h2 className="eyebrow mb-2">Neighboring states</h2>
            <div className="flex flex-wrap gap-2">
              {neighbors.map((n) => (
                <Button key={n.slug} asChild size="sm" variant="secondary">
                  <Link href={`/united-states/${n.slug}`}>{n.state}</Link>
                </Button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <Link href={`/united-states/${prev.slug}`} className="text-muted-foreground hover:underline">
            ← {prev.state}
          </Link>
          <Link href="/states" className="text-muted-foreground hover:underline">
            All states
          </Link>
          <Link href={`/united-states/${next.slug}`} className="text-muted-foreground hover:underline">
            {next.state} →
          </Link>
        </div>
      </nav>
    </main>
  )
}
