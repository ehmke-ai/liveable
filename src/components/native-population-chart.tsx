"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { maxNative, rankedByNative } from "@/lib/demographics"

const chartConfig = {
  native: {
    label: "Native / European share",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

const chartData = rankedByNative.map((d, i) => ({
  ...d,
  label: `${i + 1}. ${d.country}`,
  rank: i + 1,
}))

export function NativePopulationChart() {
  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-[min(460px,72vh)] w-full"
      initialDimension={{ width: 900, height: 420 }}
    >
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
      >
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis
          type="number"
          domain={[0, 100]}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(v) => `${v}%`}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={120}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--foreground)", fontSize: 13 }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as (typeof chartData)[number] | undefined
                return row?.country ?? ""
              }}
              formatter={(value, _name, item) => {
                const rank = (item.payload as (typeof chartData)[number]).rank
                return (
                  <div className="flex w-full items-center justify-between gap-4">
                    <span className="text-muted-foreground">
                      Rank #{rank} · native / European
                    </span>
                    <span className="font-mono font-medium tabular-nums text-foreground">
                      {value}%
                    </span>
                  </div>
                )
              }}
            />
          }
        />
        <Bar dataKey="native" radius={[0, 6, 6, 0]} maxBarSize={28}>
          {chartData.map((entry) => {
            const intensity = Math.round(
              (0.45 + (entry.native / maxNative) * 0.55) * 100
            )
            return (
              <Cell
                key={entry.country}
                fill={`color-mix(in oklch, var(--chart-1) ${intensity}%, transparent)`}
              />
            )
          })}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
