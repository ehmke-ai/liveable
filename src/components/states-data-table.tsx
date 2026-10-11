"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDollarsShort, formatRatio, formatRent } from "@/lib/cost-of-living"
import { COLORS, formatMedianAge } from "@/lib/demographics"
import { cn } from "@/lib/utils"

export type StateTableRow = {
  state: string
  slug: string
  /** Millions */
  population: number
  native: number
  foreignBorn: number
  /** Trump minus Harris, points */
  margin2024: number
  /** ILRC score: 1 = most ICE cooperation, 5 = most protective */
  enforcementScore: number
  enforcementTier: string
  antiImmig: number | null
  thirtyMarriedHomeowner: number
  medianAge: number
  /** BEA Regional Price Parity, US = 100 */
  rpp: number
  medianIncome: number
  /** Median home value over median household income */
  priceToIncome: number
  /** Median gross rent, USD per month */
  medianRent: number
}

function SortableHeader({
  column,
  title,
  className,
}: {
  column: Column<StateTableRow, unknown>
  title: string
  className?: string
}) {
  const sorted = column.getIsSorted()

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("-mr-2 h-8 gap-1.5 px-2 has-data-[icon=inline-end]:pr-1.5", className)}
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {title}
      {sorted === "desc" ? (
        <ArrowDown data-icon="inline-end" />
      ) : sorted === "asc" ? (
        <ArrowUp data-icon="inline-end" />
      ) : (
        <ArrowUpDown data-icon="inline-end" className="opacity-50" />
      )}
    </Button>
  )
}

function NumberCell({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div className="text-right font-medium tabular-nums" style={{ color }}>
      {children}
    </div>
  )
}

function sortable(title: string) {
  function Header({ column }: { column: Column<StateTableRow, unknown> }) {
    return (
      <div className="flex justify-end">
        <SortableHeader column={column} title={title} />
      </div>
    )
  }
  return Header
}

const columns: ColumnDef<StateTableRow>[] = [
  {
    accessorKey: "state",
    header: "State",
    enableSorting: false,
    cell: ({ row }) => (
      <Link
        href={`/united-states/${row.original.slug}`}
        className="font-medium whitespace-nowrap hover:underline"
      >
        {row.original.state}
      </Link>
    ),
  },
  {
    accessorKey: "population",
    header: sortable("Population"),
    cell: ({ row }) => <NumberCell>{row.original.population.toFixed(1)}M</NumberCell>,
  },
  {
    accessorKey: "native",
    header: sortable("Non-Hispanic White"),
    cell: ({ row }) => <NumberCell color={COLORS.native}>{row.original.native}%</NumberCell>,
  },
  {
    accessorKey: "foreignBorn",
    header: sortable("Foreign-born"),
    cell: ({ row }) => <NumberCell>{row.original.foreignBorn}%</NumberCell>,
  },
  {
    accessorKey: "margin2024",
    header: sortable("2024 margin"),
    cell: ({ row }) => {
      const m = row.original.margin2024
      return (
        <NumberCell color={m >= 0 ? COLORS.rightWing : COLORS.leftWing}>
          {m >= 0 ? "R" : "D"}+{Math.abs(m).toFixed(1)}
        </NumberCell>
      )
    },
  },
  {
    accessorKey: "enforcementScore",
    // ILRC score: lower = more ICE cooperation, higher = more sanctuary protections
    header: sortable("Enforcement score"),
    cell: ({ row }) => (
      <NumberCell color={COLORS.enforcement}>
        <span title={row.original.enforcementTier}>{row.original.enforcementScore.toFixed(1)}</span>
      </NumberCell>
    ),
  },
  {
    accessorKey: "antiImmig",
    header: sortable("Immigration threatens values"),
    sortUndefined: "last",
    cell: ({ row }) => (
      <NumberCell color={COLORS.anti}>
        {row.original.antiImmig == null ? "—" : `${row.original.antiImmig}%`}
      </NumberCell>
    ),
  },
  {
    accessorKey: "thirtyMarriedHomeowner",
    header: sortable("Married homeowner at 30"),
    cell: ({ row }) => (
      <NumberCell color={COLORS.thirtyMarriedHomeowner}>
        {row.original.thirtyMarriedHomeowner}%
      </NumberCell>
    ),
  },
  {
    accessorKey: "medianAge",
    header: sortable("NH White median age"),
    cell: ({ row }) => (
      <NumberCell color={COLORS.medianAge}>{formatMedianAge(row.original.medianAge)}</NumberCell>
    ),
  },
  {
    accessorKey: "rpp",
    header: sortable("Price level"),
    cell: ({ row }) => (
      <NumberCell color={COLORS.costOfLiving}>{row.original.rpp.toFixed(1)}</NumberCell>
    ),
  },
  {
    accessorKey: "medianIncome",
    header: sortable("Median income"),
    cell: ({ row }) => (
      <NumberCell color={COLORS.costOfLiving}>
        {formatDollarsShort(row.original.medianIncome)}
      </NumberCell>
    ),
  },
  {
    accessorKey: "priceToIncome",
    header: sortable("Home price ÷ income"),
    cell: ({ row }) => (
      <NumberCell color={COLORS.costOfLiving}>{formatRatio(row.original.priceToIncome)}</NumberCell>
    ),
  },
  {
    accessorKey: "medianRent",
    header: sortable("Median rent"),
    cell: ({ row }) => (
      <NumberCell color={COLORS.costOfLiving}>{formatRent(row.original.medianRent)}</NumberCell>
    ),
  },
]

export function StatesDataTable({ rows }: { rows: StateTableRow[] }) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "native", desc: true }])

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id} className="hover:bg-transparent">
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                className={header.column.id === "state" ? undefined : "text-right"}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
