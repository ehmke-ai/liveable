import type { Metadata } from "next"

import { EuropeMap } from "@/components/europe-map"
import { TopicPage } from "@/components/topic-page"
import { mapDemographicsData } from "@/lib/demographics"
import { topicMetadata } from "@/lib/topics"

export const metadata: Metadata = topicMetadata("map")

export default function MapPage() {
  return (
    <TopicPage
      title="The Europe Map"
      description={
        <>
          Interactive choropleth for {mapDemographicsData.length} European countries — switch
          metrics, hover for a preview, and click a country for the full breakdown.
        </>
      }
      notes={
        <>
          The United States appears in the topic charts and tables only (not on the Europe
          map). Map coloring for market cap is log-scaled within European countries only, and
          coloring for median age is inverted within European countries (younger = stronger).
          Sources for each metric are listed on its topic page.
        </>
      }
    >
      <EuropeMap />
    </TopicPage>
  )
}
