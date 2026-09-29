import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { PopulationStackChart } from "@/components/population-stack-chart"
import { PoliticalLeanTrendChart } from "@/components/political-lean-trend-chart"
import { StateCountyMap } from "@/components/state-county-map"
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
import { COUNTY_HISTORY_YEARS } from "@/lib/county-history"
import { COLORS, formatMedianAge, getCountryBySlug } from "@/lib/demographics"
import {
  POPULATION_GROUP_LABELS,
  POPULATION_LABEL_THRESHOLD,
  type PopulationGroup,
  latestPopulation,
  stackPopulationHistory,
} from "@/lib/states"
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
    title: `${state.state} — Demographics`,
    description: `Demographic breakdown and historical trends for ${state.state}.`,
  }
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 text-[17px] font-semibold tabular-nums" style={{ color }}>
        {value}
      </dd>
    </div>
  )
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <i
        className="inline-block size-3.5 rounded-[3px]"
        style={{ background: color }}
        aria-hidden
      />
      {label}
    </span>
  )
}

export default async function StatePage({
  params,
}: {
  params: Promise<{ state: string }>
}) {
  const { state: slug } = await params
  const state = getStateBySlug(slug)
  if (!state) notFound()

  const us = getCountryBySlug("united-states")
  const counties = getCounties(state)
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
      <header className="mb-7">
        <h1 className="sr-only">{state.state}</h1>
        <p className="page-sub">
          {state.population.toFixed(1)} million residents
        </p>
      </header>

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
          </dl>
        </CardContent>
      </Card>

      {counties.length > 0 && (
        <>
          <header className="mt-12 mb-7">
            <h2 className="section-title">European share by county</h2>
            <p className="section-sub">
              Non-Hispanic White minus Arab ancestry, % of population across all {counties.length}{" "}
              {state.state} {COUNTY_NOUN[state.abbr] ?? "counties"}, from 1990 to 2025. Drag the
              slider to change the year, hover a county to preview its figures, click to open its
              page — or browse the full list below.
            </p>
          </header>

          <Card className="border-border bg-card shadow-none">
            <CardContent>
              <StateCountyMap
                key={state.slug}
                state={state}
                counties={counties}
                years={COUNTY_HISTORY_YEARS}
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
          {state.sources.map((source) => (
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
          Asian group. Other covers Southeast Asian (mainly Vietnamese and Filipino), other South
          and Central Asian, American Indian, Pacific Islander, and multiracial residents. From
          2000 the broad groups use the Census population estimates, which assign &ldquo;some
          other race&rdquo; responses to a specific race. Before 2000 the Census published
          Hispanic origin only against non-Hispanic White, so African includes Hispanic Black
          residents, and Arab, Indian, and East Asian cannot be separated (shown as &mdash; and
          included in Other). The census did not tabulate Hispanic origin at all in 1960;
          Hispanic residents were classified as White, so a 1960 figure overstates non-Hispanic
          White relative to 1970 onward, when Hispanic origin was asked of a 15% sample. The 2025
          group splits use the 2024
          American Community Survey, the latest available. Decade points on the political
          chart use the nearest presidential election (1968, 1988, 2008, 2024); third-party
          candidates, such as George Wallace in 1968, are omitted, so the lines need not sum to
          100%. State GDP is shown in place of market capitalization, which is not published at
          the state level.
          {state.notes?.map((note) => ` ${note}.`)}
        </p>
      </footer>
    </main>
  )
}
