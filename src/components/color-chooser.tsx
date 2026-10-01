"use client"

import { HexColorInput, HexColorPicker } from "react-colorful"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

/** A swatch of the chosen color that opens a custom picker */
export function ColorChooser({
  color,
  onChange,
  label,
}: {
  color: string
  onChange: (color: string) => void
  label: string
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={label}
          aria-label={label}
          className="size-5 rounded-full border border-border"
          style={{ background: color }}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto">
        <HexColorPicker color={color} onChange={onChange} />
        <HexColorInput
          color={color}
          onChange={onChange}
          prefixed
          aria-label="Hex color code"
          className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 font-mono text-sm uppercase outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </PopoverContent>
    </Popover>
  )
}
