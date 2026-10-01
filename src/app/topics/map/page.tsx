import type { Metadata } from "next"

import { EuropeMap } from "@/components/europe-map"
import { EuropeRegionMap } from "@/components/europe-region-map"
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
          map). Colors are scaled to the range across the countries on the map, and median age
          runs from oldest to youngest. Pick each scale&apos;s colors below the map, or download
          the current view as a PNG. Sources for each metric are listed on its topic page.
        </>
      }
    >
      <EuropeMap />

      <header className="mt-12 mb-7">
        <h2 className="section-title">Origin and religion by region</h2>
        <p className="section-sub">
          Where residents of nearly 1,200 regions across 31 countries were born, from the 2021 census — Europe&apos;s counterpart to the US county
          ethnicity map. Pick origins to shade by their share, or show each region&apos;s largest
          foreign-born group; hover a region for its full breakdown and top countries of birth.
          Switch to religion for the 19 countries that record it regionally, from national
          censuses and church registers — many, including France, Spain, Italy, and Sweden,
          don&apos;t, and church registers can only tell members from non-members.
        </p>
      </header>
      <EuropeRegionMap />
    </TopicPage>
  )
}
