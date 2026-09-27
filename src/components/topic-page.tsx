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
import { slugify } from "@/lib/demographics"

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

export function TopicPage({
  title,
  description,
  notes,
  children,
}: {
  title: React.ReactNode
  description: React.ReactNode
  notes?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6">
      <header className="mb-7">
        <h1 className="page-title">{title}</h1>
        <p className="page-sub">
          {description}
        </p>
      </header>

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
  value: string
  // Bar fill, 0–1.
  intensity: number
}

export function RankingTable({
  rows,
  valueLabel,
  intensityLabel = "Intensity",
  color,
  badgeClassName,
}: {
  rows: RankingRow[]
  valueLabel: string
  intensityLabel?: string
  color: string
  badgeClassName: string
}) {
  return (
    <Card className="mt-7 border-border bg-card shadow-none">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Rank</TableHead>
              <TableHead>Country</TableHead>
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
                    {i + 1}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/country/${slugify(row.country)}`} className="hover:underline">
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
