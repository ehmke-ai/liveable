"use client"

import { FileDown, Link2 } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { downloadResults } from "@/lib/export-results"

import { POPULATION_COLORS } from "@/components/population-stack-chart"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
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
  whereYouStandSources,
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
type CountyOption = { slug: string; label: string }
type CountyPlace = CountyOption & { fips: string }

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

function countiesIn(stateSlug: string): CountyOption[] {
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
  const urlCountyKey = searchParams.getAll("county").join("\0")
  const groupId = searchParams.get("group")
  const fieldId = searchParams.get("field")
  const generationId = searchParams.get("generation")
  const schoolId = searchParams.get("school")
  const remote = searchParams.get("remote") === "1"
  const [countyKey, setCountyKey] = useState(urlCountyKey)

  useEffect(() => {
    setCountyKey(urlCountyKey)
  }, [urlCountyKey])

  const state = stateSlug ? stateNavBySlug[stateSlug] : undefined
  const counties = state ? countiesIn(state.slug) : []
  const selectedCounties = (countyKey ? countyKey.split("\0") : []).flatMap((slug) => {
    const row = counties.find((item) => item.slug === slug)
    return row ? [row] : []
  })
  const group = DEMOGRAPHIC_GROUPS.find((row) => row.id === groupId)
  const field = workField(fieldId)
  const cohort = generation(generationId)
  const school = schoolId ? schoolById.get(schoolId) : undefined
  const places = state
    ? selectedCounties.flatMap((county) => {
        const fips = fipsByPlace[state.slug]?.[county.slug]
        return fips ? [{ ...county, fips }] : []
      })
    : []

  function write(next: Record<string, string | string[] | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(next)) {
      params.delete(key)
      const items = Array.isArray(value) ? value.filter(Boolean) : value ? [value] : []
      for (const item of items) params.append(key, item)
    }
    const query = params.toString()
    router.replace(query ? `/you?${query}` : "/you", { scroll: false })
  }

  function setCounties(slugs: string[]) {
    setCountyKey(slugs.join("\0"))
    write({ county: slugs })
  }

  const ready = Boolean(state && places.length > 0 && field && cohort)

  return (
    <div className="flex flex-col gap-6">
      <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(event) => event.preventDefault()}>
        <Field label="State" htmlFor="you-state">
          <Select
            value={state?.slug}
            onValueChange={(value) => {
              setCountyKey("")
              write({ state: value, county: null })
            }}
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

        <Field
          label="Counties you’ll work in"
          htmlFor="you-county"
          aside={
            <label htmlFor="you-remote" className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <input
                id="you-remote"
                type="checkbox"
                checked={remote}
                onChange={(event) => write({ remote: event.target.checked ? "1" : null })}
                className="size-3.5 shrink-0 accent-foreground"
              />
              Remote (optional)
            </label>
          }
        >
          <CountyPicker
            counties={counties}
            selected={selectedCounties}
            disabled={!state}
            onChange={setCounties}
          />
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
            value={school ?? null}
            limit={50}
            isItemEqualToValue={(left, right) => left.value === right.value}
            itemToStringLabel={(option) => option.label}
            onValueChange={(option) => write({ school: option?.value ?? null })}
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
                  <ComboboxItem key={option.value} value={option}>
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

      {ready && state && field && cohort ? (
        <Results
          stateSlug={state.slug}
          stateName={state.state}
          abbr={state.abbr}
          places={places}
          groupId={group?.id}
          groupLabel={group?.label}
          fieldId={field.id}
          fieldLabel={field.label}
          remote={remote}
          generationId={cohort.id}
          generationLabel={cohort.label}
          schoolId={school?.value}
          schoolLabel={school?.label}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Choose a state, at least one county, a work field, and a generation.
        </p>
      )}
    </div>
  )
}

