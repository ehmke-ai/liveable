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
import {
  formatMedianAge,
  maxMedianAge,
  medianAgeYouthIntensity,
  minMedianAge,
  rankedByMedianAge,
} from "@/lib/demographics"

const chartConfig = {
  medianAge: {
    label: "Native / white median age",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig

const chartData = rankedByMedianAge.map((d, i) => ({
  ...d,
  label: `${i + 1}. ${d.country}`,
  rank: i + 1,
}))

export function MedianAgeChart() {
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
          domain={[35, 52]}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(v) => `${v}`}
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
                      Rank #{rank} · native / white median age
                    </span>
                    <span className="font-mono font-medium tabular-nums text-foreground">
                      {formatMedianAge(Number(value))} yrs
                    </span>
                  </div>
                )
              }}
            />
          }
        />
        <Bar dataKey="medianAge" radius={[0, 6, 6, 0]} maxBarSize={28}>
          {chartData.map((entry) => (
            <Cell
              key={entry.country}
              fill={`rgba(88, 160, 200, ${0.4 + medianAgeYouthIntensity(entry.medianAge, minMedianAge, maxMedianAge) * 0.6})`}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
