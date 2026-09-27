import type { Metadata } from "next"

import { PoliticalLeanTrendChart } from "@/components/political-lean-trend-chart"
import { Swatch, TopicPage } from "@/components/topic-page"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { COLORS } from "@/lib/demographics"
import { topicMetadata } from "@/lib/topics"

export const metadata: Metadata = topicMetadata("politics")

export default function PoliticsPage() {
  return (
    <TopicPage
      title="Political leanings over time"
      description="Parliamentary vote share in four left–right bands from 1960 to 2025 for a selected country. Pure centre and uncoded parties are omitted, so the lines need not sum to 100%."
      notes={
        <>
          Political leanings use ParlGov party left–right scores (0–10) aggregated into four
          bands: left wing (&lt;3), left of centre (3–5), right of centre (5–7.5), and right
          wing (≥7.5); parties at exactly 5.0 or without a score are omitted. Recent elections
          after ParlGov coverage apply the same thresholds. For the United States, Democratic
          and Republican presidential popular vote are shown as left of centre and right of
          centre. Poland starts in 1990 after competitive multi-party elections.
        </>
      }
    >
      <Card className="border-border bg-card shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="sr-only">Political leanings trend chart</CardTitle>
          <CardDescription className="sr-only">
            Line chart of left-wing, left-of-center, right-of-center, and right-wing vote share
            over time for the selected country
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PoliticalLeanTrendChart />
          <Separator className="my-4" />
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Swatch color={COLORS.leftWing} label="Left wing" />
            <Swatch color={COLORS.leftOfCenter} label="Left of center" />
            <Swatch color={COLORS.rightOfCenter} label="Right of center" />
            <Swatch color={COLORS.rightWing} label="Right wing" />
          </div>
        </CardContent>
      </Card>
    </TopicPage>
  )
}
