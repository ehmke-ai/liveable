import Link from "next/link"

import { DemographicsBarChart } from "@/components/demographics-bar-chart"
import { DemographicsDataTable } from "@/components/demographics-data-table"
import { Swatch, TopicPage } from "@/components/topic-page"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { COLORS, demographicsData } from "@/lib/demographics"
import { HOME_TOPIC, topicHref, topics } from "@/lib/topics"

export default function HomePage() {
  return (
    <TopicPage
      title="Explore by topic"
      description="Demographic, religious, political, and economic indicators for European countries and the United States."
      notes={
        <>
          Most countries do not publish official “race” statistics. “Native / European” uses
          approximate ethnic European / autochthonous shares; the United States uses Census
          Bureau non-Hispanic White share (2023). Catholic, Protestant, and Orthodox figures use
          recent church membership or self-identification (fowid/DBK/EKD for Germany, Statistik
          Austria for Austria, FSO for Switzerland, CBS for Netherlands, SSB / Church of Norway,
          Church of Sweden, Church of Denmark / Statistics Denmark, Polish census, Ipsos/CESNUR
          for Italy, Ifop/INSEE for France, CSO Census 2022 for Ireland, Pew Religious Landscape
          Study 2023–24 for the United States).
        </>
      }
    >
      <nav aria-label="Topics">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topics
            .filter((t) => t.slug !== HOME_TOPIC)
            .map((t) => (
              <Link key={t.slug} href={topicHref(t.slug)} className="group">
                <Card className="h-full border-border bg-card shadow-none transition-colors group-hover:bg-muted/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <t.icon className="size-4 shrink-0 text-muted-foreground" />
                      {t.label}
                    </CardTitle>
                    <CardDescription>{t.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
        </div>
      </nav>

      <header className="mt-12 mb-7">
        <h2 className="section-title">
          Native / European &amp; Christian share
        </h2>
        <p className="section-sub">
          Approximate percentages for {demographicsData.length} countries — native/european
          population share vs. Catholic, Protestant, and Orthodox affiliation.
        </p>
      </header>

      <Card className="border-border bg-card shadow-none">
        <CardContent className="pt-6">
          <DemographicsBarChart />
          <Separator className="my-4" />
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Swatch color={COLORS.native} label="Native / European (approx.)" />
            <Swatch color={COLORS.catholic} label="Catholic" />
            <Swatch color={COLORS.protestant} label="Protestant" />
            <Swatch color={COLORS.orthodox} label="Orthodox" />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-7 border-border bg-card shadow-none">
        <CardContent className="p-0">
          <DemographicsDataTable />
        </CardContent>
      </Card>
    </TopicPage>
  )
}
