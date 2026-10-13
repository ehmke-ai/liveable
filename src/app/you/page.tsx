import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { PageHeader } from "@/components/topic-page"
import { WhereYouStand } from "@/components/where-you-stand"
import { FIELD_CITIZENSHIP_YEAR, whereYouStandSources } from "@/lib/where-you-stand"

export const metadata: Metadata = {
  title: "Where you stand",
  description:
    "Pick a state, the counties where you will work, a work field, and a generation, and optionally a demographic, a college or university, and remote work. See what share of workers in that field are not U.S. citizens, certified foreign-worker job filings summed across those counties and listed by county, how that group’s share of each county has changed, that generation’s share of U.S. household wealth, and, when a school is chosen, the positions that school certified for foreign workers. Remote adds the national figures for that field next to the state and county ones.",
}

export default function WhereYouStandPage() {
  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="United States"
        title="Where you stand"
      />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <WhereYouStand />
      </Suspense>
      <footer className="fine-print mt-8 max-w-3xl">
        <ul className="space-y-2">
          {whereYouStandSources.map((source) => (
            <li key={source.label}>
              <Link
                href={source.url}
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                {source.label}
              </Link>
              . {source.detail}
            </li>
          ))}
        </ul>
      </footer>
    </main>
  )
}
