import type { Metadata } from "next"

import { MedianAgeChart } from "@/components/median-age-chart"
import { RankingTable, Swatch, TopicPage } from "@/components/topic-page"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  COLORS,
  formatMedianAge,
  maxMedianAge,
  medianAgeYouthIntensity,
  minMedianAge,
  rankedByMedianAge,
} from "@/lib/demographics"
import { topicMetadata } from "@/lib/topics"

export const metadata: Metadata = topicMetadata("median-age")

export default function MedianAgePage() {
  return (
    <TopicPage
      title="Native / European age ranking"
      description="Countries ranked by median age of the native / European population. Lower = younger native age structure — younger ranks higher."
      notes={
        <>
          Native / European median age uses Eurostat “born in reporting country” figures for 1
          January 2025 for European countries (a proxy where race statistics are not
          published); the United States uses Census Bureau non-Hispanic White alone median age
          (July 2024).
        </>
      }
    >
      <Card className="border-border bg-card shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="sr-only">Native / European median age ranking chart</CardTitle>
          <CardDescription className="sr-only">
            Horizontal bar chart ranking countries by native / European median age, youngest first
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MedianAgeChart />
          <Separator className="my-4" />
          <Swatch
            color={COLORS.medianAge}
            label="Native / European median age (years) — younger ranks higher"
          />
        </CardContent>
      </Card>

      <RankingTable
        rows={rankedByMedianAge.map((d) => ({
          country: d.country,
          value: `${formatMedianAge(d.medianAge)} yrs`,
          intensity: medianAgeYouthIntensity(d.medianAge, minMedianAge, maxMedianAge),
        }))}
        valueLabel="Native median age"
        intensityLabel="Youth intensity"
        color={COLORS.medianAge}
        badgeClassName="bg-[rgba(88,160,200,0.18)] text-[#9ecce8] hover:bg-[rgba(88,160,200,0.18)]"
      />
    </TopicPage>
  )
}
