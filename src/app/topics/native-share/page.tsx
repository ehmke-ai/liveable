import type { Metadata } from "next"

import { NativePopulationChart } from "@/components/native-population-chart"
import { NativeShareTrendChart } from "@/components/native-share-trend-chart"
import { RankingTable, Swatch, TopicPage } from "@/components/topic-page"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { COLORS, maxNative, rankedByNative } from "@/lib/demographics"
import { topicMetadata } from "@/lib/topics"

export const metadata: Metadata = topicMetadata("native-share")

export default function NativeSharePage() {
  return (
    <TopicPage
      title="Native / European population share"
      description="Countries ranked by approximate native / European population share, and how that share has changed from 1960 to 2025. Higher = larger ethnic European / autochthonous share."
      notes={
        <>
          Most countries do not publish official “race” statistics. “Native / European” uses
          approximate ethnic European / autochthonous shares. The United States uses Census
          Bureau non-Hispanic White share (2023). The trend series is an approximate
          reconstruction ending at the current snapshot shares.
        </>
      }
    >
      <Card className="border-border bg-card shadow-none">
        <CardHeader className="pb-2">
          <CardTitle>Ranking</CardTitle>
          <CardDescription>Current approximate share by country</CardDescription>
        </CardHeader>
        <CardContent>
          <NativePopulationChart />
          <Separator className="my-4" />
          <Swatch color={COLORS.native} label="Native / European population share (approx.)" />
        </CardContent>
      </Card>

      <Card className="mt-7 border-border bg-card shadow-none">
        <CardHeader className="pb-2">
          <CardTitle>Over time</CardTitle>
          <CardDescription>
            Share from 1960 to 2025 for a selected country — use the dropdown to compare
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NativeShareTrendChart />
          <Separator className="my-4" />
          <Swatch color={COLORS.native} label="Native / European population share (approx.)" />
        </CardContent>
      </Card>

      <RankingTable
        rows={rankedByNative.map((d) => ({
          country: d.country,
          value: `${d.native}%`,
          intensity: d.native / maxNative,
        }))}
        valueLabel="Share"
        color={COLORS.native}
        badgeClassName="bg-foreground/15 text-foreground hover:bg-foreground/15"
      />
    </TopicPage>
  )
}
