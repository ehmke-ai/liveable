"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, type ReactNode } from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { POPULATION_COLORS } from "@/components/population-stack-chart"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import countyLabels from "@/data/county-labels.json"
import countyFips from "@/data/county-fips.json"
import schools from "@/data/schools.json"
import stateGenerationPop from "@/data/state-generation-pop.json"
import {
  COUNTY_HISTORY_YEARS,
  CT_FIPS,
  groupShare,
  type CountyHistory,
} from "@/lib/county-history"
import { stateNav, stateNavBySlug } from "@/lib/states"
import {
  DEMOGRAPHIC_GROUPS,
  FED_WEALTH,
  FIELD_CITIZENSHIP_YEAR,
  fedWealth,
  fieldLabor,
  GENERATIONS,
  generation,
  MIN_FIELD_SAMPLE,
  VISA_PROGRAMS,
  WEALTH_QUARTER,
  WORK_FIELDS,
  workField,
  type FieldLabor,
  type GenerationId,
  type VisaProgramId,
  type WorkFieldId,
} from "@/lib/where-you-stand"

type FieldFile = Record<string, Partial<Record<WorkFieldId, Partial<Record<VisaProgramId, number>>>>>
type PopFile = Record<string, Record<GenerationId, number>>
type SchoolProgramId = "h1b" | "specialty" | "perm"
type SchoolVisa = Partial<Record<SchoolProgramId, number>> & {
  fields?: Partial<Record<WorkFieldId, Partial<Record<SchoolProgramId, number>>>>
  jobs?: [string, WorkFieldId, number][]
}
type SchoolFile = Record<string, SchoolVisa>
type SchoolOption = { value: string; label: string }

const labels = countyLabels as Record<string, Record<string, string>>
const fipsByPlace = countyFips as Record<string, Record<string, string>>
const population = stateGenerationPop as PopFile
const schoolRows = schools as { id: string; name: string; city: string; state: string }[]
const schoolOptions: SchoolOption[] = schoolRows.map((row) => ({
  value: row.id,
  label: [row.name, row.city, row.state].filter(Boolean).join(", "),
}))
const schoolById = new Map(schoolOptions.map((row) => [row.value, row]))

const FIELD_URL = "/data/county-visa-fields.json"
const HISTORY_URL = "/data/county-history.json"
const SCHOOL_URL = "/data/school-visas.json"

const SCHOOL_PROGRAMS = VISA_PROGRAMS.filter(
  (program): program is (typeof VISA_PROGRAMS)[number] & { id: SchoolProgramId } =>
    program.id === "h1b" || program.id === "specialty" || program.id === "perm"
)

