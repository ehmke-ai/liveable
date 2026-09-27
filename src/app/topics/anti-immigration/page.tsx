import type { Metadata } from "next"

import { AntiImmigrationChart } from "@/components/anti-immigration-chart"
import { RankingTable, Swatch, TopicPage } from "@/components/topic-page"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { COLORS, maxAntiImmig, rankedByAntiImmig } from "@/lib/demographics"
import { topicMetadata } from "@/lib/topics"

export const metadata: Metadata = topicMetadata("anti-immigration")

export default function AntiImmigrationPage() {
  return (
    <TopicPage
      title="Anti-immigration intensity ranking"
      description="Countries ranked by opposition to immigration from poorer countries outside Europe (ESS 2023 for Europe; ESS Round 9/10 for Denmark; Gallup for the United States). Higher = more opposition."
      notes={
        <>
          Anti-immigration intensity uses the ESS 2023 share answering “allow a few” or “allow
          none” for immigrants from poorer countries outside Europe (RFBerlin / ESS Round 11)
          for European countries; Denmark and the United States use roughly comparable
          estimates (ESS Round 9/10 for Denmark; Gallup share wanting immigration decreased for
          the United States).
        </>
      }
    >
      <Card className="border-border bg-card shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="sr-only">Anti-immigration ranking chart</CardTitle>
          <CardDescription className="sr-only">
            Horizontal bar chart ranking countries by anti-immigration intensity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AntiImmigrationChart />
          <Separator className="my-4" />
          <Swatch
            color={COLORS.anti}
            label="Want few / no immigrants from poorer countries outside Europe"
          />
        </CardContent>
      </Card>

      <RankingTable
        rows={rankedByAntiImmig.map((d) => ({
          country: d.country,
          value: `${d.antiImmig}%`,
          intensity: d.antiImmig / maxAntiImmig,
        }))}
        valueLabel="Opposition"
        color={COLORS.anti}
        badgeClassName="bg-[rgba(217,120,45,0.18)] text-[#f0b27a] hover:bg-[rgba(217,120,45,0.18)]"
      />
    </TopicPage>
  )
}
