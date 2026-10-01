/**
 * Renders a US map (counties or states) with its title, legend, and source to a PNG, laid out at
 * a fixed size so the image looks the same whatever the screen it was downloaded from.
 */

/** A choropleth shade: `pct` percent of `color`, the rest the muted background */
export function shade(color: string, pct: number) {
  return `color-mix(in oklch, ${color} ${pct}%, var(--muted))`
}

/** The palest to deepest shades a map uses, for legend bars */
export const SHADE_RANGE = [15, 100] as const

export function shadeStops(color: string) {
  return [15, 36, 58, 79, 100].map((pct) => shade(color, pct))
}

export function shadeGradient(color: string) {
  return `linear-gradient(in oklch to right, ${shade(color, SHADE_RANGE[0])}, ${shade(color, SHADE_RANGE[1])})`
}

/** Pro-immigration end of the diverging immigration-sentiment scale */
export const PRO_IMMIG_COLOR = "#2b7bb9"

/** Anti-immigration end of the diverging immigration-sentiment scale */
export const ANTI_IMMIG_COLOR = "#d32f2f"

/**
 * A two-sided shade for `t` in 0..1: `lowColor` deepest at 0, neutral at 0.5, `highColor`
 * deepest at 1.
 */
export function divergingShade(lowColor: string, highColor: string, t: number, boost = 0) {
  const side = t < 0.5 ? lowColor : highColor
  const pct = Math.round(Math.abs(t - 0.5) * 2 * 100)
  return shade(side, Math.min(100, pct + boost))
}

export function divergingStops(lowColor: string, highColor: string) {
  return [0, 0.25, 0.5, 0.75, 1].map((t) => divergingShade(lowColor, highColor, t))
}

export function divergingGradient(lowColor: string, highColor: string) {
  return `linear-gradient(in oklch to right, ${divergingStops(lowColor, highColor).join(", ")})`
}

export type ExportLegendEntry = {
  name: string
  /** The side's full group list, when `name` is a shorthand for it */
  groups?: string
  /** Legend bar stops, low end to high end, as CSS colors (may use var() and color-mix()) */
  stops: string[]
  /** Captions under the pale and deep ends of the bar */
  low: string
  high: string
}

export type MapExport = {
  title: string
  subtitle: string
  legend: ExportLegendEntry[]
  /** Show a "No data" swatch under the legend (default true) */
  noData?: boolean
  source: string
  /** Map viewBox size, in the pre-projected coordinates of `shapes` */
  mapWidth: number
  mapHeight: number
  shapes: { d: string; fill: string }[]
  /** Outline width between shapes, in output pixels (default 0.35, for counties) */
  shapeStroke?: number
  stateBorders?: string
  /** Text drawn over the map, in map coordinates */
  labels?: { x: number; y: number; text: string }[]
  fileName: string
}

const WIDTH = 1200
const PAD = 48
const SCALE = 2
const LEGEND_ITEM_WIDTH = 220
const WATERMARK = "basedmetrics.com"

// Canvas and SVG-as-image can't see the page's CSS variables, so every color is resolved to a
// concrete value first by letting the browser compute it on a probe element
function colorResolver() {
  const probe = document.createElement("span")
  probe.style.display = "none"
  document.body.appendChild(probe)
  const cache = new Map<string, string>()
  return {
    resolve(css: string) {
      let value = cache.get(css)
      if (value === undefined) {
        probe.style.color = ""
        probe.style.color = css
        value = getComputedStyle(probe).color
        cache.set(css, value)
      }
      return value
    },
    dispose: () => probe.remove(),
  }
}

