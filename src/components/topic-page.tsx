import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { countryHref } from "@/lib/demographics"

export function Swatch({ color, label }: { color: string; label: string }) {
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

export function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 text-[17px] font-semibold tabular-nums" style={{ color }}>
        {value}
      </dd>
    </div>
  )
}

/** Visible page title, shared by every page: section eyebrow, h1, one-line description */
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <header className="mb-7">
      {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
      <h1 className="page-title">{title}</h1>
      {description && <p className="page-sub">{description}</p>}
      {children}
    </header>
  )
}

export function TopicPage({
  eyebrow,
  title,
  description,
  notes,
  children,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description: React.ReactNode
  notes?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />

      {children}

      <footer className="fine-print mt-6 max-w-3xl">
        <strong className="font-semibold text-foreground">Notes:</strong> {notes} Values are
        rounded for comparison; years and definitions differ by country.
      </footer>
    </main>
  )
}

export type RankingRow = {
  country: string
  /** Defaults to the country's profile page */
  href?: string
  value: string
  // Bar fill, 0–1.
  intensity: number
  /** Defaults to the row's position */
  rank?: number
}

export function RankingTable({
  rows,
  valueLabel,
  nameLabel = "Country",
  intensityLabel = "Intensity",
  color,
  badgeClassName,
  className = "mt-7",
}: {
  rows: RankingRow[]
  valueLabel: string
  nameLabel?: string
  intensityLabel?: string
  color: string
  badgeClassName: string
  className?: string
}) {
  return (
    <Card className={`${className} border-border bg-card shadow-none`}>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Rank</TableHead>
              <TableHead>{nameLabel}</TableHead>
              <TableHead className="text-right">{valueLabel}</TableHead>
              <TableHead className="min-w-[8rem]">{intensityLabel}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={row.country}>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={`min-w-7 justify-center rounded-full ${badgeClassName}`}
                  >
                    {row.rank ?? i + 1}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={row.href ?? countryHref(row.country)} className="hover:underline">
                    {row.country}
                  </Link>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums" style={{ color }}>
                  {row.value}
                </TableCell>
                <TableCell>
                  <span
                    className="block h-2 min-w-24 overflow-hidden rounded-full bg-muted"
                    aria-hidden
                  >
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${row.intensity * 100}%`, backgroundColor: color }}
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
