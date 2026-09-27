import type { Metadata } from "next"

import { MarketCapChart } from "@/components/market-cap-chart"
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
  demographicsData,
  formatMarketCap,
  marketCapIntensity,
  maxMarketCap,
  rankedByMarketCap,
} from "@/lib/demographics"
import { topicMetadata } from "@/lib/topics"

export const metadata: Metadata = topicMetadata("market-cap")

export default function MarketCapPage() {
  return (
    <TopicPage
      title="Economy size by market capitalization"
      description={
        <>
          Domestic listed equity market capitalization for {demographicsData.length} countries —
          a proxy for financial-market scale. Chart uses a log scale so smaller European markets
          remain readable next to the United States.
        </>
      }
      notes={
        <>
          Market capitalization is total listed domestic equity (approx. 2026 figures from
          compiled World Bank / exchange statistics); definitions of “domestic” listings and
          reporting years differ by country.
        </>
      }
    >
      <Card className="border-border bg-card shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="sr-only">Market capitalization ranking chart</CardTitle>
          <CardDescription className="sr-only">
            Horizontal bar chart ranking countries by stock market capitalization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MarketCapChart />
          <Separator className="my-4" />
          <Swatch
            color={COLORS.marketCap}
            label="Stock market capitalization (listed domestic companies)"
          />
        </CardContent>
      </Card>

      <RankingTable
        rows={rankedByMarketCap.map((d) => ({
          country: d.country,
          value: formatMarketCap(d.marketCap),
          intensity: marketCapIntensity(d.marketCap, maxMarketCap),
        }))}
        valueLabel="Market cap"
        intensityLabel="Relative size"
        color={COLORS.marketCap}
        badgeClassName="bg-[rgba(45,184,138,0.18)] text-[#7eecc0] hover:bg-[rgba(45,184,138,0.18)]"
      />
    </TopicPage>
  )
}
