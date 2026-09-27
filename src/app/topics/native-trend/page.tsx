import type { Metadata } from "next"

import { NativeShareTrendChart } from "@/components/native-share-trend-chart"
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

export const metadata: Metadata = topicMetadata("native-trend")

export default function NativeTrendPage() {
  return (
    <TopicPage
      title="Native / European share over time"
      description="Approximate native / European population share from 1960 to 2025 for a selected country. Use the dropdown to compare trends across countries."
      notes={
        <>
          The series is an approximate reconstruction ending at the current snapshot shares
          (Census non-Hispanic White alone for the United States; ethnic European /
          autochthonous proxies for Europe).
        </>
      }
    >
      <Card className="border-border bg-card shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="sr-only">Native / European share trend chart</CardTitle>
          <CardDescription className="sr-only">
            Line chart of native / European population share over time for the selected country
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NativeShareTrendChart />
          <Separator className="my-4" />
          <Swatch color={COLORS.native} label="Native / European population share (approx.)" />
        </CardContent>
      </Card>
    </TopicPage>
  )
}