function countiesIn(stateSlug: string): { slug: string; label: string }[] {
  const rows = labels[stateSlug]
  if (rows) {
    return Object.entries(rows)
      .map(([slug, label]) => ({ slug, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }
  if (stateSlug === "district-of-columbia") {
    return [{ slug: "district-of-columbia", label: "District of Columbia" }]
  }
  return []
}

function formatCount(value: number): string {
  return value.toLocaleString("en-US")
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`
}

export function WhereYouStand() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const stateSlug = searchParams.get("state")
  const countySlug = searchParams.get("county")
  const groupId = searchParams.get("group")
  const fieldId = searchParams.get("field")
  const generationId = searchParams.get("generation")
  const schoolId = searchParams.get("school")

  const state = stateSlug ? stateNavBySlug[stateSlug] : undefined
  const counties = state ? countiesIn(state.slug) : []
  const county = counties.find((row) => row.slug === countySlug)
  const group = DEMOGRAPHIC_GROUPS.find((row) => row.id === groupId)
  const field = workField(fieldId)
  const cohort = generation(generationId)
  const school = schoolId ? schoolById.get(schoolId) : undefined
  const fips = state && county ? fipsByPlace[state.slug]?.[county.slug] : undefined

  function write(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    const query = params.toString()
    router.replace(query ? `/you?${query}` : "/you", { scroll: false })
  }

  const ready = Boolean(state && county && fips && field && cohort)

  return (
    <div className="flex flex-col gap-6">
      <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(event) => event.preventDefault()}>
        <Field label="State" htmlFor="you-state">
          <Select
            value={state?.slug}
            onValueChange={(value) => write({ state: value, county: null })}
          >
            <SelectTrigger id="you-state" className="w-full">
              <SelectValue placeholder="Select a state" />
            </SelectTrigger>
            <SelectContent>
              {stateNav.map((row) => (
                <SelectItem key={row.abbr} value={row.slug}>
                  {row.state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="County" htmlFor="you-county">
          <Select
            value={county?.slug}
            disabled={!state}
            onValueChange={(value) => write({ county: value })}
          >
            <SelectTrigger id="you-county" className="w-full">
              <SelectValue placeholder={state ? "Select a county" : "Select a state first"} />
            </SelectTrigger>
            <SelectContent>
              {counties.map((row) => (
                <SelectItem key={row.slug} value={row.slug}>
                  {row.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Work field" htmlFor="you-field">
          <Select value={field?.id} onValueChange={(value) => write({ field: value })}>
            <SelectTrigger id="you-field" className="w-full">
              <SelectValue placeholder="Select a field" />
            </SelectTrigger>
            <SelectContent>
              {WORK_FIELDS.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Generation" htmlFor="you-generation">
          <Select
            value={cohort?.id}
            onValueChange={(value) => write({ generation: value })}
          >
            <SelectTrigger id="you-generation" className="w-full">
              <SelectValue placeholder="Select a generation" />
            </SelectTrigger>
            <SelectContent>
              {GENERATIONS.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.label} ({row.born})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="College or university" htmlFor="you-school" optional>
          <Combobox
            items={schoolOptions}
            value={school?.value ?? null}
            limit={50}
            onValueChange={(value) => write({ school: value })}
          >
            <ComboboxInput
              id="you-school"
              placeholder="Search a college or university"
              showClear={Boolean(school)}
              className="w-full"
            />
            <ComboboxContent>
              <ComboboxEmpty>No college or university found.</ComboboxEmpty>
              <ComboboxList>
                {(option: SchoolOption) => (
                  <ComboboxItem key={option.value} value={option.value}>
                    {option.label}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </Field>

        <Field label="Demographic" htmlFor="you-group" optional>
          <Select value={group?.id} onValueChange={(value) => write({ group: value })}>
            <SelectTrigger id="you-group" className="w-full">
              <SelectValue placeholder="Select a group" />
            </SelectTrigger>
            <SelectContent>
              {DEMOGRAPHIC_GROUPS.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </form>

      {ready && state && county && fips && field && cohort ? (
        <Results
          stateSlug={state.slug}
          stateName={state.state}
          abbr={state.abbr}
          countySlug={county.slug}
          countyLabel={county.label}
          fips={fips}
          groupId={group?.id}
          groupLabel={group?.label}
          fieldId={field.id}
          fieldLabel={field.label}
          generationId={cohort.id}
          schoolId={school?.value}
          schoolLabel={school?.label}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Choose a state, county, work field, and generation.
        </p>
      )}
    </div>
  )
}

function Field({
  label,
  htmlFor,
  optional,
  children,
}: {
  label: string
  htmlFor: string
  optional?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm text-muted-foreground">
        {label}
        {optional ? " (optional)" : ""}
      </label>
      {children}
    </div>
  )
}

function Results(props: {
  stateSlug: string
  stateName: string
  abbr: string
  countySlug: string
  countyLabel: string
  fips: string
  groupId?: (typeof DEMOGRAPHIC_GROUPS)[number]["id"]
  groupLabel?: string
  fieldId: WorkFieldId
  fieldLabel: string
  generationId: GenerationId
  schoolId?: string
  schoolLabel?: string
}) {
  const fields = useJson<FieldFile>(FIELD_URL)
  const history = useJson<CountyHistory>(HISTORY_URL)
  const failed = fields.error || history.error
  const loading = !failed && (!fields.data || !history.data)

  return (
    <div className="flex flex-col gap-6">
      {failed && (
        <p className="text-sm text-muted-foreground">The county figures did not load.</p>
      )}
      {loading && <p className="text-sm text-muted-foreground">Loading county figures…</p>}
      {props.schoolId && props.schoolLabel && (
        <SchoolCard schoolId={props.schoolId} schoolLabel={props.schoolLabel} fieldId={props.fieldId} fieldLabel={props.fieldLabel} />
      )}
      <FieldLaborCard {...props} />
      {fields.data && <VisaCard {...props} fields={fields.data} />}
      <WealthCard {...props} />
      {history.data && props.groupId && props.groupLabel && (
        <ShareChart
          countyLabel={props.countyLabel}
          fips={props.fips}
          groupId={props.groupId}
          groupLabel={props.groupLabel}
          history={history.data}
        />
      )}
    </div>
  )
}

function laborTotal(cell: FieldLabor): number {
  return cell.citizen + cell.noncitizen
}

function laborPct(cell: FieldLabor, key: "citizen" | "naturalized" | "noncitizen"): number {
  return (cell[key] / laborTotal(cell)) * 100
}

function FieldLaborCard({
  stateName,
  abbr,
  fieldId,
  fieldLabel,
}: {
  stateName: string
  abbr: string
  fieldId: WorkFieldId
  fieldLabel: string
}) {
  const stateCell = fieldLabor(abbr, fieldId)
  const usCell = fieldLabor("US", fieldId)
  if (!usCell || laborTotal(usCell) <= 0) return null
  const stateOk = Boolean(stateCell && stateCell.n >= MIN_FIELD_SAMPLE && laborTotal(stateCell) > 0)
  const focus = stateOk && stateCell ? stateCell : usCell
  const noncitizen = laborPct(focus, "noncitizen")
  const citizen = laborPct(focus, "citizen")
  const naturalized = laborPct(focus, "naturalized")
  const field = fieldLabel.toLowerCase()
  const place = stateOk ? stateName : "the United States"
  const rows = [
    { id: "citizen", label: "U.S. citizens", share: citizen, highlight: false },
    { id: "noncitizen", label: "Non-citizens", share: noncitizen, highlight: true },
  ]

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader>
        <CardTitle className="text-4xl font-semibold tabular-nums">{formatPct(noncitizen)}</CardTitle>
        <CardDescription>
          {stateOk
            ? `Not U.S. citizens among people working in ${field} in ${stateName}, ${FIELD_CITIZENSHIP_YEAR}. Nationwide, ${formatPct(laborPct(usCell, "noncitizen"))}.`
            : `${stateName}’s ${FIELD_CITIZENSHIP_YEAR} sample of people working in ${field} is too small, so this is the U.S. share.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[8.5rem_minmax(0,1fr)_3.25rem] items-center gap-3 text-sm"
          >
            <span className={row.highlight ? "font-semibold" : "text-muted-foreground"}>{row.label}</span>
            <span className="block h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${row.share}%`,
                  background: row.highlight ? "var(--chart-1)" : "var(--muted-foreground)",
                  opacity: row.highlight ? 1 : 0.45,
                }}
              />
            </span>
            <span className="text-right tabular-nums">{formatPct(row.share)}</span>
          </div>
        ))}
        <p className="text-sm text-muted-foreground">
          Citizens include naturalized citizens, {formatPct(naturalized)} of workers in this field in{" "}
          {place}. Non-citizens include green-card holders, temporary workers such as H-1B, refugees,
          and people without status who answered the survey. The American Community Survey records
          citizenship and has no visa class. The county figure below is certified job slots in this
          occupation, for the county rather than the state.
        </p>
      </CardContent>
    </Card>
  )
}

