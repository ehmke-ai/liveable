import type { Metadata } from "next"

import { NativePopulationChart } from "@/components/native-population-chart"
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

export const metadata: Metadata = topicMetadata("native-ranking")

export default function NativeRankingPage() {
  return (
    <TopicPage
      title="Native / European population ranking"
      description="Countries ranked by approximate native / European population share. Higher = larger ethnic European / autochthonous share."
      notes={
        <>
          Most countries do not publish official “race” statistics. “Native / European” uses
          approximate ethnic European / autochthonous shares. The United States uses Census
          Bureau non-Hispanic White share (2023).
        </>
      }
    >
      <Card className="border-border bg-card shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="sr-only">Native / European population ranking chart</CardTitle>
          <CardDescription className="sr-only">
            Horizontal bar chart ranking countries by native / European population share
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NativePopulationChart />
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
