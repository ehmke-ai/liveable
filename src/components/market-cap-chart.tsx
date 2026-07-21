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
  formatMarketCap,
  marketCapIntensity,
  maxMarketCap,
  rankedByMarketCap,
} from "@/lib/demographics"

const chartConfig = {
  marketCap: {
    label: "Stock market capitalization",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

const chartData = rankedByMarketCap.map((d, i) => ({
  ...d,
  label: `${i + 1}. ${d.country}`,
  rank: i + 1,
}))

export function MarketCapChart() {
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
        <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.08)" />
        <XAxis
          type="number"
          scale="log"
          domain={[1, maxMarketCap * 1.15]}
          allowDataOverflow
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          ticks={[10, 100, 1000, 10000, 80000]}
          tickFormatter={(v) => formatMarketCap(Number(v))}
          tick={{ fill: "#9aa6ba", fontSize: 12 }}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={120}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "#e8edf5", fontSize: 13 }}
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
                      Rank #{rank} · market cap
                    </span>
                    <span className="font-mono font-medium tabular-nums text-foreground">
                      {formatMarketCap(Number(value))}
                    </span>
                  </div>
                )
              }}
            />
          }
        />
        <Bar dataKey="marketCap" radius={[0, 6, 6, 0]} maxBarSize={28}>
          {chartData.map((entry) => (
            <Cell
              key={entry.country}
              fill={`rgba(45, 184, 138, ${0.4 + marketCapIntensity(entry.marketCap, maxMarketCap) * 0.6})`}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