function VisaCard({
  stateSlug,
  countySlug,
  countyLabel,
  fips,
  fieldId,
  fieldLabel,
  fields,
}: {
  stateSlug: string
  countySlug: string
  countyLabel: string
  fips: string
  fieldId: WorkFieldId
  fieldLabel: string
  fields: FieldFile
}) {
  const buckets = fields[fips] ?? {}
  const programs = buckets[fieldId] ?? {}
  const count = VISA_PROGRAMS.reduce((sum, program) => sum + (programs[program.id] ?? 0), 0)
  const countyTotal = Object.values(buckets).reduce((sum, row) => {
    return sum + VISA_PROGRAMS.reduce((inner, program) => inner + (row?.[program.id] ?? 0), 0)
  }, 0)
  const share = countyTotal > 0 ? (count / countyTotal) * 100 : null
  const rows = VISA_PROGRAMS.flatMap((program) => {
    const value = programs[program.id] ?? 0
    return value > 0 ? [{ ...program, value }] : []
  })
  const placeHref =
    stateSlug === "district-of-columbia"
      ? "/united-states/district-of-columbia"
      : `/united-states/${stateSlug}/${countySlug}`

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader>
        <CardTitle className="text-4xl font-semibold tabular-nums">{formatCount(count)}</CardTitle>
        <CardDescription>
          {count === 0
            ? `No certified foreign-worker job filings in ${fieldLabel.toLowerCase()} in ${countyLabel}, FY 2025.`
            : `Certified foreign-worker job filings in ${fieldLabel.toLowerCase()} in ${countyLabel}, FY 2025.`}
          {share != null && count > 0 && (
            <>
              {" "}
              That is {formatPct(share)} of this county’s certified filings ({formatCount(countyTotal)}).
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {rows.length > 0 && (
          <ul className="mb-3 flex flex-col gap-1.5 text-foreground">
            {rows.map((row) => (
              <li key={row.id} className="flex items-baseline justify-between gap-4">
                <span>{row.label}</span>
                <span className="tabular-nums">{formatCount(row.value)}</span>
              </li>
            ))}
          </ul>
        )}
        <p>
          Certified job slots in this occupation, not people living in the county. The same
          worker can be counted twice when an employer certifies both a temporary visa and a
          green card in the same year. L-1, TN, O-1, student work permits, and green cards
          that skip labor certification are not in these files.
        </p>
        <p className="mt-3">
          <Link href={placeHref} className="text-foreground underline-offset-2 hover:underline">
            {countyLabel} profile
          </Link>
          {" · "}
          <Link href="/work-visas" className="text-foreground underline-offset-2 hover:underline">
            Work visas
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

function schoolProgramTotal(row: Partial<Record<SchoolProgramId, number>> | undefined): number {
  return SCHOOL_PROGRAMS.reduce((sum, program) => sum + (row?.[program.id] ?? 0), 0)
}

function SchoolCard({
  schoolId,
  schoolLabel,
  fieldId,
  fieldLabel,
}: {
  schoolId: string
  schoolLabel: string
  fieldId: WorkFieldId
  fieldLabel: string
}) {
  const file = useJson<SchoolFile>(SCHOOL_URL)
  if (file.error) {
    return <p className="text-sm text-muted-foreground">The school figures did not load.</p>
  }
  if (!file.data) {
    return <p className="text-sm text-muted-foreground">Loading school figures…</p>
  }
  const school = file.data[schoolId]
  if (!school) {
    return (
      <p className="text-sm text-muted-foreground">
        No FY 2025 certified filings for {schoolLabel}.
      </p>
    )
  }
  const fieldPrograms = school.fields?.[fieldId]
  const fieldCount = schoolProgramTotal(fieldPrograms)
  const schoolTotal = schoolProgramTotal(school)
  const share = schoolTotal > 0 ? (fieldCount / schoolTotal) * 100 : null
  const programRows = SCHOOL_PROGRAMS.flatMap((program) => {
    const value = fieldPrograms?.[program.id] ?? 0
    return value > 0 ? [{ ...program, value }] : []
  })
  const jobs = school.jobs ?? []
  const matching = jobs.filter((job) => job[1] === fieldId)
  const others = jobs.filter((job) => job[1] !== fieldId)
  const field = fieldLabel.toLowerCase()

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader>
        <CardTitle className="text-4xl font-semibold tabular-nums" style={{ color: "var(--chart-1)" }}>
          {formatCount(fieldCount)}
        </CardTitle>
        <CardDescription>
          {fieldCount === 0
            ? `No certified foreign-worker positions in ${field} at ${schoolLabel}, FY 2025.`
            : `Certified foreign-worker positions in ${field} at ${schoolLabel}, FY 2025.`}
          {share != null && fieldCount > 0 && (
            <>
              {" "}
              That is {formatPct(share)} of this school’s certified positions ({formatCount(schoolTotal)}).
            </>
          )}
          {share != null && fieldCount === 0 && schoolTotal > 0 && (
            <> The school certified {formatCount(schoolTotal)} positions in other fields.</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {programRows.length > 0 && (
          <ul className="mb-4 flex flex-col gap-1.5 text-foreground">
            {programRows.map((row) => (
              <li key={row.id} className="flex items-baseline justify-between gap-4 text-foreground">
                <span>{row.label}</span>
                <span className="tabular-nums">{formatCount(row.value)}</span>
              </li>
            ))}
          </ul>
        )}
        {jobs.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 font-medium text-foreground">Positions</p>
            <ul className="flex max-h-96 flex-col gap-1.5 overflow-y-auto">
              {[...matching, ...others].map((job) => {
                const match = job[1] === fieldId
                return (
                  <li
                    key={`${job[1]}-${job[0]}`}
                    className={
                      match
                        ? "flex items-baseline justify-between gap-4 font-semibold"
                        : "flex items-baseline justify-between gap-4 text-muted-foreground"
                    }
                  >
                    <span style={match ? { color: "var(--chart-1)" } : undefined}>{job[0]}</span>
                    <span className="tabular-nums" style={match ? { color: "var(--chart-1)" } : undefined}>
                      {formatCount(job[2])}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        <p>
          Certified job slots for this employer, not people hired. The same worker can be counted
          twice when the school certifies both a temporary visa and a green card in the same year.
          J-1 scholars, student work permits, TN, and O-1 are not in these files. University
          hospitals that file under a hospital industry code are not included.
        </p>
      </CardContent>
    </Card>
  )
}

function ShareChart({
  countyLabel,
  fips,
  groupId,
  groupLabel,
  history,
}: {
  countyLabel: string
  fips: string
  groupId: (typeof DEMOGRAPHIC_GROUPS)[number]["id"]
  groupLabel: string
  history: CountyHistory
}) {
  const points = COUNTY_HISTORY_YEARS.flatMap((year) => {
    const values = history[String(year)]?.[fips]
    if (!values) return []
    const share = groupShare(values, groupId)
    if (share == null) return []
    return [{ year: String(year), share }]
  })
  const ctTruncated = fips.startsWith(CT_FIPS) && !history["2025"]?.[fips]
  const shares = points.map((point) => point.share)
  const yMin = shares.length ? Math.max(0, Math.floor(Math.min(...shares) / 5) * 5 - 5) : 0
  const yMax = shares.length ? Math.min(100, Math.ceil(Math.max(...shares) / 5) * 5 + 5) : 100
  const chartConfig = {
    share: { label: `${groupLabel} share`, theme: POPULATION_COLORS[groupId] },
  } satisfies ChartConfig

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader>
        <CardTitle>{groupLabel} share of {countyLabel}</CardTitle>
        <CardDescription>{shareSentence(groupLabel, countyLabel, points, ctTruncated)}</CardDescription>
      </CardHeader>
      <CardContent>
        {points.length > 0 && (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[min(320px,50vh)] w-full"
            initialDimension={{ width: 720, height: 300 }}
          >
            <LineChart data={points} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="year" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => `${value}%`}
                width={48}
                domain={[yMin, yMax]}
              />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${value}%`} />} />
              <Line
                dataKey="share"
                type="monotone"
                stroke="var(--color-share)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

function shareSentence(
  groupLabel: string,
  place: string,
  points: { year: string; share: number }[],
  ctTruncated: boolean
): string {
  if (points.length === 0) return `${place} has no ${groupLabel} figure in this series.`
  const first = points[0]
  const last = points[points.length - 1]
  const body =
    first.year === last.year
      ? `${groupLabel} share of ${place} was ${formatPct(last.share)} in ${last.year}.`
      : `${groupLabel} share of ${place} went from ${formatPct(first.share)} in ${first.year} to ${formatPct(last.share)} in ${last.year}.`
  if (!ctTruncated) return body
  return `${body} Connecticut’s 2025 figures are for planning regions, so this county’s line ends in 2020.`
}

function WealthCard({
  stateName,
  abbr,
  generationId,
}: {
  stateName: string
  abbr: string
  generationId: GenerationId
}) {
  const cohort = generation(generationId)!
  const wealth = fedWealth(cohort.fed)
  const statePop = population[abbr]?.[generationId]
  const usPop = population.US?.[generationId]
  const maxShare = Math.max(...FED_WEALTH.map((row) => row.share))

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader>
        <CardTitle>
          {cohort.label} wealth, {WEALTH_QUARTER}
        </CardTitle>
        <CardDescription>{wealthSentence(stateName, cohort, wealth.share, statePop, usPop)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {FED_WEALTH.map((row) => {
          const selected = row.id === cohort.fed
          return (
            <div key={row.id} className="grid grid-cols-[9.5rem_1fr_3.5rem] items-center gap-3 text-sm">
              <span className={selected ? "font-semibold" : "text-muted-foreground"}>{row.label}</span>
              <span className="block h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${(row.share / maxShare) * 100}%`,
                    background: selected ? "var(--chart-1)" : "var(--muted-foreground)",
                    opacity: selected ? 1 : 0.45,
                  }}
                />
              </span>
              <span className="text-right tabular-nums">{formatPct(row.share)}</span>
            </div>
          )
        })}
        <p className="text-sm text-muted-foreground">
          Share of U.S. household net worth. The Federal Reserve does not publish this by state.
          {cohort.fed === "younger" &&
            " The highlighted bar is everyone born in 1981 or later. The Fed does not split Millennials, Gen Z, and Gen Alpha."}
          {cohort.id === "alpha" && " Gen Alpha are children, so almost none of that 11.2% is theirs."}
        </p>
      </CardContent>
    </Card>
  )
}

function wealthSentence(
  stateName: string,
  cohort: (typeof GENERATIONS)[number],
  wealthShare: number,
  statePop: number | undefined,
  usPop: number | undefined
): string {
  const place =
    statePop == null
      ? ""
      : `In ${stateName}, about ${formatPct(statePop)} of residents are ${cohort.label} age (${cohort.ages} in 2024)${
          usPop == null ? "" : `, against ${formatPct(usPop)} nationwide`
        }. `
  if (cohort.fed === "younger") {
    return `${place}People born in 1981 or later hold ${formatPct(wealthShare)} of U.S. household wealth. That line includes ${cohort.label}.`
  }
  const subject = cohort.fed === "silent" ? "The Silent generation and earlier" : cohort.fed === "genx" ? "Generation X" : "Baby boomers"
  const verb = cohort.fed === "genx" ? "holds" : "hold"
  return `${place}${subject} ${verb} ${formatPct(wealthShare)} of U.S. household wealth.`
}

function useJson<T>(url: string): { data: T | null; error: boolean } {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))
        return response.json() as Promise<T>
      })
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [url])
  return { data, error }
}
