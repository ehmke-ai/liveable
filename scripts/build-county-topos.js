// Generator for public/geo/<abbr>-counties-10m.json (one per state with a county map).
// Filters us-atlas's full US counties topology down to each state's FIPS prefix and
// re-topologizes so only the arcs that state's own counties need are kept.
// Run with: node scripts/build-county-topos.js
const fs = require("fs")
const path = require("path")
const topojsonClient = require("topojson-client")
const topojsonServer = require("topojson-server")

const usCounties = require("us-atlas/counties-10m.json")
const countiesByAbbr = Object.fromEntries(
  fs
    .readdirSync(path.join(__dirname, "..", "src", "data", "counties"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => [
      f.replace(".json", ""),
      require(path.join(__dirname, "..", "src", "data", "counties", f)),
    ])
)

const featureCollection = topojsonClient.feature(usCounties, usCounties.objects.counties)

for (const [abbr, counties] of Object.entries(countiesByAbbr)) {
  const prefix = counties[0].fips.slice(0, 2)
  const features = featureCollection.features.filter((f) => String(f.id).startsWith(prefix))
  const dataFips = new Set(counties.map((c) => c.fips))
  const shapeFips = new Set(features.map((f) => String(f.id)))
  const noData = [...shapeFips].filter((f) => !dataFips.has(f))
  const noShape = [...dataFips].filter((f) => !shapeFips.has(f))

  const topology = topojsonServer.topology({ counties: { type: "FeatureCollection", features } }, 1e5)
  const outPath = path.join(__dirname, "..", "public", "geo", `${abbr}-counties-10m.json`)
  fs.writeFileSync(outPath, JSON.stringify(topology))
  const size = (fs.statSync(outPath).size / 1024).toFixed(0)
  const mismatch = noData.length || noShape.length ? `  shapes w/o data: ${noData}  data w/o shape: ${noShape}` : ""
  console.log(`${abbr}: ${features.length} counties, ${size} KB${mismatch}`)
}
