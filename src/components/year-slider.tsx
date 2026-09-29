"use client"

import { Slider } from "@/components/ui/slider"

/** The county maps' year control: a stepped slider with each year as a clickable tick label */
export function YearSlider({
  years,
  year,
  onChange,
  disabled,
}: {
  /** Oldest first */
  years: number[]
  year: number
  onChange: (year: number) => void
  disabled?: boolean
}) {
  return (
    <div className="mx-auto w-full max-w-md px-2">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="eyebrow">Year</span>
        <span className="text-[17px] font-semibold tabular-nums text-foreground">{year}</span>
      </div>
      <Slider
        min={0}
        max={years.length - 1}
        step={1}
        value={[years.indexOf(year)]}
        onValueChange={([i]) => onChange(years[i])}
        disabled={disabled}
        aria-label="Data year"
      />
      <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
        {years.map((y) => (
          <button
            key={y}
            type="button"
            disabled={disabled}
            onClick={() => onChange(y)}
            className={`hover:text-foreground disabled:pointer-events-none ${y === year ? "font-semibold text-foreground" : ""}`}
          >
            {y}
          </button>
        ))}
      </div>
    </div>
  )
}
