"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { demographicsData } from "@/lib/demographics"

const chartConfig = {
  native: { label: "Native / white", color: "var(--chart-1)" },
  catholic: { label: "Catholic", color: "var(--chart-2)" },
  protestant: { label: "Protestant", color: "var(--chart-3)" },
  orthodox: { label: "Orthodox", color: "var(--chart-4)" },
} satisfies ChartConfig

export function DemographicsBarChart() {
  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-[min(460px,72vh)] w-full"
      initialDimension={{ width: 900, height: 420 }}
    >
      <BarChart
        data={demographicsData}
        margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
      >
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="country"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          interval={0}
          angle={-28}
          textAnchor="end"
          height={70}
          tick={{ fill: "var(--foreground)", fontSize: 12 }}
        />
        <YAxis
          domain={[0, 100]}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(v) => `${v}%`}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {chartConfig[name as keyof typeof chartConfig]?.label ?? name}
                  </span>
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {value}%
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="native" fill="var(--color-native)" radius={[4, 4, 0, 0]} maxBarSize={18} />
        <Bar dataKey="catholic" fill="var(--color-catholic)" radius={[4, 4, 0, 0]} maxBarSize={18} />
        <Bar
          dataKey="protestant"
          fill="var(--color-protestant)"
          radius={[4, 4, 0, 0]}
          maxBarSize={18}
        />
        <Bar dataKey="orthodox" fill="var(--color-orthodox)" radius={[4, 4, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ChartContainer>
  )
}
