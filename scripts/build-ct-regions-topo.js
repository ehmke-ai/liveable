// Generator for public/geo/ct-planning-regions-albers.json and ct-planning-regions-10m.json:
// Connecticut's nine planning regions, which replaced its counties as county-equivalents in
// 2022. The Demographics map (albers) and the Connecticut county map (unprojected, like
// ct-counties-10m.json) draw them in place of CT's old counties for years whose data is keyed
// by region (2025).
//
// Source: Census TIGERweb generalized 1:500,000 counties (the same cartographic series
// us-atlas is built from), projected exactly like us-atlas's albers files so the regions sit
// in the same 975×610 space as counties-albers-10m.json.
// Run with: node scripts/build-ct-regions-topo.js
const fs = require("fs")
const path = require("path")
const { geoAlbersUsa } = require("d3-geo")
const topojsonServer = require("topojson-server")
const topojsonSimplify = require("topojson-simplify")

const SOURCE =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/Generalized_ACS2024/State_County/MapServer/11/query" +
  "?where=STATE%3D%2709%27&outFields=GEOID,NAME&outSR=4326&f=geojson"

const projection = geoAlbersUsa().scale(1300).translate([487.5, 305])

function projectCoords(coords) {
  return typeof coords[0] === "number" ? projection(coords) : coords.map(projectCoords)
}

function rewind(coords) {
  return typeof coords[0][0] === "number" ? [...coords].reverse() : coords.map(rewind)
}

async function main() {
  const res = await fetch(SOURCE)
  if (!res.ok) throw new Error(`TIGERweb ${res.status}`)
  const collection = await res.json()

  // Unprojected longitude/latitude for the state page's map, which fits its own projection.
  // GeoJSON rings run counter-clockwise but d3-geo's spherical ones run clockwise, so reverse
  // them or each region would draw as the whole globe minus the region.
  const lonLat = collection.features.map((f) => ({
    type: "Feature",
    id: f.properties.GEOID,
    properties: { name: f.properties.NAME },
    geometry: { type: f.geometry.type, coordinates: rewind(f.geometry.coordinates) },
  }))
  const lonLatPath = path.join(__dirname, "..", "public", "geo", "ct-planning-regions-10m.json")
  fs.writeFileSync(
    lonLatPath,
    JSON.stringify(topojsonServer.topology({ counties: { type: "FeatureCollection", features: lonLat } }, 1e5))
  )
  console.log(`${lonLat.length} planning regions, ${(fs.statSync(lonLatPath).size / 1024).toFixed(0)} KB -> public/geo/ct-planning-regions-10m.json`)

  const features = collection.features.map((f) => ({
    type: "Feature",
    id: f.properties.GEOID,
    properties: { name: f.properties.NAME },
    geometry: { type: f.geometry.type, coordinates: projectCoords(f.geometry.coordinates) },
  }))

  let topology = topojsonServer.topology({ regions: { type: "FeatureCollection", features } }, 1e5)
  // Planar area threshold in square pixels of the 975×610 viewport, fine enough that the
  // outer border still lines up with us-atlas's neighboring states
  topology = topojsonSimplify.simplify(topojsonSimplify.presimplify(topology), 0.02)

  const outPath = path.join(__dirname, "..", "public", "geo", "ct-planning-regions-albers.json")
  fs.writeFileSync(outPath, JSON.stringify(topology))
  const size = (fs.statSync(outPath).size / 1024).toFixed(0)
  console.log(`${features.length} planning regions, ${size} KB -> public/geo/ct-planning-regions-albers.json`)
  for (const f of features) console.log(`  ${f.id} ${f.properties.name}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
