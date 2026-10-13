"use client"

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  chartedVisaClasses,
  formatCount,
  ISSUANCE_YEARS,
  issuedIn,
} from "@/lib/work-visas"

const issuanceConfig = Object.fromEntries(
  chartedVisaClasses.map((row) => [
    row.code,
    { label: row.code, color: row.chart?.color },
  ])
) satisfies ChartConfig

const issuanceData = ISSUANCE_YEARS.map((year) => {
  const point: Record<string, number> = { year }
  for (const row of chartedVisaClasses) point[row.code] = issuedIn(row, year)
  return point
})

export function VisaIssuanceChart() {
  return (
    <ChartContainer
      config={issuanceConfig}
      className="aspect-auto h-[min(380px,58vh)] w-full"
      initialDimension={{ width: 900, height: 360 }}
    >
      <LineChart data={issuanceData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="year"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={48}
          tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(label) => `FY ${label}`}
              formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">{name}</span>
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {formatCount(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        {chartedVisaClasses.map((row) => (
          <Line
            key={row.code}
            type="monotone"
            dataKey={row.code}
            stroke={row.chart?.color}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  )
}