function escapeAttr(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ""
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

export async function downloadMapPng(m: MapExport) {
  const colors = colorResolver()
  try {
    const background = colors.resolve("var(--background)")
    const foreground = colors.resolve("var(--foreground)")
    const muted = colors.resolve("var(--muted-foreground)")
    const border = colors.resolve("var(--border)")
    const font = getComputedStyle(document.body).fontFamily

    // Strokes are in map units: about half a pixel for counties and two for state lines
    const mapW = WIDTH - PAD * 2
    const mapH = (mapW * m.mapHeight) / m.mapWidth
    const unit = m.mapWidth / mapW
    const svg = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${m.mapWidth} ${m.mapHeight}" width="${mapW * SCALE}" height="${mapH * SCALE}">`,
      `<g stroke="${background}" stroke-width="${unit * (m.shapeStroke ?? 0.35)}" stroke-linejoin="round">`,
      ...m.shapes.map((s) => `<path d="${s.d}" fill="${escapeAttr(colors.resolve(s.fill))}"/>`),
      `</g>`,
      m.stateBorders
        ? `<path d="${m.stateBorders}" fill="none" stroke="${background}" stroke-width="${unit * 1.25}" stroke-linejoin="round"/>`
        : "",
      m.labels?.length
        ? [
            `<g font-family="${escapeAttr(font)}" font-weight="700" font-size="${unit * 12}" text-anchor="middle" dominant-baseline="middle" fill="${foreground}" stroke="${background}" stroke-width="${unit * 3}" stroke-linejoin="round" paint-order="stroke">`,
            ...m.labels.map(
              (l) => `<text x="${l.x}" y="${l.y}">${escapeAttr(l.text)}</text>`
            ),
            `</g>`,
          ].join("")
        : "",
      `</svg>`,
    ].join("")
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
    const map = await loadImage(url).finally(() => URL.revokeObjectURL(url))

    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas unavailable")

    // Lay out first (text wrapping decides the height), then size the canvas and draw
    ctx.font = `600 30px ${font}`
    const titleLines = wrap(ctx, m.title, mapW)
    ctx.font = `15px ${font}`
    const subtitleLines = wrap(ctx, m.subtitle, mapW)
    ctx.font = `13px ${font}`
    const legendItems = m.legend.map((e) => ({
      ...e,
      groupLines: e.groups ? wrap(ctx, e.groups, LEGEND_ITEM_WIDTH) : [],
    }))
    const perRow = Math.max(1, Math.floor((mapW + 24) / (LEGEND_ITEM_WIDTH + 24)))
    const rows: (typeof legendItems)[] = []
    for (let i = 0; i < legendItems.length; i += perRow) rows.push(legendItems.slice(i, i + perRow))
    const rowHeights = rows.map(
      (row) => 20 + Math.max(...row.map((e) => e.groupLines.length)) * 18 + 44
    )
    // The source shares its line with the watermark, so it wraps short of it
    ctx.font = `600 14px ${font}`
    const watermarkWidth = ctx.measureText(WATERMARK).width
    ctx.font = `12px ${font}`
    const sourceLines = wrap(ctx, m.source, mapW - watermarkWidth - 24)

    let height = PAD
    height += titleLines.length * 38 + subtitleLines.length * 22 + 20
    height += mapH + 24
    const noData = m.noData ?? true
    height += rowHeights.reduce((a, b) => a + b, 0) + (noData ? 28 : 0)
    height += 8 + sourceLines.length * 16 + PAD // source

    canvas.width = WIDTH * SCALE
    canvas.height = Math.ceil(height * SCALE)
    ctx.scale(SCALE, SCALE)
    ctx.fillStyle = background
    ctx.fillRect(0, 0, WIDTH, height)
    ctx.textBaseline = "top"

    let y = PAD
    ctx.fillStyle = foreground
    ctx.font = `600 30px ${font}`
    for (const line of titleLines) {
      ctx.fillText(line, PAD, y)
      y += 38
    }
    ctx.fillStyle = muted
    ctx.font = `15px ${font}`
    for (const line of subtitleLines) {
      ctx.fillText(line, PAD, y + 4)
      y += 22
    }
    y += 20

    ctx.drawImage(map, PAD, y, mapW, mapH)
    y += mapH + 24

    rows.forEach((row, r) => {
      // Bars share a baseline across the row, whether or not an entry lists its groups
      const barY = y + 20 + Math.max(...row.map((e) => e.groupLines.length)) * 18 + 4
      row.forEach((e, i) => {
        const x = PAD + i * (LEGEND_ITEM_WIDTH + 24)
        let ly = y
        ctx.fillStyle = foreground
        ctx.font = `600 14px ${font}`
        ctx.fillText(e.name, x, ly)
        ly += 20
        ctx.fillStyle = muted
        ctx.font = `13px ${font}`
        for (const line of e.groupLines) {
          ctx.fillText(line, x, ly)
          ly += 18
        }
        ly = barY
        const gradient = ctx.createLinearGradient(x, 0, x + LEGEND_ITEM_WIDTH, 0)
        e.stops.forEach((stop, s) =>
          gradient.addColorStop(s / (e.stops.length - 1), colors.resolve(stop))
        )
        ctx.fillStyle = gradient
        ctx.fillRect(x, ly, LEGEND_ITEM_WIDTH, 12)
        ctx.strokeStyle = border
        ctx.lineWidth = 1
        ctx.strokeRect(x + 0.5, ly + 0.5, LEGEND_ITEM_WIDTH - 1, 11)
        ly += 18
        ctx.fillStyle = muted
        ctx.font = `12px ${font}`
        ctx.fillText(e.low, x, ly)
        ctx.textAlign = "right"
        ctx.fillText(e.high, x + LEGEND_ITEM_WIDTH, ly)
        ctx.textAlign = "left"
      })
      y += rowHeights[r]
    })

    if (noData) {
      ctx.fillStyle = border
      ctx.fillRect(PAD, y, 12, 12)
      ctx.fillStyle = muted
      ctx.font = `13px ${font}`
      ctx.fillText("No data", PAD + 20, y)
      y += 28
    }

    y += 8
    ctx.fillStyle = foreground
    ctx.font = `600 14px ${font}`
    ctx.textAlign = "right"
    ctx.fillText(WATERMARK, WIDTH - PAD, y - 1)
    ctx.textAlign = "left"

    ctx.fillStyle = muted
    ctx.font = `12px ${font}`
    for (const line of sourceLines) {
      ctx.fillText(line, PAD, y)
      y += 16
    }

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
    if (!blob) throw new Error("PNG encoding failed")
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = m.fileName
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000)
  } finally {
    colors.dispose()
  }
}
