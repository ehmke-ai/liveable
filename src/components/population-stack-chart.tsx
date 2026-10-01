"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Separator } from "@/components/ui/separator"
import type { StackedPopulationRow } from "@/lib/states"

/**
 * Fixed color per group, in stacking order, so a group keeps its color on every state page.
 * Adjacent slots are validated for color-vision-deficiency separation in both themes.
 */
export const POPULATION_COLORS: Record<string, { light: string; dark: string }> = {
  european: { light: "#2a78d6", dark: "#3987e5" },
  hispanic: { light: "#eb6834", dark: "#d95926" },
  african: { light: "#1baf7a", dark: "#199e70" },
  indian: { light: "#eda100", dark: "#c98500" },
  eastAsian: { light: "#e87ba4", dark: "#d55181" },
  arab: { light: "#008300", dark: "#008300" },
  nativeAmerican: { light: "#3fa9d4", dark: "#4cb6e0" },
  other: { light: "#4a3aa7", dark: "#9085e9" },
}

export function PopulationStackChart({
  series,
  data,
}: {
  series: { key: string; label: string }[]
  data: StackedPopulationRow[]
}) {
  const chartConfig = Object.fromEntries(
    series.map(({ key, label }) => [key, { label, theme: POPULATION_COLORS[key] }])
  ) satisfies ChartConfig

  const latest = data[data.length - 1]

  return (
    <div className="flex flex-col gap-4">
      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-[min(360px,56vh)] w-full"
        initialDimension={{ width: 900, height: 340 }}
      >
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="year"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            width={44}
          />
          <ChartTooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as StackedPopulationRow | undefined
                  return row ? String(row.year) : ""
                }}
                formatter={(value, name) => (
                  <div className="flex w-full items-center justify-between gap-4">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <i
                        className="inline-block size-2.5 rounded-[2px]"
                        style={{ background: `var(--color-${name})` }}
                        aria-hidden
                      />
                      {series.find((s) => s.key === name)?.label ?? String(name)}
                    </span>
                    <span className="font-mono font-medium tabular-nums text-foreground">
                      {value}%
                    </span>
                  </div>
                )}
              />
            }
          />
          {series.map(({ key }) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stackId="population"
              stroke="var(--card)"
              strokeWidth={2}
              fill={`var(--color-${key})`}
              fillOpacity={1}
              activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
            />
          ))}
        </AreaChart>
      </ChartContainer>
      <Separator />
      {/* Legend doubles as direct labels: the latest share for each band */}
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {series.map(({ key, label }) => (
          <span key={key} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <i
              className="inline-block size-3.5 rounded-[3px] bg-(--swatch-light) dark:bg-(--swatch-dark)"
              style={
                {
                  "--swatch-light": POPULATION_COLORS[key]?.light,
                  "--swatch-dark": POPULATION_COLORS[key]?.dark,
                } as React.CSSProperties
              }
              aria-hidden
            />
            {label}
            {latest && (
              <span className="font-medium tabular-nums text-foreground">{latest[key]}%</span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}