function CountyPicker({
  counties,
  selected,
  disabled,
  onChange,
}: {
  counties: CountyOption[]
  selected: CountyOption[]
  disabled: boolean
  onChange: (slugs: string[]) => void
}) {
  const anchor = useComboboxAnchor()
  return (
    <Combobox
      items={counties}
      multiple
      disabled={disabled}
      value={selected}
      isItemEqualToValue={(left, right) => left.slug === right.slug}
      onValueChange={(next) => onChange(next.map((row) => row.slug))}
    >
      <ComboboxChips ref={anchor} className="w-full rounded-none">
        <ComboboxValue>
          {(values: CountyOption[]) =>
            values.map((county) => <ComboboxChip key={county.slug}>{county.label}</ComboboxChip>)
          }
        </ComboboxValue>
        <ComboboxChipsInput
          id="you-county"
          disabled={disabled}
          placeholder={
            disabled ? "Select a state first" : selected.length === 0 ? "Search counties" : "Add another"
          }
        />
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>No county found.</ComboboxEmpty>
        <ComboboxList>
          {(county: CountyOption) => (
            <ComboboxItem key={county.slug} value={county}>
              {county.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

function Field({
  label,
  htmlFor,
  optional,
  aside,
  children,
}: {
  label: string
  htmlFor: string
  optional?: boolean
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <label htmlFor={htmlFor} className="text-sm text-muted-foreground">
          {label}
          {optional ? " (optional)" : ""}
        </label>
        {aside}
      </div>
      {children}
    </div>
  )
}

function Results(props: {
  stateSlug: string
  stateName: string
  abbr: string
  places: CountyPlace[]
  groupId?: (typeof DEMOGRAPHIC_GROUPS)[number]["id"]
  groupLabel?: string
  fieldId: WorkFieldId
  fieldLabel: string
  remote: boolean
  generationId: GenerationId
  generationLabel: string
  schoolId?: string
  schoolLabel?: string
}) {
  const fields = useJson<FieldFile>(FIELD_URL)
  const history = useJson<CountyHistory>(HISTORY_URL)
  const schoolFile = useJson<SchoolFile>(props.schoolId ? SCHOOL_URL : null)
  const failed = fields.error || history.error
  const loading = !failed && (!fields.data || !history.data)
  const schoolLoading = Boolean(props.schoolId) && !schoolFile.error && !schoolFile.data
  const canExport = !loading && !failed && !schoolLoading && !schoolFile.error
  const rootRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState<"png" | "pdf" | null>(null)
  const [copied, setCopied] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [exportError, setExportError] = useState(false)
  const summary = [
    props.stateName,
    props.places.map((place) => place.label).join(", "),
    props.fieldLabel,
    props.generationLabel,
    props.groupLabel,
    props.schoolLabel,
    props.remote ? "Remote" : null,
  ]
    .filter(Boolean)
    .join(" · ")

  useEffect(() => {
    if (window.location.hash === "#results") {
      document.getElementById("results")?.scrollIntoView()
    }
  }, [])

  useEffect(() => {
    if (!copied) return
    const timeout = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timeout)
  }, [copied])

  async function copyLink() {
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}#results`
    try {
      await navigator.clipboard.writeText(url)
      setShareUrl(null)
      setCopied(true)
    } catch {
      setCopied(false)
      setShareUrl(url)
    }
  }

  async function save(format: "png" | "pdf") {
    const root = rootRef.current
    if (!root) return
    setExporting(format)
    setExportError(false)
    try {
      await downloadResults(root, `where-you-stand-${props.stateSlug}-${props.fieldId}`, format)
    } catch {
      setExportError(true)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div id="results" ref={rootRef} className="flex scroll-mt-16 flex-col gap-6">
      <div data-capture="exclude" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={copyLink}>
            <Link2 aria-hidden />
            {copied ? "Copied" : "Copy link"}
          </Button>
          {/* PNG export is paused.
          <Button type="button" size="sm" variant="outline" onClick={() => save("png")} disabled={!canExport || exporting !== null}>
            <Download aria-hidden />
            {exporting === "png" ? "Saving…" : "PNG"}
          </Button>
          */}
          <Button type="button" size="sm" variant="outline" onClick={() => save("pdf")} disabled={!canExport || exporting !== null}>
            <FileDown aria-hidden />
            {exporting === "pdf" ? "Saving…" : "PDF"}
          </Button>
        </div>
        {shareUrl && (
          <Input
            readOnly
            value={shareUrl}
            aria-label="Share link"
            onFocus={(event) => event.currentTarget.select()}
          />
        )}
        {exportError && <p className="text-sm text-muted-foreground">The file could not be saved.</p>}
      </div>
      <div data-export-only data-export-card hidden>
        <h2 className="font-heading text-2xl text-foreground">Where you stand</h2>
        <p className="text-sm text-muted-foreground">{summary}</p>
      </div>
      {failed && (
        <p className="text-sm text-muted-foreground">The county figures did not load.</p>
      )}
      {loading && <p className="text-sm text-muted-foreground">Loading county figures…</p>}
      {props.schoolId && props.schoolLabel && (
        <div data-export-card>
          <SchoolCard
            schoolId={props.schoolId}
            schoolLabel={props.schoolLabel}
            fieldId={props.fieldId}
            fieldLabel={props.fieldLabel}
            file={schoolFile}
          />
        </div>
      )}
      <div data-export-card>
        <FieldLaborCard
          stateName={props.stateName}
          abbr={props.abbr}
          fieldId={props.fieldId}
          fieldLabel={props.fieldLabel}
          countyCount={props.places.length}
          remote={props.remote}
        />
      </div>
      {fields.data && (
        <div data-export-card>
          <VisaCard {...props} fields={fields.data} />
        </div>
      )}
      <div data-export-card>
        <WealthCard stateName={props.stateName} abbr={props.abbr} generationId={props.generationId} />
      </div>
      {history.data && props.groupId && props.groupLabel && props.places.length > 0 && (
        <div data-export-card>
          <ShareChart
            places={props.places}
            groupId={props.groupId}
            groupLabel={props.groupLabel}
            history={history.data}
          />
        </div>
      )}
      <div data-export-only data-export-card hidden className="fine-print max-w-3xl">
        <ul className="space-y-2">
          {whereYouStandSources.map((source) => (
            <li key={source.label}>
              <span className="font-medium text-foreground">{source.label}</span>. {source.detail}
            </li>
          ))}
        </ul>
        <p className="mt-3">basedmetrics.com</p>
      </div>
    </div>
  )
}

function laborTotal(cell: FieldLabor): number {
  return cell.citizen + cell.noncitizen
}

function laborPct(cell: FieldLabor, key: "citizen" | "naturalized" | "noncitizen"): number {
  return (cell[key] / laborTotal(cell)) * 100
}

function LaborBar({ share, highlight }: { share: number; highlight: boolean }) {
  return (
    <span className="block h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
      <span
        className="block h-full rounded-full"
        style={{
          width: `${share}%`,
          background: highlight ? "var(--chart-1)" : "var(--muted-foreground)",
          opacity: highlight ? 1 : 0.45,
        }}
      />
    </span>
  )
}

function FieldLaborCard({
  stateName,
  abbr,
  fieldId,
  fieldLabel,
  countyCount,
  remote,
}: {
  stateName: string
  abbr: string
  fieldId: WorkFieldId
  fieldLabel: string
  countyCount: number
  remote: boolean
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
  const compare = remote && stateOk && stateCell
  const rows = [
    { id: "citizen" as const, label: "U.S. citizens", share: citizen, highlight: false },
    { id: "noncitizen" as const, label: "Non-citizens", share: noncitizen, highlight: true },
  ]
  const places = compare
    ? [
        { id: "state", label: stateName, cell: stateCell },
        { id: "us", label: "United States", cell: usCell },
      ]
    : []
  const slotNote =
    countyCount === 1
      ? "The county figure below is certified job slots in this occupation, for the county rather than the state."
      : "The figures below are certified job slots in this occupation, summed across the counties you chose, rather than the state."
  const nationalNote = remote
    ? " With remote checked, that card also lists the same slots for this field in the whole country."
    : ""

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader>
        <CardTitle className="text-4xl font-semibold tabular-nums">{formatPct(noncitizen)}</CardTitle>
        <CardDescription>
          {stateOk
            ? `Non-U.S. citizens among people working in ${field} in ${stateName}, ${FIELD_CITIZENSHIP_YEAR}. Nationwide, ${formatPct(laborPct(usCell, "noncitizen"))}.`
            : `${stateName}’s ${FIELD_CITIZENSHIP_YEAR} sample of people working in ${field} is too small, so this is the U.S. share.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {compare
          ? rows.map((row) => (
              <div key={row.id} className="flex flex-col gap-1.5">
                <span className={row.highlight ? "text-sm font-semibold" : "text-sm text-muted-foreground"}>
                  {row.label}
                </span>
                {places.map((column) => {
                  const share = laborPct(column.cell, row.id)
                  return (
                    <div
                      key={column.id}
                      className="grid grid-cols-[minmax(6.5rem,11rem)_minmax(0,1fr)_3.25rem] items-center gap-3 text-sm"
                    >
                      <span className="text-muted-foreground">{column.label}</span>
                      <LaborBar share={share} highlight={row.highlight} />
                      <span className="text-right tabular-nums">{formatPct(share)}</span>
                    </div>
                  )
                })}
              </div>
            ))
          : rows.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[8.5rem_minmax(0,1fr)_3.25rem] items-center gap-3 text-sm"
              >
                <span className={row.highlight ? "font-semibold" : "text-muted-foreground"}>{row.label}</span>
                <LaborBar share={row.share} highlight={row.highlight} />
                <span className="text-right tabular-nums">{formatPct(row.share)}</span>
              </div>
            ))}
        <p className="text-sm text-muted-foreground">
          Citizens include naturalized citizens, {formatPct(naturalized)} of workers in this field in{" "}
          {place}
          {compare ? ` and ${formatPct(laborPct(usCell, "naturalized"))} in the United States` : ""}.
          Non-citizens include green-card holders, temporary workers such as H-1B, refugees, and
          people without status who answered the survey. The American Community Survey records
          citizenship and has no visa class. {slotNote}
          {nationalNote}
        </p>
      </CardContent>
    </Card>
  )
}

function nationalSlots(fields: FieldFile, fieldId: WorkFieldId) {
  const programs: Partial<Record<VisaProgramId, number>> = {}
  let count = 0
  let all = 0
  for (const buckets of Object.values(fields)) {
    const fieldPrograms = buckets[fieldId]
    if (fieldPrograms) {
      for (const program of VISA_PROGRAMS) {
        const value = fieldPrograms[program.id] ?? 0
        if (value === 0) continue
        programs[program.id] = (programs[program.id] ?? 0) + value
        count += value
      }
    }
    for (const row of Object.values(buckets)) {
      if (!row) continue
      for (const program of VISA_PROGRAMS) all += row[program.id] ?? 0
    }
  }
  return { programs, count, all }
}

function fieldSlots(fields: FieldFile, fips: string, fieldId: WorkFieldId) {
  const buckets = fields[fips] ?? {}
  const programs = buckets[fieldId] ?? {}
  const count = VISA_PROGRAMS.reduce((sum, program) => sum + (programs[program.id] ?? 0), 0)
  const countyTotal = Object.values(buckets).reduce((sum, row) => {
    return sum + VISA_PROGRAMS.reduce((inner, program) => inner + (row?.[program.id] ?? 0), 0)
  }, 0)
  return { programs, count, countyTotal }
}

function placeHref(stateSlug: string, countySlug: string): string {
  if (stateSlug === "district-of-columbia") return "/united-states/district-of-columbia"
  return `/united-states/${stateSlug}/${countySlug}`
}

function placeList(labels: string[]): string {
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return "these counties"
}

function VisaCard({
  stateSlug,
  places,
  fieldId,
  fieldLabel,
  remote,
  fields,
}: {
  stateSlug: string
  places: CountyPlace[]
  fieldId: WorkFieldId
  fieldLabel: string
  remote: boolean
  fields: FieldFile
}) {
  const rows = places.map((place) => ({ ...place, ...fieldSlots(fields, place.fips, fieldId) }))
  const count = rows.reduce((sum, row) => sum + row.count, 0)
  const countyTotal = rows.reduce((sum, row) => sum + row.countyTotal, 0)
  const share = countyTotal > 0 ? (count / countyTotal) * 100 : null
  const national = useMemo(() => (remote ? nationalSlots(fields, fieldId) : null), [remote, fields, fieldId])
  const programs = VISA_PROGRAMS.flatMap((program) => {
    const value = rows.reduce((sum, row) => sum + (row.programs[program.id] ?? 0), 0)
    return value > 0 ? [{ ...program, value }] : []
  })
  const compare = national
    ? VISA_PROGRAMS.flatMap((program) => {
        const local = rows.reduce((sum, row) => sum + (row.programs[program.id] ?? 0), 0)
        const country = national.programs[program.id] ?? 0
        return local > 0 || country > 0 ? [{ id: program.id, label: program.label, local, country }] : []
      })
    : []
  const compareRows =
    national && compare.length !== 1
      ? [...compare, { id: "total", label: "Total", local: count, country: national.count }]
      : compare
  const field = fieldLabel.toLowerCase()
  const where = placeList(rows.map((row) => row.label))
  const several = rows.length > 1
  const nationalShare = national && national.all > 0 ? (national.count / national.all) * 100 : null

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader>
        <CardTitle className="text-4xl font-semibold tabular-nums">{formatCount(count)}</CardTitle>
        <CardDescription>
          {count === 0
            ? `No certified foreign-worker job filings in ${field} in ${where}, FY 2025.`
            : `Certified foreign-worker job filings in ${field} in ${where}, FY 2025.`}
          {share != null && count > 0 && (
            <>
              {" "}
              That is {formatPct(share)} of{" "}
              {several ? "certified filings in these counties" : "this county’s certified filings"} (
              {formatCount(countyTotal)}).
            </>
          )}
          {national && nationalShare != null && (
            <>
              {" "}
              Nationwide, {formatCount(national.count)} in this field, {formatPct(nationalShare)} of
              certified filings in the country ({formatCount(national.all)}).
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {several && (
          <div className="mb-4">
            <p className="mb-2 font-medium text-foreground">By county</p>
            <ul className="flex flex-col gap-1.5 text-foreground">
              {rows.map((row) => (
                <li key={row.fips} className="flex items-baseline justify-between gap-4">
                  <Link
                    href={placeHref(stateSlug, row.slug)}
                    className="underline-offset-2 hover:underline"
                  >
                    {row.label}
                  </Link>
                  <span className="tabular-nums">{formatCount(row.count)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {compareRows.length > 0 ? (
          <div className="mb-3 grid grid-cols-[minmax(0,1.4fr)_minmax(4.5rem,auto)_minmax(6.5rem,auto)] gap-x-4 gap-y-1.5 text-foreground">
            <span />
            <span className="text-right text-xs leading-tight text-muted-foreground">
              {several ? "Selected" : rows[0]?.label}
            </span>
            <span className="text-right text-xs leading-tight text-muted-foreground">United States</span>
            {compareRows.map((row) => (
              <Fragment key={row.id}>
                <span className={row.id === "total" ? "font-medium" : undefined}>{row.label}</span>
                <span className="text-right tabular-nums">{formatCount(row.local)}</span>
                <span className="text-right tabular-nums">{formatCount(row.country)}</span>
              </Fragment>
            ))}
          </div>
        ) : (
          programs.length > 0 && (
            <div className="mb-3">
              {several && <p className="mb-2 font-medium text-foreground">By visa</p>}
              <ul className="flex flex-col gap-1.5 text-foreground">
                {programs.map((row) => (
                  <li key={row.id} className="flex items-baseline justify-between gap-4">
                    <span>{row.label}</span>
                    <span className="tabular-nums">{formatCount(row.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        )}
        <p>
          Certified job slots in this occupation, not people living in{" "}
          {several ? "these counties" : "the county"}. The same worker can be counted twice when an
          employer certifies both a temporary visa and a green card in the same year. L-1, TN, O-1,
          student work permits, and green cards that skip labor certification are not in these files.
        </p>
        <p className="mt-3">
          {rows.length === 1 && (
            <>
              <Link
                href={placeHref(stateSlug, rows[0].slug)}
                className="text-foreground underline-offset-2 hover:underline"
              >
                {rows[0].label} profile
              </Link>
              {" · "}
            </>
          )}
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
  file,
}: {
  schoolId: string
  schoolLabel: string
  fieldId: WorkFieldId
  fieldLabel: string
  file: { data: SchoolFile | null; error: boolean }
}) {
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
            <ul data-export-expand className="flex max-h-96 flex-col gap-1.5 overflow-y-auto">
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

/** Distinct line colors when several counties share one chart. */
const COUNTY_LINE_COLORS: { light: string; dark: string }[] = [
  { light: "#2a78d6", dark: "#3987e5" },
  { light: "#eb6834", dark: "#d95926" },
  { light: "#1baf7a", dark: "#199e70" },
  { light: "#c98500", dark: "#eda100" },
  { light: "#d55181", dark: "#e87ba4" },
  { light: "#6d5bd0", dark: "#9085e9" },
  { light: "#0e8a8a", dark: "#2eb8b8" },
  { light: "#b45309", dark: "#d9782d" },
]

function seriesKey(fips: string): string {
  return `f${fips}`
}

function ShareChart({
  places,
  groupId,
  groupLabel,
  history,
}: {
  places: CountyPlace[]
  groupId: (typeof DEMOGRAPHIC_GROUPS)[number]["id"]
  groupLabel: string
  history: CountyHistory
}) {
  const series = places.map((place, index) => ({
    ...place,
    key: seriesKey(place.fips),
    points: sharePoints(history, place.fips, groupId),
    ctTruncated: place.fips.startsWith(CT_FIPS) && !history["2025"]?.[place.fips],
    theme: places.length === 1 ? POPULATION_COLORS[groupId] : COUNTY_LINE_COLORS[index % COUNTY_LINE_COLORS.length],
  }))
  const years = COUNTY_HISTORY_YEARS.map(String).filter((year) =>
    series.some((row) => row.points.some((point) => point.year === year))
  )
  const data = years.map((year) => {
    const row: Record<string, string | number | null> = { year }
    for (const item of series) {
      row[item.key] = item.points.find((point) => point.year === year)?.share ?? null
    }
    return row
  })
  const shares = series.flatMap((row) => row.points.map((point) => point.share))
  const yMin = shares.length ? Math.max(0, Math.floor(Math.min(...shares) / 5) * 5 - 5) : 0
  const yMax = shares.length ? Math.min(100, Math.ceil(Math.max(...shares) / 5) * 5 + 5) : 100
  const chartConfig = Object.fromEntries(
    series.map((row) => [row.key, { label: row.label, theme: row.theme }])
  ) satisfies ChartConfig
  const multiple = series.length > 1

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader>
        <CardTitle>{shareTitle(groupLabel, series.map((row) => row.label))}</CardTitle>
        <CardDescription>
          {multiple
            ? shareSentences(groupLabel, series)
            : shareSentence(groupLabel, series[0].label, series[0].points, series[0].ctTruncated)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {data.length > 0 && (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[min(320px,50vh)] w-full"
            initialDimension={{ width: 720, height: 300 }}
          >
            <LineChart data={data} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="year" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => `${value}%`}
                width={48}
                domain={[yMin, yMax]}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="text-muted-foreground">
                          {multiple ? (chartConfig[String(name)]?.label ?? String(name)) : `${groupLabel} share`}
                        </span>
                        <span className="font-mono font-medium tabular-nums text-foreground">{value}%</span>
                      </div>
                    )}
                  />
                }
              />
              {series.map((row) => (
                <Line
                  key={row.key}
                  dataKey={row.key}
                  name={row.key}
                  type="monotone"
                  stroke={`var(--color-${row.key})`}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ChartContainer>
        )}
        {multiple && (
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {series.map((row) => {
              const latest = row.points[row.points.length - 1]
              return (
                <span key={row.key} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <i
                    className="inline-block size-3.5 rounded-[3px] bg-(--swatch-light) dark:bg-(--swatch-dark)"
                    style={
                      {
                        "--swatch-light": row.theme?.light,
                        "--swatch-dark": row.theme?.dark,
                      } as CSSProperties
                    }
                    aria-hidden
                  />
                  {row.label}
                  {latest && <span className="font-medium tabular-nums text-foreground">{formatPct(latest.share)}</span>}
                </span>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function sharePoints(
  history: CountyHistory,
  fips: string,
  groupId: (typeof DEMOGRAPHIC_GROUPS)[number]["id"]
): { year: string; share: number }[] {
  return COUNTY_HISTORY_YEARS.flatMap((year) => {
    const values = history[String(year)]?.[fips]
    if (!values) return []
    const share = groupShare(values, groupId)
    if (share == null) return []
    return [{ year: String(year), share }]
  })
}

function shareTitle(groupLabel: string, labels: string[]): string {
  if (labels.length <= 1) return `${groupLabel} share of ${labels[0] ?? "the selected counties"}`
  if (labels.length === 2) return `${groupLabel} share of ${labels[0]} and ${labels[1]}`
  return `${groupLabel} share of ${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`
}

function shareSentences(
  groupLabel: string,
  series: { label: string; points: { year: string; share: number }[]; ctTruncated: boolean }[]
): string {
  const body = series
    .map((row) => shareSentence(groupLabel, row.label, row.points, false))
    .join(" ")
  if (!series.some((row) => row.ctTruncated)) return body
  return `${body} Connecticut’s 2025 figures are for planning regions, so any Connecticut county ends in 2020.`
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

function useJson<T>(url: string | null): { data: T | null; error: boolean } {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    if (!url) return
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
