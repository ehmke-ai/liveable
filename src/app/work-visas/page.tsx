import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader, RankingTable, Stat, Swatch } from "@/components/topic-page"
import { VisaIssuanceChart } from "@/components/work-visa-charts"
import { WorkVisaMap } from "@/components/work-visa-map"
import { UsCountyVisaMap } from "@/components/us-county-visa-map"
import { usCountyMapData } from "@/lib/state-data"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { slugify } from "@/lib/demographics"
import { stateNavBySlug } from "@/lib/states"
import {
  approvalRate,
  dependentVisaClasses,
  formatCount,
  formatShare,
  h1bBirthOther,
  h1bByBirth,
  h1bByEducation,
  h1bByPetitionType,
  H1B_FY2025_APPROVALS,
  issuedIn,
  issuanceTotal,
  LCA_FY2025_CERTIFIED_APPLICATIONS,
  LCA_FY2025_POSITIONS,
  lcaTopEmployers,
  lcaTopOccupations,
  lcaTopStates,
  petitionClasses,
  PETITION_PERIOD,
  workVisaClasses,
  workVisaSources,
} from "@/lib/work-visas"

export const metadata: Metadata = {
  title: "Work visas",
  description:
    "H-1B and other U.S. temporary work visas: consular issuances, H-1B approvals by country of birth, and a state map of certified H-1B, H-2A, and H-2B jobs.",
}

const FY = 2024
const h1bIssued = issuedIn(workVisaClasses.find((row) => row.code === "H-1B")!, FY)
const h2aIssued = issuedIn(workVisaClasses.find((row) => row.code === "H-2A")!, FY)
const principalTotal = issuanceTotal(FY)
const maxIssued = Math.max(...workVisaClasses.map((row) => issuedIn(row, FY)))
const maxStatePositions = lcaTopStates[0].positions
const indiaShare = h1bByBirth[0].approvals / H1B_FY2025_APPROVALS

function stateHref(name: string): string | undefined {
  const state = stateNavBySlug[slugify(name)]
  return state ? `/united-states/${state.slug}` : undefined
}

