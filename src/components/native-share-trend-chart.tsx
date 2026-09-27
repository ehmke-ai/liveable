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
  DEFAULT_NATIVE_SHARE_COUNTRY,
  getNativeShareHistory,
  nativeShareHistoryCountries,
} from "@/lib/demographics"

const chartConfig = {
  native: {
    label: "Native / European share",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export function NativeShareTrendChart({
  country: fixedCountry,
  hideSelector,
}: {
  country?: string
  hideSelector?: boolean
} = {}) {
  const [country, setCountry] = useState(fixedCountry ?? DEFAULT_NATIVE_SHARE_COUNTRY)
  const activeCountry = fixedCountry ?? country
  const chartData = getNativeShareHistory(activeCountry)
  const minNative = chartData.length
    ? Math.min(...chartData.map((d) => d.native))
    : 50
  const yMin = Math.max(0, Math.floor((minNative - 8) / 5) * 5)

  return (
    <div className="flex flex-col gap-4">
      {!hideSelector && (
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="native-share-country" className="text-sm text-muted-foreground">
            Country
          </label>
          <Select
            value={country}
            onValueChange={(value) => {
              if (value) setCountry(value)
            }}
          >
            <SelectTrigger id="native-share-country" className="min-w-[11rem]">
              <SelectValue placeholder="Select a country" />
            </SelectTrigger>
            <SelectContent>
              {nativeShareHistoryCountries.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-[min(360px,56vh)] w-full"
        initialDimension={{ width: 900, height: 340 }}
      >
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
        >
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="year"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <YAxis
            domain={[yMin, 100]}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
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
                formatter={(value) => (
                  <div className="flex w-full items-center justify-between gap-4">
                    <span className="text-muted-foreground">Native / European</span>
                    <span className="font-mono font-medium tabular-nums text-foreground">
                      {value}%
                    </span>
                  </div>
                )}
              />
            }
          />
          <Line
            type="monotone"
            dataKey="native"
            stroke="var(--color-native)"
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: "var(--color-native)", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ChartContainer>
    </div>
  )
}
