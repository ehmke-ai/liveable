"use client"

import { useRouter } from "next/navigation"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import countyLabels from "@/data/county-labels.json"
import { stateNav } from "@/lib/states"
import { cn } from "@/lib/utils"

type PlaceOption = { value: string; label: string }

// Every state, then every county as "<label>, <abbr>"; values are the pages' paths
const placeOptions: PlaceOption[] = [
  ...stateNav.map((s) => ({ value: `/united-states/${s.slug}`, label: s.state })),
  ...stateNav.flatMap((s) =>
    Object.entries(
      (countyLabels as Record<string, Record<string, string>>)[s.slug] ?? {}
    ).map(([slug, label]) => ({
      value: `/united-states/${s.slug}/${slug}`,
      label: `${label}, ${s.abbr}`,
    }))
  ),
]

/** Jump to any state or county page */
export function PlaceSearch({
  className,
  placeholder = "Search a state or county…",
  onNavigate,
}: {
  className?: string
  placeholder?: string
  /** Called after navigating, e.g. to close the mobile sidebar */
  onNavigate?: () => void
}) {
  const router = useRouter()

  return (
    <Combobox
      items={placeOptions}
      value={null}
      limit={50}
      onValueChange={(value) => {
        if (!value) return
        router.push(value)
        onNavigate?.()
      }}
    >
      <ComboboxInput placeholder={placeholder} showTrigger={false} className={cn("w-full", className)} />
      <ComboboxContent>
        <ComboboxEmpty>No state or county found.</ComboboxEmpty>
        <ComboboxList>
          {(option: PlaceOption) => (
            <ComboboxItem key={option.value} value={option.value}>
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
