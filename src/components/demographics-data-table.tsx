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
import {
  COLORS,
  demographicsData,
  formatMarketCap,
  formatMedianAge,
  slugify,
  type CountryDemographics,
} from "@/lib/demographics"
import { cn } from "@/lib/utils"

function SortableHeader({
  column,
  title,
  className,
}: {
  column: Column<CountryDemographics, unknown>
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

function PercentCell({ value, color }: { value: number; color: string }) {
  return (
    <div className="text-right font-medium tabular-nums" style={{ color }}>
      {value}%
    </div>
  )
}

const columns: ColumnDef<CountryDemographics>[] = [
  {
    accessorKey: "country",
    header: "Country",
    enableSorting: false,
    cell: ({ row }) => (
      <Link
        href={`/country/${slugify(row.getValue("country"))}`}
        className="font-medium hover:underline"
      >
        {row.getValue("country")}
      </Link>
    ),
  },
  {
    accessorKey: "native",
    header: ({ column }) => (
      <div className="flex justify-end">
        <SortableHeader column={column} title="Native / European" />
      </div>
    ),
    cell: ({ row }) => (
      <PercentCell value={row.getValue("native")} color={COLORS.native} />
    ),
  },
  {
    accessorKey: "catholic",
    header: ({ column }) => (
      <div className="flex justify-end">
        <SortableHeader column={column} title="Catholic" />
      </div>
    ),
    cell: ({ row }) => (
      <PercentCell value={row.getValue("catholic")} color={COLORS.catholic} />
    ),
  },
  {
    accessorKey: "protestant",
    header: ({ column }) => (
      <div className="flex justify-end">
        <SortableHeader column={column} title="Protestant" />
      </div>
    ),
    cell: ({ row }) => (
      <PercentCell value={row.getValue("protestant")} color={COLORS.protestant} />
    ),
  },
  {
    accessorKey: "orthodox",
    header: ({ column }) => (
      <div className="flex justify-end">
        <SortableHeader column={column} title="Orthodox" />
      </div>
    ),
    cell: ({ row }) => (
      <PercentCell value={row.getValue("orthodox")} color={COLORS.orthodox} />
    ),
  },
  {
    accessorKey: "marketCap",
    header: ({ column }) => (
      <div className="flex justify-end">
        <SortableHeader column={column} title="Market cap" />
      </div>
    ),
    cell: ({ row }) => (
      <div
        className="text-right font-medium tabular-nums"
        style={{ color: COLORS.marketCap }}
      >
        {formatMarketCap(row.getValue("marketCap"))}
      </div>
    ),
  },
  {
    accessorKey: "medianAge",
    header: ({ column }) => (
      <div className="flex justify-end">
        <SortableHeader column={column} title="Native median age" />
      </div>
    ),
    cell: ({ row }) => (
      <div
        className="text-right font-medium tabular-nums"
        style={{ color: COLORS.medianAge }}
      >
        {formatMedianAge(row.getValue("medianAge"))}
      </div>
    ),
  },
]

export function DemographicsDataTable() {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "native", desc: true },
  ])

  const table = useReactTable({
    data: demographicsData,
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
                className={header.column.id === "country" ? undefined : "text-right"}
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