export default function WorkVisasPage() {
  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="United States"
        title="Work visas"
        description="H-1B and the other temporary work visas. A visa stamp, a petition approval, and a certified job slot are three different counts. They are shown separately."
      />

      <Card className="border-border bg-card shadow-none">
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
            <Stat label="H-1B visas issued, FY 2024" value={formatCount(h1bIssued)} color="#1d4ed8" />
            <Stat label="H-2A visas issued, FY 2024" value={formatCount(h2aIssued)} color="#15803d" />
            <Stat
              label="H-1B petitions approved, FY 2025"
              value={formatCount(H1B_FY2025_APPROVALS)}
              color="#1d4ed8"
            />
            <Stat
              label="Of those, born in India"
              value={formatShare(h1bByBirth[0].approvals, H1B_FY2025_APPROVALS)}
            />
          </dl>
        </CardContent>
      </Card>

      <Card className="mt-7 border-border bg-card shadow-none">
        <CardHeader className="pb-2">
          <CardTitle>Visas issued abroad</CardTitle>
          <CardDescription>
            State Department stamps for the principal worker, fiscal years 2020–2024. FY 2024
            principal-worker stamps across all ten classes below: {formatCount(principalTotal)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VisaIssuanceChart />
          <Separator className="my-4" />
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {workVisaClasses
              .filter((row) => row.chart)
              .map((row) => (
                <Swatch key={row.code} color={row.chart!.color} label={row.code} />
              ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-7 border-border bg-card shadow-none">
        <CardHeader className="pb-2">
          <CardTitle>Principal workers, FY 2024</CardTitle>
          <CardDescription>
            Ranked by visas issued. The bar is the class’s share of the largest class that year
            (H-2A).
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Class</TableHead>
                <TableHead>Who it is for</TableHead>
                <TableHead className="text-right">Issued</TableHead>
                <TableHead className="min-w-[7rem]">Relative</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workVisaClasses.map((row) => {
                const issued = issuedIn(row, FY)
                return (
                  <TableRow key={row.code}>
                    <TableCell className="font-medium">{row.code}</TableCell>
                    <TableCell>
                      <div>{row.label}</div>
                      <div className="mt-0.5 text-muted-foreground">{row.cap}</div>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCount(issued)}
                    </TableCell>
                    <TableCell>
                      <span
                        className="block h-2 min-w-16 overflow-hidden rounded-full bg-muted"
                        aria-hidden
                      >
                        <span
                          className="block h-full rounded-full bg-foreground/70"
                          style={{ width: `${(issued / maxIssued) * 100}%` }}
                        />
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-7 border-border bg-card shadow-none">
        <CardHeader className="pb-2">
          <CardTitle>Family members issued visas, FY 2024</CardTitle>
          <CardDescription>
            These are not principal workers. Some spouses in H-4, L-2, and E-3D status can work.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Class</TableHead>
                <TableHead>Who it is for</TableHead>
                <TableHead className="text-right">Issued</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dependentVisaClasses.map((row) => (
                <TableRow key={row.code}>
                  <TableCell className="font-medium">{row.code}</TableCell>
                  <TableCell>
                    <div>{row.label}</div>
                    <div className="mt-0.5 text-muted-foreground">{row.cap}</div>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCount(issuedIn(row, FY))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-7 border-border bg-card shadow-none">
        <CardHeader className="pb-2">
          <CardTitle>H-1B approvals by country of birth, FY 2025</CardTitle>
          <CardDescription>
            {formatCount(H1B_FY2025_APPROVALS)} petitions approved.{" "}
            {formatShare(h1bByBirth[0].approvals, H1B_FY2025_APPROVALS)} of beneficiaries were
            born in India and{" "}
            {formatShare(h1bByBirth[1].approvals, H1B_FY2025_APPROVALS)} in China. India is{" "}
            {h1bByPetitionType[0].indiaShare}% of initial employment and{" "}
            {h1bByPetitionType[1].indiaShare}% of continuing employment.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Rank</TableHead>
                <TableHead>Country of birth</TableHead>
                <TableHead className="text-right">Approvals</TableHead>
                <TableHead className="text-right">Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {h1bByBirth.map((row, index) => (
                <TableRow key={row.country}>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className="min-w-7 justify-center rounded-full bg-foreground/15 text-foreground hover:bg-foreground/15"
                    >
                      {index + 1}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{row.country}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums" style={{ color: "#1d4ed8" }}>
                    {formatCount(row.approvals)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatShare(row.approvals, H1B_FY2025_APPROVALS)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell />
                <TableCell className="font-medium">All other places</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCount(h1bBirthOther)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatShare(h1bBirthOther, H1B_FY2025_APPROVALS)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        <Card className="border-border bg-card shadow-none">
          <CardHeader className="pb-2">
            <CardTitle>New H-1B job versus an extension</CardTitle>
            <CardDescription>FY 2025 approvals. Continuing employment is an extension, amendment, or employer change.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Approvals</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {h1bByPetitionType.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(row.approvals)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatShare(row.approvals, H1B_FY2025_APPROVALS)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-none">
          <CardHeader className="pb-2">
            <CardTitle>Education of H-1B beneficiaries</CardTitle>
            <CardDescription>FY 2025. Degree held at approval, not necessarily a U.S. degree.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Degree</TableHead>
                  <TableHead className="text-right">Approvals</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {h1bByEducation.map((row) => (
                  <TableRow key={row.level}>
                    <TableCell className="font-medium">{row.level}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(row.approvals)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatShare(row.approvals, H1B_FY2025_APPROVALS)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-7 border-border bg-card shadow-none">
        <CardHeader className="pb-2">
          <CardTitle>Certified jobs by state</CardTitle>
          <CardDescription>
            Fiscal year 2025, from the Labor Department’s case files. H-1B is positions on
            applications still marked Certified. H-2A and H-2B are workers on applications DOL
            certified, including partial certifications. An application that lists several
            worksites is counted entirely in the first state. A certified slot is permission for
            an employer to petition. It is not a visa stamp and not a person admitted. The H-1B
            map is H-1B only, so its state totals sit below the combined H-1B, H-1B1, and E-3
            figures in the table that follows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkVisaMap />
        </CardContent>
      </Card>

      <Card className="mt-7 border-border bg-card shadow-none">
        <CardHeader className="pb-2">
          <CardTitle>Certified jobs by county</CardTitle>
          <CardDescription>
            The same fiscal year, counted at the county of the first worksite. Hover a county for
            the H-1B, H-2A, and H-2B breakdown. Where a filing left the county blank, the
            worksite ZIP is assigned to the county it overlaps most.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsCountyVisaMap {...usCountyMapData()} />
        </CardContent>
      </Card>

      <Card className="mt-7 border-border bg-card shadow-none">
        <CardHeader className="pb-2">
          <CardTitle>Where specialty-occupation jobs are certified</CardTitle>
          <CardDescription>
            Department of Labor certified {formatCount(LCA_FY2025_POSITIONS)} H-1B, H-1B1, and E-3
            positions in FY 2025, on {formatCount(LCA_FY2025_CERTIFIED_APPLICATIONS)} applications.
            A position is a slot an employer asked to fill. It is not a person admitted, and many
            certified slots are never used. California alone is{" "}
            {formatShare(lcaTopStates[0].positions, LCA_FY2025_POSITIONS)} of certified positions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RankingTable
            className=""
            rows={lcaTopStates.map((row) => ({
              country: row.name,
              href: stateHref(row.name),
              value: formatCount(row.positions),
              intensity: row.positions / maxStatePositions,
            }))}
            nameLabel="State of employment"
            valueLabel="Positions"
            intensityLabel="Relative"
            color="#1d4ed8"
            badgeClassName="bg-foreground/15 text-foreground hover:bg-foreground/15"
          />
        </CardContent>
      </Card>

      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        <CountRank
          title="Occupations certified"
          description="Top occupations among FY 2025 certified LCA positions."
          rows={lcaTopOccupations}
          whole={LCA_FY2025_POSITIONS}
        />
        <CountRank
          title="Employers filing those slots"
          description="Top employers by certified positions. One company can file under more than one tax ID; the Labor Department counts each ID separately."
          rows={lcaTopEmployers}
          whole={LCA_FY2025_POSITIONS}
        />
      </div>

      <Card className="mt-7 border-border bg-card shadow-none">
        <CardHeader className="pb-2">
          <CardTitle>Petition decisions so far in FY 2026</CardTitle>
          <CardDescription>
            USCIS initial decisions from {PETITION_PERIOD}. This is not a full year. H-1B
            approvals here are mostly one worker each. An H-2A or H-2B approval can cover many
            workers, so those rows are petitions, not people.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Class</TableHead>
                <TableHead>Who it is for</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Approved</TableHead>
                <TableHead className="text-right">Denied</TableHead>
                <TableHead className="text-right">Approval rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {petitionClasses.map((row) => (
                <TableRow key={row.code}>
                  <TableCell className="font-medium">{row.code}</TableCell>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(row.received)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(row.approved)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(row.denied)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(approvalRate(row) * 100).toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <footer className="fine-print mt-6 max-w-3xl">
        <p>
          <strong className="font-semibold text-foreground">How to read the three counts.</strong>{" "}
          A visa issuance is a stamp from a consulate. Canadians usually skip that step for H-1B,
          L-1, and TN, and so does anyone already in the United States who extends or changes
          status. An H-1B petition approval counts a new job and an extension the same way. The
          cap limits new cap-subject slots, not the stock of people already here. A certified LCA
          position is permission for an employer to file; FY 2025 certifications ({formatCount(LCA_FY2025_POSITIONS)})
          are more than twice the H-1B petitions USCIS approved in FY 2025 (
          {formatCount(H1B_FY2025_APPROVALS)}). India-born workers are{" "}
          {(indiaShare * 100).toFixed(1)}% of those approvals.
        </p>
        <ul className="mt-3 space-y-2">
          {workVisaSources.map((source) => (
            <li key={source.label}>
              <Link href={source.url} className="font-medium text-foreground underline-offset-2 hover:underline">
                {source.label}
              </Link>
              . {source.detail}
            </li>
          ))}
        </ul>
      </footer>
    </main>
  )
}

function CountRank({
  title,
  description,
  rows,
  whole,
}: {
  title: string
  description: string
  rows: { name: string; positions: number }[]
  whole: number
}) {
  const max = rows[0].positions
  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader className="pb-2">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Positions</TableHead>
              <TableHead className="text-right">Share</TableHead>
              <TableHead className="min-w-[5rem]">Relative</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.name}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(row.positions)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatShare(row.positions, whole)}
                </TableCell>
                <TableCell>
                  <span className="block h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${(row.positions / max) * 100}%`, backgroundColor: "#1d4ed8" }}
                    />
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
