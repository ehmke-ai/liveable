import { AntiImmigrationChart } from "@/components/anti-immigration-chart"
import { DemographicsBarChart } from "@/components/demographics-bar-chart"
import { DemographicsDataTable } from "@/components/demographics-data-table"
import { EuropeMap } from "@/components/europe-map"
import { MarketCapChart } from "@/components/market-cap-chart"
import { MedianAgeChart } from "@/components/median-age-chart"
import { NativePopulationChart } from "@/components/native-population-chart"
import { NativeShareTrendChart } from "@/components/native-share-trend-chart"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  COLORS,
  demographicsData,
  formatMarketCap,
  formatMedianAge,
  mapDemographicsData,
  marketCapIntensity,
  maxAntiImmig,
  maxMarketCap,
  maxMedianAge,
  maxNative,
  medianAgeYouthIntensity,
  minMedianAge,
  rankedByAntiImmig,
  rankedByMarketCap,
  rankedByMedianAge,
  rankedByNative,
} from "@/lib/demographics"

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <i
        className="inline-block size-3.5 rounded-[3px]"
        style={{ background: color }}
        aria-hidden
      />
      {label}
    </span>
  )
}

export default function HomePage() {
  const countryCount = demographicsData.length
  const mapCountryCount = mapDemographicsData.length

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6">
      <header className="mb-7">
        <h1 className="mb-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Europe demographics map
        </h1>
        <p className="max-w-xl text-base text-muted-foreground leading-relaxed">
          Interactive choropleth for {mapCountryCount} European countries — switch metrics,
          hover for a preview, and click a country for the full breakdown.
        </p>
      </header>

      <Card className="border-border bg-card shadow-none">
        <CardContent className="pt-6">
          <EuropeMap />
        </CardContent>
      </Card>

      <header className="mt-12 mb-7">
        <h1 className="mb-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Native / white &amp; Christian share
        </h1>
        <p className="max-w-xl text-base text-muted-foreground leading-relaxed">
          Approximate percentages for {countryCount} countries — native/white population share
          vs. Catholic, Protestant, and Orthodox affiliation.
        </p>
      </header>

      <Card className="border-border bg-card shadow-none">
        <CardContent className="pt-6">
          <DemographicsBarChart />
          <Separator className="my-4" />
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Swatch color={COLORS.native} label="Native / white (approx.)" />
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

      <header className="mt-12 mb-7">
        <h1 className="mb-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Native / white population ranking
        </h1>
        <p className="max-w-xl text-base text-muted-foreground leading-relaxed">
          Countries ranked by approximate native / white population share. Higher = larger
          ethnic European / autochthonous share.
        </p>
      </header>

      <Card className="border-border bg-card shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="sr-only">Native / white population ranking chart</CardTitle>
          <CardDescription className="sr-only">
            Horizontal bar chart ranking countries by native / white population share
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NativePopulationChart />
          <Separator className="my-4" />
          <Swatch color={COLORS.native} label="Native / white population share (approx.)" />
        </CardContent>
      </Card>

      <Card className="mt-7 border-border bg-card shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Rank</TableHead>
                <TableHead>Country</TableHead>
                <TableHead className="text-right">Share</TableHead>
                <TableHead className="min-w-[8rem]">Intensity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankedByNative.map((row, i) => (
                <TableRow key={row.country}>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className="min-w-7 justify-center rounded-full bg-[rgba(255,255,255,0.18)] text-[#e8edf5] hover:bg-[rgba(255,255,255,0.18)]"
                    >
                      {i + 1}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{row.country}</TableCell>
                  <TableCell
                    className="text-right font-medium tabular-nums"
                    style={{ color: COLORS.native }}
                  >
                    {row.native}%
                  </TableCell>
                  <TableCell>
                    <span
                      className="block h-2 min-w-24 overflow-hidden rounded-full bg-[#1a1a1a]"
                      aria-hidden
                    >
                      <span
                        className="block h-full rounded-full bg-white"
                        style={{ width: `${(row.native / maxNative) * 100}%` }}
                      />
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <header className="mt-12 mb-7">
        <h1 className="mb-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Native / white share over time
        </h1>
        <p className="max-w-xl text-base text-muted-foreground leading-relaxed">
          Approximate native / white population share from 1960 to 2025 for a selected
          country. Use the dropdown to compare trends across countries.
        </p>
      </header>

      <Card className="border-border bg-card shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="sr-only">Native / white share trend chart</CardTitle>
          <CardDescription className="sr-only">
            Line chart of native / white population share over time for the selected country
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NativeShareTrendChart />
          <Separator className="my-4" />
          <Swatch color={COLORS.native} label="Native / white population share (approx.)" />
        </CardContent>
      </Card>

      <header className="mt-12 mb-7">
        <h1 className="mb-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Anti-immigration intensity ranking
        </h1>
        <p className="max-w-xl text-base text-muted-foreground leading-relaxed">
          Countries ranked by opposition to immigration from poorer countries outside Europe
          (ESS 2023 for Europe; ESS Round 9/10 for Denmark; Gallup for the United States).
          Higher = more opposition.
        </p>
      </header>

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

      <Card className="mt-7 border-border bg-card shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Rank</TableHead>
                <TableHead>Country</TableHead>
                <TableHead className="text-right">Opposition</TableHead>
                <TableHead className="min-w-[8rem]">Intensity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankedByAntiImmig.map((row, i) => (
                <TableRow key={row.country}>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className="min-w-7 justify-center rounded-full bg-[rgba(217,120,45,0.18)] text-[#f0b27a] hover:bg-[rgba(217,120,45,0.18)]"
                    >
                      {i + 1}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{row.country}</TableCell>
                  <TableCell
                    className="text-right font-medium tabular-nums"
                    style={{ color: COLORS.anti }}
                  >
                    {row.antiImmig}%
                  </TableCell>
                  <TableCell>
                    <span
                      className="block h-2 min-w-24 overflow-hidden rounded-full bg-[#1a1a1a]"
                      aria-hidden
                    >
                      <span
                        className="block h-full rounded-full bg-[#d9782d]"
                        style={{ width: `${(row.antiImmig / maxAntiImmig) * 100}%` }}
                      />
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <header className="mt-12 mb-7">
        <h1 className="mb-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Economy size by market capitalization
        </h1>
        <p className="max-w-xl text-base text-muted-foreground leading-relaxed">
          Domestic listed equity market capitalization for {countryCount} countries — a proxy
          for financial-market scale. Chart uses a log scale so smaller European markets remain
          readable next to the United States.
        </p>
      </header>

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

      <Card className="mt-7 border-border bg-card shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Rank</TableHead>
                <TableHead>Country</TableHead>
                <TableHead className="text-right">Market cap</TableHead>
                <TableHead className="min-w-[8rem]">Relative size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankedByMarketCap.map((row, i) => (
                <TableRow key={row.country}>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className="min-w-7 justify-center rounded-full bg-[rgba(45,184,138,0.18)] text-[#7eecc0] hover:bg-[rgba(45,184,138,0.18)]"
                    >
                      {i + 1}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{row.country}</TableCell>
                  <TableCell
                    className="text-right font-medium tabular-nums"
                    style={{ color: COLORS.marketCap }}
                  >
                    {formatMarketCap(row.marketCap)}
                  </TableCell>
                  <TableCell>
                    <span
                      className="block h-2 min-w-24 overflow-hidden rounded-full bg-[#1a1a1a]"
                      aria-hidden
                    >
                      <span
                        className="block h-full rounded-full bg-[#2db88a]"
                        style={{
                          width: `${marketCapIntensity(row.marketCap, maxMarketCap) * 100}%`,
                        }}
                      />
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <header className="mt-12 mb-7">
        <h1 className="mb-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Native / white age ranking
        </h1>
        <p className="max-w-xl text-base text-muted-foreground leading-relaxed">
          Countries ranked by median age of the native / white population. Lower = younger
          native age structure — younger ranks higher.
        </p>
      </header>

      <Card className="border-border bg-card shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="sr-only">Native / white median age ranking chart</CardTitle>
          <CardDescription className="sr-only">
            Horizontal bar chart ranking countries by native / white median age, youngest first
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MedianAgeChart />
          <Separator className="my-4" />
          <Swatch
            color={COLORS.medianAge}
            label="Native / white median age (years) — younger ranks higher"
          />
        </CardContent>
      </Card>

      <Card className="mt-7 border-border bg-card shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Rank</TableHead>
                <TableHead>Country</TableHead>
                <TableHead className="text-right">Native median age</TableHead>
                <TableHead className="min-w-[8rem]">Youth intensity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankedByMedianAge.map((row, i) => (
                <TableRow key={row.country}>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className="min-w-7 justify-center rounded-full bg-[rgba(88,160,200,0.18)] text-[#9ecce8] hover:bg-[rgba(88,160,200,0.18)]"
                    >
                      {i + 1}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{row.country}</TableCell>
                  <TableCell
                    className="text-right font-medium tabular-nums"
                    style={{ color: COLORS.medianAge }}
                  >
                    {formatMedianAge(row.medianAge)} yrs
                  </TableCell>
                  <TableCell>
                    <span
                      className="block h-2 min-w-24 overflow-hidden rounded-full bg-[#1a1a1a]"
                      aria-hidden
                    >
                      <span
                        className="block h-full rounded-full bg-[#58a0c8]"
                        style={{
                          width: `${medianAgeYouthIntensity(row.medianAge, minMedianAge, maxMedianAge) * 100}%`,
                        }}
                      />
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <footer className="mt-6 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        <strong className="font-semibold text-foreground">Notes:</strong> Most countries do
        not publish official “race” statistics. “Native / white” uses approximate ethnic
        European / autochthonous shares. Catholic, Protestant, and Orthodox figures use recent
        church membership or self-identification (fowid/DBK/EKD for Germany, Statistik Austria
        for Austria, FSO for Switzerland, CBS for Netherlands, SSB / Church of Norway, Church
        of Sweden, Church of Denmark / Statistics Denmark, Polish census, Ipsos/CESNUR for
        Italy, Ifop/INSEE for France, CSO Census 2022 for Ireland, Pew Religious Landscape
        Study 2023–24 for the United States). Native / autochthonous share for the United
        States uses Census Bureau non-Hispanic White share (2023). The United States appears
        in the charts and tables only (not on the Europe map). Anti-immigration intensity uses
        ESS 2023 share answering “allow a few” or “allow none” for immigrants from poorer
        countries outside Europe (RFBerlin / ESS Round 11) for European countries; Denmark and
        the United States use roughly comparable estimates (ESS Round 9/10 for Denmark; Gallup
        share wanting immigration decreased for the United States). Market capitalization is
        total listed domestic equity (approx. 2026 figures from compiled World Bank / exchange
        statistics); definitions of “domestic” listings and reporting years differ by country.
        Map coloring for market cap is log-scaled within European countries only. Native /
        white median age uses Eurostat “born in reporting country” figures for 1 January 2025
        for European countries (a proxy where race statistics are not published); the United
        States uses Census Bureau non-Hispanic White alone median age (July 2024). Map coloring
        for median age is inverted within European countries (younger = stronger). The native /
        white share over-time series is an approximate reconstruction ending at the snapshot
        shares above (Census non-Hispanic White alone for the United States; ethnic European /
        autochthonous proxies for Europe). Values are rounded for comparison; years and
        definitions differ by country.
      </footer>
    </main>
  )
}
