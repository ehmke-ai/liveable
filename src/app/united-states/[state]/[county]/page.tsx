import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { POPULATION_COLORS } from "@/components/population-stack-chart"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { COLORS, getCountryBySlug } from "@/lib/demographics"
import {
  countyEthnicBreakdown,
  countyLabel,
  countySlug,
  foldedCountyBreakdown,
  latestPopulation,
} from "@/lib/states"
import { getCounties, getCountyBySlug, getStateBySlug, statesData } from "@/lib/state-data"

export function generateStaticParams() {
  return statesData.flatMap((s) =>
    getCounties(s).map((c) => ({ state: s.slug, county: countySlug(c.name) }))
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string; county: string }>
}): Promise<Metadata> {
  const { state: stateSlug, county } = await params
  const state = getStateBySlug(stateSlug)
  const data = state && getCountyBySlug(state, county)
  if (!state || !data) return { title: "County not found" }
  return {
    title: `${countyLabel(data)}, ${state.state} — Demographics`,
    description: `Demographic breakdown for ${countyLabel(data)}, ${state.state}.`,
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

export default async function CountyPage({
  params,
}: {
  params: Promise<{ state: string; county: string }>
}) {
  const { state: stateSlug, county } = await params
  const state = getStateBySlug(stateSlug)
  if (!state) notFound()
  const data = getCountyBySlug(state, county)
  if (!data) notFound()

  const us = getCountryBySlug("united-states")
  const label = countyLabel(data)
  const statePopulation = latestPopulation(state)
  const breakdown = foldedCountyBreakdown(state, data)
  const countyEthnic = countyEthnicBreakdown(state, data)

  const comparison = [
    {
      label: "Non-Hispanic White",
      countyValue: data.nonHispanicWhitePct,
      state: `${Math.round((statePopulation.european + (statePopulation.arab ?? 0)) * 10) / 10}%`,
      us: us ? `${us.native}%` : "—",
      color: COLORS.native,
    },
    {
      label: "Hispanic",
      countyValue: data.hispanicPct,
      state: `${statePopulation.hispanic}%`,
      us: "—",
      color: POPULATION_COLORS.hispanic?.light,
    },
    {
      label: "Black or African American",
      countyValue: data.blackPct,
      state: `${statePopulation.african}%`,
      us: "—",
      color: POPULATION_COLORS.african?.light,
    },
    {
      label: "American Indian and Alaska Native",
      countyValue: data.aianPct,
      state: `${statePopulation.nativeAmerican}%`,
      us: "—",
      color: POPULATION_COLORS.nativeAmerican?.light,
    },
    {
      label: "Indian",
      countyValue: countyEthnic.indian,
      state: `${statePopulation.indian ?? "—"}${statePopulation.indian == null ? "" : "%"}`,
      us: "—",
      color: POPULATION_COLORS.indian?.light,
    },
    {
      label: "East Asian",
      countyValue: countyEthnic.eastAsian,
      state: `${statePopulation.eastAsian ?? "—"}${statePopulation.eastAsian == null ? "" : "%"}`,
      us: "—",
      color: POPULATION_COLORS.eastAsian?.light,
    },
  ].sort((a, b) => b.countyValue - a.countyValue)

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6">
      <header className="mb-7">
        <h1 className="sr-only">{label}</h1>
      </header>

      <Card className="border-border bg-card shadow-none">
        <CardHeader className="pb-2">
          <CardTitle>Snapshot</CardTitle>
          <CardDescription>
            Population by ethnic group, from the Census Bureau&rsquo;s American Community Survey.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            {breakdown.map((g) => (
              <Stat
                key={g.key}
                label={g.label}
                value={`${g.value}%`}
                color={POPULATION_COLORS[g.key]?.light}
              />
            ))}
          </dl>
        </CardContent>
      </Card>

      <header className="mt-12 mb-7">
        <h2 className="section-title">Compared with {state.state} and the United States</h2>
        <p className="section-sub">
          {label} next to the state and national figures used elsewhere on this
          site. A dash means the figure isn&rsquo;t published at that level of geography.
        </p>
      </header>

      <Card className="border-border bg-card shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Metric</TableHead>
                <TableHead className="text-right">{label}</TableHead>
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
                    {row.countyValue}%
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
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
          rounded and come from county-level ACS tables, which don&rsquo;t publish religion,
          median age, or the Arab-ancestry, Indian, and East Asian splits used at the state
          level. Asian here is split into Indian and East Asian using the state&rsquo;s own
          latest ratio between those two groups, since no county-level ancestry breakdown is
          published; the state and national comparison columns use the same broad groups as
          the rest of this site, so figures may not line up exactly with the raw ACS tables.
        </p>
      </footer>
    </main>
  )
}
