"use client"

import { useState } from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  COLORS,
  DEFAULT_POLITICAL_LEAN_COUNTRY,
  getPoliticalLeanHistory,
  politicalLeanHistoryCountries,
} from "@/lib/demographics"

const chartConfig = {
  leftWing: {
    label: "Left wing",
    color: COLORS.leftWing,
  },
  leftOfCenter: {
    label: "Left of center",
    color: COLORS.leftOfCenter,
  },
  rightOfCenter: {
    label: "Right of center",
    color: COLORS.rightOfCenter,
  },
  rightWing: {
    label: "Right wing",
    color: COLORS.rightWing,
  },
} satisfies ChartConfig

const SERIES = [
  { key: "leftWing" as const, label: "Left wing" },
  { key: "leftOfCenter" as const, label: "Left of center" },
  { key: "rightOfCenter" as const, label: "Right of center" },
  { key: "rightWing" as const, label: "Right wing" },
]

export function PoliticalLeanTrendChart() {
  const [country, setCountry] = useState(DEFAULT_POLITICAL_LEAN_COUNTRY)
  const chartData = getPoliticalLeanHistory(country)
  const leanValues = chartData.flatMap((d) => [
    d.leftWing,
    d.leftOfCenter,
    d.rightOfCenter,
    d.rightWing,
  ])
  const minLean = leanValues.length ? Math.min(...leanValues) : 0
  const maxLean = leanValues.length ? Math.max(...leanValues) : 55
  const yMin = Math.max(0, Math.floor((minLean - 5) / 5) * 5)
  const yMax = Math.min(100, Math.ceil((maxLean + 8) / 5) * 5)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="political-lean-country" className="text-sm text-muted-foreground">
          Country
        </label>
        <Select
          value={country}
          onValueChange={(value) => {
            if (value) setCountry(value)
          }}
        >
          <SelectTrigger id="political-lean-country" className="min-w-[11rem]">
            <SelectValue placeholder="Select a country" />
          </SelectTrigger>
          <SelectContent>
            {politicalLeanHistoryCountries.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-[min(360px,56vh)] w-full"
        initialDimension={{ width: 900, height: 340 }}
      >
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
        >
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
          <XAxis
            dataKey="year"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fill: "#9aa6ba", fontSize: 12 }}
          />
          <YAxis
            domain={[yMin, yMax]}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: "#9aa6ba", fontSize: 12 }}
            width={44}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as
                    | (typeof chartData)[number]
                    | undefined
                  return row ? String(row.year) : ""
                }}
                formatter={(value, name) => {
                  const label =
                    SERIES.find((s) => s.key === name)?.label ?? String(name)
                  return (
                    <div className="flex w-full items-center justify-between gap-4">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {value}%
                      </span>
                    </div>
                  )
                }}
              />
            }
          />
          {SERIES.map(({ key }) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={`var(--color-${key})`}
              strokeWidth={2.5}
              dot={{ r: 3, fill: `var(--color-${key})`, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </div>
  )
}
