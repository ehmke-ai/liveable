import type { Metadata } from "next"

import { StatesDataTable, type StateTableRow } from "@/components/states-data-table"
import { TopicPage } from "@/components/topic-page"
import { Card, CardContent } from "@/components/ui/card"
import { getStateBySlug } from "@/lib/state-data"
import {
  election2024Margin,
  ENFORCEMENT_TIER_LABELS,
  stateMapData,
  stateNavByAbbr,
  statePriceToIncome,
} from "@/lib/states"

export const metadata: Metadata = {
  title: "All states",
  description:
    "Every US state side by side: non-Hispanic White share, foreign-born share, 2024 margin, immigration enforcement, family formation, and cost of living.",
}

function stateRows(): StateTableRow[] {
  return stateMapData.flatMap((m) => {
    const slug = stateNavByAbbr[m.abbr].slug
    const state = getStateBySlug(slug)
    if (!state) return []
    return [
      {
        state: m.state,
        slug,
        population: state.population,
        native: m.native,
        foreignBorn: state.foreignBorn,
        margin2024: election2024Margin(m),
        enforcementScore: m.enforcementScore,
        enforcementTier: ENFORCEMENT_TIER_LABELS[m.enforcementTier],
        antiImmig: m.antiImmig,
        thirtyMarriedHomeowner: m.thirtyMarriedHomeowner,
        medianAge: state.medianAge,
        rpp: m.cost.rpp,
        medianIncome: m.cost.medianIncome,
        priceToIncome: statePriceToIncome(m),
        medianRent: m.cost.medianRent,
      },
    ]
  })
}

export default function StatesPage() {
  return (
    <TopicPage
      eyebrow="United States"
      title="All states"
      description="Every state and DC side by side. Click a column to sort, or a state for its full profile and county map."
      notes={
        <>
          Non-Hispanic White is Census Vintage 2025 estimates less Arab ancestry. 2024 margin is
          Trump minus Harris share of the certified statewide popular vote. Enforcement score is
          the ILRC State Map on Immigration Enforcement average (1 = most ICE cooperation, 5 =
          most protective; hover for the tier). &ldquo;Immigration threatens values&rdquo; is
          PRRI&rsquo;s 2015 American Values Atlas. Married homeowner at 30 is estimated from ACS
          2024 1-year tables. Price level is the BEA Regional Price Parity for 2024 (US = 100);
          median income, home value, and rent are ACS 2020–2024 5-year medians.
        </>
      }
    >
      <Card className="border-border bg-card shadow-none">
        <CardContent className="p-0">
          <StatesDataTable rows={stateRows()} />
        </CardContent>
      </Card>
    </TopicPage>
  )
}
