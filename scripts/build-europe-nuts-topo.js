// Generator for public/geo/europe-nuts3-20m.json, the shapes for the Europe regions map.
// Takes Eurostat GISCO's NUTS 2021 boundaries at 1:20 million (via eurostat/Nuts2json) and keeps
// the NUTS 3 regions that have data in public/data/europe-region-origin.json ("regions"), plus
// every country outline ("countries") to draw the rest of Europe as context.
// Run after scripts/build-europe-origin.py with: node scripts/build-europe-nuts-topo.js
const fs = require("fs")
const path = require("path")
const topojsonClient = require("topojson-client")
const topojsonServer = require("topojson-server")

const SOURCE = "https://raw.githubusercontent.com/eurostat/Nuts2json/master/pub/v2/2021/4326/20M/3.json"
const CACHE = path.join(__dirname, ".cache", "nuts2json-2021-4326-20M-3.json")
const DATA = path.join(__dirname, "..", "public", "data", "europe-region-origin.json")
const OUT = path.join(__dirname, "..", "public", "geo", "europe-nuts3-20m.json")

async function source() {
  if (!fs.existsSync(CACHE)) {
    fs.mkdirSync(path.dirname(CACHE), { recursive: true })
    const res = await fetch(SOURCE)
    if (!res.ok) throw new Error(`${SOURCE}: ${res.status}`)
    fs.writeFileSync(CACHE, await res.text())
  }
  return JSON.parse(fs.readFileSync(CACHE, "utf8"))
}

// Nuts2json keeps the code and name in properties; the map wants the code as the feature id
function features(topology, object, keep = () => true) {
  return topojsonClient
    .feature(topology, topology.objects[object])
    .features.filter((f) => keep(f.properties.id))
    .map((f) => ({ type: "Feature", id: f.properties.id, properties: { name: f.properties.na }, geometry: f.geometry }))
}

async function main() {
  const nuts = await source()
  const dataIds = new Set(Object.keys(JSON.parse(fs.readFileSync(DATA, "utf8")).regions))
  const regions = features(nuts, "nutsrg", (id) => dataIds.has(id))
  const countries = features(nuts, "cntrg")

  const shapeIds = new Set(regions.map((f) => f.id))
  const noShape = [...dataIds].filter((id) => !shapeIds.has(id))

  const topology = topojsonServer.topology(
    {
      regions: { type: "FeatureCollection", features: regions },
      countries: { type: "FeatureCollection", features: countries },
    },
    1e5
  )
  fs.writeFileSync(OUT, JSON.stringify(topology))
  const size = (fs.statSync(OUT).size / 1024).toFixed(0)
  console.log(`${regions.length} regions, ${countries.length} countries, ${size} KB`)
  if (noShape.length) console.log(`data w/o shape: ${noShape.join(" ")}`)
}

main()
