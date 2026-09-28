// One-off generator for public/geo/tx-counties-10m.json.
// Filters us-atlas's full US counties topology down to Texas (FIPS state prefix "48")
// and re-topologizes so only the arcs Texas's own counties need are kept.
// Run with: node scripts/build-tx-counties-topo.js
const fs = require("fs")
const path = require("path")
const topojsonClient = require("topojson-client")
const topojsonServer = require("topojson-server")

const usCounties = require("us-atlas/counties-10m.json")

const featureCollection = topojsonClient.feature(usCounties, usCounties.objects.counties)
const txFeatures = featureCollection.features.filter((f) => String(f.id).startsWith("48"))

console.log(`Texas counties found: ${txFeatures.length}`)

const txTopology = topojsonServer.topology(
  { counties: { type: "FeatureCollection", features: txFeatures } },
  1e5
)

const outPath = path.join(__dirname, "..", "public", "geo", "tx-counties-10m.json")
fs.writeFileSync(outPath, JSON.stringify(txTopology))
console.log(`Wrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`)
