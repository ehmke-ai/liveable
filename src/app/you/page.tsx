import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { PageHeader } from "@/components/topic-page"
import { WhereYouStand } from "@/components/where-you-stand"
import { FIELD_CITIZENSHIP_YEAR, whereYouStandSources } from "@/lib/where-you-stand"

export const metadata: Metadata = {
  title: "Where you stand",
  description:
    "Pick a state, county, work field, and generation, and optionally a demographic and a college or university. See what share of workers in that field are not U.S. citizens, certified foreign-worker job filings in that county and field, how that group’s share of the county has changed, that generation’s share of U.S. household wealth, and, when a school is chosen, the positions that school certified for foreign workers.",
}

export default function WhereYouStandPage() {
  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="United States"
        title="Where you stand"
        description={`Your county, your field, and your generation. For the field, it shows the share of workers in that state who are not U.S. citizens, from the ${FIELD_CITIZENSHIP_YEAR} American Community Survey. The county job count adds H-1B, H-1B1, E-3, green-card labor certifications, H-2A, and H-2B in that occupation. A college or university, if you pick one, shows the H-1B, H-1B1, E-3, and green-card positions that school certified, with your field marked. Those are certified slots, not people. Wealth by generation is a national figure. The Fed does not publish it by state.`}
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
